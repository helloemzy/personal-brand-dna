import * as amqplib from 'amqplib';
import { AgentMessage, AgentType, MessageType } from '@brandpillar/shared';
import pino from 'pino';

const logger = pino({ name: 'message-bus' });

export interface MessageBusConfig {
  url: string;
  exchangeName: string;
  prefetchCount: number;
  reconnectDelay: number;
}

export class RabbitMQMessageBus {
  private connection: any | null = null;
  private channel: any | null = null;
  private config: MessageBusConfig;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private consumers: Map<string, (message: AgentMessage) => Promise<void>> = new Map();

  constructor(config: MessageBusConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
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
      
    } catch (error) {
      logger.error({ error }, 'Failed to connect to RabbitMQ');
      this.scheduleReconnect();
      throw error;
    }
  }

  async publish(message: AgentMessage): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error('Message bus not connected');
    }

    const routingKey = this.getRoutingKey(message);
    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    // Publish with persistence
    this.channel.publish(
      this.config.exchangeName,
      routingKey,
      messageBuffer,
      {
        persistent: true,
        timestamp: Date.now(),
        messageId: message.id,
        type: message.type,
        priority: message.priority
      }
    );
    
    logger.debug({ messageId: message.id, routingKey }, 'Message published');
  }

  async subscribe(
    agentType: AgentType,
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void> {
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
      `${agentType}.*`,           // Direct messages to this agent
      `broadcast.*`,              // Broadcast messages
      `*.${agentType}`           // Messages targeting this agent type
    ];
    
    for (const pattern of routingPatterns) {
      await this.channel.bindQueue(queueName, this.config.exchangeName, pattern);
    }
    
    // Store consumer handler
    this.consumers.set(queueName, handler);
    
    // Start consuming
    await this.channel.consume(
      queueName,
      async (msg: any | null) => {
        if (!msg) return;
        
        try {
          const message: AgentMessage = JSON.parse(msg.content.toString());
          await handler(message);
          
          // Acknowledge message
          this.channel!.ack(msg);
          
        } catch (error) {
          logger.error({ error, messageId: msg.properties.messageId }, 'Message processing failed');
          
          // Reject and requeue if retries available
          const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;
          
          if (retryCount < 3) {
            // Requeue with increased retry count
            this.channel!.reject(msg, false);
            
            // Republish with retry header
            const updatedMessage = JSON.parse(msg.content.toString());
            updatedMessage.retryCount = retryCount + 1;
            
            setTimeout(() => {
              this.publish(updatedMessage).catch(err => 
                logger.error({ err }, 'Failed to republish message')
              );
            }, Math.pow(2, retryCount) * 1000); // Exponential backoff
            
          } else {
            // Send to dead letter queue
            this.channel!.reject(msg, false);
          }
        }
      },
      {
        noAck: false
      }
    );
    
    logger.info({ agentType, queueName }, 'Subscribed to queue');
  }

  async createDeadLetterExchange(): Promise<void> {
    if (!this.channel) return;
    
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

  private getRoutingKey(message: AgentMessage): string {
    if (message.target === 'broadcast') {
      return `broadcast.${message.type}`;
    }
    return `${message.target}.${message.type}`;
  }

  private handleConnectionError(error: Error): void {
    logger.error({ error }, 'RabbitMQ connection error');
    this.isConnected = false;
    this.scheduleReconnect();
  }

  private handleConnectionClose(): void {
    logger.warn('RabbitMQ connection closed');
    this.isConnected = false;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(async () => {
      logger.info('Attempting to reconnect to RabbitMQ');
      this.reconnectTimer = null;
      
      try {
        await this.connect();
        
        // Re-establish consumers
        for (const [queueName, handler] of this.consumers) {
          const agentType = queueName.split('.')[1].toUpperCase() as AgentType;
          await this.subscribe(agentType, handler);
        }
        
      } catch (error) {
        logger.error({ error }, 'Reconnection failed');
        this.scheduleReconnect();
      }
    }, this.config.reconnectDelay);
  }

  async disconnect(): Promise<void> {
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
    } catch (error) {
      logger.error({ error }, 'Error during disconnect');
    }
    
    this.isConnected = false;
    logger.info('Disconnected from RabbitMQ');
  }
}