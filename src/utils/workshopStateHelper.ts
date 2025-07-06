import { WorkshopState } from '../store/slices/workshopSlice';

/**
 * Helper to ensure workshop state is properly initialized
 * This helps prevent crashes from undefined or corrupted state
 */
export const ensureWorkshopState = (state: Partial<WorkshopState> | null | undefined): WorkshopState => {
  const defaultState: WorkshopState = {
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
      currentQuestionIndex: 0,
      responses: [],
      results: null
    },
    sessionId: null,
    isSaving: false,
    lastError: null
  };

  if (!state) {
    return defaultState;
  }

  // Merge with defaults to ensure all properties exist
  return {
    ...defaultState,
    ...state,
    values: {
      ...defaultState.values,
      ...(state.values || {}),
      selected: Array.isArray(state.values?.selected) ? state.values.selected : [],
      custom: Array.isArray(state.values?.custom) ? state.values.custom : [],
      rankings: state.values?.rankings || {}
    },
    tonePreferences: {
      ...defaultState.tonePreferences,
      ...(state.tonePreferences || {})
    },
    personalityQuiz: {
      ...defaultState.personalityQuiz,
      ...(state.personalityQuiz || {}),
      responses: Array.isArray(state.personalityQuiz?.responses) ? state.personalityQuiz.responses : []
    },
    completedSteps: Array.isArray(state.completedSteps) ? state.completedSteps : [],
    audiencePersonas: Array.isArray(state.audiencePersonas) ? state.audiencePersonas : []
  };
};

/**
 * Clear corrupted workshop state from localStorage
 */
export const clearCorruptedWorkshopState = () => {
  try {
    // Clear workshop-specific persistence
    localStorage.removeItem('persist:workshop');
    
    // Clear workshop from root persistence
    const persistRoot = localStorage.getItem('persist:root');
    if (persistRoot) {
      try {
        const parsed = JSON.parse(persistRoot);
        if (parsed.workshop) {
          delete parsed.workshop;
          localStorage.setItem('persist:root', JSON.stringify(parsed));
        }
      } catch (e) {
        // If parsing fails, clear everything
        localStorage.removeItem('persist:root');
      }
    }
    
    console.log('Cleared corrupted workshop state');
    return true;
  } catch (error) {
    console.error('Error clearing workshop state:', error);
    return false;
  }
};

/**
 * Validate workshop state structure
 */
export const isValidWorkshopState = (state: any): boolean => {
  if (!state || typeof state !== 'object') {
    return false;
  }
  
  // Check required properties
  const requiredProps = ['currentStep', 'completedSteps', 'values', 'tonePreferences'];
  for (const prop of requiredProps) {
    if (!(prop in state)) {
      return false;
    }
  }
  
  // Check values structure
  if (!state.values || typeof state.values !== 'object') {
    return false;
  }
  
  if (!Array.isArray(state.values.selected) || 
      !Array.isArray(state.values.custom) ||
      typeof state.values.rankings !== 'object') {
    return false;
  }
  
  return true;
};