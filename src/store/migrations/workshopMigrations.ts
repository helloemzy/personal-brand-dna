/**
 * Workshop State Migrations
 * Handles state structure changes over time for the workshop slice
 */

import { createMigrate } from 'redux-persist';
import type { MigrationManifest, PersistedState } from 'redux-persist/es/types';

/**
 * Migration from version 0 to 1
 * Removes nested _persist metadata that can cause Redux DevTools crashes
 */
const migration0to1 = (state: PersistedState): PersistedState => {
  console.log('Running workshop migration 0 → 1: Removing nested persist metadata');
  
  if (!state) return state;

  // Create a deep copy of the state
  const newState = JSON.parse(JSON.stringify(state));

  // Remove any nested _persist fields
  const removeNestedPersist = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // If this is an array, process each element
    if (Array.isArray(obj)) {
      return obj.map(item => removeNestedPersist(item));
    }
    
    // Create a new object without _persist at any nested level
    const cleaned: any = {};
    for (const key in obj) {
      if (key === '_persist' && obj !== newState) {
        // Skip nested _persist fields (but keep the root one)
        continue;
      }
      cleaned[key] = removeNestedPersist(obj[key]);
    }
    return cleaned;
  };

  // Clean the workshop data
  if (newState.workshop) {
    newState.workshop = removeNestedPersist(newState.workshop);
  }

  return newState;
};

/**
 * Migration from version 1 to 2
 * Fixes array structures and ensures proper initialization
 */
const migration1to2 = (state: PersistedState): PersistedState => {
  console.log('Running workshop migration 1 → 2: Fixing array structures');
  
  if (!state) return state;

  const newState = { ...state };

  // Ensure workshop exists
  if (!newState.workshop) {
    newState.workshop = {};
  }

  const workshop = newState.workshop as any;

  // Fix values structure - ensure it's an object, not an array
  if (Array.isArray(workshop.values) || !workshop.values) {
    workshop.values = {
      selected: [],
      custom: [],
      rankings: {},
      primary: [],
      aspirational: [],
      stories: {},
    };
  }

  // Ensure audiencePersonas is an array
  if (!Array.isArray(workshop.audiencePersonas)) {
    workshop.audiencePersonas = [];
  }

  // Fix personalityQuiz structure
  if (!workshop.personalityQuiz || Array.isArray(workshop.personalityQuiz)) {
    workshop.personalityQuiz = {
      responses: [],
      currentQuestionIndex: 0,
    };
  }

  // Ensure completedSteps is an array
  if (!Array.isArray(workshop.completedSteps)) {
    workshop.completedSteps = [];
  }

  return newState;
};

/**
 * Migration from version 2 to 3
 * Adds missing fields and ensures complete structure matching WorkshopState interface
 */
const migration2to3 = (state: PersistedState): PersistedState => {
  console.log('Running workshop migration 2 → 3: Adding missing fields');
  
  if (!state) return state;

  const newState = { ...state };

  // Ensure workshop exists
  if (!newState.workshop) {
    newState.workshop = {};
  }

  const workshop = newState.workshop as any;

  // Add missing top-level fields with defaults
  workshop.currentStep = workshop.currentStep || 1;
  workshop.completedSteps = workshop.completedSteps || [];
  workshop.isCompleted = workshop.isCompleted ?? false;
  workshop.assessmentScore = workshop.assessmentScore ?? null;
  workshop.workshopPath = workshop.workshopPath || null;
  workshop.startedAt = workshop.startedAt || null;
  workshop.lastSavedAt = workshop.lastSavedAt || null;
  workshop.completedAt = workshop.completedAt || null;
  workshop.sessionId = workshop.sessionId || null;
  workshop.isSaving = workshop.isSaving ?? false;
  workshop.lastError = workshop.lastError || null;

  // Ensure values structure is complete
  if (!workshop.values || typeof workshop.values !== 'object') {
    workshop.values = {
      selected: [],
      custom: [],
      rankings: {},
      primary: [],
      aspirational: [],
      stories: {},
    };
  } else {
    workshop.values.selected = workshop.values.selected || [];
    workshop.values.custom = workshop.values.custom || [];
    workshop.values.rankings = workshop.values.rankings || {};
    workshop.values.primary = workshop.values.primary || [];
    workshop.values.aspirational = workshop.values.aspirational || [];
    workshop.values.stories = workshop.values.stories || {};
  }

  // Ensure tonePreferences structure is complete
  if (!workshop.tonePreferences || typeof workshop.tonePreferences !== 'object') {
    workshop.tonePreferences = {
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0,
    };
  } else {
    workshop.tonePreferences.formal_casual = workshop.tonePreferences.formal_casual ?? 0;
    workshop.tonePreferences.concise_detailed = workshop.tonePreferences.concise_detailed ?? 0;
    workshop.tonePreferences.analytical_creative = workshop.tonePreferences.analytical_creative ?? 0;
    workshop.tonePreferences.serious_playful = workshop.tonePreferences.serious_playful ?? 0;
  }

  // Ensure audiencePersonas is an array
  if (!Array.isArray(workshop.audiencePersonas)) {
    workshop.audiencePersonas = [];
  }

  // Ensure each persona has complete structure
  workshop.audiencePersonas = workshop.audiencePersonas.map((persona: any) => ({
    id: persona.id || `persona-${Date.now()}-${Math.random()}`,
    name: persona.name || '',
    role: persona.role || '',
    industry: persona.industry || '',
    painPoints: Array.isArray(persona.painPoints) ? persona.painPoints : [],
    goals: Array.isArray(persona.goals) ? persona.goals : [],
    communicationStyle: persona.communicationStyle || 'conversational',
    demographicInfo: persona.demographicInfo || undefined,
    transformation: persona.transformation || undefined,
    isPrimary: persona.isPrimary ?? false,
  }));

  // Ensure writingSample structure is complete or null
  if (workshop.writingSample && typeof workshop.writingSample === 'object') {
    workshop.writingSample = {
      text: workshop.writingSample.text || '',
      wordCount: workshop.writingSample.wordCount || 0,
      uploadedAt: workshop.writingSample.uploadedAt || new Date().toISOString(),
      analysisResults: workshop.writingSample.analysisResults || undefined,
    };
  } else {
    workshop.writingSample = null;
  }

  // Ensure personalityQuiz structure is complete
  if (!workshop.personalityQuiz || typeof workshop.personalityQuiz !== 'object') {
    workshop.personalityQuiz = {
      responses: [],
      currentQuestionIndex: 0,
    };
  } else {
    workshop.personalityQuiz.responses = Array.isArray(workshop.personalityQuiz.responses) 
      ? workshop.personalityQuiz.responses 
      : [];
    workshop.personalityQuiz.currentQuestionIndex = workshop.personalityQuiz.currentQuestionIndex || 0;
  }

  return newState;
};

/**
 * Migration manifest for workshop state
 * Maps version numbers to migration functions
 */
export const workshopMigrations: MigrationManifest = {
  1: migration0to1,
  2: migration1to2,
  3: migration2to3,
};

/**
 * Current migration version
 * Increment this when adding new migrations
 */
export const WORKSHOP_MIGRATION_VERSION = 3;

/**
 * Create the migrate function for redux-persist
 */
export const workshopMigrate = createMigrate(workshopMigrations, {
  debug: process.env.NODE_ENV === 'development',
});

/**
 * Utility to manually run migrations on corrupted state
 * Can be called from browser console for debugging
 */
export const manuallyMigrateWorkshopState = (state: any, fromVersion = 0): any => {
  let migratedState = state;
  
  for (let version = fromVersion + 1; version <= WORKSHOP_MIGRATION_VERSION; version++) {
    const migration = workshopMigrations[version];
    if (migration) {
      console.log(`Manually running migration to version ${version}`);
      migratedState = migration(migratedState);
    }
  }
  
  return migratedState;
};

/**
 * Utility to clean corrupted workshop state
 * Use this as a last resort when migrations fail
 */
export const cleanCorruptedWorkshopState = (): any => {
  return {
    // Navigation
    currentStep: 1,
    completedSteps: [],
    isCompleted: false,
    
    // Assessment
    assessmentScore: null,
    workshopPath: null,
    
    // Timing
    startedAt: null,
    lastSavedAt: null,
    completedAt: null,
    
    // Step 1: Values
    values: {
      selected: [],
      custom: [],
      rankings: {},
      primary: [],
      aspirational: [],
      stories: {},
    },
    
    // Step 2: Tone
    tonePreferences: {
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0,
    },
    
    // Step 3: Audience
    audiencePersonas: [],
    
    // Step 4: Writing Sample
    writingSample: null,
    
    // Step 5: Personality Quiz
    personalityQuiz: {
      responses: [],
      currentQuestionIndex: 0,
    },
    
    // Meta
    sessionId: null,
    isSaving: false,
    lastError: null,
  };
};