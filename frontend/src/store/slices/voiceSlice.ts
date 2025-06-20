import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface VoiceProfile {
  id: string;
  userId: string;
  dimensions: {
    formality: number;
    enthusiasm: number;
    directness: number;
    empathy: number;
    confidence: number;
    humor: number;
    storytelling: number;
    technicality: number;
    authority: number;
    vulnerability: number;
    optimism: number;
    brevity: number;
    curiosity: number;
    authenticity: number;
  };
  accuracy: number;
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceState {
  profile: VoiceProfile | null;
  isAnalyzing: boolean;
  analysisProgress: number;
  error: string | null;
  discoverySession: {
    isActive: boolean;
    currentQuestion: number;
    totalQuestions: number;
    responses: Array<{
      questionId: string;
      response: string;
      audioUrl?: string;
      timestamp: string;
    }>;
  };
}

const initialState: VoiceState = {
  profile: null,
  isAnalyzing: false,
  analysisProgress: 0,
  error: null,
  discoverySession: {
    isActive: false,
    currentQuestion: 0,
    totalQuestions: 10,
    responses: [],
  },
};

const voiceSlice = createSlice({
  name: 'voice',
  initialState,
  reducers: {
    startVoiceDiscovery: (state) => {
      state.discoverySession.isActive = true;
      state.discoverySession.currentQuestion = 0;
      state.discoverySession.responses = [];
      state.error = null;
    },
    
    nextQuestion: (state) => {
      if (state.discoverySession.currentQuestion < state.discoverySession.totalQuestions - 1) {
        state.discoverySession.currentQuestion += 1;
      }
    },
    
    addResponse: (state, action: PayloadAction<{
      questionId: string;
      response: string;
      audioUrl?: string;
    }>) => {
      state.discoverySession.responses.push({
        ...action.payload,
        timestamp: new Date().toISOString(),
      });
    },
    
    startVoiceAnalysis: (state) => {
      state.isAnalyzing = true;
      state.analysisProgress = 0;
      state.error = null;
    },
    
    updateAnalysisProgress: (state, action: PayloadAction<number>) => {
      state.analysisProgress = action.payload;
    },
    
    completeVoiceAnalysis: (state, action: PayloadAction<VoiceProfile>) => {
      state.isAnalyzing = false;
      state.analysisProgress = 100;
      state.profile = action.payload;
      state.discoverySession.isActive = false;
      state.error = null;
    },
    
    setVoiceAnalysisError: (state, action: PayloadAction<string>) => {
      state.isAnalyzing = false;
      state.error = action.payload;
    },
    
    clearVoiceError: (state) => {
      state.error = null;
    },
    
    endVoiceDiscovery: (state) => {
      state.discoverySession.isActive = false;
    },
    
    updateVoiceProfile: (state, action: PayloadAction<Partial<VoiceProfile>>) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },
    
    clearVoiceProfile: (state) => {
      state.profile = null;
      state.discoverySession = initialState.discoverySession;
      state.error = null;
    },
  },
});

export const {
  startVoiceDiscovery,
  nextQuestion,
  addResponse,
  startVoiceAnalysis,
  updateAnalysisProgress,
  completeVoiceAnalysis,
  setVoiceAnalysisError,
  clearVoiceError,
  endVoiceDiscovery,
  updateVoiceProfile,
  clearVoiceProfile,
} = voiceSlice.actions;

// Selectors
export const selectVoiceProfile = (state: { voice: VoiceState }) => state.voice.profile;
export const selectIsAnalyzing = (state: { voice: VoiceState }) => state.voice.isAnalyzing;
export const selectAnalysisProgress = (state: { voice: VoiceState }) => state.voice.analysisProgress;
export const selectDiscoverySession = (state: { voice: VoiceState }) => state.voice.discoverySession;
export const selectVoiceError = (state: { voice: VoiceState }) => state.voice.error;

export default voiceSlice.reducer;