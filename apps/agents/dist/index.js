"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const news_monitor_agent_1 = require("./agents/news-monitor.agent");
const orchestrator_agent_1 = require("./agents/orchestrator.agent");
const content_generator_agent_1 = require("./agents/content-generator.agent");
const quality_control_agent_1 = require("./agents/quality-control.agent");
const publisher_agent_1 = require("./agents/publisher.agent");
const learning_agent_1 = require("./agents/learning.agent");
const health_server_1 = require("./health-server");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
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
    let healthServer = null;
    try {
        // Start health server
        healthServer = new health_server_1.HealthServer(parseInt(process.env.PORT || '3000'));
        await healthServer.start();
        // Start Orchestrator Agent first (it coordinates all other agents)
        const orchestrator = new orchestrator_agent_1.OrchestratorAgent();
        await orchestrator.start();
        agents.push(orchestrator);
        // Register orchestrator health check
        healthServer.registerAgentHealthCheck(orchestrator.type, () => orchestrator.getHealthStatus());
        // Give orchestrator time to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Start News Monitor Agent
        const newsMonitor = new news_monitor_agent_1.NewsMonitorAgent();
        await newsMonitor.start();
        agents.push(newsMonitor);
        // Register news monitor health check
        healthServer.registerAgentHealthCheck(newsMonitor.type, () => newsMonitor.getHealthStatus());
        // Start Content Generator Agent
        const contentGenerator = new content_generator_agent_1.ContentGeneratorAgent();
        await contentGenerator.start();
        agents.push(contentGenerator);
        // Register content generator health check
        healthServer.registerAgentHealthCheck(contentGenerator.type, () => contentGenerator.getHealthStatus());
        // Start Quality Control Agent
        const qualityControl = new quality_control_agent_1.QualityControlAgent(logger.child({ name: 'quality-control' }));
        await qualityControl.start();
        agents.push(qualityControl);
        // Register quality control health check
        healthServer.registerAgentHealthCheck(qualityControl.type, () => qualityControl.getHealthStatus());
        // Start Publisher Agent
        const publisher = new publisher_agent_1.PublisherAgent(logger.child({ name: 'publisher' }));
        await publisher.start();
        agents.push(publisher);
        // Register publisher health check
        healthServer.registerAgentHealthCheck(publisher.type, () => publisher.getHealthStatus());
        // Start Learning Agent
        const learningAgent = new learning_agent_1.LearningAgent();
        await learningAgent.start();
        agents.push(learningAgent);
        // Register learning agent health check
        healthServer.registerAgentHealthCheck(learningAgent.type, () => learningAgent.getHealthStatus());
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
    }
    catch (error) {
        logger.error({ error }, 'Failed to start agents');
        process.exit(1);
    }
}
main().catch(error => {
    logger.error({ error }, 'Unhandled error in main');
    process.exit(1);
});
//# sourceMappingURL=index.js.map