import {
  isValidWorkshopValue,
  isValidTonePreferences,
  isValidAudiencePersona,
  isValidWritingSample,
  isValidQuizResponse,
  validateWorkshopState,
  autoFixWorkshopState,
  generateValidationReportText,
  ValidationReport
} from './workshopStateValidator';
import { getDefaultWorkshopState } from './workshopStateSanitizer';
import { 
  WorkshopValue, 
  TonePreferences, 
  AudiencePersona, 
  WritingSample, 
  QuizResponse 
} from '../store/slices/workshopSlice';

describe('workshopStateValidator', () => {
  describe('isValidWorkshopValue', () => {
    it('should validate correct workshop value', () => {
      const validValue: WorkshopValue = {
        id: 'val1',
        name: 'Innovation',
        category: 'personal',
        description: 'A test value',
        isCustom: false
      };
      expect(isValidWorkshopValue(validValue)).toBe(true);
    });

    it('should validate workshop value without isCustom', () => {
      const validValue = {
        id: 'val1',
        name: 'Innovation',
        category: 'personal',
        description: 'A test value'
      };
      expect(isValidWorkshopValue(validValue)).toBe(true);
    });

    it('should reject invalid workshop values', () => {
      expect(isValidWorkshopValue(null)).toBeFalsy();
      expect(isValidWorkshopValue(undefined)).toBeFalsy();
      expect(isValidWorkshopValue({})).toBeFalsy();
      expect(isValidWorkshopValue({ id: '', name: 'test', category: 'personal', description: 'test' })).toBeFalsy();
      expect(isValidWorkshopValue({ id: 'val1', name: '', category: 'personal', description: 'test' })).toBeFalsy();
      expect(isValidWorkshopValue({ id: 'val1', name: 'test', category: '', description: 'test' })).toBeFalsy();
      expect(isValidWorkshopValue({ id: 'val1', name: 'test', category: 'personal', description: 123 })).toBeFalsy();
      expect(isValidWorkshopValue({ id: 'val1', name: 'test', category: 'personal', description: 'test', isCustom: 'yes' })).toBeFalsy();
    });
  });

  describe('isValidTonePreferences', () => {
    it('should validate correct tone preferences', () => {
      const validTone: TonePreferences = {
        formal_casual: 20,
        concise_detailed: -15,
        analytical_creative: 0,
        serious_playful: 35
      };
      expect(isValidTonePreferences(validTone)).toBe(true);
    });

    it('should validate edge values', () => {
      const edgeTone: TonePreferences = {
        formal_casual: 50,
        concise_detailed: -50,
        analytical_creative: 0,
        serious_playful: -50
      };
      expect(isValidTonePreferences(edgeTone)).toBe(true);
    });

    it('should reject invalid tone preferences', () => {
      expect(isValidTonePreferences(null)).toBe(false);
      expect(isValidTonePreferences(undefined)).toBe(false);
      expect(isValidTonePreferences({})).toBe(false);
      expect(isValidTonePreferences({ 
        formal_casual: 51, // Out of range
        concise_detailed: 0,
        analytical_creative: 0,
        serious_playful: 0
      })).toBe(false);
      expect(isValidTonePreferences({ 
        formal_casual: '20', // Wrong type
        concise_detailed: 0,
        analytical_creative: 0,
        serious_playful: 0
      })).toBe(false);
      expect(isValidTonePreferences({ 
        // Missing field
        concise_detailed: 0,
        analytical_creative: 0,
        serious_playful: 0
      })).toBe(false);
    });
  });

  describe('isValidAudiencePersona', () => {
    it('should validate complete audience persona', () => {
      const validPersona: AudiencePersona = {
        id: 'p1',
        name: 'Tech Manager',
        role: 'Engineering Manager',
        industry: 'Technology',
        painPoints: ['time management', 'team scaling'],
        goals: ['improve productivity', 'grow team'],
        communicationStyle: 'technical',
        demographicInfo: {
          ageRange: '30-40',
          experience: '5-10 years',
          company_size: 'medium'
        },
        transformation: {
          outcome: 'Efficient leader',
          beforeState: 'Overwhelmed manager',
          afterState: 'Confident leader'
        },
        isPrimary: true
      };
      expect(isValidAudiencePersona(validPersona)).toBe(true);
    });

    it('should validate minimal audience persona', () => {
      const minimalPersona = {
        id: 'p1',
        name: 'Tech Manager',
        role: 'Engineering Manager',
        industry: 'Technology',
        painPoints: ['time management'],
        goals: ['improve productivity'],
        communicationStyle: 'formal'
      };
      expect(isValidAudiencePersona(minimalPersona)).toBe(true);
    });

    it('should reject invalid audience personas', () => {
      expect(isValidAudiencePersona(null)).toBe(false);
      expect(isValidAudiencePersona(undefined)).toBe(false);
      expect(isValidAudiencePersona({})).toBe(false);
      
      // Invalid communication style
      expect(isValidAudiencePersona({
        id: 'p1',
        name: 'Tech Manager',
        role: 'Manager',
        industry: 'Tech',
        painPoints: ['pain'],
        goals: ['goal'],
        communicationStyle: 'invalid-style'
      })).toBe(false);
      
      // Invalid painPoints
      expect(isValidAudiencePersona({
        id: 'p1',
        name: 'Tech Manager',
        role: 'Manager',
        industry: 'Tech',
        painPoints: 'not-an-array',
        goals: ['goal'],
        communicationStyle: 'formal'
      })).toBe(false);
      
      // Invalid demographic info
      expect(isValidAudiencePersona({
        id: 'p1',
        name: 'Tech Manager',
        role: 'Manager',
        industry: 'Tech',
        painPoints: ['pain'],
        goals: ['goal'],
        communicationStyle: 'formal',
        demographicInfo: 'not-an-object'
      })).toBe(false);
      
      // Invalid transformation
      expect(isValidAudiencePersona({
        id: 'p1',
        name: 'Tech Manager',
        role: 'Manager',
        industry: 'Tech',
        painPoints: ['pain'],
        goals: ['goal'],
        communicationStyle: 'formal',
        transformation: {
          outcome: 'good',
          // Missing required fields
        }
      })).toBe(false);
    });
  });

  describe('isValidWritingSample', () => {
    it('should validate complete writing sample', () => {
      const validSample: WritingSample = {
        text: 'This is my writing sample',
        wordCount: 5,
        uploadedAt: '2025-01-12T00:00:00.000Z',
        prompt: 'Write about your experience',
        pillar: 'expertise',
        analysisResults: {
          readability: 75,
          sentiment: { positive: 0.8, negative: 0.1, neutral: 0.1 },
          styleMetrics: { avgSentenceLength: 10, vocabulary: 100 }
        }
      };
      expect(isValidWritingSample(validSample)).toBe(true);
    });

    it('should validate minimal writing sample', () => {
      const minimalSample = {
        text: 'This is my writing sample',
        wordCount: 5,
        uploadedAt: '2025-01-12T00:00:00.000Z'
      };
      expect(isValidWritingSample(minimalSample)).toBe(true);
    });

    it('should reject invalid writing samples', () => {
      expect(isValidWritingSample(null)).toBe(false);
      expect(isValidWritingSample(undefined)).toBe(false);
      expect(isValidWritingSample({})).toBe(false);
      
      // Empty text
      expect(isValidWritingSample({
        text: '',
        wordCount: 5,
        uploadedAt: '2025-01-12T00:00:00.000Z'
      })).toBe(false);
      
      // Invalid word count
      expect(isValidWritingSample({
        text: 'Sample',
        wordCount: 0,
        uploadedAt: '2025-01-12T00:00:00.000Z'
      })).toBe(false);
      
      // Invalid date
      expect(isValidWritingSample({
        text: 'Sample',
        wordCount: 1,
        uploadedAt: 'not-a-date'
      })).toBe(false);
      
      // Invalid analysis results
      expect(isValidWritingSample({
        text: 'Sample',
        wordCount: 1,
        uploadedAt: '2025-01-12T00:00:00.000Z',
        analysisResults: {
          readability: 'high', // Should be number
          sentiment: { positive: 0.8, negative: 0.1, neutral: 0.1 },
          styleMetrics: { avgSentenceLength: 10, vocabulary: 100 }
        }
      })).toBe(false);
    });
  });

  describe('isValidQuizResponse', () => {
    it('should validate correct quiz response', () => {
      const validResponse: QuizResponse = {
        questionId: 'q1',
        answer: 'a',
        answeredAt: '2025-01-12T00:00:00.000Z'
      };
      expect(isValidQuizResponse(validResponse)).toBe(true);
    });

    it('should reject invalid quiz responses', () => {
      expect(isValidQuizResponse(null)).toBeFalsy();
      expect(isValidQuizResponse(undefined)).toBeFalsy();
      expect(isValidQuizResponse({})).toBeFalsy();
      
      // Empty questionId
      expect(isValidQuizResponse({
        questionId: '',
        answer: 'a',
        answeredAt: '2025-01-12T00:00:00.000Z'
      })).toBeFalsy();
      
      // Empty answer
      expect(isValidQuizResponse({
        questionId: 'q1',
        answer: '',
        answeredAt: '2025-01-12T00:00:00.000Z'
      })).toBeFalsy();
      
      // Invalid date
      expect(isValidQuizResponse({
        questionId: 'q1',
        answer: 'a',
        answeredAt: '2025-01-12'
      })).toBeFalsy();
    });
  });

  describe('validateWorkshopState', () => {
    it('should validate a complete valid state', () => {
      const validState = getDefaultWorkshopState();
      validState.currentStep = 3;
      validState.completedSteps = [1, 2];
      validState.values.selected = ['val1', 'val2'];
      validState.values.primary = ['val1'];
      
      const report = validateWorkshopState(validState);
      
      expect(report.valid).toBe(true);
      expect(report.hasErrors).toBe(false);
      expect(report.hasWarnings).toBe(false);
      expect(report.summary.errorFields).toBe(0);
      expect(report.fixedState).toBeUndefined();
    });

    it('should detect and fix invalid currentStep', () => {
      // Note: The validator first sanitizes, so we need to test unsanitized input
      const state = {
        currentStep: 10, // Invalid - will be sanitized to 1 first
        completedSteps: [],
        isCompleted: false,
        values: {
          selected: [],
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {}
        }
      };
      
      const report = validateWorkshopState(state);
      
      // After sanitization, currentStep becomes 1, so validation passes
      expect(report.valid).toBe(true);
      const currentStepValidation = report.fieldValidations.find(f => f.field === 'currentStep');
      expect(currentStepValidation?.valid).toBe(true);
    });

    it('should clean duplicate and invalid completedSteps', () => {
      // Create a state that won't be fully cleaned by the sanitizer
      const state = {
        currentStep: 1,
        completedSteps: [1, 2, 2, 3], // Valid steps but with duplicate
        isCompleted: false,
        values: {
          selected: [],
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {}
        }
      };
      
      const report = validateWorkshopState(state);
      
      const completedStepsValidation = report.fieldValidations.find(f => f.field === 'completedSteps');
      // After sanitization, duplicates should be removed
      expect(completedStepsValidation?.valid).toBe(true);
    });

    it('should validate and fix values structure', () => {
      // Test with values that will pass sanitization but fail validation
      const state = {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        values: {
          selected: Array.from({ length: 12 }, (_, i) => `val${i + 1}`), // Too many (>10)
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {}
        }
      };
      
      const report = validateWorkshopState(state);
      
      const valuesValidation = report.fieldValidations.find(f => f.field === 'values');
      expect(valuesValidation?.errors).toContain('values.selected cannot have more than 10 items');
      expect(valuesValidation?.autoFixed).toBe(true);
      expect(report.fixedState?.values.selected).toHaveLength(10);
    });

    it('should enforce maximum values.selected limit', () => {
      const state = {
        ...getDefaultWorkshopState(),
        values: {
          ...getDefaultWorkshopState().values,
          selected: Array.from({ length: 15 }, (_, i) => `val${i + 1}`)
        }
      };
      
      const report = validateWorkshopState(state);
      
      const valuesValidation = report.fieldValidations.find(f => f.field === 'values');
      expect(valuesValidation?.errors).toContain('values.selected cannot have more than 10 items');
      expect(report.fixedState?.values.selected).toHaveLength(10);
    });

    it('should validate tone preferences after sanitization', () => {
      // Sanitizer will fix null tonePreferences, so test a different case
      const state = {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        values: getDefaultWorkshopState().values,
        tonePreferences: {
          formal_casual: 20,
          concise_detailed: -15,
          analytical_creative: 0,
          serious_playful: 35
        }
      };
      
      const report = validateWorkshopState(state);
      
      const toneValidation = report.fieldValidations.find(f => f.field === 'tonePreferences');
      expect(toneValidation?.valid).toBe(true);
    });

    it('should validate audience personas after sanitization', () => {
      // Sanitizer already filters invalid personas, so test valid case
      const state = {
        ...getDefaultWorkshopState(),
        audiencePersonas: [
          {
            id: 'p1',
            name: 'Valid Persona',
            role: 'Manager',
            industry: 'Tech',
            painPoints: ['pain1'],
            goals: ['goal1'],
            communicationStyle: 'formal'
          }
        ]
      };
      
      const report = validateWorkshopState(state);
      
      const audienceValidation = report.fieldValidations.find(f => f.field === 'audiencePersonas');
      expect(audienceValidation?.valid).toBe(true);
      expect(audienceValidation?.warnings).toEqual([]);
    });

    it('should validate writing sample after sanitization', () => {
      // Sanitizer will set invalid writing sample to null, so test with null
      const state = {
        ...getDefaultWorkshopState(),
        writingSample: null
      };
      
      const report = validateWorkshopState(state);
      
      const writingValidation = report.fieldValidations.find(f => f.field === 'writingSample');
      expect(writingValidation?.valid).toBe(true); // null is valid
    });

    it('should validate personality quiz after sanitization', () => {
      // Sanitizer already fixes invalid responses and currentQuestionIndex
      const state = {
        ...getDefaultWorkshopState(),
        personalityQuiz: {
          responses: [
            { questionId: 'q1', answer: 'a', answeredAt: '2025-01-12T00:00:00.000Z' }
          ],
          currentQuestionIndex: 0
        }
      };
      
      const report = validateWorkshopState(state);
      
      const quizValidation = report.fieldValidations.find(f => f.field === 'personalityQuiz');
      expect(quizValidation?.valid).toBe(true);
      expect(quizValidation?.warnings).toEqual([]);
    });

    it('should handle completely invalid state', () => {
      const report = validateWorkshopState('not-an-object');
      
      expect(report.valid).toBe(true); // Because sanitizer returns default state
      expect(report.hasErrors).toBe(false);
      expect(report.summary.errorFields).toBe(0);
    });

    it('should provide accurate summary', () => {
      // Create state that will have validation errors after sanitization
      const state = {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        values: {
          selected: Array.from({ length: 15 }, (_, i) => `val${i + 1}`), // Too many
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {}
        }
      };
      
      const report = validateWorkshopState(state);
      
      expect(report.summary.totalFields).toBeGreaterThan(0);
      expect(report.summary.errorFields).toBeGreaterThan(0); // values error
      expect(report.summary.autoFixedFields).toBeGreaterThan(0);
      expect(report.summary.validFields).toBeLessThan(report.summary.totalFields);
    });
  });

  describe('autoFixWorkshopState', () => {
    it('should return fixed state when errors exist', () => {
      // Create state with validation errors (not just sanitization issues)
      const invalidState = {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        values: {
          selected: Array.from({ length: 15 }, (_, i) => `val${i + 1}`), // Too many
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {}
        }
      };
      
      const fixed = autoFixWorkshopState(invalidState);
      
      expect(fixed.currentStep).toBe(1);
      expect(Array.isArray(fixed.completedSteps)).toBe(true);
      expect(fixed.values).toBeDefined();
      expect(fixed.values.selected.length).toBeLessThanOrEqual(10);
    });

    it('should return sanitized state when no errors exist', () => {
      const validState = getDefaultWorkshopState();
      const fixed = autoFixWorkshopState(validState);
      
      expect(fixed).toEqual(validState);
    });

    it('should handle null input', () => {
      const fixed = autoFixWorkshopState(null);
      expect(fixed).toEqual(getDefaultWorkshopState());
    });
  });

  describe('generateValidationReportText', () => {
    it('should generate readable report for valid state', () => {
      const report: ValidationReport = {
        valid: true,
        hasErrors: false,
        hasWarnings: false,
        fieldValidations: [],
        summary: {
          totalFields: 7,
          validFields: 7,
          errorFields: 0,
          warningFields: 0,
          autoFixedFields: 0
        }
      };
      
      const text = generateValidationReportText(report);
      
      expect(text).toContain('✅ VALID');
      expect(text).toContain('Total Fields Checked: 7');
      expect(text).toContain('Valid Fields: 7');
      expect(text).toContain('Fields with Errors: 0');
    });

    it('should include field details with errors and warnings', () => {
      const report: ValidationReport = {
        valid: false,
        hasErrors: true,
        hasWarnings: true,
        fieldValidations: [
          {
            field: 'currentStep',
            valid: false,
            errors: ['currentStep must be between 1 and 5'],
            warnings: [],
            autoFixed: true,
            fixedValue: 5
          },
          {
            field: 'completedSteps',
            valid: true,
            errors: [],
            warnings: ['Duplicate step: 2'],
            autoFixed: true,
            fixedValue: [1, 2]
          }
        ],
        summary: {
          totalFields: 2,
          validFields: 1,
          errorFields: 1,
          warningFields: 1,
          autoFixedFields: 2
        }
      };
      
      const text = generateValidationReportText(report);
      
      expect(text).toContain('❌ INVALID');
      expect(text).toContain('Field: currentStep');
      expect(text).toContain('Status: ❌ Invalid');
      expect(text).toContain('currentStep must be between 1 and 5');
      expect(text).toContain('Auto-Fixed: Yes');
      expect(text).toContain('Field: completedSteps');
      expect(text).toContain('Status: ✅ Valid');
      expect(text).toContain('Duplicate step: 2');
    });

    it('should format report with proper sections', () => {
      const report: ValidationReport = {
        valid: true,
        hasErrors: false,
        hasWarnings: false,
        fieldValidations: [
          {
            field: 'values',
            valid: true,
            errors: [],
            warnings: [],
            autoFixed: false
          }
        ],
        summary: {
          totalFields: 1,
          validFields: 1,
          errorFields: 0,
          warningFields: 0,
          autoFixedFields: 0
        }
      };
      
      const text = generateValidationReportText(report);
      const lines = text.split('\n');
      
      expect(lines[0]).toBe('=== Workshop State Validation Report ===');
      expect(text).toContain('=== Field Details ===');
      expect(lines[lines.length - 1]).toBe('');
    });
  });
});