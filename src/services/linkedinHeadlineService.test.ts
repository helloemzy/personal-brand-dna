import {
  generateActionableContent,
  validateHeadline,
} from './linkedinHeadlineService';
import { WorkshopState } from '../store/slices/workshopSlice';
import { UVPAnalysis } from './uvpConstructorService';

describe('linkedinHeadlineService', () => {
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
      selected: ['Innovation', 'Excellence', 'Impact'],
      custom: [],
      rankings: { 'Innovation': 1, 'Excellence': 2, 'Impact': 3 },
      primary: ['Innovation', 'Excellence'],
      aspirational: ['Leadership'],
      stories: { 'Innovation': 'Driven by innovation to create meaningful impact' },
    },
    tonePreferences: {
      formal_casual: -20,
      concise_detailed: 10,
      analytical_creative: 30,
      serious_playful: -10,
    },
    audiencePersonas: [
      {
        id: '1',
        name: 'Tech Startup Founders',
        role: 'Founder/CEO',
        industry: 'Technology',
        painPoints: ['Scaling challenges', 'Product-Market Fit'],
        goals: ['Rapid growth', 'Market dominance'],
        communicationStyle: 'conversational',
        transformation: {
          outcome: 'From idea to unicorn',
          beforeState: 'Overwhelmed and uncertain',
          afterState: 'Confident and scaling rapidly',
        },
        isPrimary: true,
      },
    ],
    writingSample: {
      text: 'I help startups transform ideas into scalable businesses.',
      wordCount: 10,
      uploadedAt: new Date().toISOString(),
    },
    personalityQuiz: {
      responses: [
        { 
          questionId: 'professional_role', 
          answer: 'Startup Advisor with 10 years experience',
          answeredAt: new Date().toISOString(),
        },
        { 
          questionId: 'known_for', 
          answer: 'Growth strategy and product development',
          answeredAt: new Date().toISOString(),
        },
      ],
    },
  };

  const mockUVPAnalysis: UVPAnalysis = {
    variations: [
      {
        id: 'standard',
        type: 'standard',
        fullStatement: 'I help startups transform ideas into scalable businesses through innovative growth strategies.',
        linkedinHeadline: 'Startup Advisor | Growth Strategy Expert',
        confidence: 0.85,
        differentiators: ['10 years experience', 'proven framework', 'data-driven approach'],
      },
    ],
    primaryUVP: {
      id: 'standard',
      type: 'standard',
      fullStatement: 'I help startups transform ideas into scalable businesses through innovative growth strategies.',
      linkedinHeadline: 'Startup Advisor | Growth Strategy Expert',
      confidence: 0.85,
      differentiators: ['10 years experience', 'proven framework', 'data-driven approach'],
    },
    uniqueFactors: {
      role: 'Startup Advisor',
      method: 'innovative growth strategies',
      outcome: 'scalable businesses',
      audience: 'startups',
      painPoint: 'transforming ideas into reality',
    },
    industryContext: {
      field: 'technology',
      terminology: ['startup', 'growth', 'scale', 'product-market fit'],
      competitiveLandscape: 'Competitive startup ecosystem',
    },
  };

  const mockContentPillars = [
    { name: 'Expertise', topics: ['Growth Strategy', 'Product Development'] },
    { name: 'Experience', topics: ['Startup Success Stories', 'Lessons Learned'] },
    { name: 'Evolution', topics: ['Industry Trends', 'Future of Startups'] },
  ];

  describe('generateActionableContent', () => {
    test('should generate complete actionable content package', () => {
      const content = generateActionableContent(mockWorkshopData, 'innovativeLeader', mockUVPAnalysis, mockContentPillars);
      expect(content).toBeDefined();
      expect(content.headlines).toBeDefined();
      expect(content.elevatorPitches).toBeDefined();
      expect(content.contentStarters).toBeDefined();
    });

    test('should generate multiple headline variations', () => {
      const content = generateActionableContent(mockWorkshopData, 'innovativeLeader', mockUVPAnalysis, mockContentPillars);
      expect(content.headlines).toHaveLength(5);
      
      // Each headline should have required properties
      content.headlines.forEach((headline) => {
        expect(headline.text).toBeTruthy();
        expect(headline.type).toBeTruthy();
        expect(headline.characterCount).toBeLessThanOrEqual(220);
        expect(headline.keywords).toBeDefined();
      });
    });

    test('should generate elevator pitches', () => {
      const content = generateActionableContent(mockWorkshopData, 'innovativeLeader', mockUVPAnalysis, mockContentPillars);
      expect(content.elevatorPitches).toHaveLength(3);
      
      const durations = content.elevatorPitches.map(p => p.duration);
      expect(durations).toContain('30-second');
      expect(durations).toContain('60-second');
      expect(durations).toContain('networking-event');
    });

    test('should generate content starters', () => {
      const content = generateActionableContent(mockWorkshopData, 'innovativeLeader', mockUVPAnalysis, mockContentPillars);
      expect(content.contentStarters.length).toBeGreaterThanOrEqual(10);
      
      // Each starter should have required properties
      content.contentStarters.forEach((starter) => {
        expect(starter.id).toBeTruthy();
        expect(starter.headline).toBeTruthy();
        expect(starter.hook).toBeTruthy();
        expect(starter.angle).toBeTruthy();
        expect(starter.pillar).toMatch(/^(expertise|experience|evolution)$/);
      });
    });
  });

  describe('validateHeadline', () => {
    test('should validate headline length', () => {
      const validHeadline = {
        id: 'test',
        text: 'Innovation Strategist | Helping startups scale',
        type: 'authority' as const,
        characterCount: 47,
        keywords: ['innovation', 'strategist', 'startups'],
        archetype: 'innovativeLeader',
        confidence: 0.85,
      };
      
      const result = validateHeadline(validHeadline);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should reject headlines over 220 characters', () => {
      const longHeadline = {
        id: 'test',
        text: 'A'.repeat(221),
        type: 'authority' as const,
        characterCount: 221,
        keywords: [],
        archetype: 'innovativeLeader',
        confidence: 0.8,
      };
      
      const result = validateHeadline(longHeadline);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Headline exceeds LinkedIn\'s 220 character limit');
    });

    test('should validate keyword count', () => {
      const goodHeadline = {
        id: 'test',
        text: 'Innovation Strategist | Helping startups scale',
        type: 'authority' as const,
        characterCount: 47,
        keywords: ['innovation', 'strategist', 'startups'],
        archetype: 'innovativeLeader',
        confidence: 0.85,
      };
      
      const result = validateHeadline(goodHeadline);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});