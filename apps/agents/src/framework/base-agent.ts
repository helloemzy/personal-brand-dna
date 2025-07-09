import { AgentType, AgentMessage, Task, HealthStatus, MessageType, Priority, TaskStatus } from '@brandpillar/shared';
import { RabbitMQMessageBus } from '@brandpillar/queue';
import pino, { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface AgentConfig {
  type: AgentType;
  name: string;
  messageBusUrl: string;
  redisUrl: string;
  maxConcurrentTasks: number;
  healthCheckInterval: number;
}

export abstract class BaseAgent {
  protected id: string;
  public readonly type: AgentType;
  protected name: string;
  protected logger: Logger;
  protected messageBus: RabbitMQMessageBus;
  protected config: AgentConfig;
  
  private isRunning: boolean = false;
  private activeTasks: Map<string, Task> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private startTime: Date;
  private completedTaskCount: number = 0;
  private failedTaskCount: number = 0;

  constructor(config: AgentConfig) {
    this.id = uuidv4();
    this.type = config.type;
    this.name = config.name;
    this.config = config;
    this.startTime = new Date();
    
    this.logger = pino({
      name: `agent:${this.type}:${this.id}`,
      level: process.env.LOG_LEVEL || 'info'
    });
    
    this.messageBus = new RabbitMQMessageBus({
      url: config.messageBusUrl,
      exchangeName: 'brandpillar.agents',
      prefetchCount: config.maxConcurrentTasks,
      reconnectDelay: 5000
    });
  }

  // Abstract methods that must be implemented by specific agents
  abstract async initialize(): Promise<void>;
  abstract async processTask(task: Task): Promise<any>;
  abstract async validateTask(task: Task): Promise<boolean>;
  
  // Core agent lifecycle methods
  async start(): Promise<void> {
    try {
      this.logger.info({ agentId: this.id }, 'Starting agent');
      
      // Connect to message bus
      await this.messageBus.connect();
      await this.messageBus.createDeadLetterExchange();
      
      // Initialize agent-specific resources
      await this.initialize();
      
      // Subscribe to messages
      await this.messageBus.subscribe(this.type, this.handleMessage.bind(this));
      
      // Start health check
      this.startHealthCheck();
      
      this.isRunning = true;
      
      // Announce agent is ready
      await this.announceStatus('online');
      
      this.logger.info({ agentId: this.id }, 'Agent started successfully');
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start agent');
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info({ agentId: this.id }, 'Stopping agent');
      
      this.isRunning = false;
      
      // Stop health check
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      
      // Wait for active tasks to complete
      await this.gracefulShutdown();
      
      // Announce agent is offline
      await this.announceStatus('offline');
      
      // Disconnect from message bus
      await this.messageBus.disconnect();
      
      this.logger.info({ agentId: this.id }, 'Agent stopped successfully');
      
    } catch (error) {
      this.logger.error({ error }, 'Error stopping agent');
      throw error;
    }
  }

  // Message handling
  private async handleMessage(message: AgentMessage): Promise<void> {
    this.logger.debug({ messageId: message.id }, 'Received message');
    
    try {
      switch (message.type) {
        case MessageType.TASK_REQUEST:
          await this.handleTaskRequest(message);
          break;
          
        case MessageType.COORDINATION:
          await this.handleCoordination(message);
          break;
          
        case MessageType.STATUS_UPDATE:
          await this.handleStatusUpdate(message);
          break;
          
        default:
          this.logger.warn({ messageType: message.type }, 'Unknown message type');
      }
      
    } catch (error) {
      this.logger.error({ error, messageId: message.id }, 'Error handling message');
      await this.reportError(message, error as Error);
    }
  }

  private async handleTaskRequest(message: AgentMessage): Promise<void> {
    const task: Task = {
      id: uuidv4(),
      userId: message.payload.userId,
      agentType: this.type,
      taskType: message.payload.taskType,
      status: TaskStatus.PENDING,
      priority: message.priority,
      payload: message.payload.data,
      retryCount: 0,
      createdAt: new Date()
    };
    
    // Check if we can accept more tasks
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      this.logger.warn({ taskId: task.id }, 'Task queue full, rejecting task');
      await this.rejectTask(task, 'Agent at capacity');
      return;
    }
    
    // Validate task
    const isValid = await this.validateTask(task);
    if (!isValid) {
      this.logger.warn({ taskId: task.id }, 'Task validation failed');
      await this.rejectTask(task, 'Invalid task parameters');
      return;
    }
    
    // Accept and process task
    await this.acceptTask(task);
  }

  private async acceptTask(task: Task): Promise<void> {
    try {
      task.status = TaskStatus.IN_PROGRESS;
      task.startedAt = new Date();
      this.activeTasks.set(task.id, task);
      
      this.logger.info({ taskId: task.id, taskType: task.taskType }, 'Processing task');
      
      // Process task
      const result = await this.processTask(task);
      
      // Complete task
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.result = result;
      
      this.completedTaskCount++;
      this.activeTasks.delete(task.id);
      
      // Send result
      await this.sendTaskResult(task);
      
      this.logger.info({ taskId: task.id }, 'Task completed successfully');
      
    } catch (error) {
      this.logger.error({ error, taskId: task.id }, 'Task processing failed');
      
      task.status = TaskStatus.FAILED;
      task.completedAt = new Date();
      task.error = {
        message: (error as Error).message,
        stack: (error as Error).stack
      };
      
      this.failedTaskCount++;
      this.activeTasks.delete(task.id);
      
      // Send failure notification
      await this.sendTaskResult(task);
    }
  }

  private async rejectTask(task: Task, reason: string): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.type,
      target: AgentType.ORCHESTRATOR,
      type: MessageType.TASK_RESULT,
      priority: Priority.MEDIUM,
      payload: {
        taskId: task.id,
        status: TaskStatus.FAILED,
        error: { message: reason }
      },
      requiresAck: false,
      timeout: 30000
    };
    
    await this.messageBus.publish(message);
  }

  private async sendTaskResult(task: Task): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.type,
      target: AgentType.ORCHESTRATOR,
      type: MessageType.TASK_RESULT,
      priority: Priority.MEDIUM,
      payload: {
        taskId: task.id,
        userId: task.userId,
        status: task.status,
        result: task.result,
        error: task.error,
        duration: task.completedAt!.getTime() - task.startedAt!.getTime()
      },
      requiresAck: false,
      timeout: 30000
    };
    
    await this.messageBus.publish(message);
  }

  // Health monitoring
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      const health = await this.getHealthStatus();
      
      if (!health.isHealthy) {
        this.logger.warn({ health }, 'Agent unhealthy');
      }
      
      // Report health status
      await this.reportHealth(health);
      
    }, this.config.healthCheckInterval);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();
    const memoryUsage = process.memoryUsage();
    
    // Calculate average task duration
    let averageTaskDuration = 0;
    if (this.completedTaskCount > 0) {
      // This would be calculated from stored metrics in production
      averageTaskDuration = 5000; // Placeholder
    }
    
    return {
      isHealthy: this.isRunning && this.activeTasks.size < this.config.maxConcurrentTasks,
      lastHealthCheck: now,
      uptime,
      memoryUsage: memoryUsage.heapUsed / memoryUsage.heapTotal,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      activeTaskCount: this.activeTasks.size,
      completedTaskCount: this.completedTaskCount,
      failedTaskCount: this.failedTaskCount,
      averageTaskDuration
    };
  }

  private async reportHealth(health: HealthStatus): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.type,
      target: AgentType.ORCHESTRATOR,
      type: MessageType.STATUS_UPDATE,
      priority: Priority.LOW,
      payload: {
        agentId: this.id,
        health
      },
      requiresAck: false,
      timeout: 10000
    };
    
    await this.messageBus.publish(message);
  }

  // Coordination
  private async handleCoordination(message: AgentMessage): Promise<void> {
    this.logger.debug({ messageId: message.id }, 'Handling coordination message');
    // Implement coordination logic based on message payload
  }

  private async handleStatusUpdate(message: AgentMessage): Promise<void> {
    this.logger.debug({ messageId: message.id }, 'Handling status update');
    // Implement status update logic
  }

  // Utility methods
  private async announceStatus(status: 'online' | 'offline'): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.type,
      target: 'broadcast',
      type: MessageType.STATUS_UPDATE,
      priority: Priority.HIGH,
      payload: {
        agentId: this.id,
        status,
        timestamp: new Date()
      },
      requiresAck: false,
      timeout: 10000
    };
    
    await this.messageBus.publish(message);
  }

  private async reportError(originalMessage: AgentMessage, error: Error): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.type,
      target: AgentType.ORCHESTRATOR,
      type: MessageType.ERROR_REPORT,
      priority: Priority.HIGH,
      payload: {
        originalMessageId: originalMessage.id,
        error: {
          message: error.message,
          stack: error.stack
        }
      },
      requiresAck: false,
      timeout: 10000
    };
    
    await this.messageBus.publish(message);
  }

  private async gracefulShutdown(): Promise<void> {
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeTasks.size > 0) {
      if (Date.now() - startTime > timeout) {
        this.logger.warn(
          { activeTaskCount: this.activeTasks.size },
          'Graceful shutdown timeout, forcing shutdown'
        );
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Protected utility methods for child classes
  protected async sendMessage(message: AgentMessage): Promise<void> {
    await this.messageBus.publish(message);
  }

  protected generateMessageId(): string {
    return uuidv4();
  }
}