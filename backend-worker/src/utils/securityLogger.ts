import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Security event types for worker service
export enum WorkerSecurityEventType {
  // Message processing events
  MESSAGE_PROCESSED = 'worker.message.processed',
  MESSAGE_FAILED = 'worker.message.failed',
  MESSAGE_RETRY = 'worker.message.retry',
  MESSAGE_DEAD_LETTER = 'worker.message.dead_letter',
  
  // API security events
  API_AUTHENTICATION_FAILED = 'worker.api.auth.failed',
  API_RATE_LIMITED = 'worker.api.rate_limited',
  API_SUSPICIOUS_REQUEST = 'worker.api.suspicious',
  
  // Data validation events
  INVALID_PHONE_NUMBER = 'worker.validation.phone.invalid',
  SUSPICIOUS_MESSAGE_CONTENT = 'worker.validation.message.suspicious',
  MALFORMED_PAYLOAD = 'worker.validation.payload.malformed',
  
  // System security events
  UNAUTHORIZED_ACCESS_ATTEMPT = 'worker.security.unauthorized',
  SUSPICIOUS_ACTIVITY = 'worker.security.suspicious',
  CONFIGURATION_ERROR = 'worker.security.config.error',
  
  // External API events
  EVOLUTION_API_ERROR = 'worker.evolution.error',
  EVOLUTION_API_TIMEOUT = 'worker.evolution.timeout',
  EVOLUTION_API_INVALID_RESPONSE = 'worker.evolution.invalid_response',
}

// Security log levels
export enum SecurityLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Security log entry interface
interface SecurityLogEntry {
  timestamp: string;
  eventType: WorkerSecurityEventType;
  level: SecurityLogLevel;
  workerId: string;
  messageId?: string;
  campaignId?: string;
  contactId?: string;
  phone?: string;
  details: Record<string, any>;
  duration?: number;
  errorCode?: string;
  retryCount?: number;
  riskScore: number;
}

class WorkerSecurityLogger {
  private static instance: WorkerSecurityLogger;
  private workerId: string;
  private logsDir: string;

  private constructor() {
    this.workerId = this.generateWorkerId();
    this.logsDir = process.env.WORKER_LOGS_DIR || './worker-security-logs';
    this.ensureLogDirectory();
  }

  public static getInstance(): WorkerSecurityLogger {
    if (!WorkerSecurityLogger.instance) {
      WorkerSecurityLogger.instance = new WorkerSecurityLogger();
    }
    return WorkerSecurityLogger.instance;
  }

  private generateWorkerId(): string {
    const hostname = process.env.HOSTNAME || 'unknown';
    const pid = process.pid;
    const randomId = crypto.randomBytes(4).toString('hex');
    return `worker-${hostname}-${pid}-${randomId}`;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  // Main logging method
  public log(
    eventType: WorkerSecurityEventType,
    level: SecurityLogLevel,
    details: Record<string, any>,
    options: {
      messageId?: string;
      campaignId?: string;
      contactId?: string;
      phone?: string;
      duration?: number;
      errorCode?: string;
      retryCount?: number;
    } = {}
  ): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      level,
      workerId: this.workerId,
      messageId: options.messageId,
      campaignId: options.campaignId,
      contactId: options.contactId,
      phone: this.sanitizePhoneNumber(options.phone),
      details: this.sanitizeDetails(details),
      duration: options.duration,
      errorCode: options.errorCode,
      retryCount: options.retryCount,
      riskScore: this.calculateRiskScore(eventType, details, options),
    };

    this.writeLogEntry(entry);
    this.consoleLog(entry);

    // Handle critical events
    if (level === SecurityLogLevel.CRITICAL) {
      this.handleCriticalEvent(entry);
    }
  }

  // Convenience methods for different event types
  public logMessageProcessing(
    messageId: string,
    campaignId: string,
    contactId: string,
    phone: string,
    success: boolean,
    duration: number,
    details: Record<string, any> = {}
  ): void {
    const eventType = success 
      ? WorkerSecurityEventType.MESSAGE_PROCESSED 
      : WorkerSecurityEventType.MESSAGE_FAILED;
    
    const level = success ? SecurityLogLevel.INFO : SecurityLogLevel.WARN;

    this.log(eventType, level, {
      success,
      evolutionApiResponse: this.sanitizeApiResponse(details.evolutionApiResponse),
      error: details.error,
    }, {
      messageId,
      campaignId,
      contactId,
      phone,
      duration,
    });
  }

  public logMessageRetry(
    messageId: string,
    campaignId: string,
    contactId: string,
    phone: string,
    retryCount: number,
    error: string,
    nextRetryAt?: Date
  ): void {
    this.log(WorkerSecurityEventType.MESSAGE_RETRY, SecurityLogLevel.WARN, {
      error: this.sanitizeErrorMessage(error),
      nextRetryAt: nextRetryAt?.toISOString(),
      maxRetries: process.env.MAX_RETRY_ATTEMPTS || 3,
    }, {
      messageId,
      campaignId,
      contactId,
      phone,
      retryCount,
    });
  }

  public logDeadLetter(
    messageId: string,
    campaignId: string,
    contactId: string,
    phone: string,
    finalError: string,
    totalRetries: number
  ): void {
    this.log(WorkerSecurityEventType.MESSAGE_DEAD_LETTER, SecurityLogLevel.ERROR, {
      finalError: this.sanitizeErrorMessage(finalError),
      totalRetries,
      deadLetterReason: 'Max retries exceeded',
    }, {
      messageId,
      campaignId,
      contactId,
      phone,
      retryCount: totalRetries,
    });
  }

  public logApiError(
    eventType: WorkerSecurityEventType,
    error: any,
    requestDetails: Record<string, any> = {}
  ): void {
    this.log(eventType, SecurityLogLevel.ERROR, {
      error: this.sanitizeErrorMessage(error.message || error),
      statusCode: error.response?.status,
      apiUrl: this.sanitizeUrl(error.config?.url),
      requestMethod: error.config?.method?.toUpperCase(),
      requestDetails: this.sanitizeDetails(requestDetails),
    });
  }

  public logSuspiciousActivity(
    eventType: WorkerSecurityEventType,
    details: Record<string, any>,
    messageId?: string
  ): void {
    this.log(eventType, SecurityLogLevel.WARN, {
      suspiciousIndicators: details.indicators || [],
      detectionMethod: details.method || 'pattern_matching',
      ...this.sanitizeDetails(details),
    }, {
      messageId,
    });
  }

  public logValidationError(
    eventType: WorkerSecurityEventType,
    validationError: string,
    input: any,
    messageId?: string
  ): void {
    this.log(eventType, SecurityLogLevel.WARN, {
      validationError,
      inputType: typeof input,
      inputSample: this.sanitizeInput(input),
    }, {
      messageId,
    });
  }

  // Private utility methods
  private calculateRiskScore(
    eventType: WorkerSecurityEventType,
    details: Record<string, any>,
    options: any
  ): number {
    let score = 0;

    // High risk events
    const highRiskEvents = [
      WorkerSecurityEventType.API_AUTHENTICATION_FAILED,
      WorkerSecurityEventType.API_SUSPICIOUS_REQUEST,
      WorkerSecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      WorkerSecurityEventType.SUSPICIOUS_ACTIVITY,
      WorkerSecurityEventType.SUSPICIOUS_MESSAGE_CONTENT,
    ];

    if (highRiskEvents.includes(eventType)) {
      score += 30;
    }

    // Failed operations
    if (eventType.includes('failed') || eventType.includes('error')) {
      score += 20;
    }

    // Retry events
    if (options.retryCount && options.retryCount > 1) {
      score += 10 * options.retryCount;
    }

    // Dead letter events
    if (eventType === WorkerSecurityEventType.MESSAGE_DEAD_LETTER) {
      score += 40;
    }

    // Malformed data
    if (eventType === WorkerSecurityEventType.MALFORMED_PAYLOAD) {
      score += 25;
    }

    return Math.min(score, 100); // Cap at 100
  }

  private sanitizePhoneNumber(phone?: string): string | undefined {
    if (!phone) return undefined;
    // Keep only first 3 and last 3 digits for logging
    if (phone.length > 6) {
      return phone.substring(0, 3) + '***' + phone.substring(phone.length - 3);
    }
    return phone;
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'api_key',
      'authorization', 'x-api-key', 'bearer'
    ];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }

  private sanitizeErrorMessage(error: string): string {
    if (!error || typeof error !== 'string') {
      return 'Unknown error';
    }
    
    // Remove sensitive information from error messages
    return error
      .replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer ***')
      .replace(/api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_-]+/gi, 'api_key: ***')
      .replace(/password["']?\s*[:=]\s*["']?\w+/gi, 'password: ***')
      .replace(/secret["']?\s*[:=]\s*["']?\w+/gi, 'secret: ***')
      .substring(0, 500); // Limit error message length
  }

  private sanitizeUrl(url?: string): string | undefined {
    if (!url) return undefined;
    
    try {
      const urlObj = new URL(url);
      // Remove query parameters and keep only path
      return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
      return 'invalid_url';
    }
  }

  private sanitizeApiResponse(response: any): any {
    if (!response) return response;
    
    const sanitized = { ...response };
    
    // Remove potential sensitive data from API responses
    delete sanitized.key;
    delete sanitized.token;
    delete sanitized.auth;
    
    return sanitized;
  }

  private sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Return first 50 characters for logging
      return input.substring(0, 50) + (input.length > 50 ? '...' : '');
    }
    
    if (typeof input === 'object') {
      return this.sanitizeDetails(input);
    }
    
    return input;
  }

  private writeLogEntry(entry: SecurityLogEntry): void {
    const logFile = path.join(
      this.logsDir,
      `worker-security-${new Date().toISOString().split('T')[0]}.log`
    );
    
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  private consoleLog(entry: SecurityLogEntry): void {
    const logMessage = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.eventType} (Risk: ${entry.riskScore})`;
    
    switch (entry.level) {
      case SecurityLogLevel.ERROR:
      case SecurityLogLevel.CRITICAL:
        console.error(logMessage, entry.details);
        break;
      case SecurityLogLevel.WARN:
        console.warn(logMessage, entry.details);
        break;
      default:
        console.log(logMessage, entry.details);
    }
  }

  private handleCriticalEvent(entry: SecurityLogEntry): void {
    console.error('🚨 CRITICAL WORKER SECURITY EVENT:', entry);
    
    // In production, you might want to:
    // - Send alerts to monitoring systems
    // - Notify security team
    // - Trigger automated responses
    // - Temporarily stop the worker
  }

  // Public utility methods
  public getWorkerId(): string {
    return this.workerId;
  }

  public getLogsSummary(hours: number = 24): Record<string, number> {
    // This would typically query a proper logging system
    // For now, return a placeholder
    return {
      totalEvents: 0,
      errorEvents: 0,
      warningEvents: 0,
      criticalEvents: 0,
      avgRiskScore: 0,
    };
  }
}

// Export singleton instance
export const workerSecurityLogger = WorkerSecurityLogger.getInstance();
// Temporarily commented to fix duplicate export error
// export { SecurityLogLevel };
export default workerSecurityLogger;