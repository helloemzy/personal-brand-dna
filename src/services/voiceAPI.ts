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
    // For demo purposes, return mock data
    return Promise.resolve({
      data: {
        conversationId: 'demo-' + Date.now(),
        currentQuestion: {
          id: 'q1',
          type: 'introduction',
          question: "Tell me about your professional journey. What brought you to where you are today?",
          followUpPrompts: [
            "What moments defined your career path?",
            "What challenges have shaped your expertise?",
            "What achievements are you most proud of?"
          ],
          expectedDuration: 60
        },
        totalQuestions: 5,
        currentQuestionNumber: 1,
        estimatedTimeRemaining: '4-5 minutes'
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  },

  // Upload audio response for transcription and analysis
  uploadAudioResponse: async (
    conversationId: string,
    audioBlob: Blob,
    questionId: string
  ): Promise<AxiosResponse<AudioUploadResponse>> => {
    // For demo purposes, simulate audio processing
    return new Promise((resolve) => {
      setTimeout(() => {
        const questions = [
          {
            id: 'q2',
            type: 'values',
            question: "What values guide your professional decisions?",
            followUpPrompts: [
              "What principles do you never compromise on?",
              "How do these values show up in your work?"
            ],
            expectedDuration: 45
          },
          {
            id: 'q3',
            type: 'expertise',
            question: "What unique expertise or perspective do you bring to your field?",
            followUpPrompts: [
              "What insights have you gained that others might miss?",
              "How does your background influence your approach?"
            ],
            expectedDuration: 60
          },
          {
            id: 'q4',
            type: 'impact',
            question: "Who do you most want to help, and what transformation do you want to create for them?",
            followUpPrompts: [
              "What problems do you solve?",
              "What outcomes do you help people achieve?"
            ],
            expectedDuration: 45
          },
          {
            id: 'q5',
            type: 'style',
            question: "How would colleagues describe your communication style?",
            followUpPrompts: [
              "Are you more formal or casual?",
              "Do you prefer data or stories?"
            ],
            expectedDuration: 30
          }
        ];

        const currentIndex = parseInt(questionId.substring(1)) - 1;
        const nextQuestion = currentIndex < questions.length ? questions[currentIndex] : null;

        resolve({
          data: {
            transcription: "Thank you for sharing that insight. Your response has been recorded.",
            nextQuestion,
            conversationComplete: !nextQuestion
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any
        });
      }, 2000);
    });
  },

  // Submit text response as fallback
  submitTextResponse: async (
    conversationId: string,
    questionId: string,
    response: string,
    isComplete: boolean = false
  ): Promise<AxiosResponse<TextResponseData>> => {
    // For demo purposes, handle text responses similarly
    return voiceAPI.uploadAudioResponse(conversationId, new Blob([response]), questionId).then(res => ({
      ...res,
      data: {
        responseRecorded: true,
        nextQuestion: res.data.nextQuestion,
        conversationComplete: res.data.conversationComplete
      }
    }));
  },

  // Complete conversation and trigger voice analysis
  completeConversation: async (
    conversationId: string
  ): Promise<AxiosResponse<VoiceAnalysisCompleteResponse>> => {
    // For demo purposes, return mock analysis
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: {
            voiceProfileId: 'profile-' + Date.now(),
            confidenceScore: 0.85,
            voiceSignature: {
              formality: 0.7,
              enthusiasm: 0.8,
              directness: 0.75,
              empathy: 0.85,
              confidence: 0.8,
              humor: 0.6,
              storytelling: 0.75,
              technicality: 0.65,
              authority: 0.8,
              vulnerability: 0.7,
              optimism: 0.85,
              brevity: 0.6,
              curiosity: 0.8,
              authenticity: 0.9
            },
            metadata: {
              totalQuestions: 5,
              analysisTime: '45 seconds',
              voiceDimensions: 14
            }
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any
        });
      }, 3000);
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