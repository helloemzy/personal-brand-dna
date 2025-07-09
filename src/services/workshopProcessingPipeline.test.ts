import { processWorkshopData, getProcessingStatus, clearSessionCache } from './workshopProcessingPipeline';
import * as archetypeService from './archetypeService';
import * as aiAnalysisService from './aiAnalysisService';
import * as contentPillarService from './contentPillarService';
import * as uvpConstructorService from './uvpConstructorService';
import * as linkedinHeadlineService from './linkedinHeadlineService';
import * as trackingService from './trackingService';

// Mock all dependencies
jest.mock('./archetypeService');
jest.mock('./aiAnalysisService');
jest.mock('./contentPillarService');
jest.mock('./uvpConstructorService');
jest.mock('./linkedinHeadlineService');
jest.mock('./trackingService');
jest.mock('@sentry/react');

describe('workshopProcessingPipeline', () => {
  // Sample workshop data
  const mockWorkshopData = {
    currentStep: 5,
    sessionStartTime: Date.now(),
    sessionId: 'test-session-123',
    personalInfo: {
      professionalRole: 'Software Engineer',
      yearsExperience: '5-10',
      industry: 'Technology'
    },
    values: {
      selected: ['innovation', 'integrity', 'growth'],
      primaryValues: ['innovation', 'integrity'],
      aspirationalValues: ['leadership'],
      descriptions: {},
      stories: {
        innovation: 'I love creating new solutions'
      }
    },
    tone: {
      selectedWords: ['professional', 'innovative', 'approachable'],
      customWord: ''
    },
    audience: {
      personas: [
        {
          id: '1',
          description: 'Tech startup founders',
          painPoints: ['Scaling challenges', 'Technical debt'],
          isPrimary: true,
          transformation: 'build scalable systems',
          beforeState: 'struggling with growth',
          afterState: 'confidently scaling'
        }
      ]
    },
    writingSample: {
      prompt: 'Write about innovation',
      sample: 'Innovation is about solving real problems...',
      pillar: 'expertise'
    },
    personality: {
      answers: {
        q1: 'a',
        q2: 'b',
        q3: 'a',
        q4: 'c',
        q5: 'b'
      }
    }
  };

  const mockArchetypeResult = {
    archetype: {
      id: 'innovative-leader',
      name: 'Innovative Leader',
      description: 'You transform industries...',
      mission: 'I lead transformation in technology...'
    },
    score: 0.85,
    confidence: 0.9,
    breakdown: {
      values: 0.9,
      tone: 0.85,
      personality: 0.8,
      writing: 0.85,
      audience: 0.85
    }
  };

  const mockContentPillars = {
    pillars: [
      {
        name: 'Expertise',
        percentage: 40,
        description: 'Technical knowledge',
        topics: ['Architecture', 'Best practices'],
        voiceGuidelines: 'Professional and informative',
        color: '#4A90E2'
      }
    ],
    starterContent: [
      {
        title: 'Why microservices matter',
        hook: 'Most developers get this wrong...',
        angle: 'contrarian',
        pillar: 'Expertise',
        engagementType: 'educational'
      }
    ]
  };

  const mockUVP = {
    statement: 'I help tech startups scale...',
    differentiators: ['10+ years experience', 'Proven framework'],
    marketPosition: 'Technical scaling expert',
    variations: {
      standard: 'Tech scaling expert',
      resultsFocused: 'I 10x your tech capacity',
      painFocused: 'Stop technical debt today'
    },
    headlines: {
      standard: 'Tech Scaling Expert',
      resultsFocused: '10x Your Tech Capacity',
      painFocused: 'Technical Debt Solver'
    }
  };

  const mockHeadlines = [
    {
      style: 'authority',
      headline: 'Tech Scaling Expert | 10+ Years',
      length: 32,
      keywords: ['scaling', 'expert'],
      isOptimalLength: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clearSessionCache('test-session-123');

    // Setup default mocks
    (archetypeService.determineArchetype as jest.Mock).mockResolvedValue(mockArchetypeResult);
    (aiAnalysisService.generateAIMission as jest.Mock).mockResolvedValue(['Mission 1', 'Mission 2']);
    (contentPillarService.generateContentPillars as jest.Mock).mockResolvedValue(mockContentPillars);
    (uvpConstructorService.generateUVP as jest.Mock).mockResolvedValue(mockUVP);
    (linkedinHeadlineService.generateLinkedInHeadlines as jest.Mock).mockResolvedValue(mockHeadlines);
  });

  describe('processWorkshopData', () => {
    it('should process workshop data successfully', async () => {
      const result = await processWorkshopData(mockWorkshopData, 'test-session-123');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.archetype).toEqual(mockArchetypeResult);
      expect(result.data?.mission).toEqual(['Mission 1', 'Mission 2']);
      expect(result.data?.contentPillars).toEqual(mockContentPillars.pillars);
      expect(result.data?.contentIdeas).toEqual(mockContentPillars.starterContent);
      expect(result.data?.uvp).toEqual(mockUVP);
      expect(result.data?.headlines).toEqual(mockHeadlines);
      expect(result.cached).toBe(false);
    });

    it('should return cached results when available', async () => {
      // First call to populate cache
      await processWorkshopData(mockWorkshopData, 'test-session-123');
      
      // Reset mocks to ensure they're not called again
      jest.clearAllMocks();

      // Second call should return cached results
      const result = await processWorkshopData(mockWorkshopData, 'test-session-123');

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(archetypeService.determineArchetype).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        ...mockWorkshopData,
        values: { selected: [] } // No values selected
      };

      const result = await processWorkshopData(invalidData, 'test-session-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('At least one value must be selected');
    });

    it('should handle processing errors gracefully', async () => {
      (archetypeService.determineArchetype as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await processWorkshopData(mockWorkshopData, 'test-session-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROCESSING_ERROR');
      expect(result.error?.message).toContain('AI service unavailable');
    });

    it('should track processing progress', async () => {
      const sessionId = 'test-session-123';
      
      // Start processing
      const promise = processWorkshopData(mockWorkshopData, sessionId);

      // Check initial status
      let status = getProcessingStatus(sessionId);
      expect(status?.status).toBe('processing');
      expect(status?.progress).toBeGreaterThanOrEqual(0);

      // Wait for completion
      await promise;

      // Check final status
      status = getProcessingStatus(sessionId);
      expect(status?.status).toBe('completed');
      expect(status?.progress).toBe(100);
    });

    it('should skip validation when requested', async () => {
      const invalidData = {
        ...mockWorkshopData,
        values: { selected: [] }
      };

      const result = await processWorkshopData(
        invalidData, 
        'test-session-123',
        { skipValidation: true }
      );

      // Should proceed despite invalid data
      expect(result.success).toBe(true);
    });

    it('should disable caching when requested', async () => {
      // First call with caching disabled
      await processWorkshopData(
        mockWorkshopData,
        'test-session-123',
        { enableCache: false }
      );
      
      jest.clearAllMocks();

      // Second call should not use cache
      const result = await processWorkshopData(
        mockWorkshopData,
        'test-session-123',
        { enableCache: false }
      );

      expect(result.cached).toBe(false);
      expect(archetypeService.determineArchetype).toHaveBeenCalled();
    });

    it('should track events when enabled', async () => {
      await processWorkshopData(mockWorkshopData, 'test-session-123');

      expect(trackingService.trackEvent).toHaveBeenCalledWith(
        'workshop_processing_started',
        expect.any(Object)
      );
      expect(trackingService.trackEvent).toHaveBeenCalledWith(
        'workshop_processing_completed',
        expect.any(Object)
      );
    });

    it('should generate elevator pitches', async () => {
      const result = await processWorkshopData(mockWorkshopData, 'test-session-123');

      expect(result.data?.elevatorPitches).toHaveLength(3);
      expect(result.data?.elevatorPitches[0]).toHaveProperty('duration', '30-second');
      expect(result.data?.elevatorPitches[1]).toHaveProperty('duration', '60-second');
      expect(result.data?.elevatorPitches[2]).toHaveProperty('duration', 'Networking Event');
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields gracefully', async () => {
      const minimalData = {
        ...mockWorkshopData,
        values: {
          selected: ['innovation'],
          primaryValues: [], // Optional field missing
          aspirationalValues: [],
          descriptions: {},
          stories: {}
        }
      };

      const result = await processWorkshopData(minimalData, 'test-session-123');
      expect(result.success).toBe(true);
    });

    it('should handle API timeouts', async () => {
      jest.useFakeTimers();
      
      (archetypeService.determineArchetype as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 60000))
      );

      const promise = processWorkshopData(mockWorkshopData, 'test-session-123');
      
      // Fast-forward time
      jest.advanceTimersByTime(60000);
      
      const result = await promise;
      
      expect(result.success).toBe(true); // Should eventually complete
      
      jest.useRealTimers();
    });
  });
});