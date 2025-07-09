import { mapContentPillars, generateStarterContent } from './contentPillarService';
import { WorkshopState } from '../store/slices/workshopSlice';

describe('contentPillarService', () => {
  const mockWorkshopData: WorkshopState = {
    // Navigation
    currentStep: 5,
    completedSteps: [1, 2, 3, 4, 5],
    isCompleted: true,
    assessmentScore: 85,
    workshopPath: 'direct',
    startedAt: '2024-01-01T10:00:00Z',
    lastSavedAt: '2024-01-01T11:00:00Z',
    completedAt: '2024-01-01T11:00:00Z',
    values: {
      selected: ['Innovation', 'Excellence', 'Growth', 'Impact', 'Authenticity'],
      custom: [],
      rankings: {},
      primary: ['Innovation', 'Excellence'],
      aspirational: ['Leadership'],
      stories: {
        Innovation: 'I believe in pushing boundaries and creating meaningful change.'
      }
    },
    tonePreferences: {
      formal_casual: 40,
      concise_detailed: 30,
      analytical_creative: 40,
      serious_playful: -10
    },
    audiencePersonas: [
        {
          id: '1',
          name: 'Tech Entrepreneurs',
          role: 'Startup Founders',
          industry: 'Technology',
          painPoints: ['Scaling', 'Innovation', 'Team Building'],
          goals: ['Growth', 'Market Leadership'],
          communicationStyle: 'casual',
          transformation: {
            outcome: 'From startup to market leader',
            beforeState: 'Struggling with growth',
            afterState: 'Leading the market'
          },
          isPrimary: true,
        },
        {
          id: '2',
          name: 'Product Managers',
          role: 'Senior Product Managers',
          industry: 'Technology',
          painPoints: ['Prioritization', 'Stakeholder Management'],
          goals: ['Strategic Impact', 'Career Growth'],
          communicationStyle: 'professional',
          transformation: {
            outcome: 'From feature factory to strategic product leadership',
            beforeState: 'Overwhelmed by requests',
            afterState: 'Strategic product leader'
          },
          isPrimary: false,
        }
      ],
    writingSample: {
      text: 'Innovation isn\'t just about new ideas; it\'s about solving real problems in ways that create lasting impact.',
      wordCount: 20,
      uploadedAt: '2024-01-01T10:30:00Z',
      analysisResults: undefined
    },
    personalityQuiz: {
      responses: [
        { questionId: 'professional_role', answer: 'Chief Innovation Officer with 15 years', answeredAt: '2024-01-01' },
        { questionId: 'known_for', answer: 'Digital transformation and product strategy', answeredAt: '2024-01-01' },
        { questionId: 'controversial_opinion', answer: 'AI will democratize innovation, but human creativity remains irreplaceable', answeredAt: '2024-01-01' },
        { questionId: 'challenge', answer: 'Breaking through organizational inertia', answeredAt: '2024-01-01' },
        { questionId: 'success', answer: 'Led a digital transformation that increased revenue by 300%', answeredAt: '2024-01-01' },
        { questionId: 'approach', answer: 'Combine data-driven insights with human-centered design', answeredAt: '2024-01-01' },
        { questionId: 'motivation', answer: 'Creating products that genuinely improve people\'s lives', answeredAt: '2024-01-01' }
      ],
      currentQuestionIndex: 7
    },
    
    // Meta
    sessionId: 'test-session-123',
    isSaving: false,
    lastError: null
  };

  describe('mapContentPillars', () => {
    test('should generate three content pillars', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      expect(result.pillars).toHaveLength(3);
      expect(result.pillars[0].name).toBe('Expertise');
      expect(result.pillars[1].name).toBe('Experience');
      expect(result.pillars[2].name).toBe('Evolution');
    });

    test('should allocate correct percentages to pillars', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      expect(result.pillars[0].percentage).toBe(40);
      expect(result.pillars[1].percentage).toBe(35);
      expect(result.pillars[2].percentage).toBe(25);
    });

    test('should extract relevant topics from workshop data', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      
      // Expertise pillar should include professional topics
      const expertiseTopics = result.pillars[0].topics;
      expect(expertiseTopics).toContain('Digital transformation');
      expect(expertiseTopics).toContain('Product strategy');
      expect(expertiseTopics).toContain('Innovation frameworks');
      
      // Experience pillar should include challenges and successes
      const experienceTopics = result.pillars[1].topics;
      expect(experienceTopics.some(t => t.includes('transformation'))).toBe(true);
      expect(experienceTopics.some(t => t.includes('Team'))).toBe(true);
      
      // Evolution pillar should include future-focused topics
      const evolutionTopics = result.pillars[2].topics;
      expect(evolutionTopics.some(t => t.includes('AI') || t.includes('Future'))).toBe(true);
    });

    test('should generate at least 5 topics per pillar', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      result.pillars.forEach(pillar => {
        expect(pillar.topics.length).toBeGreaterThanOrEqual(5);
      });
    });

    test('should provide voice guidelines for each pillar', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      result.pillars.forEach(pillar => {
        expect(pillar.voiceGuidelines).toBeTruthy();
        expect(pillar.voiceGuidelines.tone).toBeTruthy();
        expect(pillar.voiceGuidelines.approach).toBeTruthy();
        expect(pillar.voiceGuidelines.examples).toBeInstanceOf(Array);
      });
    });

    test('should return primary focus and content strategy', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      expect(result.primaryFocus).toBeDefined();
      expect(result.contentStrategy).toBeDefined();
      expect(result.voiceAdaptations).toBeDefined();
    });

    test('should adapt voice for different pillars', () => {
      const result = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      
      const expertiseVoice = result.pillars[0].voiceGuidelines;
      const experienceVoice = result.pillars[1].voiceGuidelines;
      const evolutionVoice = result.pillars[2].voiceGuidelines;
      
      // Each pillar should have different voice guidelines
      expect(expertiseVoice.tone).not.toBe(experienceVoice.tone);
      expect(experienceVoice.tone).not.toBe(evolutionVoice.tone);
    });

  });

  describe('generateStarterContent', () => {
    test('should generate starter content ideas from pillar analysis', () => {
      const pillarAnalysis = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      const missionStatement = 'To lead innovation in technology';
      const starterIdeas = generateStarterContent(pillarAnalysis, 'innovativeLeader', missionStatement);
      
      expect(starterIdeas).toBeDefined();
      expect(starterIdeas.length).toBeGreaterThan(0);
      expect(starterIdeas.every(idea => typeof idea === 'string')).toBe(true);
    });

    test('should adapt content for different archetypes', () => {
      const innovativeResult = mapContentPillars(mockWorkshopData, 'innovativeLeader');
      const empatheticResult = mapContentPillars(mockWorkshopData, 'empatheticExpert');
      
      // Voice guidelines should be different
      // Voice guidelines objects should be different
      expect(innovativeResult.pillars[0].voiceGuidelines).not.toEqual(
        empatheticResult.pillars[0].voiceGuidelines
      );
      
      // Topics might overlap but emphasis should differ
      const innovativeTopics = innovativeResult.pillars[0].topics.join(' ');
      const empatheticTopics = empatheticResult.pillars[0].topics.join(' ');
      
      expect(innovativeTopics).toContain('innovation');
      expect(empatheticTopics).toContain('team');
    });

    test('should handle minimal workshop data', () => {
      const minimalData: WorkshopState = {
        currentStep: 5,
        completedSteps: [1, 2, 3, 4, 5],
        isCompleted: true,
        assessmentScore: null,
        workshopPath: null,
        startedAt: null,
        lastSavedAt: null,
        completedAt: null,
        values: {
          selected: ['Growth'],
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
      
      const result = mapContentPillars(minimalData, 'innovativeLeader');
      expect(result.pillars).toHaveLength(3);
      
      // Should still generate topics even with minimal data
      result.pillars.forEach(pillar => {
        expect(pillar.topics.length).toBeGreaterThan(0);
      });
      
      // Should provide default content strategy
      expect(result.primaryFocus).toBeDefined();
      expect(result.contentStrategy).toBeDefined();
    });
  });
});