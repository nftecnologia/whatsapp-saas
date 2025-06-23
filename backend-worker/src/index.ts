import dotenv from 'dotenv';
import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import { MessageProcessor } from '@/services/messageProcessor';
import { SendMessageJob } from '@/types';
import logger from '@/utils/logger';

dotenv.config();

const WORKER_ID = process.env.WORKER_ID || 'worker-001';
const SEND_MESSAGE_QUEUE = process.env.SEND_MESSAGE_QUEUE || 'send_message';

class WorkerService {
  private isRunning: boolean = false;
  private startTime: Date = new Date();

  async start(): Promise<void> {
    try {
      logger.info(`🚀 Starting WhatsApp Worker Service: ${WORKER_ID}`);
      
      await this.connectServices();
      
      await this.startMessageConsumer();
      
      this.isRunning = true;
      logger.info(`✅ Worker ${WORKER_ID} started successfully`);
      
      this.startHealthChecker();
      
    } catch (error) {
      logger.error('❌ Failed to start worker service', error);
      process.exit(1);
    }
  }

  private async connectServices(): Promise<void> {
    logger.info('🔄 Connecting to services...');
    
    try {
      await redis.connect();
      logger.info('✅ Redis connected');
    } catch (error) {
      logger.error('❌ Redis connection failed', error);
      throw error;
    }

    try {
      await rabbitmq.connect();
      logger.info('✅ RabbitMQ connected');
    } catch (error) {
      logger.error('❌ RabbitMQ connection failed', error);
      throw error;
    }

    try {
      const dbResult = await pool.query('SELECT NOW()');
      logger.info('✅ PostgreSQL connected', { timestamp: dbResult.rows[0].now });
    } catch (error) {
      logger.error('❌ PostgreSQL connection failed', error);
      throw error;
    }
  }

  private async startMessageConsumer(): Promise<void> {
    logger.info(`🔄 Starting message consumer for queue: ${SEND_MESSAGE_QUEUE}`);
    
    await rabbitmq.consumeMessages(SEND_MESSAGE_QUEUE, async (message: SendMessageJob) => {
      try {
        await MessageProcessor.processMessage(message);
      } catch (error) {
        logger.error('Error in message processor', {
          jobId: message.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  private startHealthChecker(): void {
    setInterval(() => {
      const stats = MessageProcessor.getStats();
      const uptime = Date.now() - this.startTime.getTime();
      
      logger.info('📊 Worker Health Check', {
        workerId: WORKER_ID,
        isRunning: this.isRunning,
        uptime: Math.floor(uptime / 1000),
        processedMessages: stats.processedMessages,
        successfulMessages: stats.successfulMessages,
        failedMessages: stats.failedMessages,
        successRate: stats.processedMessages > 0 
          ? ((stats.successfulMessages / stats.processedMessages) * 100).toFixed(2) + '%' 
          : '0%'
      });
    }, 60000); // Every minute
  }

  async stop(): Promise<void> {
    logger.info('🔄 Graceful shutdown initiated...');
    
    this.isRunning = false;
    
    try {
      await redis.quit();
      logger.info('✅ Redis connection closed');
      
      await rabbitmq.close();
      logger.info('✅ RabbitMQ connection closed');
      
      await pool.end();
      logger.info('✅ PostgreSQL connection closed');
      
      logger.info('✅ Worker service stopped gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown', error);
      process.exit(1);
    }
  }

  getStatus(): any {
    return {
      workerId: WORKER_ID,
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime.getTime(),
      stats: MessageProcessor.getStats()
    };
  }
}

const workerService = new WorkerService();

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  workerService.stop();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  workerService.stop();
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  workerService.stop();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  workerService.stop();
});

workerService.start();