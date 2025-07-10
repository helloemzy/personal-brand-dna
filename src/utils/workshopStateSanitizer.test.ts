import {
  removePersistedMetadata,
  sanitizeArrays,
  sanitizeObjects,
  sanitizeWorkshopState,
  getDefaultWorkshopState,
  areStatesEquivalent
} from './workshopStateSanitizer';
import { WorkshopState } from '../store/slices/workshopSlice';

describe('workshopStateSanitizer', () => {
  describe('removePersistedMetadata', () => {
    it('should remove top-level _persist metadata', () => {
      const state = {
        currentStep: 1,
        _persist: { version: 1, rehydrated: true }
      };
      
      const result = removePersistedMetadata(state);
      expect(result).not.toHaveProperty('_persist');
      expect(result.currentStep).toBe(1);
    });

    it('should recursively remove nested _persist metadata', () => {
      const state = {
        values: {
          selected: ['value1'],
          _persist: { version: 1 }
        },
        nested: {
          deep: {
            data: 'test',
            _persist: { version: 1 }
          }
        }
      };
      
      const result = removePersistedMetadata(state);
      expect(result.values).not.toHaveProperty('_persist');
      expect(result.nested.deep).not.toHaveProperty('_persist');
      expect(result.values.selected).toEqual(['value1']);
      expect(result.nested.deep.data).toBe('test');
    });

    it('should handle arrays with objects containing _persist', () => {
      const state = {
        items: [
          { id: 1, _persist: { version: 1 } },
          { id: 2, data: 'test' }
        ]
      };
      
      const result = removePersistedMetadata(state);
      expect(result.items[0]).not.toHaveProperty('_persist');
      expect(result.items[0].id).toBe(1);
      expect(result.items[1]).toEqual({ id: 2, data: 'test' });
    });

    it('should handle null and undefined values', () => {
      const state = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test'
      };
      
      const result = removePersistedMetadata(state);
      expect(result).toEqual(state);
    });
  });

  describe('sanitizeArrays', () => {
    it('should ensure completedSteps is a valid array', () => {
      const state = getDefaultWorkshopState();
      
      // Test non-array becomes empty array
      (state as any).completedSteps = 'not-an-array';
      let result = sanitizeArrays(state);
      expect(result.completedSteps).toEqual([]);
      
      // Test array with invalid values
      state.completedSteps = [1, 2, 6, 'invalid', null, 3, 3, 2] as any;
      result = sanitizeArrays(state);
      expect(result.completedSteps).toEqual([1, 2, 3]); // Unique, valid, sorted
    });

    it('should sanitize values arrays', () => {
      const state = getDefaultWorkshopState();
      
      // Test selected values
      state.values.selected = ['val1', 'val2', 'val1', '', null] as any;
      let result = sanitizeArrays(state);
      expect(result.values.selected).toEqual(['val1', 'val2']);
      
      // Test primary values (max 2)
      state.values.primary = ['val1', 'val2', 'val3', 'val4'];
      result = sanitizeArrays(state);
      expect(result.values.primary).toEqual(['val1', 'val2']);
      
      // Test custom values with invalid entries
      state.values.custom = [
        { id: 'v1', name: 'Value 1', category: 'personal', description: 'Test' },
        { id: 'v2' }, // Missing fields
        null,
        { id: 'v3', name: 'Value 3', category: 'professional', description: 'Test' }
      ] as any;
      result = sanitizeArrays(state);
      expect(result.values.custom).toHaveLength(2);
      expect(result.values.custom[0].id).toBe('v1');
      expect(result.values.custom[1].id).toBe('v3');
    });

    it('should sanitize audience personas', () => {
      const state = getDefaultWorkshopState();
      
      state.audiencePersonas = [
        {
          id: 'p1',
          name: 'Persona 1',
          role: 'Manager',
          industry: 'Tech',
          painPoints: ['pain1'],
          goals: ['goal1'],
          isPrimary: true
        },
        {
          id: 'p2',
          name: 'Persona 2'
          // Missing required fields
        },
        null
      ] as any;
      
      const result = sanitizeArrays(state);
      expect(result.audiencePersonas).toHaveLength(1);
      expect(result.audiencePersonas[0].id).toBe('p1');
    });

    it('should sanitize quiz responses', () => {
      const state = getDefaultWorkshopState();
      
      state.personalityQuiz.responses = [
        { questionId: 'q1', answer: 'a', answeredAt: '2025-01-12T00:00:00.000Z' },
        { questionId: 'q2' }, // Missing fields
        null,
        { questionId: 'q3', answer: 'b', answeredAt: '2025-01-12T00:00:00.000Z' }
      ] as any;
      
      const result = sanitizeArrays(state);
      expect(result.personalityQuiz.responses).toHaveLength(2);
      expect(result.personalityQuiz.responses[0].questionId).toBe('q1');
      expect(result.personalityQuiz.responses[1].questionId).toBe('q3');
    });
  });

  describe('sanitizeObjects', () => {
    it('should ensure values object has proper structure', () => {
      const state = getDefaultWorkshopState();
      
      // Test missing values object
      (state as any).values = null;
      let result = sanitizeObjects(state);
      expect(result.values).toEqual({
        selected: [],
        custom: [],
        rankings: {},
        primary: [],
        aspirational: [],
        stories: {}
      });
      
      // Test invalid rankings
      state.values = { ...result.values }; // Reset values first
      state.values.rankings = [1, 2, 3] as any; // Array instead of object
      result = sanitizeObjects(state);
      expect(result.values.rankings).toEqual({});
      
      // Test valid rankings with some invalid entries
      state.values.rankings = {
        'val1': 5,
        'val2': 11, // Out of range
        'val3': 'not-a-number' as any,
        'val4': 8
      };
      result = sanitizeObjects(state);
      expect(result.values.rankings).toEqual({
        'val1': 5,
        'val4': 8
      });
    });

    it('should ensure tone preferences are valid', () => {
      const state = getDefaultWorkshopState();
      
      // Test missing tone preferences
      (state as any).tonePreferences = null;
      let result = sanitizeObjects(state);
      expect(result.tonePreferences).toEqual({
        formal_casual: 0,
        concise_detailed: 0,
        analytical_creative: 0,
        serious_playful: 0
      });
      
      // Test out of range values
      state.tonePreferences = {
        formal_casual: 75, // Out of range
        concise_detailed: -100, // Out of range
        analytical_creative: 25,
        serious_playful: -30
      };
      result = sanitizeObjects(state);
      expect(result.tonePreferences).toEqual({
        formal_casual: 0,
        concise_detailed: 0,
        analytical_creative: 25,
        serious_playful: -30
      });
    });

    it('should ensure personality quiz structure', () => {
      const state = getDefaultWorkshopState();
      
      // Test missing personality quiz
      (state as any).personalityQuiz = null;
      let result = sanitizeObjects(state);
      expect(result.personalityQuiz).toEqual({
        responses: [],
        currentQuestionIndex: 0
      });
      
      // Test invalid currentQuestionIndex
      state.personalityQuiz = { ...result.personalityQuiz }; // Reset personalityQuiz first
      state.personalityQuiz.currentQuestionIndex = -5;
      result = sanitizeObjects(state);
      expect(result.personalityQuiz.currentQuestionIndex).toBe(0);
    });
  });

  describe('sanitizeWorkshopState', () => {
    it('should return default state for invalid input', () => {
      expect(sanitizeWorkshopState(null)).toEqual(getDefaultWorkshopState());
      expect(sanitizeWorkshopState(undefined)).toEqual(getDefaultWorkshopState());
      expect(sanitizeWorkshopState('not-an-object')).toEqual(getDefaultWorkshopState());
      expect(sanitizeWorkshopState(123)).toEqual(getDefaultWorkshopState());
    });

    it('should validate basic fields', () => {
      const state = {
        currentStep: 10, // Out of range
        isCompleted: 'not-a-boolean',
        isSaving: 1,
        assessmentScore: 150, // Out of range
        workshopPath: 'invalid-path',
        startedAt: 'not-an-iso-string',
        sessionId: 123, // Not a string
        lastError: { message: 'error' } // Not a string
      };
      
      const result = sanitizeWorkshopState(state);
      expect(result.currentStep).toBe(1);
      expect(result.isCompleted).toBe(true); // Truthy value becomes true
      expect(result.isSaving).toBe(true);
      expect(result.assessmentScore).toBeNull();
      expect(result.workshopPath).toBeNull();
      expect(result.startedAt).toBeNull();
      expect(result.sessionId).toBeNull();
      expect(result.lastError).toBeNull();
    });

    it('should validate ISO date strings', () => {
      const validDate = '2025-01-12T00:00:00.000Z';
      const state = {
        startedAt: validDate,
        lastSavedAt: '2025-01-12', // Not full ISO
        completedAt: 'invalid-date'
      };
      
      const result = sanitizeWorkshopState(state);
      expect(result.startedAt).toBe(validDate);
      expect(result.lastSavedAt).toBeNull();
      expect(result.completedAt).toBeNull();
    });

    it('should validate writing sample', () => {
      const state = getDefaultWorkshopState();
      
      // Valid writing sample
      state.writingSample = {
        text: 'Sample text',
        wordCount: 100,
        uploadedAt: '2025-01-12T00:00:00.000Z',
        prompt: 'Test prompt',
        pillar: 'expertise'
      };
      let result = sanitizeWorkshopState(state);
      expect(result.writingSample).toEqual(state.writingSample);
      
      // Invalid writing sample
      state.writingSample = {
        text: 123, // Not a string
        wordCount: 'not-a-number',
        uploadedAt: 'invalid-date'
      } as any;
      result = sanitizeWorkshopState(state);
      expect(result.writingSample).toBeNull();
    });

    it('should handle deep nested objects without circular references', () => {
      const state: any = getDefaultWorkshopState();
      // Create deep nesting without circular reference
      state.deep = { nested: { structure: { value: 'test' } } };
      
      // Should not throw error
      expect(() => sanitizeWorkshopState(state)).not.toThrow();
      
      const result = sanitizeWorkshopState(state);
      expect(result).toBeDefined();
      expect(result.currentStep).toBe(1);
    });

    it('should preserve valid data while fixing invalid data', () => {
      const state = {
        currentStep: 3,
        completedSteps: [1, 2],
        isCompleted: false,
        values: {
          selected: ['val1', 'val2'],
          custom: [],
          rankings: { 'val1': 8, 'val2': 6 },
          primary: ['val1'],
          aspirational: ['val2'],
          stories: { 'val1': 'My story' }
        },
        tonePreferences: {
          formal_casual: 20,
          concise_detailed: -15,
          analytical_creative: 0,
          serious_playful: 35
        },
        audiencePersonas: [],
        writingSample: null,
        personalityQuiz: {
          responses: [],
          currentQuestionIndex: 0
        },
        sessionId: 'session-123',
        isSaving: false,
        lastError: null,
        // Add some invalid data
        invalidField: 'should-be-removed',
        _persist: { version: 1 }
      };
      
      const result = sanitizeWorkshopState(state);
      expect(result.currentStep).toBe(3);
      expect(result.completedSteps).toEqual([1, 2]);
      expect(result.values.selected).toEqual(['val1', 'val2']);
      expect(result.values.rankings).toEqual({ 'val1': 8, 'val2': 6 });
      expect(result.tonePreferences.formal_casual).toBe(20);
      expect(result.sessionId).toBe('session-123');
      expect(result).not.toHaveProperty('invalidField');
      expect(result).not.toHaveProperty('_persist');
    });
  });

  describe('getDefaultWorkshopState', () => {
    it('should return a valid default state', () => {
      const defaultState = getDefaultWorkshopState();
      
      expect(defaultState.currentStep).toBe(1);
      expect(defaultState.completedSteps).toEqual([]);
      expect(defaultState.isCompleted).toBe(false);
      expect(defaultState.values.selected).toEqual([]);
      expect(defaultState.values.rankings).toEqual({});
      expect(defaultState.tonePreferences.formal_casual).toBe(0);
      expect(defaultState.audiencePersonas).toEqual([]);
      expect(defaultState.writingSample).toBeNull();
      expect(defaultState.personalityQuiz.responses).toEqual([]);
      expect(defaultState.sessionId).toBeNull();
    });

    it('should create independent instances', () => {
      const state1 = getDefaultWorkshopState();
      const state2 = getDefaultWorkshopState();
      
      state1.currentStep = 3;
      state1.values.selected.push('value1');
      
      expect(state2.currentStep).toBe(1);
      expect(state2.values.selected).toEqual([]);
    });
  });

  describe('areStatesEquivalent', () => {
    it('should return true for equivalent states', () => {
      const state1 = getDefaultWorkshopState();
      const state2 = getDefaultWorkshopState();
      
      expect(areStatesEquivalent(state1, state2)).toBe(true);
      
      // Add same data to both
      state1.currentStep = 3;
      state1.values.selected = ['val1', 'val2'];
      state2.currentStep = 3;
      state2.values.selected = ['val1', 'val2'];
      
      expect(areStatesEquivalent(state1, state2)).toBe(true);
    });

    it('should return false for different states', () => {
      const state1 = getDefaultWorkshopState();
      const state2 = getDefaultWorkshopState();
      
      state1.currentStep = 2;
      state2.currentStep = 3;
      
      expect(areStatesEquivalent(state1, state2)).toBe(false);
    });

    it('should ignore _persist metadata when comparing', () => {
      const state1: any = getDefaultWorkshopState();
      const state2: any = getDefaultWorkshopState();
      
      state1._persist = { version: 1 };
      state2._persist = { version: 2 };
      
      expect(areStatesEquivalent(state1, state2)).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const state1: any = getDefaultWorkshopState();
      const state2: any = getDefaultWorkshopState();
      
      // Create complex nested structures in known fields
      state1.values.stories = { 'val1': 'test story', 'val2': 'another story' };
      state2.values.stories = { 'val1': 'test story', 'val2': 'another story' };
      
      // Should handle complex structures
      expect(areStatesEquivalent(state1, state2)).toBe(true);
      
      // Different nested values
      state2.values.stories['val2'] = 'different story';
      expect(areStatesEquivalent(state1, state2)).toBe(false);
    });

    it('should sanitize before comparing', () => {
      const state1: any = {
        currentStep: 10, // Invalid
        values: { selected: ['val1'] }
      };
      const state2: any = {
        currentStep: 1, // Valid default
        values: { selected: ['val1'] }
      };
      
      // Should be equivalent after sanitization
      expect(areStatesEquivalent(state1, state2)).toBe(true);
    });
  });
});