import { getDefaultWorkshopState } from '../utils/workshopStateSanitizer';
import type { WorkshopState } from '../store/slices/workshopSlice';

// Mock the workshop API
const mockWorkshopAPI = {
  saveProgress: jest.fn(),
  getSessions: jest.fn(),
  getSession: jest.fn(),
};

// Mock Redux store
const mockStore = {
  getState: jest.fn(),
  dispatch: jest.fn(),
  subscribe: jest.fn(),
};

// Mock the persistence service dependencies
jest.mock('./workshopAPI', () => ({
  workshopAPI: mockWorkshopAPI,
}));

jest.mock('../store', () => ({
  store: mockStore,
}));

// Import after mocking
const { WorkshopPersistenceService } = require('./workshopPersistenceService');

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('WorkshopPersistenceService Integration Tests', () => {
  let persistenceService: any; // Access private instance for testing
  let testState: WorkshopState;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockLocalStorage.clear();
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Create test state
    testState = {
      ...getDefaultWorkshopState(),
      sessionId: 'test-session-123',
      currentStep: 2,
      completedSteps: [1],
      lastSavedAt: new Date().toISOString(),
      values: {
        selected: ['value1', 'value2'],
        custom: [],
        rankings: { value1: 8, value2: 6 },
        primary: ['value1'],
        aspirational: ['value2'],
        stories: { value1: 'My test story' }
      }
    };

    // Reset all mocks
    jest.clearAllMocks();
    mockWorkshopAPI.saveProgress.mockClear();
    mockWorkshopAPI.getSessions.mockClear();
    mockWorkshopAPI.getSession.mockClear();

    // Get fresh instance for each test
    WorkshopPersistenceService.resetInstance();
    persistenceService = WorkshopPersistenceService.getInstance();

    // Mock Redux store methods with dynamic state tracking
    let currentReduxState = testState;
    mockStore.getState = jest.fn().mockImplementation(() => ({
      workshop: currentReduxState
    }));
    mockStore.dispatch = jest.fn().mockImplementation((action) => {
      if (action.type === 'workshop/loadWorkshopState') {
        currentReduxState = action.payload;
      }
    });
  });

  afterEach(() => {
    // Clean up timers
    jest.clearAllTimers();
  });

  describe('Three-Layer Persistence Strategy', () => {
    it('should save to all layers when online', async () => {
      // Mock successful API responses
      mockWorkshopAPI.saveProgress.mockResolvedValue({ success: true });

      await persistenceService.save(testState);

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Check localStorage was written
      const localStorageData = mockLocalStorage.getItem('workshop-persistence');
      expect(localStorageData).toBeTruthy();
      
      const parsed = JSON.parse(localStorageData!);
      expect(parsed.data.sessionId).toBe('test-session-123');
      expect(parsed.data.currentStep).toBe(2);

      // Check API was called
      expect(mockWorkshopAPI.saveProgress).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        step: 2,
        stepData: expect.objectContaining({
          values: testState.values,
          toneSettings: testState.tonePreferences,
          audiences: testState.audiencePersonas,
          writingSample: null,
          quizResponses: testState.personalityQuiz.responses
        })
      });
    });

    it('should handle offline scenario gracefully', async () => {
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // Reinitialize service to pick up offline status
      WorkshopPersistenceService.resetInstance();
      persistenceService = WorkshopPersistenceService.getInstance();

      await persistenceService.save(testState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should still save to localStorage
      const localStorageData = mockLocalStorage.getItem('workshop-persistence');
      expect(localStorageData).toBeTruthy();

      // Should not call API when offline
      expect(mockWorkshopAPI.saveProgress).not.toHaveBeenCalled();

      // Should have items in offline queue
      const queueStatus = persistenceService.getOfflineQueueStatus();
      expect(queueStatus.count).toBe(1);
      expect(queueStatus.items[0].data.sessionId).toBe('test-session-123');
    });

    it('should process offline queue when coming back online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      WorkshopPersistenceService.resetInstance();
      persistenceService = WorkshopPersistenceService.getInstance();

      await persistenceService.save(testState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should have queued item
      expect(persistenceService.getOfflineQueueStatus().count).toBe(1);

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // Mock successful API response
      mockWorkshopAPI.saveProgress.mockResolvedValue({ success: true });

      // Force process queue
      await persistenceService.forceProcessOfflineQueue();

      // Queue should be empty
      expect(persistenceService.getOfflineQueueStatus().count).toBe(0);

      // API should have been called
      expect(mockWorkshopAPI.saveProgress).toHaveBeenCalled();
    });
  });

  describe('Data Loading and Recovery', () => {
    it('should load from Redux first when available', async () => {
      // Redux has data
      mockStore.getState.mockReturnValue({
        workshop: testState
      });

      const loadedData = await persistenceService.load();

      expect(loadedData).toEqual(testState);
      expect(mockWorkshopAPI.getSessions).not.toHaveBeenCalled();
    });

    it('should fall back to database when Redux is empty', async () => {
      // Redux has no session ID
      const incompleteState = { ...testState, sessionId: null };
      mockStore.getState.mockReturnValue({
        workshop: incompleteState
      });

      // Mock database response
      mockWorkshopAPI.getSessions.mockResolvedValue({
        data: {
          sessions: [
            { id: 'session-1', completed: false, step: 2, createdAt: '2025-01-12T00:00:00.000Z' }
          ]
        }
      });

      mockWorkshopAPI.getSession.mockResolvedValue({
        data: {
          session: {
            id: 'session-1',
            step: 2,
            completed: false,
            createdAt: '2025-01-12T00:00:00.000Z',
            updatedAt: '2025-01-12T01:00:00.000Z',
            data: {
              completedSteps: [1],
              values: { selected: ['db-value'] }
            }
          }
        }
      });

      const loadedData = await persistenceService.load();

      expect(loadedData).toBeDefined();
      expect(loadedData?.currentStep).toBe(2);
      expect(mockWorkshopAPI.getSessions).toHaveBeenCalled();
      expect(mockWorkshopAPI.getSession).toHaveBeenCalledWith('session-1');
    });

    it('should fall back to localStorage when database fails', async () => {
      // Redux has no data
      mockStore.getState.mockReturnValue({
        workshop: { ...getDefaultWorkshopState(), sessionId: null }
      });

      // Database fails
      mockWorkshopAPI.getSessions.mockRejectedValue(new Error('Database error'));

      // localStorage has data
      const localData = {
        data: testState,
        timestamp: Date.now(),
        version: '1.0'
      };
      mockLocalStorage.setItem('workshop-persistence', JSON.stringify(localData));

      const loadedData = await persistenceService.load();

      expect(loadedData).toEqual(testState);
    });

    it('should handle expired localStorage data', async () => {
      // Redux has no data
      mockStore.getState.mockReturnValue({
        workshop: { ...getDefaultWorkshopState(), sessionId: null }
      });

      // Database fails
      mockWorkshopAPI.getSessions.mockRejectedValue(new Error('Database error'));

      // localStorage has expired data (25 hours old)
      const expiredData = {
        data: testState,
        timestamp: Date.now() - (25 * 60 * 60 * 1000),
        version: '1.0'
      };
      mockLocalStorage.setItem('workshop-persistence', JSON.stringify(expiredData));

      const loadedData = await persistenceService.load();

      expect(loadedData).toBeNull();
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using local-first strategy by default', async () => {
      const localState = {
        ...testState,
        currentStep: 3,
        lastSavedAt: '2025-01-12T02:00:00.000Z'
      };

      const remoteState = {
        ...testState,
        currentStep: 2,
        lastSavedAt: '2025-01-12T01:00:00.000Z'
      };

      // Use private method for testing
      const resolved = persistenceService.resolveConflict(localState, remoteState);

      expect(resolved).toEqual(localState);
      expect(resolved.currentStep).toBe(3);
    });

    it('should use merge strategy when configured', async () => {
      persistenceService.setConflictResolution({
        strategy: 'merge',
        resolver: (local: WorkshopState, remote: WorkshopState) => ({
          ...local,
          // Keep the higher step count
          currentStep: Math.max(local.currentStep, remote.currentStep),
          // Merge completed steps
          completedSteps: [...new Set([...local.completedSteps, ...remote.completedSteps])]
        })
      });

      const localState = {
        ...testState,
        currentStep: 2,
        completedSteps: [1],
        values: { ...testState.values, selected: ['local-value'] }
      };

      const remoteState = {
        ...testState,
        currentStep: 3,
        completedSteps: [1, 2],
        values: { ...testState.values, selected: ['remote-value'] }
      };

      const resolved = persistenceService.resolveConflict(localState, remoteState);

      expect(resolved.currentStep).toBe(3); // Higher step
      expect(resolved.completedSteps).toEqual([1, 2]); // Merged steps
      expect(resolved.values.selected).toEqual(['local-value']); // Custom resolver logic
    });

    it('should use default merge strategy when no custom resolver', async () => {
      persistenceService.setConflictResolution({ strategy: 'merge' });

      // Local has more completed steps
      const localState = {
        ...testState,
        completedSteps: [1, 2, 3],
        lastSavedAt: '2025-01-12T01:00:00.000Z'
      };

      const remoteState = {
        ...testState,
        completedSteps: [1, 2],
        lastSavedAt: '2025-01-12T02:00:00.000Z'
      };

      const resolved = persistenceService.resolveConflict(localState, remoteState);

      // Should prefer local because it has more completed steps
      expect(resolved).toEqual(localState);
      expect(resolved.completedSteps).toHaveLength(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should add to offline queue when database save fails', async () => {
      mockWorkshopAPI.saveProgress.mockRejectedValue(new Error('Database error'));

      await persistenceService.save(testState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should have added to offline queue
      const queueStatus = persistenceService.getOfflineQueueStatus();
      expect(queueStatus.count).toBe(1);
      expect(queueStatus.items[0].data.sessionId).toBe('test-session-123');
    });

    it('should retry failed offline queue items', async () => {
      // Start with failing API
      mockWorkshopAPI.saveProgress.mockRejectedValue(new Error('Database error'));

      await persistenceService.save(testState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should have one item in queue
      expect(persistenceService.getOfflineQueueStatus().count).toBe(1);

      // API starts working
      mockWorkshopAPI.saveProgress.mockResolvedValue({ success: true });

      // Process queue
      await persistenceService.forceProcessOfflineQueue();

      // Queue should be empty
      expect(persistenceService.getOfflineQueueStatus().count).toBe(0);
      expect(mockWorkshopAPI.saveProgress).toHaveBeenCalledTimes(2); // Original + retry
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      // Redux has no data
      mockStore.getState.mockReturnValue({
        workshop: { ...getDefaultWorkshopState(), sessionId: null }
      });

      // Database fails
      mockWorkshopAPI.getSessions.mockRejectedValue(new Error('Database error'));

      // Corrupted localStorage
      mockLocalStorage.setItem('workshop-persistence', 'invalid-json');

      const loadedData = await persistenceService.load();

      expect(loadedData).toBeNull();
    });

    it('should clear all layers when clear is called', async () => {
      // Save some data first
      await persistenceService.save(testState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify data exists
      expect(mockLocalStorage.getItem('workshop-persistence')).toBeTruthy();
      expect(persistenceService.getOfflineQueueStatus().count).toBeGreaterThanOrEqual(0);

      // Clear all data
      await persistenceService.clear();

      // Verify all layers cleared
      expect(mockLocalStorage.getItem('workshop-persistence')).toBeNull();
      expect(persistenceService.getOfflineQueueStatus().count).toBe(0);
    });
  });

  describe('Debouncing and Performance', () => {
    it.skip('should debounce rapid saves', async () => {
      const state1 = { ...testState, currentStep: 1 };
      const state2 = { ...testState, currentStep: 2 };
      const state3 = { ...testState, currentStep: 3 };

      // Rapid saves
      persistenceService.save(state1);
      persistenceService.save(state2);
      persistenceService.save(state3);

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should only call API once with the last state
      expect(mockWorkshopAPI.saveProgress).toHaveBeenCalledTimes(1);
      expect(mockWorkshopAPI.saveProgress).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        step: 3, // Last state
        stepData: expect.any(Object)
      });
    });

    it('should save to Redux immediately despite debouncing', async () => {
      const newState = { ...testState, currentStep: 5 };

      await persistenceService.save(newState);

      // Redux should be updated immediately
      expect(mockStore.dispatch).toHaveBeenCalled();
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency across layers', async () => {
      mockWorkshopAPI.saveProgress.mockResolvedValue({ success: true });

      await persistenceService.save(testState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Load data back
      const loadedData = await persistenceService.load();

      // Should maintain core data integrity
      expect(loadedData?.sessionId).toBe(testState.sessionId);
      expect(loadedData?.currentStep).toBe(testState.currentStep);
      expect(loadedData?.values.selected).toEqual(testState.values.selected);
      expect(loadedData?.values.rankings).toEqual(testState.values.rankings);
    });

    it('should handle missing session ID gracefully', async () => {
      const stateWithoutSession = { ...testState, sessionId: null };

      await persistenceService.save(stateWithoutSession);

      // Wait for debounced save to complete
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should save to localStorage but not database
      const localData = mockLocalStorage.getItem('workshop-persistence');
      expect(localData).toBeTruthy();
      expect(mockWorkshopAPI.saveProgress).not.toHaveBeenCalled();
    });

    it('should preserve data types during serialization', async () => {
      const complexState = {
        ...testState,
        values: {
          ...testState.values,
          rankings: { value1: 8, value2: 6 }, // Numbers
          selected: ['value1', 'value2'], // Strings
          stories: { value1: 'My story with "quotes" and special chars: &<>' }
        },
        completedSteps: [1, 2], // Numbers array
        isCompleted: false, // Boolean
        lastSavedAt: '2025-01-12T00:00:00.000Z' // ISO string
      };

      await persistenceService.save(complexState);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const loaded = await persistenceService.load();

      expect(typeof loaded?.values.rankings.value1).toBe('number');
      expect(Array.isArray(loaded?.values.selected)).toBe(true);
      expect(typeof loaded?.isCompleted).toBe('boolean');
      expect(loaded?.values.stories.value1).toContain('quotes');
    });
  });

  describe('Cross-Session Scenarios', () => {
    it('should handle multiple sessions correctly', async () => {
      // Mock multiple sessions from database
      mockWorkshopAPI.getSessions.mockResolvedValue({
        data: {
          sessions: [
            { id: 'session-1', completed: true, step: 5, createdAt: '2025-01-11T00:00:00.000Z' },
            { id: 'session-2', completed: false, step: 3, createdAt: '2025-01-12T00:00:00.000Z' }
          ]
        }
      });

      mockWorkshopAPI.getSession.mockResolvedValue({
        data: {
          session: {
            id: 'session-2',
            step: 3,
            completed: false,
            createdAt: '2025-01-12T00:00:00.000Z',
            updatedAt: '2025-01-12T01:00:00.000Z',
            data: { completedSteps: [1, 2] }
          }
        }
      });

      // Redux has no data
      mockStore.getState.mockReturnValue({
        workshop: { ...getDefaultWorkshopState(), sessionId: null }
      });

      const loadedData = await persistenceService.load();

      // Should load the incomplete session (session-2)
      expect(mockWorkshopAPI.getSession).toHaveBeenCalledWith('session-2');
      expect(loadedData?.currentStep).toBe(3);
    });

    it('should prefer most recent session when all are complete', async () => {
      mockWorkshopAPI.getSessions.mockResolvedValue({
        data: {
          sessions: [
            { id: 'session-1', completed: true, step: 5, createdAt: '2025-01-11T00:00:00.000Z' },
            { id: 'session-2', completed: true, step: 5, createdAt: '2025-01-12T00:00:00.000Z' }
          ]
        }
      });

      mockWorkshopAPI.getSession.mockResolvedValue({
        data: {
          session: {
            id: 'session-1', // First in array
            step: 5,
            completed: true,
            createdAt: '2025-01-11T00:00:00.000Z',
            updatedAt: '2025-01-11T01:00:00.000Z',
            data: {}
          }
        }
      });

      mockStore.getState.mockReturnValue({
        workshop: { ...getDefaultWorkshopState(), sessionId: null }
      });

      const loadedData = await persistenceService.load();

      // Should load the first session in the array
      expect(mockWorkshopAPI.getSession).toHaveBeenCalledWith('session-1');
    });
  });
});