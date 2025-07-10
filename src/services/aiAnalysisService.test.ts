// Mock fetch globally
global.fetch = jest.fn();

// Save original env
const originalEnv = process.env;

// Import the service normally
import { analyzeWritingWithAI, analyzePersonalityWithAI, generateEnhancedMission } from './aiAnalysisService';
import { WorkshopState } from '../store/slices/workshopSlice';
import { Archetype } from './archetypeService';

describe('aiAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set test API key by default
    process.env.REACT_APP_OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  const mockArchetypes: Archetype[] = [
    {
      id: 'innovative-leader',
      name: 'Innovative Leader',
      description: 'Transforms industries through breakthrough thinking',
      coreValues: ['innovation', 'leadership', 'courage', 'adaptability'],
      toneProfile: {
        formality: 0.7,
        analytical: 0.6,
        creative: 0.8,
        assertive: 0.8
      },
      personalityTraits: ['Visionary', 'Risk-taker', 'Creative', 'Strategic', 'Disruptive'],
      keywords: ['innovate', 'transform', 'disrupt', 'breakthrough', 'future'],
      contentStyle: 'Bold and forward-thinking',
      missionTemplate: 'I transform [INDUSTRY] through [METHOD]'
    },
    {
      id: 'empathetic-expert',
      name: 'Empathetic Expert',
      description: 'Combines deep expertise with human connection',
      coreValues: ['empathy', 'service', 'wisdom', 'authenticity'],
      toneProfile: {
        formality: 0.6,
        analytical: 0.5,
        creative: 0.5,
        assertive: 0.4
      },
      personalityTraits: ['Knowledgeable', 'Caring', 'Patient', 'Supportive', 'Wise'],
      keywords: ['help', 'support', 'guide', 'understand', 'teach'],
      contentStyle: 'Warm and authoritative',
      missionTemplate: 'I help [AUDIENCE] achieve [OUTCOME] through [EXPERTISE]'
    }
  ];

  describe('analyzeWritingWithAI', () => {
    test('should return default analysis when no API key is provided', async () => {
      // Temporarily remove API key
      const originalKey = process.env.REACT_APP_OPENAI_API_KEY;
      delete process.env.REACT_APP_OPENAI_API_KEY;
      
      const result = await analyzeWritingWithAI('Sample text', mockArchetypes);
      
      expect(result).toEqual({
        communicationStyle: {
          formality: 0.5,
          analyticalVsEmotional: 0.5,
          assertiveness: 0.5,
          creativity: 0.5
        },
        expertise: [],
        keyThemes: [],
        voiceCharacteristics: [],
        archetypeIndicators: {}
      });
      
      // Restore API key
      if (originalKey) {
        process.env.REACT_APP_OPENAI_API_KEY = originalKey;
      }
    });

    test('should return default analysis when no writing sample is provided', async () => {
      const result = await analyzeWritingWithAI('', mockArchetypes);
      
      expect(result).toEqual({
        communicationStyle: {
          formality: 0.5,
          analyticalVsEmotional: 0.5,
          assertiveness: 0.5,
          creativity: 0.5
        },
        expertise: [],
        keyThemes: [],
        voiceCharacteristics: [],
        archetypeIndicators: {}
      });
    });

    test('should call OpenAI API with correct parameters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              communicationStyle: {
                formality: 0.7,
                analyticalVsEmotional: 0.3,
                assertiveness: 0.8,
                creativity: 0.6
              },
              expertise: ['Technology', 'Innovation'],
              keyThemes: ['Digital transformation', 'Future of work'],
              voiceCharacteristics: ['Confident', 'Visionary', 'Direct'],
              archetypeIndicators: {
                'innovative-leader': 0.85,
                'empathetic-expert': 0.45
              }
            })
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await analyzeWritingWithAI('I believe in transforming industries through innovative technology...', mockArchetypes);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: expect.stringContaining('transforming industries')
        })
      );

      expect(result).toEqual({
        communicationStyle: {
          formality: 0.7,
          analyticalVsEmotional: 0.3,
          assertiveness: 0.8,
          creativity: 0.6
        },
        expertise: ['Technology', 'Innovation'],
        keyThemes: ['Digital transformation', 'Future of work'],
        voiceCharacteristics: ['Confident', 'Visionary', 'Direct'],
        archetypeIndicators: {
          'innovative-leader': 0.85,
          'empathetic-expert': 0.45
        }
      });
    });

    test('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeWritingWithAI('Sample text', mockArchetypes);

      // Should fall back to basic analysis
      expect(result.communicationStyle.formality).toBe(0.5);
      expect(result.communicationStyle.assertiveness).toBe(0.5);
      expect(result.communicationStyle.analyticalVsEmotional).toBeGreaterThanOrEqual(0);
      expect(result.communicationStyle.creativity).toBeGreaterThan(0);
      expect(result.expertise).toEqual([]);
      expect(result.keyThemes).toEqual([]);
      expect(result.voiceCharacteristics).toHaveLength(3);
      expect(result.archetypeIndicators).toHaveProperty('innovative-leader');
      expect(result.archetypeIndicators).toHaveProperty('empathetic-expert');
    });

    test('should handle malformed API responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await analyzeWritingWithAI('Sample text', mockArchetypes);

      // Should fall back to basic analysis
      expect(result.communicationStyle.formality).toBe(0.5);
      expect(result.communicationStyle.assertiveness).toBe(0.5);
      expect(result.communicationStyle.analyticalVsEmotional).toBeGreaterThanOrEqual(0);
      expect(result.communicationStyle.creativity).toBeGreaterThan(0);
      expect(result.expertise).toEqual([]);
      expect(result.keyThemes).toEqual([]);
      expect(result.voiceCharacteristics).toHaveLength(3);
      expect(result.archetypeIndicators).toHaveProperty('innovative-leader');
      expect(result.archetypeIndicators).toHaveProperty('empathetic-expert');
    });
  });

  describe('analyzePersonalityWithAI', () => {
    const mockResponses = [
      { questionId: 'role', question: 'What is your current role?', answer: 'Senior Product Manager' },
      { questionId: 'strength', question: 'What is your greatest strength?', answer: 'Strategic thinking and innovation' },
      { questionId: 'challenge', question: 'What is your biggest challenge?', answer: 'Balancing speed with quality' },
      { questionId: 'motivation', question: 'What motivates you?', answer: 'Creating products that make a difference' }
    ];

    test('should return default analysis when no API key is provided', async () => {
      // Temporarily remove API key
      const originalKey = process.env.REACT_APP_OPENAI_API_KEY;
      delete process.env.REACT_APP_OPENAI_API_KEY;
      
      const result = await analyzePersonalityWithAI(mockResponses, mockArchetypes);
      
      expect(result).toEqual({
        coreTraits: [],
        leadershipStyle: 'collaborative',
        values: [],
        motivations: [],
        archetypeAlignment: {}
      });
      
      // Restore API key
      if (originalKey) {
        process.env.REACT_APP_OPENAI_API_KEY = originalKey;
      }
    });

    test('should return default analysis when no responses are provided', async () => {
      const result = await analyzePersonalityWithAI([], mockArchetypes);
      
      expect(result).toEqual({
        coreTraits: [],
        leadershipStyle: 'collaborative',
        values: [],
        motivations: [],
        archetypeAlignment: {}
      });
    });

    test('should analyze personality responses correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              coreTraits: ['Strategic', 'Innovative', 'Decisive'],
              leadershipStyle: 'Visionary Leader',
              values: ['Innovation', 'Excellence', 'Impact'],
              motivations: ['Making a difference', 'Solving complex problems'],
              archetypeAlignment: {
                'innovative-leader': 0.9,
                'empathetic-expert': 0.6
              }
            })
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await analyzePersonalityWithAI(mockResponses, mockArchetypes);

      expect(result).toEqual({
        coreTraits: ['Strategic', 'Innovative', 'Decisive'],
        leadershipStyle: 'Visionary Leader',
        values: ['Innovation', 'Excellence', 'Impact'],
        motivations: ['Making a difference', 'Solving complex problems'],
        archetypeAlignment: {
          'innovative-leader': 0.9,
          'empathetic-expert': 0.6
        }
      });
    });
  });

  describe('generateEnhancedMission', () => {
    const mockWorkshopData: WorkshopState = {
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      isCompleted: true,
      assessmentScore: 85,
      workshopPath: 'direct',
      startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      values: {
        selected: ['innovation', 'excellence', 'integrity'],
        custom: [],
        rankings: {},
        primary: ['innovation', 'excellence'],
        aspirational: ['leadership'],
        stories: {}
      },
      tonePreferences: {
        formal_casual: -20,
        concise_detailed: 10,
        analytical_creative: 30,
        serious_playful: -10
      },
      audiencePersonas: [{
        id: '1',
        name: 'Tech Leaders',
        role: 'CTO/VP Engineering',
        industry: 'Technology',
        painPoints: ['Scaling teams', 'Innovation challenges'],
        goals: ['Digital transformation', 'Team excellence'],
        communicationStyle: 'technical',
        transformation: {
          outcome: 'From struggling to scale to leading innovation',
          beforeState: 'Overwhelmed by growth',
          afterState: 'Confidently scaling'
        },
        isPrimary: true
      }],
      writingSample: {
        text: 'I believe in building products that transform industries...',
        wordCount: 50,
        uploadedAt: new Date().toISOString()
      },
      personalityQuiz: {
        responses: [
          { questionId: 'role', answer: 'VP of Product', answeredAt: new Date().toISOString() },
          { questionId: 'motivation', answer: 'Creating meaningful impact', answeredAt: new Date().toISOString() }
        ],
        currentQuestionIndex: 0
      },
      sessionId: 'test-session',
      isSaving: false,
      lastError: null
    };

    const mockWritingAnalysis = {
      communicationStyle: {
        formality: 0.7,
        analyticalVsEmotional: 0.3,
        assertiveness: 0.8,
        creativity: 0.6
      },
      expertise: ['Product Strategy', 'Innovation'],
      keyThemes: ['Transformation', 'Leadership'],
      voiceCharacteristics: ['Visionary', 'Strategic'],
      archetypeIndicators: {}
    };

    const mockPersonalityAnalysis = {
      coreTraits: ['Strategic', 'Innovative'],
      leadershipStyle: 'Visionary',
      values: ['Innovation', 'Excellence'],
      motivations: ['Impact', 'Growth'],
      archetypeAlignment: {}
    };

    test('should return default missions when no API key is provided', async () => {
      // Temporarily remove API key
      const originalKey = process.env.REACT_APP_OPENAI_API_KEY;
      delete process.env.REACT_APP_OPENAI_API_KEY;
      
      const result = await generateEnhancedMission(
        mockArchetypes[0],
        mockWorkshopData,
        mockWritingAnalysis,
        mockPersonalityAnalysis
      );
      
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('help');
      
      // Restore API key
      if (originalKey) {
        process.env.REACT_APP_OPENAI_API_KEY = originalKey;
      }
    });

    test('should generate enhanced mission statements', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              'To revolutionize product development through innovative thinking',
              'Empowering teams to build products that change the world',
              'Leading the charge in creating technology that matters'
            ])
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnhancedMission(
        mockArchetypes[0],
        mockWorkshopData,
        mockWritingAnalysis,
        mockPersonalityAnalysis
      );

      expect(result).toEqual([
        'To revolutionize product development through innovative thinking',
        'Empowering teams to build products that change the world',
        'Leading the charge in creating technology that matters'
      ]);
    });

    test('should handle API errors and return fallback missions', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await generateEnhancedMission(
        mockArchetypes[0],
        mockWorkshopData,
        mockWritingAnalysis,
        mockPersonalityAnalysis
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('help');
    });
  });
});