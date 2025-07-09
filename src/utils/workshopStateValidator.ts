import { 
  WorkshopState, 
  WorkshopValue, 
  TonePreferences, 
  AudiencePersona, 
  WritingSample, 
  QuizResponse 
} from '../store/slices/workshopSlice';
import { sanitizeWorkshopState, getDefaultWorkshopState } from './workshopStateSanitizer';

/**
 * Validation result for a single field
 */
interface FieldValidation {
  field: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  autoFixed: boolean;
  fixedValue?: any;
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  valid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  fieldValidations: FieldValidation[];
  summary: {
    totalFields: number;
    validFields: number;
    errorFields: number;
    warningFields: number;
    autoFixedFields: number;
  };
  fixedState?: WorkshopState;
}

/**
 * Type guard for WorkshopValue
 */
export function isValidWorkshopValue(value: any): value is WorkshopValue {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.description === 'string' &&
    (value.isCustom === undefined || typeof value.isCustom === 'boolean')
  );
}

/**
 * Type guard for TonePreferences
 */
export function isValidTonePreferences(value: any): value is TonePreferences {
  if (!value || typeof value !== 'object') return false;
  
  const requiredKeys: (keyof TonePreferences)[] = [
    'formal_casual',
    'concise_detailed',
    'analytical_creative',
    'serious_playful'
  ];
  
  return requiredKeys.every(key => 
    typeof value[key] === 'number' &&
    value[key] >= -50 &&
    value[key] <= 50
  );
}

/**
 * Type guard for AudiencePersona
 */
export function isValidAudiencePersona(value: any): value is AudiencePersona {
  if (!value || typeof value !== 'object') return false;
  
  const validCommunicationStyles = ['formal', 'casual', 'technical', 'conversational'];
  
  const baseValid = (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && value.name.length > 0 &&
    typeof value.role === 'string' && value.role.length > 0 &&
    typeof value.industry === 'string' && value.industry.length > 0 &&
    Array.isArray(value.painPoints) &&
    value.painPoints.every((p: any) => typeof p === 'string') &&
    Array.isArray(value.goals) &&
    value.goals.every((g: any) => typeof g === 'string') &&
    validCommunicationStyles.includes(value.communicationStyle)
  );
  
  if (!baseValid) return false;
  
  // Optional fields validation
  if (value.demographicInfo) {
    if (typeof value.demographicInfo !== 'object') return false;
    if (value.demographicInfo.ageRange && typeof value.demographicInfo.ageRange !== 'string') return false;
    if (value.demographicInfo.experience && typeof value.demographicInfo.experience !== 'string') return false;
    if (value.demographicInfo.company_size && typeof value.demographicInfo.company_size !== 'string') return false;
  }
  
  if (value.transformation) {
    if (typeof value.transformation !== 'object') return false;
    if (typeof value.transformation.outcome !== 'string') return false;
    if (typeof value.transformation.beforeState !== 'string') return false;
    if (typeof value.transformation.afterState !== 'string') return false;
  }
  
  if (value.isPrimary !== undefined && typeof value.isPrimary !== 'boolean') return false;
  
  return true;
}

/**
 * Type guard for WritingSample
 */
export function isValidWritingSample(value: any): value is WritingSample {
  if (!value || typeof value !== 'object') return false;
  
  const baseValid = (
    typeof value.text === 'string' &&
    value.text.length > 0 &&
    typeof value.wordCount === 'number' &&
    value.wordCount > 0 &&
    typeof value.uploadedAt === 'string' &&
    isValidISOString(value.uploadedAt)
  );
  
  if (!baseValid) return false;
  
  if (value.analysisResults) {
    if (typeof value.analysisResults !== 'object') return false;
    if (typeof value.analysisResults.readability !== 'number') return false;
    if (!value.analysisResults.sentiment || typeof value.analysisResults.sentiment !== 'object') return false;
    if (!value.analysisResults.styleMetrics || typeof value.analysisResults.styleMetrics !== 'object') return false;
  }
  
  return true;
}

/**
 * Type guard for QuizResponse
 */
export function isValidQuizResponse(value: any): value is QuizResponse {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.questionId === 'string' &&
    value.questionId.length > 0 &&
    typeof value.answer === 'string' &&
    value.answer.length > 0 &&
    typeof value.answeredAt === 'string' &&
    isValidISOString(value.answeredAt)
  );
}

/**
 * Check if a string is a valid ISO date string
 */
function isValidISOString(value: string): boolean {
  try {
    const date = new Date(value);
    return date.toISOString() === value;
  } catch {
    return false;
  }
}

/**
 * Validate currentStep field
 */
function validateCurrentStep(state: WorkshopState): FieldValidation {
  const validation: FieldValidation = {
    field: 'currentStep',
    valid: true,
    errors: [],
    warnings: [],
    autoFixed: false
  };
  
  if (typeof state.currentStep !== 'number') {
    validation.valid = false;
    validation.errors.push('currentStep must be a number');
    validation.autoFixed = true;
    validation.fixedValue = 1;
  } else if (state.currentStep < 1 || state.currentStep > 5) {
    validation.valid = false;
    validation.errors.push('currentStep must be between 1 and 5');
    validation.autoFixed = true;
    validation.fixedValue = Math.max(1, Math.min(5, state.currentStep));
  }
  
  return validation;
}

/**
 * Validate completedSteps field
 */
function validateCompletedSteps(state: WorkshopState): FieldValidation {
  const validation: FieldValidation = {
    field: 'completedSteps',
    valid: true,
    errors: [],
    warnings: [],
    autoFixed: false
  };
  
  if (!Array.isArray(state.completedSteps)) {
    validation.valid = false;
    validation.errors.push('completedSteps must be an array');
    validation.autoFixed = true;
    validation.fixedValue = [];
  } else {
    const uniqueSteps = new Set<number>();
    const validSteps: number[] = [];
    
    for (const step of state.completedSteps) {
      if (typeof step !== 'number') {
        validation.warnings.push(`Invalid step type: ${typeof step}`);
      } else if (step < 1 || step > 5) {
        validation.warnings.push(`Step ${step} is out of range`);
      } else if (uniqueSteps.has(step)) {
        validation.warnings.push(`Duplicate step: ${step}`);
      } else {
        uniqueSteps.add(step);
        validSteps.push(step);
      }
    }
    
    if (validSteps.length !== state.completedSteps.length) {
      validation.autoFixed = true;
      validation.fixedValue = validSteps;
    }
  }
  
  return validation;
}

/**
 * Validate values field
 */
function validateValues(state: WorkshopState): FieldValidation {
  const validation: FieldValidation = {
    field: 'values',
    valid: true,
    errors: [],
    warnings: [],
    autoFixed: false
  };
  
  if (!state.values || typeof state.values !== 'object') {
    validation.valid = false;
    validation.errors.push('values must be an object');
    validation.autoFixed = true;
    validation.fixedValue = getDefaultWorkshopState().values;
    return validation;
  }
  
  const fixed: any = { ...state.values };
  let needsFix = false;
  
  // Validate selected array
  if (!Array.isArray(state.values.selected)) {
    validation.errors.push('values.selected must be an array');
    fixed.selected = [];
    needsFix = true;
  } else {
    const uniqueSelected = [...new Set(state.values.selected.filter(id => typeof id === 'string' && id.length > 0))];
    if (uniqueSelected.length !== state.values.selected.length) {
      validation.warnings.push('values.selected contained duplicates or invalid entries');
      fixed.selected = uniqueSelected;
      needsFix = true;
    }
    if (uniqueSelected.length > 10) {
      validation.errors.push('values.selected cannot have more than 10 items');
      fixed.selected = uniqueSelected.slice(0, 10);
      needsFix = true;
    }
  }
  
  // Validate custom array
  if (!Array.isArray(state.values.custom)) {
    validation.errors.push('values.custom must be an array');
    fixed.custom = [];
    needsFix = true;
  } else {
    const validCustom = state.values.custom.filter(isValidWorkshopValue);
    if (validCustom.length !== state.values.custom.length) {
      validation.warnings.push('values.custom contained invalid entries');
      fixed.custom = validCustom;
      needsFix = true;
    }
  }
  
  // Validate rankings object
  if (!state.values.rankings || typeof state.values.rankings !== 'object' || Array.isArray(state.values.rankings)) {
    validation.errors.push('values.rankings must be an object');
    fixed.rankings = {};
    needsFix = true;
  } else {
    const validRankings: Record<string, number> = {};
    for (const [key, value] of Object.entries(state.values.rankings)) {
      if (typeof value === 'number' && value >= 1 && value <= 10) {
        validRankings[key] = value;
      } else {
        validation.warnings.push(`Invalid ranking for ${key}: ${value}`);
        needsFix = true;
      }
    }
    if (Object.keys(validRankings).length !== Object.keys(state.values.rankings).length) {
      fixed.rankings = validRankings;
    }
  }
  
  // Validate primary array
  if (!Array.isArray(state.values.primary)) {
    validation.errors.push('values.primary must be an array');
    fixed.primary = [];
    needsFix = true;
  } else {
    const validPrimary = state.values.primary.filter(id => typeof id === 'string' && id.length > 0).slice(0, 2);
    if (validPrimary.length !== state.values.primary.length) {
      validation.warnings.push('values.primary had invalid entries or more than 2 values');
      fixed.primary = validPrimary;
      needsFix = true;
    }
  }
  
  // Validate aspirational array
  if (!Array.isArray(state.values.aspirational)) {
    validation.errors.push('values.aspirational must be an array');
    fixed.aspirational = [];
    needsFix = true;
  } else {
    const validAspirational = state.values.aspirational.filter(id => typeof id === 'string' && id.length > 0);
    if (validAspirational.length !== state.values.aspirational.length) {
      validation.warnings.push('values.aspirational had invalid entries');
      fixed.aspirational = validAspirational;
      needsFix = true;
    }
  }
  
  // Validate stories object
  if (!state.values.stories || typeof state.values.stories !== 'object' || Array.isArray(state.values.stories)) {
    validation.errors.push('values.stories must be an object');
    fixed.stories = {};
    needsFix = true;
  } else {
    const validStories: Record<string, string> = {};
    for (const [key, value] of Object.entries(state.values.stories)) {
      if (typeof value === 'string') {
        validStories[key] = value;
      } else {
        validation.warnings.push(`Invalid story for ${key}`);
        needsFix = true;
      }
    }
    if (Object.keys(validStories).length !== Object.keys(state.values.stories).length) {
      fixed.stories = validStories;
    }
  }
  
  if (needsFix) {
    validation.autoFixed = true;
    validation.fixedValue = fixed;
  }
  
  if (validation.errors.length > 0) {
    validation.valid = false;
  }
  
  return validation;
}

/**
 * Validate workshop state and generate a comprehensive report
 */
export function validateWorkshopState(state: any): ValidationReport {
  // First, sanitize the state
  const sanitizedState = sanitizeWorkshopState(state);
  
  const fieldValidations: FieldValidation[] = [];
  let fixedState = { ...sanitizedState };
  
  // Validate each field
  const currentStepValidation = validateCurrentStep(sanitizedState);
  fieldValidations.push(currentStepValidation);
  if (currentStepValidation.autoFixed) {
    fixedState.currentStep = currentStepValidation.fixedValue;
  }
  
  const completedStepsValidation = validateCompletedSteps(sanitizedState);
  fieldValidations.push(completedStepsValidation);
  if (completedStepsValidation.autoFixed) {
    fixedState.completedSteps = completedStepsValidation.fixedValue;
  }
  
  const valuesValidation = validateValues(sanitizedState);
  fieldValidations.push(valuesValidation);
  if (valuesValidation.autoFixed) {
    fixedState.values = valuesValidation.fixedValue;
  }
  
  // Validate tone preferences
  const toneValidation: FieldValidation = {
    field: 'tonePreferences',
    valid: isValidTonePreferences(sanitizedState.tonePreferences),
    errors: [],
    warnings: [],
    autoFixed: false
  };
  if (!toneValidation.valid) {
    toneValidation.errors.push('Invalid tone preferences structure');
    toneValidation.autoFixed = true;
    toneValidation.fixedValue = getDefaultWorkshopState().tonePreferences;
    fixedState.tonePreferences = toneValidation.fixedValue;
  }
  fieldValidations.push(toneValidation);
  
  // Validate audience personas
  const audienceValidation: FieldValidation = {
    field: 'audiencePersonas',
    valid: true,
    errors: [],
    warnings: [],
    autoFixed: false
  };
  if (!Array.isArray(sanitizedState.audiencePersonas)) {
    audienceValidation.valid = false;
    audienceValidation.errors.push('audiencePersonas must be an array');
    audienceValidation.autoFixed = true;
    audienceValidation.fixedValue = [];
    fixedState.audiencePersonas = [];
  } else {
    const validPersonas = sanitizedState.audiencePersonas.filter(isValidAudiencePersona);
    if (validPersonas.length !== sanitizedState.audiencePersonas.length) {
      audienceValidation.warnings.push('Some audience personas were invalid and removed');
      audienceValidation.autoFixed = true;
      audienceValidation.fixedValue = validPersonas;
      fixedState.audiencePersonas = validPersonas;
    }
  }
  fieldValidations.push(audienceValidation);
  
  // Validate writing sample
  const writingSampleValidation: FieldValidation = {
    field: 'writingSample',
    valid: sanitizedState.writingSample === null || isValidWritingSample(sanitizedState.writingSample),
    errors: [],
    warnings: [],
    autoFixed: false
  };
  if (!writingSampleValidation.valid) {
    writingSampleValidation.errors.push('Invalid writing sample structure');
    writingSampleValidation.autoFixed = true;
    writingSampleValidation.fixedValue = null;
    fixedState.writingSample = null;
  }
  fieldValidations.push(writingSampleValidation);
  
  // Validate personality quiz
  const quizValidation: FieldValidation = {
    field: 'personalityQuiz',
    valid: true,
    errors: [],
    warnings: [],
    autoFixed: false
  };
  if (!sanitizedState.personalityQuiz || typeof sanitizedState.personalityQuiz !== 'object') {
    quizValidation.valid = false;
    quizValidation.errors.push('personalityQuiz must be an object');
    quizValidation.autoFixed = true;
    quizValidation.fixedValue = getDefaultWorkshopState().personalityQuiz;
    fixedState.personalityQuiz = quizValidation.fixedValue;
  } else {
    let needsFix = false;
    const fixed: any = { ...sanitizedState.personalityQuiz };
    
    if (!Array.isArray(sanitizedState.personalityQuiz.responses)) {
      quizValidation.errors.push('personalityQuiz.responses must be an array');
      fixed.responses = [];
      needsFix = true;
    } else {
      const validResponses = sanitizedState.personalityQuiz.responses.filter(isValidQuizResponse);
      if (validResponses.length !== sanitizedState.personalityQuiz.responses.length) {
        quizValidation.warnings.push('Some quiz responses were invalid and removed');
        fixed.responses = validResponses;
        needsFix = true;
      }
    }
    
    if (typeof sanitizedState.personalityQuiz.currentQuestionIndex !== 'number' || 
        sanitizedState.personalityQuiz.currentQuestionIndex < 0) {
      quizValidation.errors.push('Invalid currentQuestionIndex');
      fixed.currentQuestionIndex = 0;
      needsFix = true;
    }
    
    if (needsFix) {
      quizValidation.autoFixed = true;
      quizValidation.fixedValue = fixed;
      fixedState.personalityQuiz = fixed;
    }
  }
  fieldValidations.push(quizValidation);
  
  // Calculate summary
  const summary = {
    totalFields: fieldValidations.length,
    validFields: fieldValidations.filter(f => f.valid).length,
    errorFields: fieldValidations.filter(f => f.errors.length > 0).length,
    warningFields: fieldValidations.filter(f => f.warnings.length > 0).length,
    autoFixedFields: fieldValidations.filter(f => f.autoFixed).length
  };
  
  const hasErrors = summary.errorFields > 0;
  const hasWarnings = summary.warningFields > 0;
  const valid = !hasErrors;
  
  return {
    valid,
    hasErrors,
    hasWarnings,
    fieldValidations,
    summary,
    fixedState: summary.autoFixedFields > 0 ? fixedState : undefined
  };
}

/**
 * Auto-fix common workshop state issues
 */
export function autoFixWorkshopState(state: any): WorkshopState {
  const validation = validateWorkshopState(state);
  return validation.fixedState || sanitizeWorkshopState(state);
}

/**
 * Generate a human-readable validation report
 */
export function generateValidationReportText(report: ValidationReport): string {
  const lines: string[] = [
    '=== Workshop State Validation Report ===',
    '',
    `Overall Status: ${report.valid ? '✅ VALID' : '❌ INVALID'}`,
    `Total Fields Checked: ${report.summary.totalFields}`,
    `Valid Fields: ${report.summary.validFields}`,
    `Fields with Errors: ${report.summary.errorFields}`,
    `Fields with Warnings: ${report.summary.warningFields}`,
    `Auto-Fixed Fields: ${report.summary.autoFixedFields}`,
    ''
  ];
  
  if (report.fieldValidations.length > 0) {
    lines.push('=== Field Details ===');
    lines.push('');
    
    for (const field of report.fieldValidations) {
      lines.push(`Field: ${field.field}`);
      lines.push(`Status: ${field.valid ? '✅ Valid' : '❌ Invalid'}`);
      
      if (field.errors.length > 0) {
        lines.push('Errors:');
        field.errors.forEach(error => lines.push(`  - ${error}`));
      }
      
      if (field.warnings.length > 0) {
        lines.push('Warnings:');
        field.warnings.forEach(warning => lines.push(`  - ${warning}`));
      }
      
      if (field.autoFixed) {
        lines.push(`Auto-Fixed: Yes`);
      }
      
      lines.push('');
    }
  }
  
  return lines.join('\n');
}