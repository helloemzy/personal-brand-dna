import { store } from '../store';
import { workshopAPI } from './workshopAPI';
import { setWorkshopState } from '../store/slices/workshopSlice';
import type { WorkshopState } from '../store/slices/workshopSlice';

export interface WorkshopSession {
  id: string;
  data: WorkshopState;
  lastSavedAt: number;
  userId?: string;
  isValid: boolean;
  metadata?: {
    step?: number;
    completionProgress?: number;
    archetype?: string;
    createdAt?: number;
  };
}

/**
 * Workshop Session Service
 * Manages workshop sessions for recovery and diagnostics
 */
class WorkshopSessionService {
  private static instance: WorkshopSessionService;
  private readonly STORAGE_KEY = 'workshop-sessions';
  private readonly MAX_SESSIONS = 10; // Keep last 10 sessions

  private constructor() {
    // Initialize service
    this.migrateOldSessions();
  }

  public static getInstance(): WorkshopSessionService {
    if (!WorkshopSessionService.instance) {
      WorkshopSessionService.instance = new WorkshopSessionService();
    }
    return WorkshopSessionService.instance;
  }

  /**
   * Get all stored sessions
   */
  public getAllSessions(): WorkshopSession[] {
    try {
      const sessionsJson = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionsJson) return [];

      const sessions: WorkshopSession[] = JSON.parse(sessionsJson);
      
      // Validate and filter sessions
      return sessions
        .filter(session => this.isValidSession(session))
        .sort((a, b) => b.lastSavedAt - a.lastSavedAt); // Most recent first
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Save current workshop state as a session
   */
  public async saveCurrentSession(): Promise<string | null> {
    try {
      const state = store.getState();
      const workshopState = state.workshop;

      if (!workshopState || !this.hasMinimalData(workshopState)) {
        return null; // Don't save empty or minimal states
      }

      const session: WorkshopSession = {
        id: this.generateSessionId(),
        data: workshopState,
        lastSavedAt: Date.now(),
        userId: state.auth.user?.id,
        isValid: true,
        metadata: {
          step: workshopState.currentStep || 0,
          completionProgress: this.calculateCompletionProgress(workshopState),
          archetype: workshopState.archetype?.primary,
          createdAt: Date.now(),
        },
      };

      await this.saveSession(session);
      return session.id;
    } catch (error) {
      console.error('Failed to save current session:', error);
      return null;
    }
  }

  /**
   * Restore a specific session
   */
  public async restoreSession(sessionId: string): Promise<boolean> {
    try {
      const sessions = this.getAllSessions();
      const session = sessions.find(s => s.id === sessionId);

      if (!session || !this.isValidSession(session)) {
        console.warn('Session not found or invalid:', sessionId);
        return false;
      }

      // Dispatch the session data to Redux store
      store.dispatch(setWorkshopState(session.data));

      // Save to persistence layer as well
      localStorage.setItem('persist:workshop', JSON.stringify({
        workshop: JSON.stringify(session.data)
      }));

      return true;
    } catch (error) {
      console.error('Failed to restore session:', error);
      return false;
    }
  }

  /**
   * Clear all sessions
   */
  public clearAllSessions(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  }

  /**
   * Get sessions by user ID
   */
  public getSessionsByUser(userId: string): WorkshopSession[] {
    return this.getAllSessions().filter(session => session.userId === userId);
  }

  /**
   * Remove old sessions (keep only MAX_SESSIONS)
   */
  public cleanupOldSessions(): void {
    try {
      const sessions = this.getAllSessions();
      if (sessions.length <= this.MAX_SESSIONS) return;

      const sessionsToKeep = sessions.slice(0, this.MAX_SESSIONS);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionsToKeep));
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }
  }

  /**
   * Get corrupted or invalid sessions for diagnostics
   */
  public getCorruptedSessions(): string[] {
    try {
      const sessionsJson = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionsJson) return [];

      const sessions: any[] = JSON.parse(sessionsJson);
      
      return sessions
        .filter(session => !this.isValidSession(session))
        .map(session => session.id || 'unknown');
    } catch (error) {
      console.error('Failed to get corrupted sessions:', error);
      return ['parse-error'];
    }
  }

  /**
   * Remove a specific session
   */
  public removeSession(sessionId: string): boolean {
    try {
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      if (filteredSessions.length === sessions.length) {
        return false; // Session not found
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSessions));
      return true;
    } catch (error) {
      console.error('Failed to remove session:', error);
      return false;
    }
  }

  /**
   * Get session statistics for diagnostics
   */
  public getSessionStats(): {
    total: number;
    valid: number;
    corrupted: number;
    oldestDate: string | null;
    newestDate: string | null;
  } {
    const sessions = this.getAllSessions();
    const corruptedSessions = this.getCorruptedSessions();

    return {
      total: sessions.length + corruptedSessions.length,
      valid: sessions.length,
      corrupted: corruptedSessions.length,
      oldestDate: sessions.length > 0 
        ? new Date(Math.min(...sessions.map(s => s.lastSavedAt))).toLocaleString()
        : null,
      newestDate: sessions.length > 0 
        ? new Date(Math.max(...sessions.map(s => s.lastSavedAt))).toLocaleString()
        : null,
    };
  }

  // Private helper methods

  private async saveSession(session: WorkshopSession): Promise<void> {
    try {
      const sessions = this.getAllSessions();
      
      // Remove existing session with same ID if exists
      const filteredSessions = sessions.filter(s => s.id !== session.id);
      
      // Add new session at the beginning
      filteredSessions.unshift(session);
      
      // Keep only MAX_SESSIONS
      const sessionsToSave = filteredSessions.slice(0, this.MAX_SESSIONS);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionsToSave));
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  private isValidSession(session: any): session is WorkshopSession {
    return (
      session &&
      typeof session === 'object' &&
      typeof session.id === 'string' &&
      typeof session.lastSavedAt === 'number' &&
      session.data &&
      typeof session.data === 'object' &&
      typeof session.isValid === 'boolean'
    );
  }

  private hasMinimalData(state: WorkshopState): boolean {
    // Check if the state has enough data to be worth saving
    return !!(
      state.values?.length > 0 ||
      state.tonePreferences ||
      state.audiencePersonas?.length > 0 ||
      state.writingSamples?.length > 0 ||
      state.quizResponses?.length > 0
    );
  }

  private calculateCompletionProgress(state: WorkshopState): number {
    let completed = 0;
    const total = 5; // 5 workshop steps

    if (state.values?.length > 0) completed++;
    if (state.tonePreferences) completed++;
    if (state.audiencePersonas?.length > 0) completed++;
    if (state.writingSamples?.length > 0) completed++;
    if (state.quizResponses?.length > 0) completed++;

    return Math.round((completed / total) * 100);
  }

  private generateSessionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private migrateOldSessions(): void {
    try {
      // Check for old workshop data that might need to be converted to sessions
      const oldWorkshopData = localStorage.getItem('persist:workshop');
      if (oldWorkshopData && !localStorage.getItem(this.STORAGE_KEY)) {
        const parsed = JSON.parse(oldWorkshopData);
        const workshopState = JSON.parse(parsed.workshop || '{}');
        
        if (this.hasMinimalData(workshopState)) {
          const session: WorkshopSession = {
            id: this.generateSessionId(),
            data: workshopState,
            lastSavedAt: Date.now(),
            isValid: true,
            metadata: {
              step: workshopState.currentStep || 0,
              completionProgress: this.calculateCompletionProgress(workshopState),
              createdAt: Date.now(),
            },
          };
          
          this.saveSession(session);
        }
      }
    } catch (error) {
      console.error('Failed to migrate old sessions:', error);
    }
  }
}

// Export singleton instance
export const workshopSessionService = WorkshopSessionService.getInstance();