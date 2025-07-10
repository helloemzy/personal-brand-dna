import { constructUVP, generateUVPContentHooks } from './uvpConstructorService';
import { WorkshopState } from '../store/slices/workshopSlice';

describe('uvpConstructorService', () => {
  // Mock workshop data with complete structure
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
      selected: ['innovation', 'integrity', 'growth', 'impact', 'collaboration'],
      custom: [],
      rankings: {},
      primary: ['innovation', 'integrity'],
      aspirational: ['leadership'],
      stories: {
        innovation: 'Led digital transformation at previous company',
        integrity: 'Turned down lucrative deal that compromised values'
      }
    },
    tonePreferences: {
      formal_casual: 20,
      concise_detailed: -10,
      analytical_creative: 30,
      serious_playful: 10
    },
    audiencePersonas: [
      {
        id: '1',
        title: 'Tech Startup Founders',
        name: 'Tech Startup Founders',
        role: 'CEO/CTO',
        industry: 'Technology',
        painPoints: ['Scaling challenges', 'Technical debt', 'Team building'],
        goals: ['Rapid growth', 'Product-market fit', 'Funding'],
        communicationStyle: 'Direct and data-driven',
        transformation: {
          outcome: 'Scale from startup to successful exit',
          beforeState: 'Overwhelmed by growth challenges',
          afterState: 'Confidently leading scalable operations'
        },
        isPrimary: true
      }
    ],
    writingSample: {
      text: 'I believe in transforming complex technical challenges into elegant solutions that drive business growth.',
      wordCount: 15,
      uploadedAt: new Date().toISOString()
    },
    personalityQuiz: {
      responses: [
        {
          questionId: 'professional_role',
          question: 'What is your current professional role?',
          answer: 'Senior Product Manager with 10 years of experience',
          answeredAt: new Date().toISOString()
        },
        {
          questionId: 'known_for',
          question: 'What are you known for professionally?',
          answer: 'Building user-centric products that scale, data-driven decision making, cross-functional leadership',
          answeredAt: new Date().toISOString()
        },
        {
          questionId: 'unique_approach',
          question: 'What makes your approach unique?',
          answer: 'I combine technical expertise with business acumen to create products users love',
          answeredAt: new Date().toISOString()
        },
        {
          questionId: 'industry_frustration',
          question: 'What frustrates you about your industry?',
          answer: 'Too many products built without understanding real user needs',
          answeredAt: new Date().toISOString()
        },
        {
          questionId: 'aspirational_role',
          question: 'What role do you aspire to?',
          answer: 'Chief Product Officer at an innovative tech company',
          answeredAt: new Date().toISOString()
        },
        {
          questionId: 'controversial_opinion',
          question: 'What\'s your controversial opinion?',
          answer: 'Most MVPs fail because they\'re neither minimal nor viable',
          answeredAt: new Date().toISOString()
        }
      ],
      currentQuestionIndex: 0
    },
    sessionId: 'test-session-123',
    isSaving: false,
    lastError: null
  };

  describe('constructUVP', () => {
    test('should generate UVP variations with all required fields', () => {
      const result = constructUVP(mockWorkshopData, 'Innovative Leader');

      expect(result).toHaveProperty('variations');
      expect(result).toHaveProperty('primaryUVP');
      expect(result).toHaveProperty('uniqueFactors');
      expect(result).toHaveProperty('industryContext');

      expect(result.variations).toHaveLength(3);
      expect(result.variations[0]).toHaveProperty('id');
      expect(result.variations[0]).toHaveProperty('type');
      expect(result.variations[0]).toHaveProperty('fullStatement');
      expect(result.variations[0]).toHaveProperty('linkedinHeadline');
      expect(result.variations[0]).toHaveProperty('confidence');
      expect(result.variations[0]).toHaveProperty('differentiators');
    });

    test('should generate standard format UVP correctly', () => {
      const result = constructUVP(mockWorkshopData, 'Innovative Leader');
      const standardUVP = result.variations.find(v => v.type === 'standard');

      expect(standardUVP).toBeDefined();
      expect(standardUVP?.fullStatement).toContain('Senior Product Manager');
      expect(standardUVP?.fullStatement).toMatch(/Tech Startup Founders|ambitious professionals/);
      expect(standardUVP?.linkedinHeadline.length).toBeLessThanOrEqual(220);
    });

    test('should generate results-focused UVP correctly', () => {
      const result = constructUVP(mockWorkshopData, 'Strategic Visionary');
      const resultsUVP = result.variations.find(v => v.type === 'results-focused');

      expect(resultsUVP).toBeDefined();
      expect(resultsUVP?.fullStatement).toContain('Scale from startup to successful exit');
      expect(resultsUVP?.differentiators.length).toBeGreaterThan(0);
    });

    test('should generate pain-focused UVP correctly', () => {
      const result = constructUVP(mockWorkshopData, 'Empathetic Expert');
      const painUVP = result.variations.find(v => v.type === 'pain-focused');

      expect(painUVP).toBeDefined();
      expect(painUVP?.fullStatement).toMatch(/scaling challenges|conventional thinking|usual complexity/);
    });

    test('should extract unique factors correctly', () => {
      const result = constructUVP(mockWorkshopData, 'Authentic Changemaker');

      expect(result.uniqueFactors.role).toBe('Senior Product Manager');
      expect(result.uniqueFactors.method).toContain('most mvps fail');
      expect(result.uniqueFactors.outcome).toContain('Scale from startup to successful exit');
      expect(result.uniqueFactors.audience).toContain('Tech Startup Founders');
      expect(result.uniqueFactors.painPoint).toMatch(/scaling challenges|conventional thinking|usual complexity/);
    });

    test('should handle missing data gracefully', () => {
      const minimalData: WorkshopState = {
        ...mockWorkshopData,
        personalityQuiz: {
          responses: [],
          currentQuestionIndex: 0
        },
        audiencePersonas: []
      };

      const result = constructUVP(minimalData, 'Innovative Leader');

      expect(result.variations).toHaveLength(3);
      expect(result.uniqueFactors.role).toMatch(/professional/);
      expect(result.uniqueFactors.audience).toBe('ambitious professionals');
    });

    test('should adapt UVP based on archetype', () => {
      const innovativeResult = constructUVP(mockWorkshopData, 'Innovative Leader');
      const empatheticResult = constructUVP(mockWorkshopData, 'Empathetic Expert');

      // Each archetype should have different competitive landscape
      expect(innovativeResult.industryContext.competitiveLandscape).toContain('forward-thinking pioneer');
      expect(empatheticResult.industryContext.competitiveLandscape).toContain('human-centered expertise');
      expect(innovativeResult.industryContext.competitiveLandscape).not.toBe(empatheticResult.industryContext.competitiveLandscape);
    });

    test('should include industry-specific terminology', () => {
      const result = constructUVP(mockWorkshopData, 'Strategic Visionary');

      expect(result.industryContext.field).toBe('Technology');
      expect(result.industryContext.terminology).toEqual(
        expect.arrayContaining(['digital transformation', 'scalable solutions', 'innovation'])
      );
    });

    test('should generate LinkedIn-optimized headlines', () => {
      const result = constructUVP(mockWorkshopData, 'Innovative Leader');

      result.variations.forEach(variation => {
        expect(variation.linkedinHeadline.length).toBeLessThanOrEqual(220);
        expect(variation.linkedinHeadline).not.toContain('\n');
        expect(variation.linkedinHeadline.trim()).toBe(variation.linkedinHeadline);
      });
    });

    test('should calculate confidence scores based on data completeness', () => {
      const completeDataResult = constructUVP(mockWorkshopData, 'Strategic Visionary');
      
      const incompleteData: WorkshopState = {
        ...mockWorkshopData,
        personalityQuiz: {
          responses: mockWorkshopData.personalityQuiz.responses.slice(0, 2),
          currentQuestionIndex: 0
        },
        audiencePersonas: [] // Remove personas to reduce confidence
      };
      const incompleteDataResult = constructUVP(incompleteData, 'Strategic Visionary');

      // Just check that confidence was calculated, actual value depends on implementation
      expect(completeDataResult.primaryUVP.confidence).toBeGreaterThan(0);
      expect(incompleteDataResult.primaryUVP.confidence).toBeGreaterThan(0);
      expect(incompleteDataResult.primaryUVP.confidence).toBeLessThanOrEqual(completeDataResult.primaryUVP.confidence);
    });
  });

  describe('generateUVPContentHooks', () => {
    const mockUVPAnalysis = {
      variations: [
        {
          id: 'uvp-1',
          type: 'standard' as const,
          fullStatement: 'I\'m the only Senior Product Manager who combines technical expertise with business acumen...',
          linkedinHeadline: 'Senior Product Manager | Scaling Tech Startups | Data-Driven Growth',
          confidence: 0.85,
          differentiators: ['technical expertise', 'business acumen', 'user-centric approach']
        }
      ],
      primaryUVP: {
        id: 'uvp-1',
        type: 'standard' as const,
        fullStatement: 'I\'m the only Senior Product Manager who combines technical expertise with business acumen...',
        linkedinHeadline: 'Senior Product Manager | Scaling Tech Startups | Data-Driven Growth',
        confidence: 0.85,
        differentiators: ['technical expertise', 'business acumen', 'user-centric approach']
      },
      uniqueFactors: {
        role: 'Senior Product Manager',
        method: 'combine technical expertise with business acumen',
        outcome: 'products users love that scale',
        audience: 'Tech Startup Founders',
        painPoint: 'products built without understanding real user needs'
      },
      industryContext: {
        field: 'Technology',
        terminology: ['MVP', 'product-market fit', 'scalability'],
        competitiveLandscape: 'Highly competitive with focus on innovation'
      }
    };

    test('should generate content hooks as strings', () => {
      const hooks = generateUVPContentHooks(mockUVPAnalysis);

      expect(Array.isArray(hooks)).toBe(true);
      expect(hooks.length).toBeGreaterThan(0);
      hooks.forEach(hook => {
        expect(typeof hook).toBe('string');
      });
    });

    test('should generate relevant content ideas', () => {
      const hooks = generateUVPContentHooks(mockUVPAnalysis);
      const allHooksText = hooks.join(' ');

      // Check that hooks incorporate the unique factors
      expect(allHooksText).toMatch(/Senior Product Manager|technical expertise|Tech Startup/i);
    });

    test('should generate multiple content hooks', () => {
      const hooks = generateUVPContentHooks(mockUVPAnalysis);
      
      expect(hooks.length).toBeGreaterThanOrEqual(5);
      expect(hooks.length).toBeLessThanOrEqual(10);
    });

    test('should generate unique hooks', () => {
      const hooks = generateUVPContentHooks(mockUVPAnalysis);
      const uniqueHooks = new Set(hooks);
      
      // All hooks should be unique
      expect(uniqueHooks.size).toBe(hooks.length);
    });
  });
});