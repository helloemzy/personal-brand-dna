import { store } from '../store';
import { workshopAPI } from './workshopAPI';
import type { WorkshopState } from '../store/slices/workshopSlice';
import { logger } from '../utils/logger';

// Persistence layer types
interface PersistenceLayer {
  save: (data: WorkshopState) => Promise<void>;
  load: () => Promise<WorkshopState | null>;
  clear: () => Promise<void>;
}

interface OfflineQueueItem {
  id: string;
  timestamp: number;
  data: WorkshopState;
  retryCount: number;
  maxRetries: number;
}

interface ConflictResolution {
  strategy: 'local-first' | 'remote-first' | 'merge';
  resolver?: (local: WorkshopState, remote: WorkshopState) => WorkshopState;
}

// Constants
const LOCALSTORAGE_KEY = 'workshop-persistence';
const OFFLINE_QUEUE_KEY = 'workshop-offline-queue';
const DEBOUNCE_DELAY = 1000; // 1 second
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Workshop Persistence Service
 * Implements a three-layer persistence strategy with automatic recovery
 */
class WorkshopPersistenceService {
  private static instance: WorkshopPersistenceService;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private offlineQueue: OfflineQueueItem[] = [];
  private isOnline: boolean = navigator.onLine;
  private conflictResolution: ConflictResolution = { strategy: 'local-first' };

  // Persistence layers
  private reduxLayer: PersistenceLayer;
  private localStorageLayer: PersistenceLayer;
  private databaseLayer: PersistenceLayer;

  private constructor() {
    // Initialize persistence layers
    this.reduxLayer = this.createReduxLayer();
    this.localStorageLayer = this.createLocalStorageLayer();
    this.databaseLayer = this.createDatabaseLayer();

    // Setup event listeners
    this.setupEventListeners();
    
    // Load offline queue from storage
    this.loadOfflineQueue();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WorkshopPersistenceService {
    if (!WorkshopPersistenceService.instance) {
      WorkshopPersistenceService.instance = new WorkshopPersistenceService();
    }
    return WorkshopPersistenceService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (WorkshopPersistenceService.instance) {
      // Clear any active timers before resetting
      const instance = WorkshopPersistenceService.instance;
      if (instance.saveDebounceTimer) {
        clearTimeout(instance.saveDebounceTimer);
        instance.saveDebounceTimer = null;
      }
    }
    WorkshopPersistenceService.instance = undefined as any;
  }

  /**
   * Redux persistence layer
   */
  private createReduxLayer(): PersistenceLayer {
    return {
      save: async (data: WorkshopState) => {
        // Import the actions dynamically to avoid circular dependencies
        const { loadWorkshopState } = await import('../store/slices/workshopSlice');
        store.dispatch(loadWorkshopState(data));
      },
      load: async () => {
        const state = store.getState();
        return state.workshop || null;
      },
      clear: async () => {
        // Import the actions dynamically to avoid circular dependencies
        const { resetWorkshop } = await import('../store/slices/workshopSlice');
        store.dispatch(resetWorkshop());
      },
    };
  }

  /**
   * LocalStorage persistence layer
   */
  private createLocalStorageLayer(): PersistenceLayer {
    return {
      save: async (data: WorkshopState) => {
        try {
          const serialized = JSON.stringify({
            data,
            timestamp: Date.now(),
            version: '1.0',
          });
          localStorage.setItem(LOCALSTORAGE_KEY, serialized);
        } catch (error) {
          logger.error('LocalStorage save failed:', error);
          throw error;
        }
      },
      load: async () => {
        try {
          const item = localStorage.getItem(LOCALSTORAGE_KEY);
          if (!item) return null;

          const parsed = JSON.parse(item);
          // Check if data is not too old (24 hours)
          const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
          
          return isExpired ? null : parsed.data;
        } catch (error) {
          logger.error('LocalStorage load failed:', error);
          return null;
        }
      },
      clear: async () => {
        localStorage.removeItem(LOCALSTORAGE_KEY);
      },
    };
  }

  /**
   * Database persistence layer
   */
  private createDatabaseLayer(): PersistenceLayer {
    return {
      save: async (data: WorkshopState) => {
        if (!data.sessionId) {
          throw new Error('Cannot save to database without session ID');
        }

        try {
          // Convert workshop state to API format
          const stepData = {
            values: data.values,
            toneSettings: data.tonePreferences,
            audiences: data.audiencePersonas,
            writingSample: data.writingSample?.text || null,
            quizResponses: data.personalityQuiz.responses,
          };

          await workshopAPI.saveProgress({
            sessionId: data.sessionId,
            step: data.currentStep,
            stepData: stepData,
          });
        } catch (error) {
          logger.error('Database save failed:', error);
          // Add to offline queue if save fails
          this.addToOfflineQueue(data);
          throw error;
        }
      },
      load: async () => {
        try {
          // Get the most recent session
          const sessionsResponse = await workshopAPI.getSessions();
          const sessions = sessionsResponse.data.sessions;
          
          if (!sessions || sessions.length === 0) {
            return null;
          }

          // Get the most recent incomplete session
          const recentSession = sessions.find(s => !s.completed) || sessions[0];
          
          if (!recentSession) {
            return null;
          }

          const sessionResponse = await workshopAPI.getSession(recentSession.id);
          const session = sessionResponse.data.session;

          // Convert database format to WorkshopState
          const stepData = session.data || {};
          
          return {
            // Navigation
            currentStep: session.step as 1 | 2 | 3 | 4 | 5,
            completedSteps: stepData.completedSteps || [],
            isCompleted: session.completed,
            
            // Assessment
            assessmentScore: stepData.assessmentScore || null,
            workshopPath: stepData.workshopPath || null,
            
            // Timing
            startedAt: session.createdAt,
            lastSavedAt: session.updatedAt,
            completedAt: session.completed ? session.updatedAt : null,
            
            // Step data
            values: stepData.values || {
              selected: [],
              custom: [],
              rankings: {},
              primary: [],
              aspirational: [],
              stories: {}
            },
            tonePreferences: stepData.toneSettings || {
              formal_casual: 0,
              concise_detailed: 0,
              analytical_creative: 0,
              serious_playful: 0
            },
            audiencePersonas: stepData.audiences || [],
            writingSample: stepData.writingSample ? {
              text: stepData.writingSample,
              wordCount: stepData.writingSample.split(/\s+/).length,
              uploadedAt: session.updatedAt,
            } : null,
            personalityQuiz: {
              responses: stepData.quizResponses || [],
              currentQuestionIndex: stepData.quizResponses?.length || 0,
            },
            
            // Meta
            sessionId: session.id,
            isSaving: false,
            lastError: null,
          };
        } catch (error) {
          logger.error('Database load failed:', error);
          return null;
        }
      },
      clear: async () => {
        // Database clear is handled by deleting the session
        // This is a no-op for now
      },
    };
  }

  /**
   * Setup event listeners for online/offline detection
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Save before page unload
    window.addEventListener('beforeunload', () => {
      this.saveImmediately();
    });
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue(): void {
    try {
      const queueData = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
        // Process queue if online
        if (this.isOnline) {
          this.processOfflineQueue();
        }
      }
    } catch (error) {
      logger.error('Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Save offline queue to localStorage
   */
  private saveOfflineQueue(): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      logger.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Add item to offline queue
   */
  private addToOfflineQueue(data: WorkshopState): void {
    const item: OfflineQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      data,
      retryCount: 0,
      maxRetries: MAX_RETRY_ATTEMPTS,
    };

    this.offlineQueue.push(item);
    this.saveOfflineQueue();
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return;
    }

    const itemsToProcess = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of itemsToProcess) {
      try {
        await this.databaseLayer.save(item.data);
      } catch (error) {
        item.retryCount++;
        
        if (item.retryCount < item.maxRetries) {
          // Re-add to queue for retry
          this.offlineQueue.push(item);
          
          // Schedule retry
          setTimeout(() => {
            this.processOfflineQueue();
          }, RETRY_DELAY * item.retryCount);
        } else {
          logger.error('Failed to process offline queue item after max retries:', item.id);
        }
      }
    }

    this.saveOfflineQueue();
  }

  /**
   * Resolve conflicts between local and remote data
   */
  private resolveConflict(local: WorkshopState, remote: WorkshopState): WorkshopState {
    switch (this.conflictResolution.strategy) {
      case 'local-first':
        return local;
      
      case 'remote-first':
        return remote;
      
      case 'merge':
        if (this.conflictResolution.resolver) {
          return this.conflictResolution.resolver(local, remote);
        }
        // Default merge: take the most recent data
        return this.defaultMergeStrategy(local, remote);
      
      default:
        return local;
    }
  }

  /**
   * Default merge strategy - keeps the most complete data
   */
  private defaultMergeStrategy(local: WorkshopState, remote: WorkshopState): WorkshopState {
    // Compare completeness based on completed steps
    const localCompletedSteps = local.completedSteps?.length || 0;
    const remoteCompletedSteps = remote.completedSteps?.length || 0;

    // Use the data with more completed steps
    if (localCompletedSteps > remoteCompletedSteps) {
      return local;
    } else if (remoteCompletedSteps > localCompletedSteps) {
      return remote;
    }

    // If equal completed steps, compare by last saved time
    const localTime = local.lastSavedAt ? new Date(local.lastSavedAt).getTime() : 0;
    const remoteTime = remote.lastSavedAt ? new Date(remote.lastSavedAt).getTime() : 0;

    // Return the most recently saved
    return localTime >= remoteTime ? local : remote;
  }

  /**
   * Save workshop data with debouncing
   */
  public async save(data: WorkshopState): Promise<void> {
    // Clear existing debounce timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    // Save to Redux immediately
    await this.reduxLayer.save(data);

    // Debounce other saves - fetch latest data when timer executes
    this.saveDebounceTimer = setTimeout(async () => {
      try {
        // Get the latest data from Redux instead of using captured data
        const latestData = await this.reduxLayer.load();
        if (!latestData) return;

        // Save to localStorage
        await this.localStorageLayer.save(latestData);

        // Save to database if online
        if (this.isOnline && latestData.sessionId) {
          await this.databaseLayer.save(latestData);
        } else if (latestData.sessionId) {
          // Add to offline queue
          this.addToOfflineQueue(latestData);
        }
      } catch (error) {
        logger.error('Save failed:', error);
      }
    }, DEBOUNCE_DELAY);
  }

  /**
   * Save immediately without debouncing
   */
  public async saveImmediately(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    const data = await this.reduxLayer.load();
    if (!data) return;

    try {
      await this.localStorageLayer.save(data);
      
      if (this.isOnline && data.sessionId) {
        await this.databaseLayer.save(data);
      } else if (data.sessionId) {
        this.addToOfflineQueue(data);
      }
    } catch (error) {
      logger.error('Immediate save failed:', error);
    }
  }

  /**
   * Load workshop data with fallback strategy
   */
  public async load(): Promise<WorkshopState | null> {
    // Try loading from Redux first
    let reduxData = await this.reduxLayer.load();
    if (reduxData && reduxData.sessionId) {
      return reduxData;
    }

    // Try loading from database if online
    let remoteData: WorkshopState | null = null;
    if (this.isOnline) {
      try {
        remoteData = await this.databaseLayer.load();
      } catch (error) {
        logger.error('Failed to load from database:', error);
      }
    }

    // Try loading from localStorage
    let localData: WorkshopState | null = null;
    try {
      localData = await this.localStorageLayer.load();
    } catch (error) {
      logger.error('Failed to load from localStorage:', error);
    }

    // Resolve conflicts if both exist
    let finalData: WorkshopState | null = null;
    if (localData && remoteData) {
      finalData = this.resolveConflict(localData, remoteData);
    } else {
      finalData = localData || remoteData;
    }

    // Update Redux if data was found
    if (finalData) {
      await this.reduxLayer.save(finalData);
    }

    return finalData;
  }

  /**
   * Clear all workshop data
   */
  public async clear(): Promise<void> {
    // Clear debounce timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    // Clear all layers
    await Promise.all([
      this.reduxLayer.clear(),
      this.localStorageLayer.clear(),
      // Database clear is handled separately
    ]);

    // Clear offline queue
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  /**
   * Set conflict resolution strategy
   */
  public setConflictResolution(resolution: ConflictResolution): void {
    this.conflictResolution = resolution;
  }

  /**
   * Get offline queue status
   */
  public getOfflineQueueStatus(): { count: number; items: OfflineQueueItem[] } {
    return {
      count: this.offlineQueue.length,
      items: [...this.offlineQueue],
    };
  }

  /**
   * Force process offline queue
   */
  public async forceProcessOfflineQueue(): Promise<void> {
    this.isOnline = navigator.onLine;
    await this.processOfflineQueue();
  }
}

// Export singleton instance
export const workshopPersistence = WorkshopPersistenceService.getInstance();

// Export the class for testing
export { WorkshopPersistenceService };

// Export types
export type { OfflineQueueItem, ConflictResolution };

/**
 * Usage Example:
 * 
 * // In a React component or Redux middleware
 * import { workshopPersistence } from '@/services/workshopPersistenceService';
 * 
 * // Save workshop data (automatically debounced)
 * await workshopPersistence.save(workshopState);
 * 
 * // Save immediately (e.g., before navigation)
 * await workshopPersistence.saveImmediately();
 * 
 * // Load workshop data on app start
 * const savedData = await workshopPersistence.load();
 * if (savedData) {
 *   // Resume workshop
 * }
 * 
 * // Clear all workshop data
 * await workshopPersistence.clear();
 * 
 * // Check offline queue status
 * const { count, items } = workshopPersistence.getOfflineQueueStatus();
 * 
 * // Set conflict resolution strategy
 * workshopPersistence.setConflictResolution({
 *   strategy: 'merge',
 *   resolver: (local, remote) => {
 *     // Custom merge logic
 *     return mergedState;
 *   }
 * });
 */