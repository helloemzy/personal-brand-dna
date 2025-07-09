import { BaseAgent } from '../framework/base-agent';
import { Task, AgentType, AgentMessage, MessageType, Priority, TaskStatus } from '@brandpillar/shared';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

interface AgentRegistry {
  agentId: string;
  type: AgentType;
  status: 'online' | 'offline';
  lastSeen: Date;
  health?: any;
  capabilities: string[];
}

interface TaskQueue {
  pending: Task[];
  processing: Map<string, Task>;
  completed: Task[];
  failed: Task[];
}

export class OrchestratorAgent extends BaseAgent {
  private redis: Redis;
  private agentRegistry: Map<string, AgentRegistry> = new Map();
  private taskQueues: Map<AgentType, TaskQueue> = new Map();
  private orchestrationTimer?: NodeJS.Timeout;
  
  constructor() {
    super({
      type: AgentType.ORCHESTRATOR,
      name: 'Orchestrator Agent',
      messageBusUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      maxConcurrentTasks: 100,
      healthCheckInterval: 30000
    });
    
    this.redis = new Redis(this.config.redisUrl);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Orchestrator Agent');
    
    // Initialize task queues for each agent type
    Object.values(AgentType).forEach(type => {
      if (type !== AgentType.ORCHESTRATOR) {
        this.taskQueues.set(type, {
          pending: [],
          processing: new Map(),
          completed: [],
          failed: []
        });
      }
    });
    
    // Load agent registry from Redis
    await this.loadAgentRegistry();
    
    // Start orchestration loop
    this.startOrchestration();
    
    // Subscribe to all agent messages
    await this.subscribeToAllAgents();
  }

  async processTask(task: Task): Promise<any> {
    this.logger.info({ taskType: task.taskType }, 'Processing orchestrator task');
    
    switch (task.taskType) {
      case 'ORCHESTRATE_WORKFLOW':
        return this.orchestrateWorkflow(task.payload);
        
      case 'GET_AGENT_STATUS':
        return this.getAgentStatus();
        
      case 'GET_SYSTEM_HEALTH':
        return this.getSystemHealth();
        
      case 'REBALANCE_TASKS':
        return this.rebalanceTasks();
        
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }
  }

  async validateTask(task: Task): Promise<boolean> {
    return true; // Orchestrator accepts all tasks
  }

  private async subscribeToAllAgents(): Promise<void> {
    // Subscribe to status updates from all agents
    await this.messageBus.subscribe(
      this.type,
      async (message: AgentMessage) => {
        await this.handleAgentMessage(message);
      }
    );
  }

  private async handleAgentMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case MessageType.STATUS_UPDATE:
        await this.handleAgentStatusUpdate(message);
        break;
        
      case MessageType.TASK_RESULT:
        await this.handleTaskResult(message);
        break;
        
      case MessageType.ERROR_REPORT:
        await this.handleErrorReport(message);
        break;
        
      case MessageType.LEARNING_UPDATE:
        await this.handleLearningUpdate(message);
        break;
    }
  }

  private async handleAgentStatusUpdate(message: AgentMessage): Promise<void> {
    const { agentId, status, health } = message.payload;
    
    if (status === 'online') {
      // Register new agent
      this.agentRegistry.set(agentId, {
        agentId,
        type: message.source,
        status: 'online',
        lastSeen: new Date(),
        health,
        capabilities: this.getAgentCapabilities(message.source)
      });
      
      this.logger.info({ agentId, type: message.source }, 'Agent came online');
      
    } else if (status === 'offline') {
      // Mark agent as offline
      const agent = this.agentRegistry.get(agentId);
      if (agent) {
        agent.status = 'offline';
        
        // Reassign any active tasks
        await this.reassignAgentTasks(agentId);
      }
      
      this.logger.info({ agentId }, 'Agent went offline');
    }
    
    // Update health metrics if provided
    if (health) {
      const agent = this.agentRegistry.get(agentId);
      if (agent) {
        agent.health = health;
        agent.lastSeen = new Date();
      }
    }
    
    // Persist to Redis
    await this.saveAgentRegistry();
  }

  private async handleTaskResult(message: AgentMessage): Promise<void> {
    const { taskId, userId, status, result, error, duration } = message.payload;
    
    // Find task in processing queue
    let foundTask: Task | undefined;
    let foundQueue: TaskQueue | undefined;
    
    for (const [agentType, queue] of this.taskQueues) {
      const task = queue.processing.get(taskId);
      if (task) {
        foundTask = task;
        foundQueue = queue;
        break;
      }
    }
    
    if (!foundTask || !foundQueue) {
      this.logger.warn({ taskId }, 'Task result for unknown task');
      return;
    }
    
    // Update task status
    foundTask.status = status;
    foundTask.result = result;
    foundTask.error = error;
    foundTask.completedAt = new Date();
    
    // Move to appropriate queue
    foundQueue.processing.delete(taskId);
    
    if (status === TaskStatus.COMPLETED) {
      foundQueue.completed.push(foundTask);
      
      // Trigger next steps in workflow if applicable
      await this.checkWorkflowContinuation(foundTask);
      
    } else if (status === TaskStatus.FAILED) {
      foundQueue.failed.push(foundTask);
      
      // Check if retry is needed
      if (foundTask.retryCount < 3) {
        foundTask.retryCount++;
        foundQueue.pending.push(foundTask);
        this.logger.info({ taskId, retryCount: foundTask.retryCount }, 'Retrying failed task');
      }
    }
    
    // Update metrics
    await this.updateTaskMetrics(foundTask, duration);
  }

  private async handleErrorReport(message: AgentMessage): Promise<void> {
    const { originalMessageId, error } = message.payload;
    
    this.logger.error(
      { 
        agentId: message.source, 
        originalMessageId, 
        error 
      }, 
      'Agent reported error'
    );
    
    // Store error for analysis
    await this.redis.lpush(
      'agent:errors',
      JSON.stringify({
        timestamp: new Date(),
        agentId: message.source,
        error
      })
    );
  }

  private async handleLearningUpdate(message: AgentMessage): Promise<void> {
    const { insight, metrics } = message.payload;
    
    this.logger.info({ agentId: message.source, insight }, 'Learning update received');
    
    // Store learning insights
    await this.redis.hset(
      'learning:insights',
      `${message.source}:${Date.now()}`,
      JSON.stringify({ insight, metrics })
    );
    
    // Apply learning updates to orchestration strategy
    await this.applyLearningInsights(message.source, insight);
  }

  private startOrchestration(): void {
    this.orchestrationTimer = setInterval(async () => {
      try {
        // Process pending tasks
        await this.processPendingTasks();
        
        // Check agent health
        await this.checkAgentHealth();
        
        // Balance workload
        await this.balanceWorkload();
        
        // Clean up old tasks
        await this.cleanupOldTasks();
        
      } catch (error) {
        this.logger.error({ error }, 'Orchestration cycle error');
      }
    }, 5000); // Run every 5 seconds
  }

  private async processPendingTasks(): Promise<void> {
    for (const [agentType, queue] of this.taskQueues) {
      const availableAgents = this.getAvailableAgents(agentType);
      
      if (availableAgents.length === 0) {
        continue;
      }
      
      while (queue.pending.length > 0 && availableAgents.length > 0) {
        const task = queue.pending.shift()!;
        const agent = this.selectBestAgent(availableAgents, task);
        
        if (!agent) {
          // Put task back if no suitable agent
          queue.pending.unshift(task);
          break;
        }
        
        // Assign task to agent
        await this.assignTask(task, agent);
        queue.processing.set(task.id, task);
      }
    }
  }

  private async assignTask(task: Task, agent: AgentRegistry): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.type,
      target: agent.type,
      type: MessageType.TASK_REQUEST,
      priority: task.priority,
      payload: {
        userId: task.userId,
        taskType: task.taskType,
        data: task.payload
      },
      requiresAck: true,
      timeout: 30000
    };
    
    await this.sendMessage(message);
    
    this.logger.info(
      { taskId: task.id, agentId: agent.agentId, agentType: agent.type },
      'Task assigned to agent'
    );
  }

  private getAvailableAgents(type: AgentType): AgentRegistry[] {
    return Array.from(this.agentRegistry.values()).filter(
      agent => agent.type === type && 
               agent.status === 'online' &&
               this.isAgentHealthy(agent)
    );
  }

  private selectBestAgent(agents: AgentRegistry[], task: Task): AgentRegistry | null {
    if (agents.length === 0) return null;
    
    // Sort agents by health and workload
    const sorted = agents.sort((a, b) => {
      const scoreA = this.calculateAgentScore(a);
      const scoreB = this.calculateAgentScore(b);
      return scoreB - scoreA;
    });
    
    return sorted[0];
  }

  private calculateAgentScore(agent: AgentRegistry): number {
    if (!agent.health) return 0;
    
    const health = agent.health;
    let score = 100;
    
    // Penalize high CPU usage
    score -= health.cpuUsage * 0.3;
    
    // Penalize high memory usage
    score -= health.memoryUsage * 100 * 0.2;
    
    // Penalize many active tasks
    score -= health.activeTaskCount * 5;
    
    // Bonus for low failure rate
    const failureRate = health.failedTaskCount / (health.completedTaskCount || 1);
    score += (1 - failureRate) * 20;
    
    return Math.max(0, Math.min(100, score));
  }

  private isAgentHealthy(agent: AgentRegistry): boolean {
    if (!agent.health) return false;
    
    const health = agent.health;
    const timeSinceLastSeen = Date.now() - agent.lastSeen.getTime();
    
    return health.isHealthy && 
           timeSinceLastSeen < 60000 && // Seen in last minute
           health.memoryUsage < 0.9 &&
           health.cpuUsage < 90;
  }

  private async checkAgentHealth(): Promise<void> {
    const now = new Date();
    
    for (const [agentId, agent] of this.agentRegistry) {
      const timeSinceLastSeen = now.getTime() - agent.lastSeen.getTime();
      
      // Mark as offline if not seen for 2 minutes
      if (timeSinceLastSeen > 120000 && agent.status === 'online') {
        agent.status = 'offline';
        this.logger.warn({ agentId, lastSeen: agent.lastSeen }, 'Agent marked offline due to timeout');
        
        // Reassign tasks
        await this.reassignAgentTasks(agentId);
      }
    }
  }

  private async reassignAgentTasks(agentId: string): Promise<void> {
    // Find all tasks assigned to this agent
    for (const [agentType, queue] of this.taskQueues) {
      const tasksToReassign: Task[] = [];
      
      for (const [taskId, task] of queue.processing) {
        // Check if task was assigned to offline agent
        // This would require tracking assignment in task metadata
        tasksToReassign.push(task);
        queue.processing.delete(taskId);
      }
      
      // Put tasks back in pending queue
      queue.pending.unshift(...tasksToReassign);
    }
  }

  private async balanceWorkload(): Promise<void> {
    // Implement workload balancing logic
    // Move tasks from overloaded agents to underutilized ones
  }

  private async cleanupOldTasks(): Promise<void> {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    
    for (const queue of this.taskQueues.values()) {
      // Clean completed tasks
      queue.completed = queue.completed.filter(
        task => task.completedAt!.getTime() > cutoffTime
      );
      
      // Clean failed tasks
      queue.failed = queue.failed.filter(
        task => task.completedAt!.getTime() > cutoffTime
      );
    }
  }

  private async orchestrateWorkflow(workflow: any): Promise<void> {
    // Implement workflow orchestration
    // Break down workflow into tasks and assign to appropriate agents
  }

  private async checkWorkflowContinuation(completedTask: Task): Promise<void> {
    // Check if this task completion triggers next steps in a workflow
    // Implement workflow continuation logic
  }

  private async updateTaskMetrics(task: Task, duration: number): Promise<void> {
    const key = `metrics:${task.agentType}:${task.taskType}`;
    
    await this.redis.hincrby(key, 'count', 1);
    await this.redis.hincrby(key, 'totalDuration', duration);
    
    if (task.status === TaskStatus.COMPLETED) {
      await this.redis.hincrby(key, 'successCount', 1);
    } else {
      await this.redis.hincrby(key, 'failureCount', 1);
    }
  }

  private async applyLearningInsights(agentType: AgentType, insight: any): Promise<void> {
    // Apply learning insights to improve orchestration
    // Adjust task assignment strategy based on performance data
  }

  private getAgentCapabilities(type: AgentType): string[] {
    const capabilities: Record<AgentType, string[]> = {
      [AgentType.NEWS_MONITOR]: ['ADD_FEED', 'REMOVE_FEED', 'CHECK_FEEDS', 'GET_OPPORTUNITIES'],
      [AgentType.CONTENT_GENERATOR]: ['GENERATE_POST', 'GENERATE_ARTICLE', 'GENERATE_VARIATIONS'],
      [AgentType.QUALITY_CONTROL]: ['CHECK_QUALITY', 'VERIFY_FACTS', 'ASSESS_RISK'],
      [AgentType.PUBLISHER]: ['PUBLISH_CONTENT', 'SCHEDULE_POST', 'TRACK_PERFORMANCE'],
      [AgentType.LEARNING]: ['ANALYZE_PERFORMANCE', 'UPDATE_MODELS', 'GENERATE_INSIGHTS'],
      [AgentType.ORCHESTRATOR]: ['ORCHESTRATE_WORKFLOW', 'GET_AGENT_STATUS', 'GET_SYSTEM_HEALTH']
    };
    
    return capabilities[type] || [];
  }

  private async loadAgentRegistry(): Promise<void> {
    const data = await this.redis.get('agent:registry');
    if (data) {
      const registry = JSON.parse(data);
      for (const [id, agent] of Object.entries(registry)) {
        this.agentRegistry.set(id, agent as AgentRegistry);
      }
    }
  }

  private async saveAgentRegistry(): Promise<void> {
    const registry: Record<string, AgentRegistry> = {};
    for (const [id, agent] of this.agentRegistry) {
      registry[id] = agent;
    }
    await this.redis.set('agent:registry', JSON.stringify(registry));
  }

  private async getAgentStatus(): Promise<any> {
    const status: any = {};
    
    for (const [id, agent] of this.agentRegistry) {
      status[id] = {
        type: agent.type,
        status: agent.status,
        lastSeen: agent.lastSeen,
        health: agent.health
      };
    }
    
    return status;
  }

  private async getSystemHealth(): Promise<any> {
    const health = {
      agents: {},
      tasks: {},
      errors: []
    };
    
    // Agent health
    for (const [type, agents] of this.groupAgentsByType()) {
      health.agents[type] = {
        total: agents.length,
        online: agents.filter(a => a.status === 'online').length,
        healthy: agents.filter(a => this.isAgentHealthy(a)).length
      };
    }
    
    // Task metrics
    for (const [type, queue] of this.taskQueues) {
      health.tasks[type] = {
        pending: queue.pending.length,
        processing: queue.processing.size,
        completed: queue.completed.length,
        failed: queue.failed.length
      };
    }
    
    // Recent errors
    const recentErrors = await this.redis.lrange('agent:errors', 0, 10);
    health.errors = recentErrors.map(e => JSON.parse(e));
    
    return health;
  }

  private groupAgentsByType(): Map<AgentType, AgentRegistry[]> {
    const grouped = new Map<AgentType, AgentRegistry[]>();
    
    for (const agent of this.agentRegistry.values()) {
      const agents = grouped.get(agent.type) || [];
      agents.push(agent);
      grouped.set(agent.type, agents);
    }
    
    return grouped;
  }

  private async rebalanceTasks(): Promise<void> {
    // Implement task rebalancing across agents
    this.logger.info('Task rebalancing completed');
  }

  async stop(): Promise<void> {
    if (this.orchestrationTimer) {
      clearInterval(this.orchestrationTimer);
    }
    
    await this.redis.quit();
    await super.stop();
  }
}