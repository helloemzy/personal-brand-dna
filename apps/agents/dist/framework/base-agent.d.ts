import { AgentType, AgentMessage, Task, HealthStatus } from '@brandpillar/shared';
import { RabbitMQMessageBus } from '@brandpillar/queue';
import { Logger } from 'pino';
export interface AgentConfig {
    type: AgentType;
    name: string;
    messageBusUrl: string;
    redisUrl: string;
    maxConcurrentTasks: number;
    healthCheckInterval: number;
}
export declare abstract class BaseAgent {
    protected id: string;
    readonly type: AgentType;
    protected name: string;
    protected logger: Logger;
    protected messageBus: RabbitMQMessageBus;
    protected config: AgentConfig;
    private isRunning;
    private activeTasks;
    private healthCheckTimer?;
    private startTime;
    private completedTaskCount;
    private failedTaskCount;
    constructor(config: AgentConfig);
    abstract initialize(): Promise<void>;
    abstract processTask(task: Task): Promise<any>;
    abstract validateTask(task: Task): Promise<boolean>;
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleMessage;
    private handleTaskRequest;
    private acceptTask;
    private rejectTask;
    private sendTaskResult;
    private startHealthCheck;
    getHealthStatus(): Promise<HealthStatus>;
    private reportHealth;
    private handleCoordination;
    private handleStatusUpdate;
    private announceStatus;
    private reportError;
    private gracefulShutdown;
    protected sendMessage(message: AgentMessage): Promise<void>;
    protected generateMessageId(): string;
}
