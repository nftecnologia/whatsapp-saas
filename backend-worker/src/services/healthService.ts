import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import os from 'os';

export interface WorkerHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    rabbitmq: RabbitMQHealth;
  };
  system: SystemMetrics;
  worker: WorkerMetrics;
}

export interface ServiceHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  details?: string;
  lastChecked: string;
}

export interface RabbitMQHealth extends ServiceHealth {
  queueStatus?: {
    queueName: string;
    messageCount?: number;
    consumerCount?: number;
    isConsuming: boolean;
  };
}

export interface SystemMetrics {
  platform: string;
  arch: string;
  nodeVersion: string;
  memory: {
    used: number;
    free: number;
    total: number;
    usagePercentage: number;
  };
  cpu: {
    loadAverage: number[];
  };
}

export interface WorkerMetrics {
  messagesProcessed: number;
  messagesSuccessful: number;
  messagesFailed: number;
  messagesRetried: number;
  lastMessageProcessedAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  processingRate: number; // messages per minute
  averageProcessingTime: number; // milliseconds
  queueBacklog: number;
  isProcessing: boolean;
}

class WorkerHealthService {
  private static instance: WorkerHealthService;
  private metrics: WorkerMetrics = {
    messagesProcessed: 0,
    messagesSuccessful: 0,
    messagesFailed: 0,
    messagesRetried: 0,
    processingRate: 0,
    averageProcessingTime: 0,
    queueBacklog: 0,
    isProcessing: false,
  };
  private startTime = Date.now();
  private processingTimes: number[] = [];
  private processingStart: number | null = null;

  public static getInstance(): WorkerHealthService {
    if (!WorkerHealthService.instance) {
      WorkerHealthService.instance = new WorkerHealthService();
    }
    return WorkerHealthService.instance;
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const result = await pool.query('SELECT 1, NOW() as current_time');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'connected',
        responseTime,
        details: `Connected at ${result.rows[0].current_time}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown database error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const result = await redis.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: result === 'PONG' ? 'connected' : 'error',
        responseTime,
        details: `Ping response: ${result}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown Redis error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkRabbitMQ(): Promise<RabbitMQHealth> {
    const startTime = Date.now();
    try {
      const channel = rabbitmq.getChannel();
      const responseTime = Date.now() - startTime;
      
      if (channel) {
        // Try to get queue information
        let queueStatus;
        try {
          const queueName = process.env.SEND_MESSAGE_QUEUE || 'send_message';
          const queueInfo = await channel.checkQueue(queueName);
          queueStatus = {
            queueName,
            messageCount: queueInfo.messageCount,
            consumerCount: queueInfo.consumerCount,
            isConsuming: queueInfo.consumerCount > 0,
          };
          this.metrics.queueBacklog = queueInfo.messageCount;
        } catch (queueError) {
          queueStatus = {
            queueName: process.env.SEND_MESSAGE_QUEUE || 'send_message',
            isConsuming: false,
          };
        }

        return {
          status: 'connected',
          responseTime,
          details: 'Channel available and consuming messages',
          lastChecked: new Date().toISOString(),
          queueStatus,
        };
      } else {
        return {
          status: 'disconnected',
          responseTime,
          details: 'No active channel available',
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown RabbitMQ error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        free: Math.round(freeMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        usagePercentage: Math.round((usedMemory / totalMemory) * 100),
      },
      cpu: {
        loadAverage: os.loadavg(),
      },
    };
  }

  private calculateProcessingRate(): number {
    const uptimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    if (uptimeMinutes === 0) return 0;
    return Math.round(this.metrics.messagesProcessed / uptimeMinutes);
  }

  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.processingTimes.length);
  }

  private determineOverallStatus(services: WorkerHealthCheck['services']): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = [services.database.status, services.redis.status, services.rabbitmq.status];
    
    if (statuses.every(status => status === 'connected')) {
      return 'healthy';
    }
    
    if (statuses.some(status => status === 'connected')) {
      return 'degraded';
    }
    
    return 'unhealthy';
  }

  public async getHealthCheck(): Promise<WorkerHealthCheck> {
    const [database, redis, rabbitmq] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRabbitMQ(),
    ]);

    const services = { database, redis, rabbitmq };
    const status = this.determineOverallStatus(services);

    // Update calculated metrics
    this.metrics.processingRate = this.calculateProcessingRate();
    this.metrics.averageProcessingTime = this.calculateAverageProcessingTime();

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
      services,
      system: this.getSystemMetrics(),
      worker: { ...this.metrics },
    };
  }

  public async getLivenessCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadinessCheck(): Promise<{ status: string; ready: boolean; timestamp: string }> {
    const health = await this.getHealthCheck();
    const isReady = health.status === 'healthy' && 
                   health.services.rabbitmq.queueStatus?.isConsuming === true;
    
    return {
      status: health.status,
      ready: isReady,
      timestamp: new Date().toISOString(),
    };
  }

  // Worker-specific metrics tracking
  public startMessageProcessing(): void {
    this.processingStart = Date.now();
    this.metrics.isProcessing = true;
  }

  public finishMessageProcessing(success: boolean, error?: string): void {
    if (this.processingStart) {
      const processingTime = Date.now() - this.processingStart;
      this.processingTimes.push(processingTime);
      
      // Keep only last 1000 processing times for average calculation
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000);
      }
      
      this.processingStart = null;
    }

    this.metrics.messagesProcessed++;
    this.metrics.lastMessageProcessedAt = new Date().toISOString();
    this.metrics.isProcessing = false;

    if (success) {
      this.metrics.messagesSuccessful++;
    } else {
      this.metrics.messagesFailed++;
      if (error) {
        this.metrics.lastError = error;
        this.metrics.lastErrorAt = new Date().toISOString();
      }
    }
  }

  public incrementRetry(): void {
    this.metrics.messagesRetried++;
  }

  public getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  public updateQueueBacklog(count: number): void {
    this.metrics.queueBacklog = count;
  }
}

export default WorkerHealthService.getInstance();