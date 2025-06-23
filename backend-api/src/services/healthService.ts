import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import os from 'os';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    rabbitmq: ServiceHealth;
  };
  system: SystemMetrics;
  application: ApplicationMetrics;
}

export interface ServiceHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  details?: string;
  lastChecked: string;
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
    usage?: number;
  };
  disk?: {
    free: number;
    total: number;
    usagePercentage: number;
  };
}

export interface ApplicationMetrics {
  totalRequests?: number;
  activeConnections?: number;
  errorRate?: number;
  averageResponseTime?: number;
  messagesProcessed?: number;
  lastMessageProcessedAt?: string;
}

class HealthService {
  private static instance: HealthService;
  private metrics: ApplicationMetrics = {};
  private startTime = Date.now();

  public static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
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

  private async checkRabbitMQ(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const channel = rabbitmq.getChannel();
      const responseTime = Date.now() - startTime;
      
      if (channel) {
        return {
          status: 'connected',
          responseTime,
          details: 'Channel available and ready',
          lastChecked: new Date().toISOString(),
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

  private determineOverallStatus(services: HealthCheck['services']): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(services).map(service => service.status);
    
    if (statuses.every(status => status === 'connected')) {
      return 'healthy';
    }
    
    if (statuses.some(status => status === 'connected')) {
      return 'degraded';
    }
    
    return 'unhealthy';
  }

  public async getHealthCheck(): Promise<HealthCheck> {
    const [database, redis, rabbitmq] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRabbitMQ(),
    ]);

    const services = { database, redis, rabbitmq };
    const status = this.determineOverallStatus(services);

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
      services,
      system: this.getSystemMetrics(),
      application: this.metrics,
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
    return {
      status: health.status,
      ready: health.status === 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  // Metrics tracking methods
  public incrementRequests(): void {
    this.metrics.totalRequests = (this.metrics.totalRequests || 0) + 1;
  }

  public updateActiveConnections(count: number): void {
    this.metrics.activeConnections = count;
  }

  public updateErrorRate(rate: number): void {
    this.metrics.errorRate = rate;
  }

  public updateAverageResponseTime(time: number): void {
    this.metrics.averageResponseTime = time;
  }

  public incrementMessagesProcessed(): void {
    this.metrics.messagesProcessed = (this.metrics.messagesProcessed || 0) + 1;
    this.metrics.lastMessageProcessedAt = new Date().toISOString();
  }

  public getMetrics(): ApplicationMetrics {
    return { ...this.metrics };
  }
}

export default HealthService.getInstance();