import dotenv from 'dotenv';

// Initialize environment variables first
dotenv.config();

// Import and validate environment
import { workerEnvValidator } from '@/utils/envValidator';
import { workerSecurityLogger, WorkerSecurityEventType, SecurityLogLevel } from '@/utils/securityLogger';

// Validate environment on startup
const config = workerEnvValidator.getConfig();

import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import { MessageProcessor } from '@/services/messageProcessor';
import { SendMessageJob } from '@/types';
import logger from '@/utils/logger';
// import { createHealthServer } from '@/server';
import healthService from '@/services/healthService';

const WORKER_ID = workerSecurityLogger.getWorkerId();
const SEND_MESSAGE_QUEUE = config.RABBITMQ_QUEUE;

class WorkerService {
  private isRunning: boolean = false;
  private startTime: Date = new Date();
  private healthServer: any;

  async start(): Promise<void> {
    try {
      logger.info(`🚀 Starting WhatsApp Worker Service: ${WORKER_ID}`);
      logger.info(`🔧 Environment: ${config.NODE_ENV}`);
      
      // Validate worker configuration
      workerEnvValidator.validateWorkerConfig();
      
      // Log startup event
      workerSecurityLogger.log(
        WorkerSecurityEventType.MESSAGE_PROCESSED,
        SecurityLogLevel.INFO,
        {
          action: 'worker_startup',
          workerId: WORKER_ID,
          environment: config.NODE_ENV,
          configuration: workerEnvValidator.getSanitizedConfig(),
        }
      );
      
      await this.connectServices();
      
      await this.startMessageConsumer();
      
      // Start health server (temporarily disabled due to missing express dependency)
      // const healthPort = config.HEALTH_CHECK_PORT;
      // this.healthServer = createHealthServer(healthPort);
      
      this.isRunning = true;
      logger.info(`✅ Worker ${WORKER_ID} started successfully`);
      // logger.info(`🏥 Health check: http://localhost:${healthPort}/health`);
      logger.info(`🔒 Security: Enhanced validation enabled`);
      logger.info(`📊 Concurrency: ${config.WORKER_CONCURRENCY} concurrent jobs`);
      
      this.startHealthChecker();
      
    } catch (error) {
      workerSecurityLogger.log(
        WorkerSecurityEventType.CONFIGURATION_ERROR,
        SecurityLogLevel.CRITICAL,
        {
          error: error instanceof Error ? error.message : String(error),
          action: 'worker_startup_failed',
        }
      );
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
      const startTime = Date.now();
      healthService.startMessageProcessing();
      
      // Validate message structure
      if (!this.validateMessage(message)) {
        workerSecurityLogger.logValidationError(
          WorkerSecurityEventType.MALFORMED_PAYLOAD,
          'Invalid message structure',
          message,
          message.id
        );
        healthService.finishMessageProcessing(false, 'Invalid message structure');
        return; // Skip processing invalid messages
      }
      
      try {
        await MessageProcessor.processMessage(message);
        
        const duration = Date.now() - startTime;
        healthService.finishMessageProcessing(true);
        
        // Log successful processing
        workerSecurityLogger.logMessageProcessing(
          message.id,
          message.campaign_id,
          message.contact_id,
          message.phone,
          true,
          duration,
          { success: true }
        );
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;
        
        logger.error('Error in message processor', {
          jobId: message.id,
          error: errorMessage
        });
        
        // Log processing failure
        workerSecurityLogger.logMessageProcessing(
          message.id,
          message.campaign_id,
          message.contact_id,
          message.phone,
          false,
          duration,
          { error: errorMessage }
        );
        
        healthService.finishMessageProcessing(false, errorMessage);
        throw error;
      }
    });
  }
  
  private validateMessage(message: SendMessageJob): boolean {
    try {
      // Check required fields
      if (!message.id || !message.campaign_id || !message.contact_id || !message.phone) {
        return false;
      }
      
      // Validate phone number format
      if (!/^\+?[1-9]\d{1,14}$/.test(message.phone.replace(/\D/g, ''))) {
        workerSecurityLogger.logValidationError(
          WorkerSecurityEventType.INVALID_PHONE_NUMBER,
          'Invalid phone number format',
          message.phone,
          message.id
        );
        return false;
      }
      
      // Check for suspicious message content
      if (message.content) {
        const suspiciousPatterns = [
          /<script[\s\S]*?<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe[\s\S]*?<\/iframe>/gi,
        ];
        
        if (suspiciousPatterns.some(pattern => pattern.test(message.content))) {
          workerSecurityLogger.logSuspiciousActivity(
            WorkerSecurityEventType.SUSPICIOUS_MESSAGE_CONTENT,
            {
              reason: 'Suspicious patterns detected in message content',
              contentSample: message.content.substring(0, 100),
            },
            message.id
          );
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error validating message', error);
      return false;
    }
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
    
    // Log shutdown event
    workerSecurityLogger.log(
      WorkerSecurityEventType.MESSAGE_PROCESSED,
      SecurityLogLevel.INFO,
      {
        action: 'worker_shutdown',
        workerId: WORKER_ID,
        uptime: Date.now() - this.startTime.getTime(),
        stats: MessageProcessor.getStats(),
      }
    );
    
    this.isRunning = false;
    
    try {
      // Close health server
      if (this.healthServer) {
        this.healthServer.gracefulShutdown();
        logger.info('✅ Health server closed');
      }
      
      await redis.quit();
      logger.info('✅ Redis connection closed');
      
      await rabbitmq.close();
      logger.info('✅ RabbitMQ connection closed');
      
      await pool.end();
      logger.info('✅ PostgreSQL connection closed');
      
      logger.info('✅ Worker service stopped gracefully');
      process.exit(0);
    } catch (error) {
      workerSecurityLogger.log(
        WorkerSecurityEventType.CONFIGURATION_ERROR,
        SecurityLogLevel.ERROR,
        {
          error: error instanceof Error ? error.message : String(error),
          action: 'worker_shutdown_error',
        }
      );
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