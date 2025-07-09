import { EventEmitter } from 'events';
import { IMessage, IMessageBus } from '@brandpillar/queue';

export class MockMessageBus extends EventEmitter implements IMessageBus {
  private connected = false;
  private channels = new Map<string, any[]>();
  private consumerCallbacks = new Map<string, (msg: IMessage) => Promise<void>>();

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  async publish(channel: string, message: IMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Message bus not connected');
    }

    // Store message in channel
    if (!this.channels.has(channel)) {
      this.channels.set(channel, []);
    }
    this.channels.get(channel)!.push(message);

    // Emit for testing
    this.emit('message:published', { channel, message });

    // Call consumer if registered
    const callback = this.consumerCallbacks.get(channel);
    if (callback) {
      // Simulate async processing
      setTimeout(() => {
        callback(message).catch(err => {
          this.emit('message:error', { channel, message, error: err });
        });
      }, 10);
    }
  }

  async subscribe(
    channel: string,
    callback: (msg: IMessage) => Promise<void>
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Message bus not connected');
    }

    this.consumerCallbacks.set(channel, callback);
    this.emit('channel:subscribed', channel);
  }

  // Test helpers
  getMessages(channel: string): any[] {
    return this.channels.get(channel) || [];
  }

  clearMessages(channel?: string): void {
    if (channel) {
      this.channels.delete(channel);
    } else {
      this.channels.clear();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}