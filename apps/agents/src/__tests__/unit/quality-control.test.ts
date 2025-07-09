import { QualityControlAgent } from '../../agents/quality-control.agent';
import { ContentSafetyService } from '../../services/content-safety.service';
import { PlagiarismDetector } from '../../services/plagiarism-detector.service';
import { MockMessageBus } from '../mocks/message-bus.mock';
import { mockWorkshopData } from '../fixtures/workshop-data.fixture';

// Mock services
jest.mock('../../services/content-safety.service');
jest.mock('../../services/plagiarism-detector.service');
jest.mock('../../services/workshop-data.service', () => ({
  WorkshopDataService: jest.fn().mockImplementation(() => ({
    getWorkshopData: jest.fn().mockResolvedValue(mockWorkshopData)
  }))
}));

describe('QualityControlAgent Unit Tests', () => {
  let agent: QualityControlAgent;
  let messageBus: MockMessageBus;
  let mockSafetyService: jest.Mocked<ContentSafetyService>;
  let mockPlagiarismDetector: jest.Mocked<PlagiarismDetector>;

  beforeEach(async () => {
    messageBus = new MockMessageBus();
    await messageBus.connect();

    // Setup mocks
    mockSafetyService = {
      checkContent: jest.fn().mockResolvedValue({
        safe: true,
        issues: [],
        riskScore: 0.1
      })
    } as any;

    mockPlagiarismDetector = {
      checkPlagiarism: jest.fn().mockResolvedValue({
        isPlagiarized: false,
        similarity: 0.05,
        sources: []
      })
    } as any;

    (ContentSafetyService as jest.Mock).mockImplementation(() => mockSafetyService);
    (PlagiarismDetector as jest.Mock).mockImplementation(() => mockPlagiarismDetector);

    agent = new QualityControlAgent(messageBus as any);
    await agent.start();
  });

  afterEach(async () => {
    await agent.stop();
    await messageBus.disconnect();
  });

  describe('Quality Assessment', () => {
    it('should perform comprehensive quality check', async () => {
      const content = {
        text: 'This is a high-quality post about innovation in technology. It provides valuable insights and actionable advice for leaders.',
        metadata: {
          userId: mockWorkshopData.userId,
          pillar: 'Digital Innovation',
          sourceType: 'manual'
        }
      };

      const result = await (agent as any).performQualityCheck(content);

      expect(result).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.scores).toMatchObject({
        grammar: expect.any(Number),
        readability: expect.any(Number),
        engagement: expect.any(Number),
        brandAlignment: expect.any(Number),
        safety: expect.any(Number),
        originality: expect.any(Number)
      });
      expect(result.overallScore).toBeGreaterThan(0.7);
    });

    it('should fail content with safety issues', async () => {
      mockSafetyService.checkContent.mockResolvedValueOnce({
        safe: false,
        issues: ['Inappropriate language detected', 'Potential misinformation'],
        riskScore: 0.8
      });

      const content = {
        text: 'Controversial content with potential issues',
        metadata: { userId: mockWorkshopData.userId }
      };

      const result = await (agent as any).performQualityCheck(content);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Content failed safety check');
      expect(result.scores.safety).toBeLessThan(0.5);
    });

    it('should detect plagiarism', async () => {
      mockPlagiarismDetector.checkPlagiarism.mockResolvedValueOnce({
        isPlagiarized: true,
        similarity: 0.85,
        sources: ['https://example.com/original-article']
      });

      const content = {
        text: 'Copied content from another source',
        metadata: { userId: mockWorkshopData.userId }
      };

      const result = await (agent as any).performQualityCheck(content);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Content appears to be plagiarized');
      expect(result.scores.originality).toBeLessThan(0.3);
    });
  });

  describe('Grammar and Readability', () => {
    it('should score grammar correctly', async () => {
      const wellWritten = {
        text: 'This is a well-written post with proper grammar, punctuation, and structure. It conveys ideas clearly and concisely.',
        metadata: { userId: mockWorkshopData.userId }
      };

      const poorlyWritten = {
        text: 'this is bad grammer and. punctuation is all wrong no capitals',
        metadata: { userId: mockWorkshopData.userId }
      };

      const goodResult = await (agent as any).assessGrammar(wellWritten.text);
      const poorResult = await (agent as any).assessGrammar(poorlyWritten.text);

      expect(goodResult.score).toBeGreaterThan(0.8);
      expect(poorResult.score).toBeLessThan(0.5);
      expect(poorResult.issues).toContain('Missing capitalization');
    });

    it('should assess readability', async () => {
      const readable = {
        text: 'Leadership is about empowering others. Great leaders inspire their teams. They create environments where people thrive.',
        metadata: { userId: mockWorkshopData.userId }
      };

      const complex = {
        text: 'The paradigmatic shifts in contemporary organizational dynamics necessitate a comprehensive reevaluation of traditional leadership methodologies.',
        metadata: { userId: mockWorkshopData.userId }
      };

      const readableScore = await (agent as any).assessReadability(readable.text);
      const complexScore = await (agent as any).assessReadability(complex.text);

      expect(readableScore.score).toBeGreaterThan(0.7);
      expect(complexScore.score).toBeLessThan(0.6);
      expect(complexScore.suggestions).toContain('Consider simplifying complex sentences');
    });
  });

  describe('Brand Alignment', () => {
    it('should check alignment with user brand', async () => {
      const aligned = {
        text: 'Innovation in technology requires authentic leadership and continuous transformation. Let me share how I empower teams to excel.',
        metadata: { 
          userId: mockWorkshopData.userId,
          pillar: 'Digital Innovation'
        }
      };

      const misaligned = {
        text: 'Here are 10 quick tips for social media marketing. Follow these hacks to go viral!',
        metadata: { 
          userId: mockWorkshopData.userId,
          pillar: 'Digital Innovation'
        }
      };

      const alignedResult = await (agent as any).assessBrandAlignment(aligned, mockWorkshopData);
      const misalignedResult = await (agent as any).assessBrandAlignment(misaligned, mockWorkshopData);

      expect(alignedResult.score).toBeGreaterThan(0.8);
      expect(misalignedResult.score).toBeLessThan(0.5);
      expect(misalignedResult.issues).toContain('Content doesn\'t align with brand values');
    });

    it('should verify content pillar alignment', async () => {
      const content = {
        text: 'The future of AI in healthcare is transforming patient care through innovative solutions.',
        metadata: { 
          userId: mockWorkshopData.userId,
          pillar: 'Digital Innovation'
        }
      };

      const alignment = await (agent as any).checkPillarAlignment(content, mockWorkshopData);

      expect(alignment.aligned).toBe(true);
      expect(alignment.score).toBeGreaterThan(0.7);
      expect(alignment.suggestedPillar).toBe('Digital Innovation');
    });
  });

  describe('Engagement Prediction', () => {
    it('should predict content engagement', async () => {
      const engaging = {
        text: 'Just had an incredible breakthrough with our AI project! 🚀 Here\'s what we learned: [compelling story]. What challenges are you facing in your AI journey?',
        metadata: { userId: mockWorkshopData.userId }
      };

      const boring = {
        text: 'Today I attended a meeting. It was about project updates. The meeting lasted two hours.',
        metadata: { userId: mockWorkshopData.userId }
      };

      const engagingScore = await (agent as any).predictEngagement(engaging.text);
      const boringScore = await (agent as any).predictEngagement(boring.text);

      expect(engagingScore.score).toBeGreaterThan(0.7);
      expect(engagingScore.factors).toContain('Contains question for audience');
      expect(boringScore.score).toBeLessThan(0.4);
      expect(boringScore.improvements).toContain('Add more emotional appeal');
    });
  });

  describe('Message Handling', () => {
    it('should process quality check requests', async () => {
      const request = {
        type: 'quality:check:requested',
        agentId: 'content-generator',
        timestamp: new Date(),
        data: {
          content: {
            text: 'Quality content for testing',
            metadata: {
              userId: mockWorkshopData.userId,
              pillar: 'Leadership Excellence'
            }
          }
        }
      };

      await messageBus.publish('quality:check', request);
      
      await new Promise(resolve => setTimeout(resolve, 500));

      const completedMessages = messageBus.getMessages('quality:check:completed');
      expect(completedMessages).toHaveLength(1);
      expect(completedMessages[0].data.passed).toBeDefined();
      expect(completedMessages[0].data.scores).toBeDefined();
    });

    it('should handle batch quality checks', async () => {
      const batchRequest = {
        type: 'quality:check:batch',
        agentId: 'orchestrator',
        timestamp: new Date(),
        data: {
          contents: [
            { text: 'Content 1', metadata: { userId: mockWorkshopData.userId } },
            { text: 'Content 2', metadata: { userId: mockWorkshopData.userId } },
            { text: 'Content 3', metadata: { userId: mockWorkshopData.userId } }
          ]
        }
      };

      await messageBus.publish('quality:check:batch', batchRequest);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      const batchResults = messageBus.getMessages('quality:check:batch:completed');
      expect(batchResults).toHaveLength(1);
      expect(batchResults[0].data.results).toHaveLength(3);
    });
  });

  describe('Improvement Suggestions', () => {
    it('should provide actionable improvements', async () => {
      const content = {
        text: 'ai is changing everything we need to adapt quick or be left behind!!!',
        metadata: { userId: mockWorkshopData.userId }
      };

      const result = await (agent as any).performQualityCheck(content);

      expect(result.improvements).toBeDefined();
      expect(result.improvements.length).toBeGreaterThan(0);
      expect(result.improvements).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/capitalization/i),
          expect.stringMatching(/punctuation/i)
        ])
      );
    });
  });
});