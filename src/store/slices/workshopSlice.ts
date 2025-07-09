import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { ensureWorkshopState } from '../../utils/workshopStateHelper';

// Types
export interface WorkshopValue {
  id: string;
  name: string;
  category: string;
  description: string;
  isCustom?: boolean;
}

export interface TonePreferences {
  formal_casual: number;        // -50 (formal) to 50 (casual)
  concise_detailed: number;     // -50 (concise) to 50 (detailed)
  analytical_creative: number;  // -50 (analytical) to 50 (creative)
  serious_playful: number;      // -50 (serious) to 50 (playful)
}

export interface AudiencePersona {
  id: string;
  name: string;
  role: string;
  industry: string;
  painPoints: string[];
  goals: string[];
  communicationStyle: 'formal' | 'casual' | 'technical' | 'conversational';
  demographicInfo?: {
    ageRange?: string;
    experience?: string;
    company_size?: string;
  };
  transformation?: {
    outcome: string; // The #1 transformation you help them achieve
    beforeState: string; // How they feel before working with you
    afterState: string; // How they feel after working with you
  };
  isPrimary?: boolean; // Is this your primary audience?
}

// Style metrics interface
interface StyleMetrics {
  averageSentenceLength: number;
  vocabularyDiversity: number;
  formalityScore: number;
  activeVoiceRatio: number;
  complexityScore: number;
}

export interface WritingSample {
  text: string;
  wordCount: number;
  uploadedAt: string; // ISO string
  analysisResults?: {
    readability: number;
    sentiment: Record<string, number>;
    styleMetrics: StyleMetrics;
  };
}

export interface QuizResponse {
  questionId: string;
  answer: string;
  answeredAt: string; // ISO string
}

export interface WorkshopState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5;
  completedSteps: number[];
  isCompleted: boolean;
  
  // Assessment
  assessmentScore: number | null; // 0-100 clarity score
  workshopPath: 'direct' | 'discovery' | 'hybrid' | null; // Personalized path based on assessment
  
  // Timing
  startedAt: string | null; // ISO string
  lastSavedAt: string | null; // ISO string
  completedAt: string | null; // ISO string
  
  // Step 1: Values
  values: {
    selected: string[];
    custom: WorkshopValue[];
    rankings: Record<string, number>; // valueId -> rank (1-10)
    primary: string[]; // top 2 non-negotiable values
    aspirational: string[]; // values they aspire to embody more
    stories: Record<string, string>; // valueId -> story about living this value
  };
  
  // Step 2: Tone
  tonePreferences: TonePreferences;
  
  // Step 3: Audience
  audiencePersonas: AudiencePersona[];
  
  // Step 4: Writing Sample
  writingSample: WritingSample | null;
  
  // Step 5: Personality Quiz
  personalityQuiz: {
    responses: QuizResponse[];
    currentQuestionIndex: number;
  };
  
  // Meta
  sessionId: string | null;
  isSaving: boolean;
  lastError: string | null;
}

const initialState: WorkshopState = {
  currentStep: 1,
  completedSteps: [],
  isCompleted: false,
  assessmentScore: null,
  workshopPath: null,
  startedAt: null,
  lastSavedAt: null,
  completedAt: null,
  values: {
    selected: [],
    custom: [],
    rankings: {},
    primary: [],
    aspirational: [],
    stories: {}
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

const workshopSlice = createSlice({
  name: 'workshop',
  initialState,
  reducers: {
    // Navigation
    startWorkshop: (state) => {
      state.startedAt = new Date().toISOString();
      state.sessionId = `workshop_${Date.now()}`;
    },
    
    goToStep: (state, action: PayloadAction<1 | 2 | 3 | 4 | 5>) => {
      state.currentStep = action.payload;
    },
    
    completeStep: (state, action: PayloadAction<number>) => {
      if (!state.completedSteps.includes(action.payload)) {
        state.completedSteps.push(action.payload);
      }
      state.lastSavedAt = new Date().toISOString();
    },
    
    // Values (Step 1)
    selectValue: (state, action: PayloadAction<string>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      if (!state.values.selected) {
        state.values.selected = [];
      }
      if (!state.values.rankings) {
        state.values.rankings = {};
      }
      
      // Add value if not already selected and within limit
      if (!state.values.selected.includes(action.payload) && state.values.selected.length < 10) {
        state.values.selected.push(action.payload);
      }
    },
    
    deselectValue: (state, action: PayloadAction<string>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      if (!state.values.selected) {
        state.values.selected = [];
      }
      if (!state.values.rankings) {
        state.values.rankings = {};
      }
      
      // Remove value from selection
      state.values.selected = state.values.selected.filter(id => id !== action.payload);
      
      // Remove ranking if exists
      if (state.values.rankings[action.payload]) {
        delete state.values.rankings[action.payload];
      }
    },
    
    addCustomValue: (state, action: PayloadAction<WorkshopValue>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      if (!state.values.custom) {
        state.values.custom = [];
      }
      if (!state.values.selected) {
        state.values.selected = [];
      }
      
      // Add custom value if within limits
      if (state.values.selected.length < 10) {
        state.values.custom.push(action.payload);
        state.values.selected.push(action.payload.id);
      }
    },
    
    rankValue: (state, action: PayloadAction<{ valueId: string; rank: number }>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      if (!state.values.rankings) {
        state.values.rankings = {};
      }
      
      // Set ranking if value is selected
      if (state.values.selected?.includes(action.payload.valueId)) {
        state.values.rankings[action.payload.valueId] = action.payload.rank;
      }
    },
    
    setPrimaryValues: (state, action: PayloadAction<string[]>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      state.values.primary = action.payload;
    },
    
    setAspirationalValues: (state, action: PayloadAction<string[]>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      state.values.aspirational = action.payload;
    },
    
    addValueStory: (state, action: PayloadAction<{ valueId: string; story: string }>) => {
      // Initialize values if needed
      if (!state.values) {
        state.values = { selected: [], custom: [], rankings: {}, primary: [], aspirational: [], stories: {} };
      }
      if (!state.values.stories) {
        state.values.stories = {};
      }
      state.values.stories[action.payload.valueId] = action.payload.story;
    },
    
    // Tone (Step 2)
    updateTonePreference: (state, action: PayloadAction<{ dimension: keyof TonePreferences; value: number }>) => {
      state.tonePreferences[action.payload.dimension] = action.payload.value;
    },
    
    setTonePreset: (state, action: PayloadAction<TonePreferences>) => {
      state.tonePreferences = action.payload;
    },
    
    // Audience (Step 3)
    addPersona: (state, action: PayloadAction<AudiencePersona>) => {
      // Initialize personas array if needed
      if (!state.audiencePersonas) {
        state.audiencePersonas = [];
      }
      state.audiencePersonas.push(action.payload);
    },
    
    updatePersona: (state, action: PayloadAction<{ id: string; updates: Partial<AudiencePersona> }>) => {
      const index = state.audiencePersonas.findIndex(p => p.id === action.payload.id);
      if (index !== -1 && state.audiencePersonas[index]) {
        Object.assign(state.audiencePersonas[index], action.payload.updates);
      }
    },
    
    removePersona: (state, action: PayloadAction<string>) => {
      state.audiencePersonas = state.audiencePersonas.filter(p => p.id !== action.payload);
    },
    
    setPrimaryPersona: (state, action: PayloadAction<string>) => {
      // Reset all personas to non-primary
      state.audiencePersonas.forEach(persona => {
        persona.isPrimary = false;
      });
      // Set the selected persona as primary
      const persona = state.audiencePersonas.find(p => p.id === action.payload);
      if (persona) {
        persona.isPrimary = true;
      }
    },
    
    // Writing Sample (Step 4)
    setWritingSample: (state, action: PayloadAction<WritingSample>) => {
      state.writingSample = action.payload;
    },
    
    updateAnalysisResults: (state, action: PayloadAction<WritingSample['analysisResults']>) => {
      if (state.writingSample && action.payload) {
        state.writingSample.analysisResults = action.payload;
      }
    },
    
    // Quiz (Step 5)
    answerQuizQuestion: (state, action: PayloadAction<QuizResponse>) => {
      // Initialize quiz state if needed
      if (!state.personalityQuiz) {
        state.personalityQuiz = { currentQuestionIndex: 0, responses: [], results: null };
      }
      if (!state.personalityQuiz.responses) {
        state.personalityQuiz.responses = [];
      }
      
      state.personalityQuiz.responses.push(action.payload);
      state.personalityQuiz.currentQuestionIndex += 1;
    },
    
    // Meta
    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
    },
    
    completeWorkshop: (state) => {
      state.isCompleted = true;
      state.completedAt = new Date().toISOString();
    },
    
    resetWorkshop: () => initialState,
    
    loadWorkshopState: (state, action: PayloadAction<Partial<WorkshopState>>) => {
      return { ...state, ...action.payload };
    },
    
    // Assessment
    setAssessmentScore: (state, action: PayloadAction<number>) => {
      state.assessmentScore = action.payload;
    },
    
    setWorkshopPath: (state, action: PayloadAction<'direct' | 'discovery' | 'hybrid'>) => {
      state.workshopPath = action.payload;
    }
  }
});

// Actions
export const {
  startWorkshop,
  goToStep,
  completeStep,
  selectValue,
  deselectValue,
  addCustomValue,
  rankValue,
  setPrimaryValues,
  setAspirationalValues,
  addValueStory,
  updateTonePreference,
  setTonePreset,
  addPersona,
  updatePersona,
  removePersona,
  setPrimaryPersona,
  setWritingSample,
  updateAnalysisResults,
  answerQuizQuestion,
  setSaving,
  setError,
  completeWorkshop,
  resetWorkshop,
  loadWorkshopState,
  setAssessmentScore,
  setWorkshopPath
} = workshopSlice.actions;

// Type for persisted state
interface PersistedWorkshopState extends WorkshopState {
  _persist?: {
    version: number;
    rehydrated: boolean;
  };
}

// Selectors with proper handling for persisted state
export const selectWorkshopState = (state: RootState): WorkshopState => {
  try {
    const workshop = state.workshop as PersistedWorkshopState;
    // If it's a persisted state object, return the actual state
    if (workshop && '_persist' in workshop) {
      // Extract the actual workshop state, excluding _persist
      const { _persist, ...actualState } = workshop;
      return ensureWorkshopState(actualState);
    }
    return ensureWorkshopState(state.workshop);
  } catch (error) {
    console.error('Error in selectWorkshopState:', error);
    // Return a valid default state if there's any error
    return ensureWorkshopState(null);
  }
};

export const selectCurrentStep = (state: RootState) => {
  const workshop = selectWorkshopState(state);
  return workshop?.currentStep || 1;
};

export const selectCompletedSteps = (state: RootState) => {
  const workshop = selectWorkshopState(state);
  return workshop?.completedSteps || [];
};

export const selectIsStepCompleted = (step: number) => (state: RootState) => {
  const completedSteps = selectCompletedSteps(state);
  return completedSteps.includes(step);
};

export const selectWorkshopProgress = (state: RootState) => {
  const completedSteps = selectCompletedSteps(state);
  return (completedSteps.length / 5) * 100;
};

// Reducer
export default workshopSlice.reducer;