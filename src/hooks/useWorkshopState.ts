import { useAppSelector } from './redux';
import { WorkshopState } from '../store/slices/workshopSlice';

/**
 * Hook to safely access workshop state with proper handling of persisted state
 */
export const useWorkshopState = () => {
  const workshopState = useAppSelector((state) => {
    // Handle persisted state which might have _persist property
    const workshop = state.workshop as any;
    
    // If it's a persisted state object, extract the actual state
    if (workshop && workshop._persist) {
      const { _persist, ...actualState } = workshop;
      return actualState as WorkshopState;
    }
    
    return state.workshop;
  });

  // Provide safe defaults if state is undefined
  const safeState = workshopState || {
    currentStep: 1,
    completedSteps: [],
    isCompleted: false,
    startedAt: null,
    lastSavedAt: null,
    completedAt: null,
    values: {
      selected: [],
      custom: [],
      rankings: {}
    },
    tonePreferences: {
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0
    },
    audiencePersonas: [],
    writingSample: null,
    personalityQuiz: {
      responses: [],
      currentQuestionIndex: 0
    },
    sessionId: null,
    isSaving: false,
    lastError: null
  };

  return {
    // State values with safe defaults
    currentStep: safeState.currentStep || 1,
    completedSteps: safeState.completedSteps || [],
    isCompleted: safeState.isCompleted || false,
    startedAt: safeState.startedAt,
    lastSavedAt: safeState.lastSavedAt,
    completedAt: safeState.completedAt,
    values: safeState.values || { selected: [], custom: [], rankings: {} },
    tonePreferences: safeState.tonePreferences,
    audiencePersonas: safeState.audiencePersonas || [],
    writingSample: safeState.writingSample,
    personalityQuiz: safeState.personalityQuiz,
    sessionId: safeState.sessionId,
    isSaving: safeState.isSaving || false,
    lastError: safeState.lastError,
    
    // Computed values
    selectedValues: safeState.values?.selected || [],
    customValues: safeState.values?.custom || [],
    rankings: safeState.values?.rankings || {},
    isLoading: safeState.isSaving || false,
    hasError: !!safeState.lastError,
  };
};

// Hook for just the values state
export const useWorkshopValues = () => {
  const { selectedValues, customValues, rankings } = useWorkshopState();
  return { selectedValues, customValues, rankings };
};