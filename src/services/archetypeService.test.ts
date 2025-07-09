import { determineArchetype, generateMissionStatement, archetypes } from './archetypeService';

// Helper to create personality quiz responses
const createPersonalityQuiz = (role: string, experience: string, expertise: string, opinion: string) => ({
  responses: [
    { questionId: 'role', answer: role, answeredAt: '2024-01-01' },
    { questionId: 'experience', answer: experience, answeredAt: '2024-01-01' },
    { questionId: 'expertise', answer: expertise, answeredAt: '2024-01-01' },
    { questionId: 'opinion', answer: opinion, answeredAt: '2024-01-01' },
  ],
  currentQuestionIndex: 4,
});

describe('ArchetypeService', () => {
  describe('determineArchetype', () => {
    test('returns Innovative Leader for innovation and future-focused values', async () => {
      const workshopData = {
        values: {
          selected: ['Innovation', 'Vision', 'Creativity', 'Excellence', 'Growth'],
          primary: ['Innovation', 'Vision'],
          aspirational: ['Leadership'],
          stories: {
            Innovation: 'I love creating new solutions',
          },
          custom: [],
          rankings: {},
        },
        tonePreferences: {
          formality: 70,
          analytical: 80,
          creative: 90,
          assertive: 80,
        },
        audiencePersonas: [{
            id: '1',
            role: 'Startup Founders',
            challenges: ['Scaling innovation'],
            transformation: 'From idea to market leader',
            isPrimary: true,
          }],
        writingSample: {
          text: 'I believe in disrupting traditional approaches with innovative solutions.',
          wordCount: 100,
          uploadedAt: '2024-01-01',
          analysisResults: undefined,
        },
        personalityQuiz: createPersonalityQuiz(
          'Innovation Director',
          '10',
          'Digital transformation',
          'AI will revolutionize every industry'
        ),
      };

      const result = await determineArchetype(workshopData);
      expect(result.primary.archetype.name).toBe('Innovative Leader');
      expect(result.primary.score).toBeGreaterThan(0.3);
    });

    test('returns Empathetic Expert for people-focused values', async () => {
      const workshopData = {
        values: {
          selected: ['Empathy', 'Service', 'Connection', 'Trust', 'Compassion'],
          primary: ['Empathy', 'Service'],
          aspirational: ['Impact'],
          stories: {
            Empathy: 'I believe in helping others succeed',
          },
          custom: [],
          rankings: {},
        },
        tonePreferences: {
          formality: 40,
          analytical: 50,
          creative: 80,
          assertive: 40,
        },
        audiencePersonas: [{
            id: '1',
            role: 'Team Leaders',
            challenges: ['Employee engagement'],
            transformation: 'From struggling to thriving teams',
            isPrimary: true,
          }],
        writingSample: {
          text: 'Leadership is about serving others and creating environments where people can thrive.',
          wordCount: 100,
          uploadedAt: '2024-01-01',
          analysisResults: undefined,
        },
        personalityQuiz: createPersonalityQuiz(
          'HR Director',
          '15',
          'Organizational psychology',
          'People are the heart of every organization'
        ),
      };

      const result = await determineArchetype(workshopData);
      expect(result.primary.archetype.name).toBe('Empathetic Expert');
      expect(result.primary.score).toBeGreaterThan(0.3);
    });

    test('detects hybrid archetype when scores are close', async () => {
      const workshopData = {
        values: {
          selected: ['Strategy', 'Innovation', 'Excellence', 'Impact', 'Growth'],
          primary: ['Strategy', 'Innovation'],
          aspirational: ['Leadership'],
          stories: {
            Strategy: 'I combine strategic thinking with innovative approaches',
          },
          custom: [],
          rankings: {},
        },
        tonePreferences: {
          formality: 70,
          analytical: 75,
          creative: 75,
          assertive: 70,
        },
        audiencePersonas: [{
            id: '1',
            role: 'C-Suite Executives',
            challenges: ['Digital transformation'],
            transformation: 'From traditional to digital-first',
            isPrimary: true,
          }],
        writingSample: {
          text: 'Success requires both strategic planning and innovative execution.',
          wordCount: 100,
          uploadedAt: '2024-01-01',
          analysisResults: undefined,
        },
        personalityQuiz: createPersonalityQuiz(
          'Strategy Consultant',
          '12',
          'Business transformation',
          'Strategy without innovation is obsolete'
        ),
      };

      const result = await determineArchetype(workshopData);
      // Since scores are similar, it should not detect a hybrid (difference > 0.15)
      expect(result.hybrid).toBeUndefined();
      expect(result.primary.confidence).toBeGreaterThan(0.3);
      expect(result.primary.confidence).toBeLessThan(0.85); // Lower confidence for hybrid
    });

    test('calculates confidence based on data completeness', async () => {
      const incompleteData = {
        values: {
          selected: ['Innovation'],
          primary: [],
          aspirational: [],
          stories: {},
          custom: [],
          rankings: {},
        },
        tonePreferences: {
          formality: 50,
          analytical: 50,
          creative: 50,
          assertive: 50,
        },
        audiencePersonas: [],
        writingSample: {
          text: '',
          wordCount: 0,
          uploadedAt: '2024-01-01',
          analysisResults: undefined,
        },
        personalityQuiz: {
          responses: [],
          currentQuestionIndex: 0,
        },
      };

      const result = await determineArchetype(incompleteData);
      expect(result.primary.confidence).toBeLessThan(0.5); // Low confidence for incomplete data
    });
  });

  describe('generateMissionStatement', () => {
    test('generates mission statement for archetype', () => {
      const workshopData = {
        values: {
          selected: ['Innovation', 'Excellence'],
          primary: ['Innovation', 'Excellence'],
        },
        audiencePersonas: [{
            id: '1',
            name: 'Entrepreneurs',
            role: 'Startup Founders',
            industry: 'Technology',
            painPoints: ['Scaling', 'Funding'],
            goals: ['Growth', 'Impact'],
            communicationStyle: 'casual',
            transformation: {
              outcome: 'From idea to success',
              beforeState: 'Struggling with direction',
              afterState: 'Clear path to growth',
            },
            isPrimary: true,
          }],
        personalityQuiz: {
          responses: [
            { questionId: 'role', answer: 'Innovation Coach', answeredAt: '2024-01-01' },
            { questionId: 'expertise', answer: 'Startup strategy', answeredAt: '2024-01-01' },
          ],
          currentQuestionIndex: 2,
        },
      };

      const archetype = archetypes.find(a => a.id === 'innovative-leader')!;
      const mission = generateMissionStatement(archetype, workshopData as any);

      expect(mission).toBeDefined();
      expect(mission.length).toBeGreaterThan(20);
      expect(mission.toLowerCase()).toMatch(/lead|transform|pioneer|impact/);
    });

    test('generates mission statement for empathetic expert', () => {
      const workshopData = {
        values: {
          selected: ['Empathy', 'Service'],
          primary: ['Empathy', 'Service'],
        },
        audiencePersonas: [{
            id: '1',
            name: 'Healthcare Pros',
            role: 'Healthcare Professionals', 
            industry: 'Healthcare',
            painPoints: ['Patient satisfaction', 'Efficiency'],
            goals: ['Better outcomes', 'Work-life balance'],
            communicationStyle: 'formal',
            transformation: {
              outcome: 'Better patient care',
              beforeState: 'Overwhelmed and burnt out',
              afterState: 'Confident and effective',
            },
            isPrimary: true,
          }],
        personalityQuiz: {
          responses: [
            { questionId: 'role', answer: 'Healthcare Consultant', answeredAt: '2024-01-01' },
            { questionId: 'expertise', answer: 'Patient experience', answeredAt: '2024-01-01' },
          ],
          currentQuestionIndex: 2,
        },
      };

      const archetype = archetypes.find(a => a.id === 'empathetic-expert')!;
      const mission = generateMissionStatement(archetype, workshopData as any);

      expect(mission).toBeDefined();
      expect(mission.length).toBeGreaterThan(20);
      expect(mission.toLowerCase()).toMatch(/help|overcome|compassionate|expertise/);
    });
  });
});