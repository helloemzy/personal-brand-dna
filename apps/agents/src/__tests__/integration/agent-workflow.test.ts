import { NewsMonitorAgent } from '../../agents/news-monitor.agent';
import { ContentGeneratorAgent } from '../../agents/content-generator.agent';
import { QualityControlAgent } from '../../agents/quality-control.agent';
import { PublisherAgent } from '../../agents/publisher.agent';
import { OrchestratorAgent } from '../../agents/orchestrator.agent';
import { MockMessageBus } from '../mocks/message-bus.mock';
import { mockWorkshopData, mockNewsItem } from '../fixtures/workshop-data.fixture';
import { AgentMessage } from '@brandpillar/shared';

// Mock external services
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => require('../mocks/openai.mock').createMockOpenAI())
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockWorkshopData, error: null })
        })
      }),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      update: jest.fn().mockResolvedValue({ data: {}, error: null })
    })
  })
}));

jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK')
  }));
  return Redis;
});

describe('AI Agents Integration Tests', () => {
  let messageBus: MockMessageBus;
  let orchestrator: OrchestratorAgent;
  let newsMonitor: NewsMonitorAgent;
  let contentGenerator: ContentGeneratorAgent;
  let qualityControl: QualityControlAgent;
  let publisher: PublisherAgent;

  beforeEach(async () => {
    // Create mock message bus
    messageBus = new MockMessageBus();
    await messageBus.connect();

    // Initialize agents with mock message bus
    orchestrator = new OrchestratorAgent(messageBus as any);
    newsMonitor = new NewsMonitorAgent(messageBus as any);
    contentGenerator = new ContentGeneratorAgent(messageBus as any);
    qualityControl = new QualityControlAgent(messageBus as any);
    publisher = new PublisherAgent(messageBus as any);

    // Start all agents
    await Promise.all([
      orchestrator.start(),
      newsMonitor.start(),
      contentGenerator.start(),
      qualityControl.start(),
      publisher.start()
    ]);
  });

  afterEach(async () => {
    // Stop all agents
    await Promise.all([
      orchestrator.stop(),
      newsMonitor.stop(),
      contentGenerator.stop(),
      qualityControl.stop(),
      publisher.stop()
    ]);

    await messageBus.disconnect();
  });

  describe('Complete Content Creation Workflow', () => {
    it('should process news item through entire pipeline', async () => {
      const workflowId = 'test-workflow-123';
      
      // Track messages
      const publishedMessages: any[] = [];
      messageBus.on('message:published', (data) => {
        publishedMessages.push(data);
      });

      // Simulate news discovery
      const newsMessage: AgentMessage = {
        type: 'news:discovered',
        agentId: 'news-monitor',
        timestamp: new Date(),
        data: {
          news: mockNewsItem,
          userId: mockWorkshopData.userId,
          relevanceScore: 0.92
        },
        correlationId: workflowId
      };

      // Publish news discovery
      await messageBus.publish('news:discovered', newsMessage);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify workflow progression
      const messageTypes = publishedMessages.map(m => m.message.type);
      
      expect(messageTypes).toContain('workflow:started');
      expect(messageTypes).toContain('content:requested');
      expect(messageTypes).toContain('content:generated');
      expect(messageTypes).toContain('quality:check:requested');
      expect(messageTypes).toContain('quality:check:completed');
      expect(messageTypes).toContain('content:publish:requested');
    });

    it('should handle content generation with voice matching', async () => {
      const contentRequest: AgentMessage = {
        type: 'content:requested',
        agentId: 'orchestrator',
        timestamp: new Date(),
        data: {
          userId: mockWorkshopData.userId,
          sourceType: 'news',
          sourceContent: mockNewsItem,
          angle: 'thought-leader',
          pillar: 'Digital Innovation'
        }
      };

      await messageBus.publish('content:generate', contentRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const generatedMessages = messageBus.getMessages('content:generated');
      expect(generatedMessages).toHaveLength(1);
      
      const content = generatedMessages[0].data.content;
      expect(content).toBeDefined();
      expect(content.text).toBeTruthy();
      expect(content.voiceMatch).toBeGreaterThan(0.8);
    });

    it('should perform quality control checks', async () => {
      const contentMessage: AgentMessage = {
        type: 'quality:check:requested',
        agentId: 'content-generator',
        timestamp: new Date(),
        data: {
          content: {
            text: 'Test content for quality check with potential issues.',
            metadata: {
              userId: mockWorkshopData.userId,
              pillar: 'Digital Innovation'
            }
          }
        }
      };

      await messageBus.publish('quality:check', contentMessage);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      const qualityMessages = messageBus.getMessages('quality:check:completed');
      expect(qualityMessages).toHaveLength(1);
      
      const result = qualityMessages[0].data;
      expect(result.passed).toBeDefined();
      expect(result.scores).toBeDefined();
      expect(result.scores.grammar).toBeGreaterThan(0);
      expect(result.scores.brandAlignment).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle agent failures gracefully', async () => {
      // Force an error in content generation
      const invalidRequest: AgentMessage = {
        type: 'content:requested',
        agentId: 'orchestrator',
        timestamp: new Date(),
        data: {
          // Missing required fields
          userId: null
        }
      };

      const errorMessages: any[] = [];
      messageBus.on('message:error', (data) => {
        errorMessages.push(data);
      });

      await messageBus.publish('content:generate', invalidRequest);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0].error).toBeDefined();
    });

    it('should retry failed operations', async () => {
      let attemptCount = 0;
      
      // Mock a service that fails first time
      const originalCreate = require('../mocks/openai.mock').mockOpenAI.chat.completions.create;
      require('../mocks/openai.mock').mockOpenAI.chat.completions.create = jest.fn()
        .mockImplementationOnce(() => {
          attemptCount++;
          throw new Error('Temporary failure');
        })
        .mockImplementationOnce(() => {
          attemptCount++;
          return originalCreate();
        });

      const contentRequest: AgentMessage = {
        type: 'content:requested',
        agentId: 'orchestrator',
        timestamp: new Date(),
        data: {
          userId: mockWorkshopData.userId,
          sourceType: 'manual',
          prompt: 'Test retry mechanism'
        }
      };

      await messageBus.publish('content:generate', contentRequest);
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(attemptCount).toBe(2);
      const generatedMessages = messageBus.getMessages('content:generated');
      expect(generatedMessages).toHaveLength(1);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation metrics', async () => {
      const metricsMessages: any[] = [];
      
      await messageBus.subscribe('metrics:reported', async (msg) => {
        metricsMessages.push(msg);
      });

      // Generate multiple pieces of content
      const requests = Array(5).fill(null).map((_, i) => ({
        type: 'content:requested' as const,
        agentId: 'test',
        timestamp: new Date(),
        data: {
          userId: mockWorkshopData.userId,
          sourceType: 'manual' as const,
          prompt: `Test content ${i + 1}`
        }
      }));

      for (const request of requests) {
        await messageBus.publish('content:generate', request);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if metrics were reported
      const contentMetrics = metricsMessages.filter(m => 
        m.data.operation === 'content:generation'
      );
      
      expect(contentMetrics.length).toBeGreaterThan(0);
      expect(contentMetrics[0].data.duration).toBeDefined();
      expect(contentMetrics[0].data.success).toBe(true);
    });
  });
});