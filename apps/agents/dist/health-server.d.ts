import { AgentType } from '@brandpillar/shared';
export interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    timestamp: Date;
    agents: Record<string, any>;
    errors: string[];
}
export declare class HealthServer {
    private app;
    private port;
    private server;
    private agentHealthChecks;
    constructor(port?: number);
    private setupRoutes;
    registerAgentHealthCheck(agentType: AgentType, healthCheck: () => Promise<any>): void;
    private performHealthCheck;
    private collectMetrics;
    start(): Promise<void>;
    stop(): Promise<void>;
}
