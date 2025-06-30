import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
}

export interface WritingSample {
  text: string;
  wordCount: number;
  uploadedAt: Date;
  analysisResults?: {
    readability: number;
    sentiment: Record<string, number>;
    styleMetrics: Record<string, any>;
  };
}

export interface QuizResponse {
  questionId: string;
  answer: string;
  answeredAt: Date;
}

export interface WorkshopState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5;
  completedSteps: number[];
  isCompleted: boolean;
  
  // Timing
  startedAt: Date | null;
  lastSavedAt: Date | null;
  completedAt: Date | null;
  
  // Step 1: Values
  values: {
    selected: string[];
    custom: WorkshopValue[];
    rankings: Record<string, number>; // valueId -> rank (1-10)
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

const workshopSlice = createSlice({
  name: 'workshop',
  initialState,
  reducers: {
    // Navigation
    startWorkshop: (state) => {
      state.startedAt = new Date();
      state.sessionId = `workshop_${Date.now()}`;
    },
    
    goToStep: (state, action: PayloadAction<1 | 2 | 3 | 4 | 5>) => {
      state.currentStep = action.payload;
    },
    
    completeStep: (state, action: PayloadAction<number>) => {
      if (!state.completedSteps.includes(action.payload)) {
        state.completedSteps.push(action.payload);
      }
      state.lastSavedAt = new Date();
    },
    
    // Values (Step 1)
    selectValue: (state, action: PayloadAction<string>) => {
      if (!state.values.selected.includes(action.payload)) {
        state.values.selected.push(action.payload);
      }
    },
    
    deselectValue: (state, action: PayloadAction<string>) => {
      state.values.selected = state.values.selected.filter(id => id !== action.payload);
      delete state.values.rankings[action.payload];
    },
    
    addCustomValue: (state, action: PayloadAction<WorkshopValue>) => {
      state.values.custom.push(action.payload);
      state.values.selected.push(action.payload.id);
    },
    
    rankValue: (state, action: PayloadAction<{ valueId: string; rank: number }>) => {
      state.values.rankings[action.payload.valueId] = action.payload.rank;
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
      state.completedAt = new Date();
    },
    
    resetWorkshop: () => initialState,
    
    loadWorkshopState: (state, action: PayloadAction<Partial<WorkshopState>>) => {
      return { ...state, ...action.payload };
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
  updateTonePreference,
  setTonePreset,
  addPersona,
  updatePersona,
  removePersona,
  setWritingSample,
  updateAnalysisResults,
  answerQuizQuestion,
  setSaving,
  setError,
  completeWorkshop,
  resetWorkshop,
  loadWorkshopState
} = workshopSlice.actions;

// Selectors
type StateWithWorkshop = { workshop: WorkshopState };
export const selectWorkshopState = (state: StateWithWorkshop) => state.workshop;
export const selectCurrentStep = (state: StateWithWorkshop) => state.workshop.currentStep;
export const selectCompletedSteps = (state: StateWithWorkshop) => state.workshop.completedSteps;
export const selectIsStepCompleted = (step: number) => (state: StateWithWorkshop) => 
  state.workshop.completedSteps.includes(step);
export const selectWorkshopProgress = (state: StateWithWorkshop) => 
  (state.workshop.completedSteps.length / 5) * 100;

// Reducer
export default workshopSlice.reducer;