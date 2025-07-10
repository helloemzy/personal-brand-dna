"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorAgent = void 0;
const base_agent_1 = require("../framework/base-agent");
const shared_1 = require("@brandpillar/shared");
const ioredis_1 = __importDefault(require("ioredis"));
const uuid_1 = require("uuid");
class OrchestratorAgent extends base_agent_1.BaseAgent {
    redis;
    agentRegistry = new Map();
    taskQueues = new Map();
    orchestrationTimer;
    constructor() {
        super({
            type: shared_1.AgentType.ORCHESTRATOR,
            name: 'Orchestrator Agent',
            messageBusUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
            redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
            maxConcurrentTasks: 100,
            healthCheckInterval: 30000
        });
        this.redis = new ioredis_1.default(this.config.redisUrl);
    }
    async initialize() {
        this.logger.info('Initializing Orchestrator Agent');
        // Initialize task queues for each agent type
        Object.values(shared_1.AgentType).forEach(type => {
            if (type !== shared_1.AgentType.ORCHESTRATOR) {
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
    async processTask(task) {
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
    async validateTask(task) {
        return true; // Orchestrator accepts all tasks
    }
    async subscribeToAllAgents() {
        // Subscribe to status updates from all agents
        await this.messageBus.subscribe(this.type, async (message) => {
            await this.handleAgentMessage(message);
        });
    }
    async handleAgentMessage(message) {
        switch (message.type) {
            case shared_1.MessageType.STATUS_UPDATE:
                await this.handleAgentStatusUpdate(message);
                break;
            case shared_1.MessageType.TASK_RESULT:
                await this.handleTaskResult(message);
                break;
            case shared_1.MessageType.ERROR_REPORT:
                await this.handleErrorReport(message);
                break;
            case shared_1.MessageType.LEARNING_UPDATE:
                await this.handleLearningUpdate(message);
                break;
        }
    }
    async handleAgentStatusUpdate(message) {
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
        }
        else if (status === 'offline') {
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
    async handleTaskResult(message) {
        const { taskId, userId, status, result, error, duration } = message.payload;
        // Find task in processing queue
        let foundTask;
        let foundQueue;
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
        if (status === shared_1.TaskStatus.COMPLETED) {
            foundQueue.completed.push(foundTask);
            // Trigger next steps in workflow if applicable
            await this.checkWorkflowContinuation(foundTask);
        }
        else if (status === shared_1.TaskStatus.FAILED) {
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
    async handleErrorReport(message) {
        const { originalMessageId, error } = message.payload;
        this.logger.error({
            agentId: message.source,
            originalMessageId,
            error
        }, 'Agent reported error');
        // Store error for analysis
        await this.redis.lpush('agent:errors', JSON.stringify({
            timestamp: new Date(),
            agentId: message.source,
            error
        }));
    }
    async handleLearningUpdate(message) {
        const { insight, metrics } = message.payload;
        this.logger.info({ agentId: message.source, insight }, 'Learning update received');
        // Store learning insights
        await this.redis.hset('learning:insights', `${message.source}:${Date.now()}`, JSON.stringify({ insight, metrics }));
        // Apply learning updates to orchestration strategy
        await this.applyLearningInsights(message.source, insight);
    }
    startOrchestration() {
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
            }
            catch (error) {
                this.logger.error({ error }, 'Orchestration cycle error');
            }
        }, 5000); // Run every 5 seconds
    }
    async processPendingTasks() {
        for (const [agentType, queue] of this.taskQueues) {
            const availableAgents = this.getAvailableAgents(agentType);
            if (availableAgents.length === 0) {
                continue;
            }
            while (queue.pending.length > 0 && availableAgents.length > 0) {
                const task = queue.pending.shift();
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
    async assignTask(task, agent) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: agent.type,
            type: shared_1.MessageType.TASK_REQUEST,
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
        this.logger.info({ taskId: task.id, agentId: agent.agentId, agentType: agent.type }, 'Task assigned to agent');
    }
    getAvailableAgents(type) {
        return Array.from(this.agentRegistry.values()).filter(agent => agent.type === type &&
            agent.status === 'online' &&
            this.isAgentHealthy(agent));
    }
    selectBestAgent(agents, task) {
        if (agents.length === 0)
            return null;
        // Sort agents by health and workload
        const sorted = agents.sort((a, b) => {
            const scoreA = this.calculateAgentScore(a);
            const scoreB = this.calculateAgentScore(b);
            return scoreB - scoreA;
        });
        return sorted[0];
    }
    calculateAgentScore(agent) {
        if (!agent.health)
            return 0;
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
    isAgentHealthy(agent) {
        if (!agent.health)
            return false;
        const health = agent.health;
        const timeSinceLastSeen = Date.now() - agent.lastSeen.getTime();
        return health.isHealthy &&
            timeSinceLastSeen < 60000 && // Seen in last minute
            health.memoryUsage < 0.9 &&
            health.cpuUsage < 90;
    }
    async checkAgentHealth() {
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
    async reassignAgentTasks(agentId) {
        // Find all tasks assigned to this agent
        for (const [agentType, queue] of this.taskQueues) {
            const tasksToReassign = [];
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
    async balanceWorkload() {
        // Implement workload balancing logic
        // Move tasks from overloaded agents to underutilized ones
    }
    async cleanupOldTasks() {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        for (const queue of this.taskQueues.values()) {
            // Clean completed tasks
            queue.completed = queue.completed.filter(task => task.completedAt.getTime() > cutoffTime);
            // Clean failed tasks
            queue.failed = queue.failed.filter(task => task.completedAt.getTime() > cutoffTime);
        }
    }
    async orchestrateWorkflow(workflow) {
        // Implement workflow orchestration
        // Break down workflow into tasks and assign to appropriate agents
    }
    async checkWorkflowContinuation(completedTask) {
        // Check if this task completion triggers next steps in a workflow
        // Implement workflow continuation logic
    }
    async updateTaskMetrics(task, duration) {
        const key = `metrics:${task.agentType}:${task.taskType}`;
        await this.redis.hincrby(key, 'count', 1);
        await this.redis.hincrby(key, 'totalDuration', duration);
        if (task.status === shared_1.TaskStatus.COMPLETED) {
            await this.redis.hincrby(key, 'successCount', 1);
        }
        else {
            await this.redis.hincrby(key, 'failureCount', 1);
        }
    }
    async applyLearningInsights(agentType, insight) {
        // Apply learning insights to improve orchestration
        // Adjust task assignment strategy based on performance data
    }
    getAgentCapabilities(type) {
        const capabilities = {
            [shared_1.AgentType.NEWS_MONITOR]: ['ADD_FEED', 'REMOVE_FEED', 'CHECK_FEEDS', 'GET_OPPORTUNITIES'],
            [shared_1.AgentType.CONTENT_GENERATOR]: ['GENERATE_POST', 'GENERATE_ARTICLE', 'GENERATE_VARIATIONS'],
            [shared_1.AgentType.QUALITY_CONTROL]: ['CHECK_QUALITY', 'VERIFY_FACTS', 'ASSESS_RISK'],
            [shared_1.AgentType.PUBLISHER]: ['PUBLISH_CONTENT', 'SCHEDULE_POST', 'TRACK_PERFORMANCE'],
            [shared_1.AgentType.LEARNING]: ['ANALYZE_PERFORMANCE', 'UPDATE_MODELS', 'GENERATE_INSIGHTS'],
            [shared_1.AgentType.ORCHESTRATOR]: ['ORCHESTRATE_WORKFLOW', 'GET_AGENT_STATUS', 'GET_SYSTEM_HEALTH']
        };
        return capabilities[type] || [];
    }
    async loadAgentRegistry() {
        const data = await this.redis.get('agent:registry');
        if (data) {
            const registry = JSON.parse(data);
            for (const [id, agent] of Object.entries(registry)) {
                this.agentRegistry.set(id, agent);
            }
        }
    }
    async saveAgentRegistry() {
        const registry = {};
        for (const [id, agent] of this.agentRegistry) {
            registry[id] = agent;
        }
        await this.redis.set('agent:registry', JSON.stringify(registry));
    }
    async getAgentStatus() {
        const status = {};
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
    async getSystemHealth() {
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
    groupAgentsByType() {
        const grouped = new Map();
        for (const agent of this.agentRegistry.values()) {
            const agents = grouped.get(agent.type) || [];
            agents.push(agent);
            grouped.set(agent.type, agents);
        }
        return grouped;
    }
    async rebalanceTasks() {
        // Implement task rebalancing across agents
        this.logger.info('Task rebalancing completed');
    }
    async stop() {
        if (this.orchestrationTimer) {
            clearInterval(this.orchestrationTimer);
        }
        await this.redis.quit();
        await super.stop();
    }
}
exports.OrchestratorAgent = OrchestratorAgent;
//# sourceMappingURL=orchestrator.agent.js.map