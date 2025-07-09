"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQMessageBus = void 0;
const amqplib = __importStar(require("amqplib"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'message-bus' });
class RabbitMQMessageBus {
    connection = null;
    channel = null;
    config;
    isConnected = false;
    reconnectTimer = null;
    consumers = new Map();
    constructor(config) {
        this.config = config;
    }
    async connect() {
        try {
            this.connection = await amqplib.connect(this.config.url);
            if (!this.connection) {
                throw new Error('Failed to establish connection');
            }
            this.channel = await this.connection.createChannel();
            if (!this.channel) {
                throw new Error('Failed to create channel');
            }
            // Set prefetch for fair dispatch
            await this.channel.prefetch(this.config.prefetchCount);
            // Create topic exchange
            await this.channel.assertExchange(this.config.exchangeName, 'topic', {
                durable: true
            });
            this.isConnected = true;
            logger.info('Connected to RabbitMQ');
            // Handle connection events
            this.connection.on('error', this.handleConnectionError.bind(this));
            this.connection.on('close', this.handleConnectionClose.bind(this));
        }
        catch (error) {
            logger.error({ error }, 'Failed to connect to RabbitMQ');
            this.scheduleReconnect();
            throw error;
        }
    }
    async publish(message) {
        if (!this.isConnected || !this.channel) {
            throw new Error('Message bus not connected');
        }
        const routingKey = this.getRoutingKey(message);
        const messageBuffer = Buffer.from(JSON.stringify(message));
        // Publish with persistence
        this.channel.publish(this.config.exchangeName, routingKey, messageBuffer, {
            persistent: true,
            timestamp: Date.now(),
            messageId: message.id,
            type: message.type,
            priority: message.priority
        });
        logger.debug({ messageId: message.id, routingKey }, 'Message published');
    }
    async subscribe(agentType, handler) {
        if (!this.isConnected || !this.channel) {
            throw new Error('Message bus not connected');
        }
        const queueName = `agent.${agentType.toLowerCase()}`;
        // Create queue
        await this.channel.assertQueue(queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': `${this.config.exchangeName}.dlx`,
                'x-message-ttl': 3600000 // 1 hour
            }
        });
        // Bind queue to exchange with routing patterns
        const routingPatterns = [
            `${agentType}.*`, // Direct messages to this agent
            `broadcast.*`, // Broadcast messages
            `*.${agentType}` // Messages targeting this agent type
        ];
        for (const pattern of routingPatterns) {
            await this.channel.bindQueue(queueName, this.config.exchangeName, pattern);
        }
        // Store consumer handler
        this.consumers.set(queueName, handler);
        // Start consuming
        await this.channel.consume(queueName, async (msg) => {
            if (!msg)
                return;
            try {
                const message = JSON.parse(msg.content.toString());
                await handler(message);
                // Acknowledge message
                this.channel.ack(msg);
            }
            catch (error) {
                logger.error({ error, messageId: msg.properties.messageId }, 'Message processing failed');
                // Reject and requeue if retries available
                const retryCount = (msg.properties.headers?.['x-retry-count'] || 0);
                if (retryCount < 3) {
                    // Requeue with increased retry count
                    this.channel.reject(msg, false);
                    // Republish with retry header
                    const updatedMessage = JSON.parse(msg.content.toString());
                    updatedMessage.retryCount = retryCount + 1;
                    setTimeout(() => {
                        this.publish(updatedMessage).catch(err => logger.error({ err }, 'Failed to republish message'));
                    }, Math.pow(2, retryCount) * 1000); // Exponential backoff
                }
                else {
                    // Send to dead letter queue
                    this.channel.reject(msg, false);
                }
            }
        }, {
            noAck: false
        });
        logger.info({ agentType, queueName }, 'Subscribed to queue');
    }
    async createDeadLetterExchange() {
        if (!this.channel)
            return;
        const dlxName = `${this.config.exchangeName}.dlx`;
        const dlqName = `${this.config.exchangeName}.dlq`;
        // Create dead letter exchange
        await this.channel.assertExchange(dlxName, 'topic', { durable: true });
        // Create dead letter queue
        await this.channel.assertQueue(dlqName, { durable: true });
        // Bind DLQ to DLX
        await this.channel.bindQueue(dlqName, dlxName, '#');
        logger.info('Dead letter exchange created');
    }
    getRoutingKey(message) {
        if (message.target === 'broadcast') {
            return `broadcast.${message.type}`;
        }
        return `${message.target}.${message.type}`;
    }
    handleConnectionError(error) {
        logger.error({ error }, 'RabbitMQ connection error');
        this.isConnected = false;
        this.scheduleReconnect();
    }
    handleConnectionClose() {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(async () => {
            logger.info('Attempting to reconnect to RabbitMQ');
            this.reconnectTimer = null;
            try {
                await this.connect();
                // Re-establish consumers
                for (const [queueName, handler] of this.consumers) {
                    const agentType = queueName.split('.')[1].toUpperCase();
                    await this.subscribe(agentType, handler);
                }
            }
            catch (error) {
                logger.error({ error }, 'Reconnection failed');
                this.scheduleReconnect();
            }
        }, this.config.reconnectDelay);
    }
    async disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
        }
        catch (error) {
            logger.error({ error }, 'Error during disconnect');
        }
        this.isConnected = false;
        logger.info('Disconnected from RabbitMQ');
    }
}
exports.RabbitMQMessageBus = RabbitMQMessageBus;
