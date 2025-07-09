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
    quit: jest.fn().mockResolvedValue('OK'),
    zadd: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([])
  }));
  return Redis;
});

describe('AI Agents Load Testing', () => {
  let messageBus: MockMessageBus;
  let agents: {
    orchestrator: OrchestratorAgent;
    newsMonitor: NewsMonitorAgent;
    contentGenerator: ContentGeneratorAgent;
    qualityControl: QualityControlAgent;
    publisher: PublisherAgent;
  };

  beforeAll(async () => {
    messageBus = new MockMessageBus();
    await messageBus.connect();

    agents = {
      orchestrator: new OrchestratorAgent(messageBus as any),
      newsMonitor: new NewsMonitorAgent(messageBus as any),
      contentGenerator: new ContentGeneratorAgent(messageBus as any),
      qualityControl: new QualityControlAgent(messageBus as any),
      publisher: new PublisherAgent(messageBus as any)
    };

    await Promise.all(Object.values(agents).map(agent => agent.start()));
  }, 10000);

  afterAll(async () => {
    await Promise.all(Object.values(agents).map(agent => agent.stop()));
    await messageBus.disconnect();
  }, 10000);

  describe('Concurrent Request Handling', () => {
    it('should handle 50 concurrent content generation requests', async () => {
      const startTime = Date.now();
      const concurrentRequests = 50;
      const results: any[] = [];
      const errors: any[] = [];

      // Track messages
      messageBus.on('content:generated', (msg) => results.push(msg));
      messageBus.on('message:error', (err) => errors.push(err));

      // Create concurrent requests
      const requests = Array(concurrentRequests).fill(null).map((_, i) => ({
        type: 'content:requested' as const,
        agentId: 'load-test',
        timestamp: new Date(),
        data: {
          userId: `user-${i % 10}`, // Simulate 10 different users
          sourceType: 'manual' as const,
          prompt: `Load test content ${i}`,
          pillar: ['Digital Innovation', 'Leadership Excellence', 'Personal Growth'][i % 3]
        },
        correlationId: `load-test-${i}`
      }));

      // Send all requests concurrently
      await Promise.all(
        requests.map(req => messageBus.publish('content:generate', req))
      );

      // Wait for processing with timeout
      const timeout = 30000; // 30 seconds
      const checkInterval = 100;
      let elapsed = 0;

      while (results.length < concurrentRequests && elapsed < timeout) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }

      const duration = Date.now() - startTime;

      // Assertions
      expect(results.length).toBe(concurrentRequests);
      expect(errors.length).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      // Calculate throughput
      const throughput = (concurrentRequests / duration) * 1000; // requests per second
      console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
      expect(throughput).toBeGreaterThan(1); // At least 1 request per second
    }, 35000);

    it('should handle mixed workload of different operations', async () => {
      const startTime = Date.now();
      const metrics = {
        newsProcessed: 0,
        contentGenerated: 0,
        qualityChecked: 0,
        published: 0,
        errors: 0
      };

      // Track different message types
      messageBus.on('workflow:completed', () => metrics.newsProcessed++);
      messageBus.on('content:generated', () => metrics.contentGenerated++);
      messageBus.on('quality:check:completed', () => metrics.qualityChecked++);
      messageBus.on('content:published', () => metrics.published++);
      messageBus.on('message:error', () => metrics.errors++);

      // Create mixed workload
      const workload = [
        // 20 news items to process
        ...Array(20).fill(null).map((_, i) => ({
          type: 'news:discovered' as const,
          channel: 'news:discovered',
          data: {
            news: { ...mockNewsItem, title: `News ${i}` },
            userId: `user-${i % 5}`,
            relevanceScore: 0.8 + (i % 3) * 0.05
          }
        })),
        // 30 direct content generation requests
        ...Array(30).fill(null).map((_, i) => ({
          type: 'content:requested' as const,
          channel: 'content:generate',
          data: {
            userId: `user-${i % 5}`,
            sourceType: 'manual',
            prompt: `Direct content ${i}`
          }
        })),
        // 20 quality check requests
        ...Array(20).fill(null).map((_, i) => ({
          type: 'quality:check:requested' as const,
          channel: 'quality:check',
          data: {
            content: {
              text: `Content to check ${i}`,
              metadata: { userId: `user-${i % 5}` }
            }
          }
        }))
      ];

      // Shuffle workload for realistic simulation
      const shuffled = workload.sort(() => Math.random() - 0.5);

      // Send all requests with slight delays to simulate real traffic
      for (const item of shuffled) {
        await messageBus.publish(item.channel, {
          ...item,
          agentId: 'load-test',
          timestamp: new Date()
        });
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms between requests
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      const duration = Date.now() - startTime;

      // Verify processing
      expect(metrics.errors).toBe(0);
      expect(metrics.contentGenerated).toBeGreaterThan(25); // Most should complete
      expect(metrics.qualityChecked).toBeGreaterThan(15);

      console.log('Load test metrics:', metrics);
      console.log(`Total duration: ${duration}ms`);
    }, 20000);
  });

  describe('Resource Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const memorySnapshots: number[] = [];

      // Generate continuous load for 10 seconds
      const loadDuration = 10000;
      const startTime = Date.now();
      let requestCount = 0;

      const loadInterval = setInterval(async () => {
        // Send 5 requests every 100ms (50 requests/second)
        for (let i = 0; i < 5; i++) {
          messageBus.publish('content:generate', {
            type: 'content:requested',
            agentId: 'memory-test',
            timestamp: new Date(),
            data: {
              userId: `user-${requestCount % 10}`,
              sourceType: 'manual',
              prompt: `Memory test ${requestCount++}`
            }
          });
        }

        // Take memory snapshot
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }, 100);

      // Run load test
      await new Promise(resolve => setTimeout(resolve, loadDuration));
      clearInterval(loadInterval);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Calculate memory growth rate
      const avgMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
      const memoryVariance = memorySnapshots.reduce((sum, mem) => 
        sum + Math.pow(mem - avgMemory, 2), 0
      ) / memorySnapshots.length;
      const memoryStdDev = Math.sqrt(memoryVariance) / 1024 / 1024;

      console.log(`Total requests: ${requestCount}`);
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);
      console.log(`Memory std dev: ${memoryStdDev.toFixed(2)} MB`);

      // Memory should not grow excessively
      expect(memoryIncreaseMB).toBeLessThan(100); // Less than 100MB increase
      expect(memoryStdDev).toBeLessThan(20); // Stable memory usage
    }, 20000);
  });

  describe('Error Recovery', () => {
    it('should recover from agent failures during high load', async () => {
      const results = { success: 0, failed: 0, recovered: 0 };

      // Track results
      messageBus.on('content:generated', () => results.success++);
      messageBus.on('message:error', () => results.failed++);
      messageBus.on('content:retry:success', () => results.recovered++);

      // Simulate intermittent failures
      let failureCount = 0;
      const originalCreate = require('../mocks/openai.mock').mockOpenAI.chat.completions.create;
      require('../mocks/openai.mock').mockOpenAI.chat.completions.create = jest.fn()
        .mockImplementation(() => {
          failureCount++;
          // Fail every 5th request
          if (failureCount % 5 === 0) {
            throw new Error('Simulated API failure');
          }
          return originalCreate();
        });

      // Send 100 requests
      const requests = Array(100).fill(null).map((_, i) => ({
        type: 'content:requested' as const,
        agentId: 'recovery-test',
        timestamp: new Date(),
        data: {
          userId: mockWorkshopData.userId,
          sourceType: 'manual' as const,
          prompt: `Recovery test ${i}`
        }
      }));

      // Send requests with small delays
      for (const req of requests) {
        await messageBus.publish('content:generate', req);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 15000));

      console.log('Recovery test results:', results);

      // Should recover from most failures
      expect(results.success).toBeGreaterThan(80); // At least 80% success
      expect(results.failed).toBeLessThan(20); // Less than 20% permanent failures
    }, 20000);
  });

  describe('Queue Management', () => {
    it('should handle queue overflow gracefully', async () => {
      const queueMetrics = {
        queued: 0,
        processed: 0,
        dropped: 0,
        backpressure: 0
      };

      // Monitor queue events
      messageBus.on('queue:item:added', () => queueMetrics.queued++);
      messageBus.on('queue:item:processed', () => queueMetrics.processed++);
      messageBus.on('queue:item:dropped', () => queueMetrics.dropped++);
      messageBus.on('queue:backpressure', () => queueMetrics.backpressure++);

      // Send burst of 200 requests instantly
      const requests = Array(200).fill(null).map((_, i) => ({
        type: 'content:requested' as const,
        agentId: 'queue-test',
        timestamp: new Date(),
        data: {
          userId: `user-${i % 10}`,
          sourceType: 'manual' as const,
          prompt: `Queue test ${i}`,
          priority: i < 50 ? 'high' : 'normal' // First 50 are high priority
        }
      }));

      // Send all at once to stress the queue
      await Promise.all(
        requests.map(req => messageBus.publish('content:generate', req))
      );

      // Wait for queue to process
      await new Promise(resolve => setTimeout(resolve, 20000));

      console.log('Queue metrics:', queueMetrics);

      // Queue should handle overflow without dropping messages
      expect(queueMetrics.dropped).toBe(0);
      expect(queueMetrics.processed).toBeGreaterThan(150); // Most should be processed
      
      // Backpressure should be applied when needed
      if (queueMetrics.queued > 100) {
        expect(queueMetrics.backpressure).toBeGreaterThan(0);
      }
    }, 25000);
  });
});