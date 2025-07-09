import express from 'express';
import pino from 'pino';
import { AgentType } from '@brandpillar/shared';

const logger = pino({ name: 'health-server' });

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  agents: Record<string, any>;
  errors: string[];
}

export class HealthServer {
  private app: express.Application;
  private port: number;
  private server: any;
  private agentHealthChecks: Map<AgentType, () => Promise<any>> = new Map();
  
  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // Basic health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.performHealthCheck();
        
        if (health.status === 'healthy') {
          res.status(200).json(health);
        } else {
          res.status(503).json(health);
        }
      } catch (error) {
        logger.error({ error }, 'Health check failed');
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: (error as Error).message
        });
      }
    });
    
    // Liveness probe (simple check that service is running)
    this.app.get('/health/live', (req, res) => {
      res.status(200).json({ status: 'alive' });
    });
    
    // Readiness probe (check if agents are ready to accept work)
    this.app.get('/health/ready', async (req, res) => {
      const health = await this.performHealthCheck();
      
      if (health.status === 'healthy' && Object.keys(health.agents).length > 0) {
        res.status(200).json({ status: 'ready' });
      } else {
        res.status(503).json({ status: 'not_ready' });
      }
    });
    
    // Detailed metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.collectMetrics();
        res.status(200).json(metrics);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }
  
  public registerAgentHealthCheck(
    agentType: AgentType, 
    healthCheck: () => Promise<any>
  ): void {
    this.agentHealthChecks.set(agentType, healthCheck);
  }
  
  private async performHealthCheck(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date(),
      agents: {},
      errors: []
    };
    
    // Check each registered agent
    for (const [agentType, healthCheck] of this.agentHealthChecks) {
      try {
        const agentHealth = await healthCheck();
        result.agents[agentType] = agentHealth;
        
        if (!agentHealth.isHealthy) {
          result.status = 'unhealthy';
          result.errors.push(`Agent ${agentType} is unhealthy`);
        }
      } catch (error) {
        result.status = 'unhealthy';
        result.errors.push(`Failed to check ${agentType}: ${(error as Error).message}`);
      }
    }
    
    // Check if we have at least one agent running
    if (Object.keys(result.agents).length === 0) {
      result.status = 'unhealthy';
      result.errors.push('No agents are running');
    }
    
    return result;
  }
  
  private async collectMetrics(): Promise<any> {
    const metrics = {
      timestamp: new Date(),
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      agents: {}
    };
    
    // Collect metrics from each agent
    for (const [agentType, healthCheck] of this.agentHealthChecks) {
      try {
        const agentHealth = await healthCheck();
        metrics.agents[agentType] = {
          uptime: agentHealth.uptime,
          tasksCompleted: agentHealth.completedTaskCount,
          tasksFailed: agentHealth.failedTaskCount,
          activeTasks: agentHealth.activeTaskCount,
          averageTaskDuration: agentHealth.averageTaskDuration
        };
      } catch (error) {
        logger.error({ error, agentType }, 'Failed to collect metrics');
      }
    }
    
    return metrics;
  }
  
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.info({ port: this.port }, 'Health server started');
        resolve();
      }).on('error', reject);
    });
  }
  
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}