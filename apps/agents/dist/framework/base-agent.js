"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const shared_1 = require("@brandpillar/shared");
const queue_1 = require("@brandpillar/queue");
const pino_1 = __importDefault(require("pino"));
const uuid_1 = require("uuid");
class BaseAgent {
    id;
    type;
    name;
    logger;
    messageBus;
    config;
    isRunning = false;
    activeTasks = new Map();
    healthCheckTimer;
    startTime;
    completedTaskCount = 0;
    failedTaskCount = 0;
    constructor(config) {
        this.id = (0, uuid_1.v4)();
        this.type = config.type;
        this.name = config.name;
        this.config = config;
        this.startTime = new Date();
        this.logger = (0, pino_1.default)({
            name: `agent:${this.type}:${this.id}`,
            level: process.env.LOG_LEVEL || 'info'
        });
        this.messageBus = new queue_1.RabbitMQMessageBus({
            url: config.messageBusUrl,
            exchangeName: 'brandpillar.agents',
            prefetchCount: config.maxConcurrentTasks,
            reconnectDelay: 5000
        });
    }
    // Core agent lifecycle methods
    async start() {
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
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to start agent');
            throw error;
        }
    }
    async stop() {
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
        }
        catch (error) {
            this.logger.error({ error }, 'Error stopping agent');
            throw error;
        }
    }
    // Message handling
    async handleMessage(message) {
        this.logger.debug({ messageId: message.id }, 'Received message');
        try {
            switch (message.type) {
                case shared_1.MessageType.TASK_REQUEST:
                    await this.handleTaskRequest(message);
                    break;
                case shared_1.MessageType.COORDINATION:
                    await this.handleCoordination(message);
                    break;
                case shared_1.MessageType.STATUS_UPDATE:
                    await this.handleStatusUpdate(message);
                    break;
                default:
                    this.logger.warn({ messageType: message.type }, 'Unknown message type');
            }
        }
        catch (error) {
            this.logger.error({ error, messageId: message.id }, 'Error handling message');
            await this.reportError(message, error);
        }
    }
    async handleTaskRequest(message) {
        const task = {
            id: (0, uuid_1.v4)(),
            userId: message.payload.userId,
            agentType: this.type,
            taskType: message.payload.taskType,
            status: shared_1.TaskStatus.PENDING,
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
    async acceptTask(task) {
        try {
            task.status = shared_1.TaskStatus.IN_PROGRESS;
            task.startedAt = new Date();
            this.activeTasks.set(task.id, task);
            this.logger.info({ taskId: task.id, taskType: task.taskType }, 'Processing task');
            // Process task
            const result = await this.processTask(task);
            // Complete task
            task.status = shared_1.TaskStatus.COMPLETED;
            task.completedAt = new Date();
            task.result = result;
            this.completedTaskCount++;
            this.activeTasks.delete(task.id);
            // Send result
            await this.sendTaskResult(task);
            this.logger.info({ taskId: task.id }, 'Task completed successfully');
        }
        catch (error) {
            this.logger.error({ error, taskId: task.id }, 'Task processing failed');
            task.status = shared_1.TaskStatus.FAILED;
            task.completedAt = new Date();
            task.error = {
                message: error.message,
                stack: error.stack
            };
            this.failedTaskCount++;
            this.activeTasks.delete(task.id);
            // Send failure notification
            await this.sendTaskResult(task);
        }
    }
    async rejectTask(task, reason) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: shared_1.AgentType.ORCHESTRATOR,
            type: shared_1.MessageType.TASK_RESULT,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskId: task.id,
                status: shared_1.TaskStatus.FAILED,
                error: { message: reason }
            },
            requiresAck: false,
            timeout: 30000
        };
        await this.messageBus.publish(message);
    }
    async sendTaskResult(task) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: shared_1.AgentType.ORCHESTRATOR,
            type: shared_1.MessageType.TASK_RESULT,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskId: task.id,
                userId: task.userId,
                status: task.status,
                result: task.result,
                error: task.error,
                duration: task.completedAt.getTime() - task.startedAt.getTime()
            },
            requiresAck: false,
            timeout: 30000
        };
        await this.messageBus.publish(message);
    }
    // Health monitoring
    startHealthCheck() {
        this.healthCheckTimer = setInterval(async () => {
            const health = await this.getHealthStatus();
            if (!health.isHealthy) {
                this.logger.warn({ health }, 'Agent unhealthy');
            }
            // Report health status
            await this.reportHealth(health);
        }, this.config.healthCheckInterval);
    }
    async getHealthStatus() {
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
    async reportHealth(health) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: shared_1.AgentType.ORCHESTRATOR,
            type: shared_1.MessageType.STATUS_UPDATE,
            priority: shared_1.Priority.LOW,
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
    async handleCoordination(message) {
        this.logger.debug({ messageId: message.id }, 'Handling coordination message');
        // Implement coordination logic based on message payload
    }
    async handleStatusUpdate(message) {
        this.logger.debug({ messageId: message.id }, 'Handling status update');
        // Implement status update logic
    }
    // Utility methods
    async announceStatus(status) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: 'broadcast',
            type: shared_1.MessageType.STATUS_UPDATE,
            priority: shared_1.Priority.HIGH,
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
    async reportError(originalMessage, error) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: shared_1.AgentType.ORCHESTRATOR,
            type: shared_1.MessageType.ERROR_REPORT,
            priority: shared_1.Priority.HIGH,
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
    async gracefulShutdown() {
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();
        while (this.activeTasks.size > 0) {
            if (Date.now() - startTime > timeout) {
                this.logger.warn({ activeTaskCount: this.activeTasks.size }, 'Graceful shutdown timeout, forcing shutdown');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    // Protected utility methods for child classes
    async sendMessage(message) {
        await this.messageBus.publish(message);
    }
    generateMessageId() {
        return (0, uuid_1.v4)();
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=base-agent.js.map