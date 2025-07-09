import { WorkshopState } from '../store/slices/workshopSlice';
import { Archetype, ArchetypeScore } from '../services/archetypeService';

// Re-export WorkshopState as WorkshopData for clarity
export type WorkshopData = WorkshopState;

// Processing status tracking
export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  lastUpdated: string;
  error?: ProcessingError;
}

// Processing error structure
export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
}

// Processed results structure
export interface ProcessedResults {
  sessionId: string;
  timestamp: string;
  archetype: ArchetypeScore | null;
  mission: string[];
  contentPillars: ContentPillar[];
  uvp: UVPAnalysis | null;
  headlines: LinkedInHeadline[];
  elevatorPitches: ElevatorPitch[];
  contentIdeas: ContentIdea[];
}

// Content pillar structure
export interface ContentPillar {
  name: string;
  percentage: number;
  description: string;
  topics: string[];
  voiceGuidelines: string;
  color: string;
}

// UVP analysis structure
export interface UVPAnalysis {
  statement: string;
  differentiators: string[];
  marketPosition: string;
  variations: {
    standard: string;
    resultsFocused: string;
    painFocused: string;
  };
  headlines: {
    standard: string;
    resultsFocused: string;
    painFocused: string;
  };
}

// LinkedIn headline structure
export interface LinkedInHeadline {
  style: string;
  headline: string;
  length: number;
  keywords: string[];
  isOptimalLength: boolean;
}

// Elevator pitch structure
export interface ElevatorPitch {
  duration: string;
  type: string;
  pitch: string;
  wordCount: number;
  keyPoints: string[];
}

// Content idea structure
export interface ContentIdea {
  title: string;
  hook: string;
  angle: string;
  pillar: string;
  engagementType: string;
}

// Workshop session info
export interface WorkshopSession {
  id: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  currentStep: number;
  data: WorkshopData;
  results?: ProcessedResults;
  version: number;
}

// API response types
export interface ProcessingResponse {
  success: boolean;
  sessionId?: string;
  results?: ProcessedResults;
  error?: ProcessingError;
}

export interface SessionRecoveryData {
  sessions: WorkshopSession[];
  mostRecent: WorkshopSession | null;
}