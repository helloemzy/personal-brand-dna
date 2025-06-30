import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// Workshop API response types
export interface WorkshopSession {
  id: string;
  userId: string;
  step: number;
  completed: boolean;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopStartResponse {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  stepData: any;
}

export interface WorkshopSaveResponse {
  success: boolean;
  nextStep?: number;
  message?: string;
}

export interface WorkshopCompleteResponse {
  sessionId: string;
  voiceProfileId: string;
  summary: Record<string, any>;
}

export interface WorkshopSessionsResponse {
  sessions: WorkshopSession[];
  totalSessions: number;
}

// Workshop API service
export const workshopAPI = {
  // Start a new workshop session
  startWorkshop: async (): Promise<AxiosResponse<WorkshopStartResponse>> => {
    return apiClient.post('/workshop?action=start');
  },

  // Save workshop progress
  saveProgress: async (data: {
    sessionId: string;
    step: number;
    stepData: any;
  }): Promise<AxiosResponse<WorkshopSaveResponse>> => {
    return apiClient.post('/workshop?action=save', data);
  },

  // Complete workshop and generate voice profile
  completeWorkshop: async (sessionId: string): Promise<AxiosResponse<WorkshopCompleteResponse>> => {
    return apiClient.post('/workshop?action=complete', { sessionId });
  },

  // Get all workshop sessions for user
  getSessions: async (): Promise<AxiosResponse<WorkshopSessionsResponse>> => {
    return apiClient.get('/workshop?action=sessions');
  },

  // Get specific workshop session
  getSession: async (sessionId: string): Promise<AxiosResponse<{ session: WorkshopSession }>> => {
    return apiClient.get(`/workshop?action=detail&id=${sessionId}`);
  },

  // Resume a workshop session
  resumeSession: async (sessionId: string): Promise<AxiosResponse<WorkshopStartResponse>> => {
    return apiClient.post('/workshop?action=resume', { sessionId });
  },

  // Delete a workshop session
  deleteSession: async (sessionId: string): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/workshop?action=delete&id=${sessionId}`);
  },
};

// Workshop step configurations
export const WORKSHOP_STEPS = {
  VALUES_AUDIT: {
    step: 1,
    title: 'Values Audit',
    description: 'Select your core professional values',
  },
  TONE_PREFERENCES: {
    step: 2,
    title: 'Tone Preferences',
    description: 'Adjust your communication style',
  },
  AUDIENCE_PERSONAS: {
    step: 3,
    title: 'Audience Personas',
    description: 'Define your target audience',
  },
  WRITING_SAMPLE: {
    step: 4,
    title: 'Writing Sample',
    description: 'Provide a sample of your writing',
  },
  PERSONALITY_QUIZ: {
    step: 5,
    title: 'Personality Quiz',
    description: 'Complete a quick personality assessment',
  },
};

// Helper functions
export const getStepProgress = (currentStep: number, totalSteps: number): number => {
  return Math.round((currentStep / totalSteps) * 100);
};

export const isStepComplete = (stepData: any): boolean => {
  if (!stepData) return false;
  
  // Check if step has required data based on step type
  if (stepData.values && Array.isArray(stepData.values)) {
    return stepData.values.length > 0;
  }
  if (stepData.toneSettings && typeof stepData.toneSettings === 'object') {
    return Object.keys(stepData.toneSettings).length > 0;
  }
  if (stepData.audiences && Array.isArray(stepData.audiences)) {
    return stepData.audiences.length > 0;
  }
  if (stepData.writingSample && typeof stepData.writingSample === 'string') {
    return stepData.writingSample.length > 50;
  }
  if (stepData.quizResponses && Array.isArray(stepData.quizResponses)) {
    return stepData.quizResponses.length >= 10;
  }
  
  return false;
};

export default workshopAPI;