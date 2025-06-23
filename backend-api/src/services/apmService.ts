import logger from '@/utils/logger';
import metricsService from './metricsService';
import { EventEmitter } from 'events';

export interface Trace {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string>;
  status: 'started' | 'completed' | 'error';
  parentId?: string;
  children: Trace[];
  metadata: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
}

export interface TransactionSummary {
  name: string;
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorRate: number;
  throughput: number; // requests per second
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface APMStatus {
  enabled: boolean;
  activeTraces: number;
  completedTraces: number;
  erroredTraces: number;
  averageResponseTime: number;
  transactionSummaries: TransactionSummary[];
  slowestTransactions: Array<{
    name: string;
    duration: number;
    timestamp: number;
  }>;
  errorSummary: {
    total: number;
    byType: Record<string, number>;
    recent: Array<{
      message: string;
      timestamp: number;
      trace?: string;
    }>;
  };
}

class APMService extends EventEmitter {
  private static instance: APMService;
  private traces: Map<string, Trace> = new Map();
  private completedTraces: Trace[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private transactionStats: Map<string, {
    durations: number[];
    errors: number;
    count: number;
  }> = new Map();
  private enabled = true;
  private maxTracesInMemory = 10000;
  private maxMetricsInMemory = 50000;

  constructor() {
    super();
    this.startPeriodicCleanup();
  }

  public static getInstance(): APMService {
    if (!APMService.instance) {
      APMService.instance = new APMService();
    }
    return APMService.instance;
  }

  // Trace management
  public startTrace(name: string, tags: Record<string, string> = {}, parentId?: string): string {
    if (!this.enabled) return '';

    const trace: Trace = {
      id: this.generateTraceId(),
      name,
      startTime: Date.now(),
      tags,
      status: 'started',
      parentId,
      children: [],
      metadata: {},
    };

    this.traces.set(trace.id, trace);

    // Add to parent if specified
    if (parentId && this.traces.has(parentId)) {
      const parent = this.traces.get(parentId)!;
      parent.children.push(trace);
    }

    logger.debug('Trace started', {
      traceId: trace.id,
      name: trace.name,
      parentId: trace.parentId,
      tags: trace.tags,
    });

    this.emit('trace:started', trace);
    return trace.id;
  }

  public finishTrace(traceId: string, error?: Error): void {
    if (!this.enabled || !traceId) return;

    const trace = this.traces.get(traceId);
    if (!trace) {
      logger.warn('Attempted to finish non-existent trace', { traceId });
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = error ? 'error' : 'completed';

    if (error) {
      trace.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    // Record transaction statistics
    this.recordTransactionStats(trace.name, trace.duration, !!error);

    // Record performance metrics
    this.recordPerformanceMetric('transaction_duration', trace.duration, 'ms', {
      transaction: trace.name,
      status: trace.status,
      ...trace.tags,
    });

    // Move to completed traces
    this.completedTraces.push(trace);
    this.traces.delete(traceId);

    // Limit memory usage
    if (this.completedTraces.length > this.maxTracesInMemory) {
      this.completedTraces = this.completedTraces.slice(-this.maxTracesInMemory);
    }

    // Log slow traces
    if (trace.duration > 2000) {
      logger.warn('Slow transaction detected', {
        traceId: trace.id,
        name: trace.name,
        duration: trace.duration,
        tags: trace.tags,
      });
    }

    // Record in Prometheus metrics
    metricsService.recordHttpRequest(
      trace.tags.method || 'UNKNOWN',
      trace.tags.endpoint || trace.name,
      error ? 500 : 200,
      trace.duration,
      trace.tags.userId,
      trace.tags.companyId
    );

    if (error) {
      metricsService.recordError('http', 'transaction', 'high');
    }

    logger.debug('Trace finished', {
      traceId: trace.id,
      name: trace.name,
      duration: trace.duration,
      status: trace.status,
    });

    this.emit('trace:finished', trace);
  }

  public addTraceTag(traceId: string, key: string, value: string): void {
    if (!this.enabled || !traceId) return;

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.tags[key] = value;
    }
  }

  public addTraceMetadata(traceId: string, key: string, value: any): void {
    if (!this.enabled || !traceId) return;

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.metadata[key] = value;
    }
  }

  // Performance metrics
  public recordPerformanceMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {}
  ): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    this.performanceMetrics.push(metric);

    // Limit memory usage
    if (this.performanceMetrics.length > this.maxMetricsInMemory) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsInMemory);
    }

    logger.debug('Performance metric recorded', {
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      tags: metric.tags,
    });

    this.emit('metric:recorded', metric);
  }

  // Database query tracing
  public traceDbQuery(query: string, params: any[] = []): {
    finish: (error?: Error, result?: any) => void;
  } {
    if (!this.enabled) {
      return { finish: () => {} };
    }

    const traceId = this.startTrace('db_query', {
      operation: 'database',
      query: query.substring(0, 100), // Truncate long queries
    });

    this.addTraceMetadata(traceId, 'fullQuery', query);
    this.addTraceMetadata(traceId, 'params', params);

    return {
      finish: (error?: Error, result?: any) => {
        if (result) {
          this.addTraceMetadata(traceId, 'rowCount', result.rowCount || result.length);
        }
        this.finishTrace(traceId, error);
      },
    };
  }

  // HTTP request tracing
  public traceHttpRequest(req: any): {
    finish: (res: any, error?: Error) => void;
  } {
    if (!this.enabled) {
      return { finish: () => {} };
    }

    const traceId = this.startTrace('http_request', {
      method: req.method,
      endpoint: req.route?.path || req.path,
      userAgent: req.get('User-Agent') || 'unknown',
    });

    this.addTraceMetadata(traceId, 'headers', req.headers);
    this.addTraceMetadata(traceId, 'query', req.query);
    this.addTraceMetadata(traceId, 'body', req.body);

    if (req.user) {
      this.addTraceTag(traceId, 'userId', req.user.id);
    }
    if (req.company) {
      this.addTraceTag(traceId, 'companyId', req.company.id);
    }

    return {
      finish: (res: any, error?: Error) => {
        this.addTraceTag(traceId, 'statusCode', res.statusCode?.toString() || '500');
        this.addTraceMetadata(traceId, 'responseHeaders', res.getHeaders());
        this.finishTrace(traceId, error);
      },
    };
  }

  // External API call tracing
  public traceExternalCall(
    service: string,
    method: string,
    url: string
  ): {
    finish: (statusCode: number, error?: Error) => void;
  } {
    if (!this.enabled) {
      return { finish: () => {} };
    }

    const traceId = this.startTrace('external_api_call', {
      service,
      method,
      url,
    });

    return {
      finish: (statusCode: number, error?: Error) => {
        this.addTraceTag(traceId, 'statusCode', statusCode.toString());
        this.finishTrace(traceId, error);
      },
    };
  }

  // RabbitMQ operation tracing
  public traceRabbitMQOperation(
    operation: string,
    queue: string,
    messageId?: string
  ): {
    finish: (error?: Error) => void;
  } {
    if (!this.enabled) {
      return { finish: () => {} };
    }

    const traceId = this.startTrace('rabbitmq_operation', {
      operation,
      queue,
      service: 'rabbitmq',
    });

    if (messageId) {
      this.addTraceTag(traceId, 'messageId', messageId);
    }

    return {
      finish: (error?: Error) => {
        this.finishTrace(traceId, error);
      },
    };
  }

  // Redis operation tracing
  public traceRedisOperation(operation: string, key: string): {
    finish: (error?: Error) => void;
  } {
    if (!this.enabled) {
      return { finish: () => {} };
    }

    const traceId = this.startTrace('redis_operation', {
      operation,
      key,
      service: 'redis',
    });

    return {
      finish: (error?: Error) => {
        this.finishTrace(traceId, error);
      },
    };
  }

  // Statistics and analysis
  private recordTransactionStats(name: string, duration: number, isError: boolean): void {
    if (!this.transactionStats.has(name)) {
      this.transactionStats.set(name, {
        durations: [],
        errors: 0,
        count: 0,
      });
    }

    const stats = this.transactionStats.get(name)!;
    stats.durations.push(duration);
    stats.count++;

    if (isError) {
      stats.errors++;
    }

    // Keep only last 1000 durations for each transaction
    if (stats.durations.length > 1000) {
      stats.durations = stats.durations.slice(-1000);
    }
  }

  public getTransactionSummaries(): TransactionSummary[] {
    const summaries: TransactionSummary[] = [];

    for (const [name, stats] of this.transactionStats) {
      if (stats.durations.length === 0) continue;

      const sorted = [...stats.durations].sort((a, b) => a - b);
      const count = stats.count;
      const avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;
      const minDuration = Math.min(...stats.durations);
      const maxDuration = Math.max(...stats.durations);
      const errorRate = (stats.errors / count) * 100;
      const throughput = count / ((Date.now() - (Date.now() - 3600000)) / 1000); // Last hour

      summaries.push({
        name,
        count,
        avgDuration: Math.round(avgDuration),
        minDuration,
        maxDuration,
        errorRate: Math.round(errorRate * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
        percentiles: {
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p90: sorted[Math.floor(sorted.length * 0.9)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)],
        },
      });
    }

    return summaries.sort((a, b) => b.count - a.count);
  }

  public getAPMStatus(): APMStatus {
    const completedWithErrors = this.completedTraces.filter(t => t.status === 'error');
    const recentErrors = completedWithErrors
      .slice(-10)
      .map(t => ({
        message: t.error?.message || 'Unknown error',
        timestamp: t.endTime || t.startTime,
        trace: t.id,
      }));

    const errorsByType: Record<string, number> = {};
    completedWithErrors.forEach(t => {
      const errorType = t.error?.code || 'unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    const slowestTransactions = this.completedTraces
      .filter(t => t.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(t => ({
        name: t.name,
        duration: t.duration!,
        timestamp: t.endTime || t.startTime,
      }));

    const totalDuration = this.completedTraces
      .filter(t => t.duration !== undefined)
      .reduce((sum, t) => sum + (t.duration || 0), 0);
    const avgResponseTime = this.completedTraces.length > 0 ? 
      totalDuration / this.completedTraces.length : 0;

    return {
      enabled: this.enabled,
      activeTraces: this.traces.size,
      completedTraces: this.completedTraces.length,
      erroredTraces: completedWithErrors.length,
      averageResponseTime: Math.round(avgResponseTime),
      transactionSummaries: this.getTransactionSummaries(),
      slowestTransactions,
      errorSummary: {
        total: completedWithErrors.length,
        byType: errorsByType,
        recent: recentErrors,
      },
    };
  }

  // Utility methods
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicCleanup(): void {
    // Clean up old data every 5 minutes
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour

    // Clean up old completed traces
    this.completedTraces = this.completedTraces.filter(
      t => (t.endTime || t.startTime) > oneHourAgo
    );

    // Clean up old performance metrics
    this.performanceMetrics = this.performanceMetrics.filter(
      m => m.timestamp > oneHourAgo
    );

    // Clean up old transaction stats
    for (const [name, stats] of this.transactionStats) {
      if (stats.count === 0) {
        this.transactionStats.delete(name);
      }
    }

    logger.debug('APM data cleanup completed', {
      completedTraces: this.completedTraces.length,
      performanceMetrics: this.performanceMetrics.length,
      transactionStats: this.transactionStats.size,
    });
  }

  // Control methods
  public enable(): void {
    this.enabled = true;
    logger.info('APM service enabled');
  }

  public disable(): void {
    this.enabled = false;
    logger.info('APM service disabled');
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clear(): void {
    this.traces.clear();
    this.completedTraces = [];
    this.performanceMetrics = [];
    this.transactionStats.clear();
    logger.info('APM data cleared');
  }

  // Export/import for analysis
  public exportTraces(limit?: number): Trace[] {
    const traces = limit ? this.completedTraces.slice(-limit) : this.completedTraces;
    return traces.map(t => ({ ...t })); // Deep copy
  }

  public exportMetrics(limit?: number): PerformanceMetric[] {
    const metrics = limit ? this.performanceMetrics.slice(-limit) : this.performanceMetrics;
    return metrics.map(m => ({ ...m })); // Deep copy
  }
}

export default APMService.getInstance();