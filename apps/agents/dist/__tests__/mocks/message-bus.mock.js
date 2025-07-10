"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMessageBus = void 0;
const events_1 = require("events");
class MockMessageBus extends events_1.EventEmitter {
    connected = false;
    channels = new Map();
    consumerCallbacks = new Map();
    async connect() {
        this.connected = true;
        this.emit('connected');
    }
    async disconnect() {
        this.connected = false;
        this.emit('disconnected');
    }
    async publish(channel, message) {
        if (!this.connected) {
            throw new Error('Message bus not connected');
        }
        // Store message in channel
        if (!this.channels.has(channel)) {
            this.channels.set(channel, []);
        }
        this.channels.get(channel).push(message);
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
    async subscribe(channel, callback) {
        if (!this.connected) {
            throw new Error('Message bus not connected');
        }
        this.consumerCallbacks.set(channel, callback);
        this.emit('channel:subscribed', channel);
    }
    // Test helpers
    getMessages(channel) {
        return this.channels.get(channel) || [];
    }
    clearMessages(channel) {
        if (channel) {
            this.channels.delete(channel);
        }
        else {
            this.channels.clear();
        }
    }
    isConnected() {
        return this.connected;
    }
}
exports.MockMessageBus = MockMessageBus;
//# sourceMappingURL=message-bus.mock.js.map