import { EventEmitter } from 'events';
import { IMessage, IMessageBus } from '@brandpillar/queue';
export declare class MockMessageBus extends EventEmitter implements IMessageBus {
    private connected;
    private channels;
    private consumerCallbacks;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish(channel: string, message: IMessage): Promise<void>;
    subscribe(channel: string, callback: (msg: IMessage) => Promise<void>): Promise<void>;
    getMessages(channel: string): any[];
    clearMessages(channel?: string): void;
    isConnected(): boolean;
}
