import { AgentMessage, AgentType } from '@brandpillar/shared';
export interface MessageBusConfig {
    url: string;
    exchangeName: string;
    prefetchCount: number;
    reconnectDelay: number;
}
export declare class RabbitMQMessageBus {
    private connection;
    private channel;
    private config;
    private isConnected;
    private reconnectTimer;
    private consumers;
    constructor(config: MessageBusConfig);
    connect(): Promise<void>;
    publish(message: AgentMessage): Promise<void>;
    subscribe(agentType: AgentType, handler: (message: AgentMessage) => Promise<void>): Promise<void>;
    createDeadLetterExchange(): Promise<void>;
    private getRoutingKey;
    private handleConnectionError;
    private handleConnectionClose;
    private scheduleReconnect;
    disconnect(): Promise<void>;
}
