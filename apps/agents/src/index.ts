import 'dotenv/config';
import { NewsMonitorAgent } from './agents/news-monitor.agent';
import { OrchestratorAgent } from './agents/orchestrator.agent';
import { ContentGeneratorAgent } from './agents/content-generator.agent';
import { QualityControlAgent } from './agents/quality-control.agent';
import { PublisherAgent } from './agents/publisher.agent';
import { LearningAgent } from './agents/learning.agent';
import { HealthServer } from './health-server';
import pino from 'pino';

const logger = pino({
  name: 'agents-main',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function main() {
  logger.info('Starting BrandPillar AI Agents');
  
  const agents = [];
  let healthServer: HealthServer | null = null;
  
  try {
    // Start health server
    healthServer = new HealthServer(parseInt(process.env.PORT || '3000'));
    await healthServer.start();
    
    // Start Orchestrator Agent first (it coordinates all other agents)
    const orchestrator = new OrchestratorAgent();
    await orchestrator.start();
    agents.push(orchestrator);
    
    // Register orchestrator health check
    healthServer.registerAgentHealthCheck(
      orchestrator.type,
      () => orchestrator.getHealthStatus()
    );
    
    // Give orchestrator time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start News Monitor Agent
    const newsMonitor = new NewsMonitorAgent();
    await newsMonitor.start();
    agents.push(newsMonitor);
    
    // Register news monitor health check
    healthServer.registerAgentHealthCheck(
      newsMonitor.type,
      () => newsMonitor.getHealthStatus()
    );
    
    // Start Content Generator Agent
    const contentGenerator = new ContentGeneratorAgent();
    await contentGenerator.start();
    agents.push(contentGenerator);
    
    // Register content generator health check
    healthServer.registerAgentHealthCheck(
      contentGenerator.type,
      () => contentGenerator.getHealthStatus()
    );
    
    // Start Quality Control Agent
    const qualityControl = new QualityControlAgent(logger.child({ name: 'quality-control' }));
    await qualityControl.start();
    agents.push(qualityControl);
    
    // Register quality control health check
    healthServer.registerAgentHealthCheck(
      qualityControl.type,
      () => qualityControl.getHealthStatus()
    );
    
    // Start Publisher Agent
    const publisher = new PublisherAgent(logger.child({ name: 'publisher' }));
    await publisher.start();
    agents.push(publisher);
    
    // Register publisher health check
    healthServer.registerAgentHealthCheck(
      publisher.type,
      () => publisher.getHealthStatus()
    );
    
    // Start Learning Agent
    const learningAgent = new LearningAgent();
    await learningAgent.start();
    agents.push(learningAgent);
    
    // Register learning agent health check
    healthServer.registerAgentHealthCheck(
      learningAgent.type,
      () => learningAgent.getHealthStatus()
    );
    
    logger.info(`Started ${agents.length} agents`);
    
    // Handle shutdown gracefully
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      for (const agent of agents) {
        await agent.stop();
      }
      
      if (healthServer) {
        await healthServer.stop();
      }
      
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      
      for (const agent of agents) {
        await agent.stop();
      }
      
      if (healthServer) {
        await healthServer.stop();
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start agents');
    process.exit(1);
  }
}

main().catch(error => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});