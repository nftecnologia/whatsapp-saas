import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

interface LogMeta {
  requestId?: string;
  userId?: string;
  companyId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

class AppLogger {
  private logger: Logger;
  private static instance: AppLogger;

  constructor() {
    this.logger = this.createLogger();
  }

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  private createLogger(): Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Custom format for structured logging
    const structuredFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      format.metadata({
        fillExcept: ['message', 'level', 'timestamp'],
      }),
      format.json()
    );

    // Console format for development
    const consoleFormat = format.combine(
      format.colorize(),
      format.timestamp({ format: 'HH:mm:ss.SSS' }),
      format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
      })
    );

    const loggerTransports: any[] = [];

    // Console transport for development
    if (isDevelopment) {
      loggerTransports.push(
        new transports.Console({
          format: consoleFormat,
          level: logLevel,
        })
      );
    }

    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      // Error logs
      loggerTransports.push(
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          format: structuredFormat,
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true,
        })
      );

      // Combined logs
      loggerTransports.push(
        new DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          format: structuredFormat,
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true,
        })
      );

      // Access logs (HTTP requests)
      loggerTransports.push(
        new DailyRotateFile({
          filename: 'logs/access-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'http',
          format: structuredFormat,
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true,
        })
      );
    }

    return createLogger({
      level: logLevel,
      format: structuredFormat,
      transports: loggerTransports,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true,
    });
  }

  // Core logging methods
  public error(message: string, meta: LogMeta = {}): void {
    this.logger.error(message, meta);
  }

  public warn(message: string, meta: LogMeta = {}): void {
    this.logger.warn(message, meta);
  }

  public info(message: string, meta: LogMeta = {}): void {
    this.logger.info(message, meta);
  }

  public debug(message: string, meta: LogMeta = {}): void {
    this.logger.debug(message, meta);
  }

  public http(message: string, meta: LogMeta = {}): void {
    this.logger.http(message, meta);
  }

  // Specialized logging methods
  public logRequest(req: any, res: any, responseTime: number): void {
    const meta: LogMeta = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      companyId: req.company?.id,
      contentLength: res.get('content-length'),
      referer: req.get('Referer'),
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`;
    
    if (res.statusCode >= 400) {
      this.error(`HTTP ${message}`, meta);
    } else {
      this.http(message, meta);
    }
  }

  public logDatabaseQuery(query: string, params: any[], duration: number, error?: Error): void {
    const meta = {
      query: query.substring(0, 1000), // Truncate long queries
      params: params.length > 0 ? params : undefined,
      duration,
      error: error?.message,
    };

    if (error) {
      this.error(`Database query failed: ${error.message}`, meta);
    } else {
      this.debug(`Database query executed in ${duration}ms`, meta);
    }
  }

  public logRedisOperation(operation: string, key: string, duration: number, error?: Error): void {
    const meta = {
      operation,
      key,
      duration,
      error: error?.message,
    };

    if (error) {
      this.error(`Redis ${operation} failed: ${error.message}`, meta);
    } else {
      this.debug(`Redis ${operation} completed in ${duration}ms`, meta);
    }
  }

  public logRabbitMQOperation(operation: string, queue: string, messageId?: string, error?: Error): void {
    const meta = {
      operation,
      queue,
      messageId,
      error: error?.message,
    };

    if (error) {
      this.error(`RabbitMQ ${operation} failed: ${error.message}`, meta);
    } else {
      this.info(`RabbitMQ ${operation} completed`, meta);
    }
  }

  public logMessageProcessing(
    messageId: string, 
    contactPhone: string, 
    campaignId: string, 
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    error?: Error
  ): void {
    const meta = {
      messageId,
      contactPhone,
      campaignId,
      duration,
      error: error?.message,
    };

    switch (status) {
      case 'started':
        this.info(`Message processing started`, meta);
        break;
      case 'completed':
        this.info(`Message processing completed in ${duration}ms`, meta);
        break;
      case 'failed':
        this.error(`Message processing failed: ${error?.message}`, meta);
        break;
    }
  }

  public logEvolutionApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    messageId?: string,
    error?: Error
  ): void {
    const meta = {
      endpoint,
      method,
      statusCode,
      duration,
      messageId,
      error: error?.message,
    };

    if (error || statusCode >= 400) {
      this.error(`Evolution API call failed: ${endpoint}`, meta);
    } else {
      this.info(`Evolution API call completed: ${endpoint}`, meta);
    }
  }

  public logAuth(
    action: 'login' | 'logout' | 'register' | 'refresh',
    userId?: string,
    email?: string,
    success: boolean = true,
    error?: string
  ): void {
    const meta = {
      action,
      userId,
      email,
      success,
      error,
    };

    if (success) {
      this.info(`Auth ${action} successful`, meta);
    } else {
      this.warn(`Auth ${action} failed: ${error}`, meta);
    }
  }

  public logSecurity(
    event: 'rate_limit_exceeded' | 'invalid_token' | 'unauthorized_access' | 'suspicious_activity',
    details: LogMeta
  ): void {
    this.warn(`Security event: ${event}`, {
      securityEvent: event,
      ...details,
    });
  }

  public logBusinessMetric(
    metric: string,
    value: number,
    unit: string = 'count',
    tags: Record<string, string> = {}
  ): void {
    const meta = {
      metric,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString(),
    };

    this.info(`Business metric: ${metric}`, meta);
  }

  // Performance monitoring
  public logPerformance(
    operation: string,
    duration: number,
    metadata: LogMeta = {}
  ): void {
    const meta = {
      operation,
      duration,
      performance: true,
      ...metadata,
    };

    if (duration > 5000) { // Slow operations (>5s)
      this.warn(`Slow operation detected: ${operation} took ${duration}ms`, meta);
    } else if (duration > 1000) { // Moderate operations (>1s)
      this.info(`Operation completed: ${operation} took ${duration}ms`, meta);
    } else {
      this.debug(`Operation completed: ${operation} took ${duration}ms`, meta);
    }
  }

  // Health check logging
  public logHealthCheck(
    service: string,
    status: 'healthy' | 'unhealthy' | 'degraded',
    responseTime: number,
    details?: any
  ): void {
    const meta = {
      service,
      status,
      responseTime,
      details,
      healthCheck: true,
    };

    if (status === 'unhealthy') {
      this.error(`Health check failed for ${service}`, meta);
    } else if (status === 'degraded') {
      this.warn(`Health check degraded for ${service}`, meta);
    } else {
      this.debug(`Health check passed for ${service}`, meta);
    }
  }

  // Create child logger with context
  public child(meta: LogMeta): AppLogger {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(meta);
    return childLogger;
  }

  // Get raw winston logger (for advanced usage)
  public getLogger(): Logger {
    return this.logger;
  }
}

// Export singleton instance
export default AppLogger.getInstance();

// Export types
export type { LogMeta };