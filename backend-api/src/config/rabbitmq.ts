import amqp, { Connection, Channel } from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

class RabbitMQService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  async connect(): Promise<void> {
    try {
      const connectionUrl = process.env.RABBITMQ_URL || 
        `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}${process.env.RABBITMQ_VHOST}`;
      
      this.connection = await amqp.connect(connectionUrl);
      this.channel = await this.connection.createChannel();
      
      await this.setupQueues();
      
      console.log('✅ RabbitMQ connected successfully');
    } catch (error) {
      console.error('❌ RabbitMQ connection failed:', error);
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
  }

  async publishMessage(queue: string, message: any): Promise<boolean> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      return this.channel.sendToQueue(queue, messageBuffer, {
        persistent: true,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error publishing message to queue:', error);
      throw error;
    }
  }

  async publishSendMessage(messageData: any): Promise<boolean> {
    const queue = process.env.SEND_MESSAGE_QUEUE || 'send_message';
    return this.publishMessage(queue, messageData);
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('RabbitMQ connection closed');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }
}

export default new RabbitMQService();