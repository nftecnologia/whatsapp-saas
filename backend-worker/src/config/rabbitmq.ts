import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

class RabbitMQWorker {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      const connectionUrl = process.env.RABBITMQ_URL || 
        `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}${process.env.RABBITMQ_VHOST}`;
      
      this.connection = await amqp.connect(connectionUrl);
      this.channel = await this.connection.createChannel();
      
      await this.setupQueues();
      
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        this.isConnected = false;
      });

      this.isConnected = true;
      console.log('✅ RabbitMQ Worker connected successfully');
    } catch (error) {
      console.error('❌ RabbitMQ Worker connection failed:', error);
      throw error;
    }
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const sendMessageQueue = process.env.SEND_MESSAGE_QUEUE || 'send_message';
    const dlqSendMessageQueue = process.env.DLQ_SEND_MESSAGE_QUEUE || 'send_message_dlq';

    await this.channel.assertQueue(dlqSendMessageQueue, {
      durable: true,
    });

    await this.channel.assertQueue(sendMessageQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': dlqSendMessageQueue,
      },
    });

    await this.channel.prefetch(parseInt(process.env.MAX_CONCURRENT_JOBS || '5'));
  }

  async consumeMessages(
    queue: string,
    callback: (message: any) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    console.log(`🔄 Starting to consume messages from queue: ${queue}`);

    await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const messageContent = JSON.parse(msg.content.toString());
        console.log(`📨 Processing message: ${messageContent.id || 'unknown'}`);
        
        await callback(messageContent);
        
        this.channel?.ack(msg);
        console.log(`✅ Message processed successfully: ${messageContent.id || 'unknown'}`);
      } catch (error) {
        console.error('❌ Error processing message:', error);
        
        const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
        const maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3');

        if (retryCount <= maxRetries) {
          console.log(`🔄 Retrying message (attempt ${retryCount}/${maxRetries})`);
          
          setTimeout(() => {
            if (this.channel) {
              this.channel.publish('', queue, msg.content, {
                ...msg.properties,
                headers: {
                  ...msg.properties.headers,
                  'x-retry-count': retryCount
                }
              });
              this.channel.ack(msg);
            }
          }, parseInt(process.env.RETRY_DELAY_MS || '5000'));
        } else {
          console.log(`💀 Message failed after ${maxRetries} attempts, sending to DLQ`);
          this.channel?.nack(msg, false, false);
        }
      }
    });
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      console.log('RabbitMQ Worker connection closed');
    } catch (error) {
      console.error('Error closing RabbitMQ Worker connection:', error);
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }

  isReady(): boolean {
    return this.isConnected && this.channel !== null;
  }
}

export default new RabbitMQWorker();