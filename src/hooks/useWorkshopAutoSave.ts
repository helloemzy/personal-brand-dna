import { useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from './redux';
import { useWorkshopState } from './useWorkshopState';
import { selectUser } from '../store/slices/authSlice';
import { workshopPersistence } from '../services/workshopPersistenceService';
import { debouncedFunctions } from '../utils/debounce';
import { WorkshopState } from '../store/slices/workshopSlice';

interface AutoSaveOptions {
  // Enable/disable auto-save
  enabled?: boolean;
  // Save on significant changes only
  onlySignificantChanges?: boolean;
  // Custom debounce delay (ms)
  debounceDelay?: number;
  // Callback when save starts
  onSaveStart?: () => void;
  // Callback when save completes
  onSaveComplete?: (success: boolean) => void;
  // Callback on save error
  onSaveError?: (error: Error) => void;
}

interface AutoSaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: Error | null;
  pendingSave: boolean;
}

/**
 * Hook to automatically save workshop progress with intelligent triggers
 * 
 * Features:
 * - Debounced saves on data changes
 * - Save on step completion
 * - Save on significant changes (e.g., adding values, completing personas)
 * - Save before window unload/blur
 * - Tracks save status and errors
 * 
 * @param options Configuration options for auto-save behavior
 * @returns Save status and manual save trigger
 */
export const useWorkshopAutoSave = (options: AutoSaveOptions = {}) => {
  const {
    enabled = true,
    onlySignificantChanges = false,
    debounceDelay,
    onSaveStart,
    onSaveComplete,
    onSaveError,
  } = options;

  // Get current user and workshop state
  const user = useAppSelector(selectUser);
  const workshopState = useWorkshopState();
  const rawWorkshopState = useAppSelector((state) => state.workshop) as WorkshopState;

  // Save status tracking
  const statusRef = useRef<AutoSaveStatus>({
    isSaving: false,
    lastSaved: null,
    saveError: null,
    pendingSave: false,
  });

  // Previous state for change detection
  const previousStateRef = useRef<WorkshopState | null>(null);
  const saveInProgressRef = useRef(false);

  // Create debounced save function
  const debouncedSave = useRef(
    debounceDelay
      ? debouncedFunctions.workshopAutoSave(async () => {
          await performSave();
        })
      : debouncedFunctions.workshopAutoSave(async () => {
          await performSave();
        })
  );

  // Perform the actual save
  const performSave = useCallback(async () => {
    if (!enabled || saveInProgressRef.current || !rawWorkshopState) {
      return;
    }

    // Don't save if no session ID exists yet
    if (!rawWorkshopState.sessionId) {
      return;
    }

    saveInProgressRef.current = true;
    statusRef.current.isSaving = true;
    statusRef.current.pendingSave = false;

    try {
      onSaveStart?.();

      // Add user context to the save if available
      const stateToSave: WorkshopState = {
        ...rawWorkshopState,
        lastSavedAt: new Date().toISOString(),
      };

      await workshopPersistence.save(stateToSave);

      statusRef.current.lastSaved = new Date();
      statusRef.current.saveError = null;
      onSaveComplete?.(true);
    } catch (error) {
      console.error('Workshop auto-save failed:', error);
      statusRef.current.saveError = error as Error;
      onSaveError?.(error as Error);
      onSaveComplete?.(false);
    } finally {
      saveInProgressRef.current = false;
      statusRef.current.isSaving = false;
    }
  }, [enabled, rawWorkshopState, onSaveStart, onSaveComplete, onSaveError]);

  // Detect significant changes
  const detectSignificantChange = useCallback((current: WorkshopState, previous: WorkshopState | null): boolean => {
    if (!previous) return true;

    // Step completion
    if (current.currentStep !== previous.currentStep) return true;
    if (current.completedSteps.length !== previous.completedSteps.length) return true;
    if (current.isCompleted !== previous.isCompleted) return true;

    // Values changes
    if (current.values.selected.length !== previous.values.selected.length) return true;
    if (current.values.custom.length !== previous.values.custom.length) return true;
    if (current.values.primary?.length !== previous.values.primary?.length) return true;
    if (current.values.aspirational?.length !== previous.values.aspirational?.length) return true;

    // Tone preferences changed
    const toneKeys = ['formal_casual', 'concise_detailed', 'analytical_creative', 'serious_playful'] as const;
    for (const key of toneKeys) {
      if (current.tonePreferences[key] !== previous.tonePreferences[key]) return true;
    }

    // Audience personas changed
    if (current.audiencePersonas.length !== previous.audiencePersonas.length) return true;

    // Writing sample added/changed
    if (current.writingSample?.text !== previous.writingSample?.text) return true;

    // Personality quiz progress
    if (current.personalityQuiz.responses.length !== previous.personalityQuiz.responses.length) return true;

    return false;
  }, []);

  // Manual save trigger
  const saveNow = useCallback(async () => {
    // Cancel any pending debounced save
    if (debouncedSave.current.cancel) {
      debouncedSave.current.cancel();
    }
    
    await performSave();
  }, [performSave]);

  // Save before unload
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (statusRef.current.pendingSave && enabled) {
      // Try to save immediately
      workshopPersistence.saveImmediately();
      
      // Show browser warning if there are unsaved changes
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }, [enabled]);

  // Save on visibility change (tab blur)
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && statusRef.current.pendingSave && enabled) {
      saveNow();
    }
  }, [enabled, saveNow]);

  // Watch for changes and trigger saves
  useEffect(() => {
    if (!enabled || !rawWorkshopState) return;

    const hasSignificantChange = detectSignificantChange(rawWorkshopState, previousStateRef.current);
    const hasAnyChange = JSON.stringify(rawWorkshopState) !== JSON.stringify(previousStateRef.current);

    if (hasAnyChange) {
      statusRef.current.pendingSave = true;

      if (!onlySignificantChanges || hasSignificantChange) {
        debouncedSave.current();
      }
    }

    previousStateRef.current = rawWorkshopState;
  }, [enabled, rawWorkshopState, onlySignificantChanges, detectSignificantChange]);

  // Setup event listeners
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also save on window blur
    const handleWindowBlur = () => {
      if (statusRef.current.pendingSave) {
        saveNow();
      }
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      
      // Cancel any pending saves on unmount
      if (debouncedSave.current.cancel) {
        debouncedSave.current.cancel();
      }
    };
  }, [enabled, handleBeforeUnload, handleVisibilityChange, saveNow]);

  // Save on component unmount if there are pending changes
  useEffect(() => {
    return () => {
      if (statusRef.current.pendingSave && enabled) {
        workshopPersistence.saveImmediately();
      }
    };
  }, [enabled]);

  return {
    // Save status
    isSaving: statusRef.current.isSaving,
    lastSaved: statusRef.current.lastSaved,
    saveError: statusRef.current.saveError,
    hasPendingChanges: statusRef.current.pendingSave,
    
    // Manual controls
    saveNow,
    
    // User info for display
    currentUser: user,
  };
};

/**
 * Usage Example:
 * 
 * const WorkshopComponent = () => {
 *   const { isSaving, lastSaved, saveError, hasPendingChanges, saveNow } = useWorkshopAutoSave({
 *     enabled: true,
 *     onlySignificantChanges: false,
 *     onSaveStart: () => console.log('Saving...'),
 *     onSaveComplete: (success) => console.log('Save complete:', success),
 *     onSaveError: (error) => console.error('Save error:', error),
 *   });
 * 
 *   return (
 *     <div>
 *       {isSaving && <span>Saving...</span>}
 *       {lastSaved && <span>Last saved: {lastSaved.toLocaleTimeString()}</span>}
 *       {saveError && <span>Save error: {saveError.message}</span>}
 *       {hasPendingChanges && <span>Unsaved changes</span>}
 *       <button onClick={saveNow}>Save Now</button>
 *     </div>
 *   );
 * };
 */