import { WorkshopState, WorkshopValue, TonePreferences, AudiencePersona, WritingSample, QuizResponse } from '../store/slices/workshopSlice';

/**
 * Deep clone an object to prevent circular references
 */
function deepClone<T>(obj: T, visited = new WeakSet()): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  
  // Handle circular references
  if (visited.has(obj as any)) {
    return {} as T; // Return empty object for circular references
  }
  visited.add(obj as any);
  
  if (obj instanceof Array) {
    const clonedArr: any[] = [];
    for (const item of obj) {
      clonedArr.push(deepClone(item, visited));
    }
    return clonedArr as T;
  }
  
  const clonedObj: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key], visited);
    }
  }
  return clonedObj;
}

/**
 * Remove any nested _persist metadata from the state
 */
export function removePersistedMetadata<T extends Record<string, any>>(state: T): T {
  const cleaned = { ...state };
  
  // Remove top-level _persist
  if ('_persist' in cleaned) {
    delete cleaned._persist;
  }
  
  // Recursively clean nested objects
  for (const key in cleaned) {
    if (cleaned[key] && typeof cleaned[key] === 'object') {
      if (Array.isArray(cleaned[key])) {
        // Clean each array item
        cleaned[key] = cleaned[key].map((item: any) => 
          item && typeof item === 'object' ? removePersistedMetadata(item) : item
        );
      } else {
        // Clean nested object
        cleaned[key] = removePersistedMetadata(cleaned[key]);
      }
    }
  }
  
  return cleaned;
}

/**
 * Ensure arrays are properly formatted and not corrupted
 */
export function sanitizeArrays(state: WorkshopState): WorkshopState {
  const sanitized = deepClone(state);
  
  // Ensure completedSteps is an array
  if (!Array.isArray(sanitized.completedSteps)) {
    sanitized.completedSteps = [];
  } else {
    // Remove duplicates and ensure only valid step numbers
    sanitized.completedSteps = [...new Set(sanitized.completedSteps)]
      .filter(step => typeof step === 'number' && step >= 1 && step <= 5);
  }
  
  // Ensure values arrays
  if (sanitized.values) {
    if (!Array.isArray(sanitized.values.selected)) {
      sanitized.values.selected = [];
    } else {
      // Remove duplicates
      sanitized.values.selected = [...new Set(sanitized.values.selected)]
        .filter(id => typeof id === 'string' && id.length > 0);
    }
    
    if (!Array.isArray(sanitized.values.custom)) {
      sanitized.values.custom = [];
    } else {
      // Validate custom values structure
      sanitized.values.custom = sanitized.values.custom.filter(
        (value): value is WorkshopValue => 
          value && 
          typeof value === 'object' &&
          typeof value.id === 'string' &&
          typeof value.name === 'string' &&
          typeof value.category === 'string' &&
          typeof value.description === 'string'
      );
    }
    
    if (!Array.isArray(sanitized.values.primary)) {
      sanitized.values.primary = [];
    } else {
      sanitized.values.primary = sanitized.values.primary
        .filter(id => typeof id === 'string' && id.length > 0)
        .slice(0, 2); // Max 2 primary values
    }
    
    if (!Array.isArray(sanitized.values.aspirational)) {
      sanitized.values.aspirational = [];
    } else {
      sanitized.values.aspirational = sanitized.values.aspirational
        .filter(id => typeof id === 'string' && id.length > 0);
    }
  }
  
  // Ensure audience personas array
  if (!Array.isArray(sanitized.audiencePersonas)) {
    sanitized.audiencePersonas = [];
  } else {
    sanitized.audiencePersonas = sanitized.audiencePersonas.filter(
      (persona): persona is AudiencePersona =>
        persona &&
        typeof persona === 'object' &&
        typeof persona.id === 'string' &&
        typeof persona.name === 'string' &&
        typeof persona.role === 'string' &&
        typeof persona.industry === 'string' &&
        Array.isArray(persona.painPoints) &&
        Array.isArray(persona.goals)
    );
  }
  
  // Ensure quiz responses array
  if (sanitized.personalityQuiz) {
    if (!Array.isArray(sanitized.personalityQuiz.responses)) {
      sanitized.personalityQuiz.responses = [];
    } else {
      sanitized.personalityQuiz.responses = sanitized.personalityQuiz.responses.filter(
        (response): response is QuizResponse =>
          response &&
          typeof response === 'object' &&
          typeof response.questionId === 'string' &&
          typeof response.answer === 'string' &&
          typeof response.answeredAt === 'string'
      );
    }
  }
  
  return sanitized;
}

/**
 * Ensure all objects have proper structure and no circular references
 */
export function sanitizeObjects(state: WorkshopState): WorkshopState {
  const sanitized = { ...state };
  
  // Ensure values object structure
  if (!sanitized.values || typeof sanitized.values !== 'object') {
    sanitized.values = {
      selected: [],
      custom: [],
      rankings: {},
      primary: [],
      aspirational: [],
      stories: {}
    };
  } else {
    // Ensure rankings is an object
    if (!sanitized.values.rankings || typeof sanitized.values.rankings !== 'object' || Array.isArray(sanitized.values.rankings)) {
      sanitized.values.rankings = {};
    } else {
      // Clean rankings - ensure values are numbers
      const cleanedRankings: Record<string, number> = {};
      for (const [key, value] of Object.entries(sanitized.values.rankings)) {
        if (typeof key === 'string' && typeof value === 'number' && value >= 1 && value <= 10) {
          cleanedRankings[key] = value;
        }
      }
      sanitized.values.rankings = cleanedRankings;
    }
    
    // Ensure stories is an object
    if (!sanitized.values.stories || typeof sanitized.values.stories !== 'object' || Array.isArray(sanitized.values.stories)) {
      sanitized.values.stories = {};
    } else {
      // Clean stories - ensure values are strings
      const cleanedStories: Record<string, string> = {};
      for (const [key, value] of Object.entries(sanitized.values.stories)) {
        if (typeof key === 'string' && typeof value === 'string') {
          cleanedStories[key] = value;
        }
      }
      sanitized.values.stories = cleanedStories;
    }
  }
  
  // Ensure tone preferences structure
  if (!sanitized.tonePreferences || typeof sanitized.tonePreferences !== 'object') {
    sanitized.tonePreferences = {
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0
    };
  } else {
    // Validate tone preference values
    const validatedTone: TonePreferences = {
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0
    };
    
    for (const key of Object.keys(validatedTone) as (keyof TonePreferences)[]) {
      const value = sanitized.tonePreferences[key];
      if (typeof value === 'number' && value >= -50 && value <= 50) {
        validatedTone[key] = value;
      }
    }
    
    sanitized.tonePreferences = validatedTone;
  }
  
  // Ensure personality quiz structure
  if (!sanitized.personalityQuiz || typeof sanitized.personalityQuiz !== 'object') {
    sanitized.personalityQuiz = {
      responses: [],
      currentQuestionIndex: 0
    };
  } else {
    if (typeof sanitized.personalityQuiz.currentQuestionIndex !== 'number' || 
        sanitized.personalityQuiz.currentQuestionIndex < 0) {
      sanitized.personalityQuiz.currentQuestionIndex = 0;
    }
  }
  
  return sanitized;
}

/**
 * Main sanitizer function to clean workshop state for safe persistence
 */
export function sanitizeWorkshopState(state: any): WorkshopState {
  // Handle primitive types and null/undefined
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return getDefaultWorkshopState();
  }
  
  // Start with a deep clone to prevent mutations
  let sanitized = deepClone(state);
  
  // Remove any _persist metadata
  sanitized = removePersistedMetadata(sanitized);
  
  // Ensure base structure
  if (!sanitized || typeof sanitized !== 'object') {
    return getDefaultWorkshopState();
  }
  
  // Validate and fix basic fields
  sanitized.currentStep = 
    typeof sanitized.currentStep === 'number' && 
    sanitized.currentStep >= 1 && 
    sanitized.currentStep <= 5 
      ? sanitized.currentStep 
      : 1;
  
  sanitized.isCompleted = Boolean(sanitized.isCompleted);
  sanitized.isSaving = Boolean(sanitized.isSaving);
  
  // Validate optional fields
  sanitized.assessmentScore = 
    typeof sanitized.assessmentScore === 'number' && 
    sanitized.assessmentScore >= 0 && 
    sanitized.assessmentScore <= 100 
      ? sanitized.assessmentScore 
      : null;
  
  sanitized.workshopPath = 
    ['direct', 'discovery', 'hybrid'].includes(sanitized.workshopPath) 
      ? sanitized.workshopPath 
      : null;
  
  // Validate ISO strings
  sanitized.startedAt = isValidISOString(sanitized.startedAt) ? sanitized.startedAt : null;
  sanitized.lastSavedAt = isValidISOString(sanitized.lastSavedAt) ? sanitized.lastSavedAt : null;
  sanitized.completedAt = isValidISOString(sanitized.completedAt) ? sanitized.completedAt : null;
  
  // Validate strings
  sanitized.sessionId = typeof sanitized.sessionId === 'string' ? sanitized.sessionId : null;
  sanitized.lastError = typeof sanitized.lastError === 'string' ? sanitized.lastError : null;
  
  // Sanitize objects
  sanitized = sanitizeObjects(sanitized);
  
  // Sanitize arrays
  sanitized = sanitizeArrays(sanitized);
  
  // Validate writing sample
  if (sanitized.writingSample && typeof sanitized.writingSample === 'object') {
    const sample = sanitized.writingSample;
    if (
      typeof sample.text !== 'string' ||
      typeof sample.wordCount !== 'number' ||
      !isValidISOString(sample.uploadedAt)
    ) {
      sanitized.writingSample = null;
    }
  } else {
    sanitized.writingSample = null;
  }
  
  // Create clean state with only known fields
  const cleanState: WorkshopState = {
    currentStep: sanitized.currentStep,
    completedSteps: sanitized.completedSteps,
    isCompleted: sanitized.isCompleted,
    assessmentScore: sanitized.assessmentScore,
    workshopPath: sanitized.workshopPath,
    startedAt: sanitized.startedAt,
    lastSavedAt: sanitized.lastSavedAt,
    completedAt: sanitized.completedAt,
    values: sanitized.values,
    tonePreferences: sanitized.tonePreferences,
    audiencePersonas: sanitized.audiencePersonas,
    writingSample: sanitized.writingSample,
    personalityQuiz: sanitized.personalityQuiz,
    sessionId: sanitized.sessionId,
    isSaving: sanitized.isSaving,
    lastError: sanitized.lastError
  };
  
  return cleanState;
}

/**
 * Check if a value is a valid ISO string
 */
function isValidISOString(value: any): boolean {
  if (typeof value !== 'string') return false;
  try {
    const date = new Date(value);
    return date.toISOString() === value;
  } catch {
    return false;
  }
}

/**
 * Get a clean default workshop state
 */
export function getDefaultWorkshopState(): WorkshopState {
  return {
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
}

/**
 * Compare two states to check if they're equivalent (for debugging)
 */
export function areStatesEquivalent(state1: WorkshopState, state2: WorkshopState): boolean {
  try {
    const sanitized1 = JSON.stringify(sanitizeWorkshopState(state1), null, 2);
    const sanitized2 = JSON.stringify(sanitizeWorkshopState(state2), null, 2);
    return sanitized1 === sanitized2;
  } catch {
    return false;
  }
}