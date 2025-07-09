import { 
  WorkshopData, 
  ProcessedResults,
  ProcessingStatus,
  ProcessingError 
} from '../types/workshop';
import { determineArchetype } from './archetypeService';
import { generateAIMission } from './aiAnalysisService';
import { generateContentPillars } from './contentPillarService';
import { generateUVP } from './uvpConstructorService';
import { generateLinkedInHeadlines } from './linkedinHeadlineService';
import { trackEvent } from './trackingService';
import * as Sentry from '@sentry/react';

// Types for processing pipeline
export interface ProcessingPipelineOptions {
  enableCache?: boolean;
  cacheTimeout?: number;
  skipValidation?: boolean;
  trackProgress?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  data?: ProcessedResults;
  error?: ProcessingError;
  processingTime: number;
  cached: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// In-memory cache for results (in production, use Redis)
const resultsCache = new Map<string, { data: ProcessedResults; timestamp: number }>();
const CACHE_TIMEOUT = 1000 * 60 * 60; // 1 hour

// Processing status tracking
const processingStatus = new Map<string, ProcessingStatus>();

/**
 * Master processing function that orchestrates all workshop data processing
 */
export async function processWorkshopData(
  workshopData: WorkshopData,
  sessionId: string,
  options: ProcessingPipelineOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const {
    enableCache = true,
    cacheTimeout = CACHE_TIMEOUT,
    skipValidation = false,
    trackProgress = true
  } = options;

  try {
    // Track processing start
    if (trackProgress) {
      trackEvent('workshop_processing_started', {
        sessionId,
        hasCache: enableCache
      });
      updateProcessingStatus(sessionId, 'processing', 0);
    }

    // Check cache first
    if (enableCache) {
      const cachedResult = getCachedResult(sessionId, cacheTimeout);
      if (cachedResult) {
        return {
          success: true,
          data: cachedResult,
          processingTime: Date.now() - startTime,
          cached: true
        };
      }
    }

    // Validate workshop data
    if (!skipValidation) {
      const validation = validateWorkshopData(workshopData);
      if (!validation.isValid) {
        throw new ProcessingError('VALIDATION_ERROR', validation.errors.join(', '));
      }
    }

    // Process each component with progress tracking
    const processedResults: ProcessedResults = {
      sessionId,
      timestamp: new Date().toISOString(),
      archetype: null,
      mission: [],
      contentPillars: [],
      uvp: null,
      headlines: [],
      elevatorPitches: [],
      contentIdeas: []
    };

    // Step 1: Determine archetype (20% progress)
    updateProcessingStatus(sessionId, 'processing', 20);
    const archetypeResult = await determineArchetype(workshopData);
    processedResults.archetype = archetypeResult;

    // Step 2: Generate AI mission statements (40% progress)
    updateProcessingStatus(sessionId, 'processing', 40);
    const missionStatements = await generateAIMission(workshopData, archetypeResult);
    processedResults.mission = missionStatements;

    // Step 3: Generate content pillars (60% progress)
    updateProcessingStatus(sessionId, 'processing', 60);
    const contentPillars = await generateContentPillars(workshopData, archetypeResult);
    processedResults.contentPillars = contentPillars.pillars;
    processedResults.contentIdeas = contentPillars.starterContent;

    // Step 4: Generate UVP (80% progress)
    updateProcessingStatus(sessionId, 'processing', 80);
    const uvpAnalysis = await generateUVP(workshopData, archetypeResult);
    processedResults.uvp = uvpAnalysis;

    // Step 5: Generate LinkedIn headlines (90% progress)
    updateProcessingStatus(sessionId, 'processing', 90);
    const headlines = await generateLinkedInHeadlines(
      workshopData.personalInfo.professionalRole,
      archetypeResult,
      uvpAnalysis,
      contentPillars.pillars
    );
    processedResults.headlines = headlines;

    // Step 6: Generate elevator pitches (95% progress)
    updateProcessingStatus(sessionId, 'processing', 95);
    processedResults.elevatorPitches = generateElevatorPitches(
      workshopData,
      archetypeResult,
      uvpAnalysis
    );

    // Cache the results
    if (enableCache) {
      cacheResult(sessionId, processedResults);
    }

    // Mark as complete
    updateProcessingStatus(sessionId, 'completed', 100);

    // Track success
    if (trackProgress) {
      trackEvent('workshop_processing_completed', {
        sessionId,
        processingTime: Date.now() - startTime,
        cached: false
      });
    }

    return {
      success: true,
      data: processedResults,
      processingTime: Date.now() - startTime,
      cached: false
    };

  } catch (error) {
    // Track error
    Sentry.captureException(error, {
      tags: { sessionId, component: 'workshop_processing' }
    });

    if (trackProgress) {
      trackEvent('workshop_processing_error', {
        sessionId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
    }

    updateProcessingStatus(sessionId, 'error', 0);

    return {
      success: false,
      error: {
        code: error.code || 'PROCESSING_ERROR',
        message: error.message || 'Failed to process workshop data',
        details: error
      },
      processingTime: Date.now() - startTime,
      cached: false
    };
  }
}

/**
 * Validate workshop data before processing
 */
function validateWorkshopData(data: WorkshopData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!data.personalInfo?.professionalRole) {
    errors.push('Professional role is required');
  }

  if (!data.values?.selected || data.values.selected.length === 0) {
    errors.push('At least one value must be selected');
  }

  if (!data.tone?.selectedWords || data.tone.selectedWords.length === 0) {
    errors.push('Tone words must be selected');
  }

  if (!data.audience?.personas || data.audience.personas.length === 0) {
    errors.push('At least one audience persona is required');
  }

  if (!data.writingSample?.sample) {
    errors.push('Writing sample is required');
  }

  if (!data.personality?.answers || Object.keys(data.personality.answers).length === 0) {
    errors.push('Personality quiz must be completed');
  }

  // Warnings for optional but recommended fields
  if (!data.values?.primaryValues || data.values.primaryValues.length < 2) {
    warnings.push('Selecting 2 primary values improves results');
  }

  if (!data.audience?.personas.some(p => p.isPrimary)) {
    warnings.push('Selecting a primary audience improves targeting');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get cached result if available and not expired
 */
function getCachedResult(sessionId: string, timeout: number): ProcessedResults | null {
  const cached = resultsCache.get(sessionId);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > timeout) {
    resultsCache.delete(sessionId);
    return null;
  }

  return cached.data;
}

/**
 * Cache processing results
 */
function cacheResult(sessionId: string, data: ProcessedResults): void {
  resultsCache.set(sessionId, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Update processing status for real-time tracking
 */
function updateProcessingStatus(
  sessionId: string, 
  status: 'pending' | 'processing' | 'completed' | 'error',
  progress: number
): void {
  processingStatus.set(sessionId, {
    status,
    progress,
    lastUpdated: new Date().toISOString()
  });
}

/**
 * Get current processing status
 */
export function getProcessingStatus(sessionId: string): ProcessingStatus | null {
  return processingStatus.get(sessionId) || null;
}

/**
 * Generate elevator pitches based on workshop data
 */
function generateElevatorPitches(
  workshopData: WorkshopData,
  archetype: any,
  uvp: any
): any[] {
  // This is a simplified version - in production, this would use AI
  const { professionalRole, yearsExperience } = workshopData.personalInfo;
  const primaryValue = workshopData.values.primaryValues?.[0] || workshopData.values.selected[0];
  const transformation = workshopData.audience.personas[0]?.transformation || '';

  return [
    {
      duration: '30-second',
      type: 'Problem-Solution',
      pitch: `As a ${professionalRole} with ${yearsExperience} years of experience, I help ${workshopData.audience.personas[0].description} ${transformation}. What makes me different is ${uvp.differentiators[0]}. I believe in ${primaryValue} and use my expertise to ${archetype.mission}.`,
      wordCount: 65,
      keyPoints: ['Problem identification', 'Clear solution', 'Unique value']
    },
    {
      duration: '60-second',
      type: 'Story-Based',
      pitch: `I've spent ${yearsExperience} years as a ${professionalRole}, and I've noticed that ${workshopData.audience.personas[0].painPoints?.[0] || 'many professionals struggle'}. This frustrates me because ${workshopData.values.stories?.[primaryValue] || 'I believe everyone deserves better'}. That's why I ${archetype.mission}. My approach is unique because ${uvp.differentiators.join(' and ')}. I've helped dozens of ${workshopData.audience.personas[0].description} ${transformation}, and I'd love to help you too.`,
      wordCount: 120,
      keyPoints: ['Personal story', 'Empathy', 'Clear outcome', 'Call to action']
    },
    {
      duration: 'Networking Event',
      type: 'Conversational',
      pitch: `I'm a ${professionalRole} who ${archetype.tagline}. Basically, I help ${workshopData.audience.personas[0].description} ${transformation}. What I love most is ${workshopData.values.stories?.[primaryValue] || 'seeing the transformation'}. How about you - what brings you here?`,
      wordCount: 45,
      keyPoints: ['Casual intro', 'Clear value', 'Conversation starter']
    }
  ];
}

/**
 * Clear cache for a specific session
 */
export function clearSessionCache(sessionId: string): void {
  resultsCache.delete(sessionId);
  processingStatus.delete(sessionId);
}

/**
 * Clear all cached results
 */
export function clearAllCache(): void {
  resultsCache.clear();
  processingStatus.clear();
}

/**
 * Custom error class for processing errors
 */
class ProcessingError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ProcessingError';
  }
}

// Export all functions and types
export {
  ProcessingError,
  ValidationResult
};