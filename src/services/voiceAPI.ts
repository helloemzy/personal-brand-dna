import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// Voice API response types
export interface ConversationQuestion {
  id: string;
  type: string;
  question: string;
  followUpPrompts: string[];
  expectedDuration: number;
}

export interface ConversationStartResponse {
  conversationId: string;
  currentQuestion: ConversationQuestion;
  totalQuestions: number;
  currentQuestionNumber: number;
  estimatedTimeRemaining: string;
}

export interface AudioUploadResponse {
  transcription: string;
  nextQuestion: ConversationQuestion | null;
  conversationComplete: boolean;
}

export interface TextResponseData {
  responseRecorded: boolean;
  nextQuestion: ConversationQuestion | null;
  conversationComplete: boolean;
}

export interface VoiceSignature {
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
}

export interface VoiceProfile {
  id: string;
  voiceSignature: VoiceSignature;
  confidenceScore: number;
  metadata: {
    totalQuestions: number;
    analysisTime: string;
    voiceDimensions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VoiceAnalysisCompleteResponse {
  voiceProfileId: string;
  confidenceScore: number;
  voiceSignature: VoiceSignature;
  metadata: {
    totalQuestions: number;
    analysisTime: string;
    voiceDimensions: number;
  };
}

export interface VoiceProfilesResponse {
  profiles: Array<{
    id: string;
    confidenceScore: number;
    createdAt: string;
    updatedAt: string;
    metadata: any;
    voiceDimensions: number;
  }>;
  totalProfiles: number;
}

// Voice API service
export const voiceAPI = {
  // Start voice discovery conversation
  startConversation: async (): Promise<AxiosResponse<ConversationStartResponse>> => {
    return apiClient.post('/workshop?action=start');
  },

  // Upload audio response for transcription and analysis
  uploadAudioResponse: async (
    conversationId: string,
    audioBlob: Blob,
    questionId: string
  ): Promise<AxiosResponse<AudioUploadResponse>> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'response.webm');
    formData.append('questionId', questionId);
    formData.append('conversationId', conversationId);
    formData.append('action', 'audio');

    return apiClient.post('/workshop', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 1 minute timeout for audio processing
    });
  },

  // Submit text response as fallback
  submitTextResponse: async (
    conversationId: string,
    questionId: string,
    response: string,
    isComplete: boolean = false
  ): Promise<AxiosResponse<TextResponseData>> => {
    return apiClient.post('/workshop?action=save', {
      conversationId,
      questionId,
      response,
      isComplete,
    });
  },

  // Complete conversation and trigger voice analysis
  completeConversation: async (
    conversationId: string
  ): Promise<AxiosResponse<VoiceAnalysisCompleteResponse>> => {
    return apiClient.post('/workshop?action=complete', { conversationId }, {
      timeout: 120000, // 2 minute timeout for analysis
    });
  },

  // Get user's voice profiles
  getVoiceProfiles: async (): Promise<AxiosResponse<VoiceProfilesResponse>> => {
    return apiClient.get('/workshop?action=sessions');
  },

  // Get specific voice profile with full details
  getVoiceProfile: async (profileId: string): Promise<AxiosResponse<{ profile: VoiceProfile }>> => {
    return apiClient.get(`/workshop?action=detail&id=${profileId}`);
  },

  // Delete voice profile
  deleteVoiceProfile: async (profileId: string): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/workshop?action=delete&id=${profileId}`);
  },
};

// Helper function to create audio blob from MediaRecorder
export const createAudioBlob = (chunks: BlobPart[], mimeType: string = 'audio/webm'): Blob => {
  return new Blob(chunks, { type: mimeType });
};

// Helper function to format voice dimensions for display
export const formatVoiceDimensions = (voiceSignature: VoiceSignature): Array<{
  dimension: string;
  value: number;
  percentage: number;
  label: string;
}> => {
  const dimensionLabels: Record<keyof VoiceSignature, string> = {
    formality: 'Formality',
    enthusiasm: 'Enthusiasm',
    directness: 'Directness',
    empathy: 'Empathy',
    confidence: 'Confidence',
    humor: 'Humor',
    storytelling: 'Storytelling',
    technicality: 'Technical Detail',
    authority: 'Authority',
    vulnerability: 'Vulnerability',
    optimism: 'Optimism',
    brevity: 'Brevity',
    curiosity: 'Curiosity',
    authenticity: 'Authenticity',
  };

  return Object.entries(voiceSignature).map(([key, value]) => ({
    dimension: key,
    value,
    percentage: Math.round(value * 100),
    label: dimensionLabels[key as keyof VoiceSignature],
  }));
};

// Helper function to get confidence level description
export const getConfidenceDescription = (score: number): string => {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.8) return 'Very Good';
  if (score >= 0.7) return 'Good';
  if (score >= 0.6) return 'Fair';
  return 'Needs Improvement';
};

// Helper function to format duration from seconds
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default voiceAPI;