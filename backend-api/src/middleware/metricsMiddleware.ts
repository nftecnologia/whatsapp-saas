import { Request, Response, NextFunction } from 'express';
import healthService from '@/services/healthService';
import metricsService from '@/services/metricsService';
import logger from '@/utils/logger';

interface MetricsData {
  totalRequests: number;
  totalErrors: number;
  responseTimes: number[];
  activeConnections: Set<string>;
}

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  company?: { id: string };
}

class MetricsMiddleware {
  private static instance: MetricsMiddleware;
  private metrics: MetricsData = {
    totalRequests: 0,
    totalErrors: 0,
    responseTimes: [],
    activeConnections: new Set(),
  };

  public static getInstance(): MetricsMiddleware {
    if (!MetricsMiddleware.instance) {
      MetricsMiddleware.instance = new MetricsMiddleware();
    }
    return MetricsMiddleware.instance;
  }

  public getMiddleware() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = `${Date.now()}-${Math.random()}`;
      
      // Track active connection
      this.metrics.activeConnections.add(requestId);
      healthService.updateActiveConnections(this.metrics.activeConnections.size);
      metricsService.setActiveConnections(this.metrics.activeConnections.size);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const responseTime = Date.now() - startTime;
        
        // Update internal metrics
        MetricsMiddleware.instance.metrics.totalRequests++;
        MetricsMiddleware.instance.metrics.responseTimes.push(responseTime);
        
        // Keep only last 1000 response times for average calculation
        if (MetricsMiddleware.instance.metrics.responseTimes.length > 1000) {
          MetricsMiddleware.instance.metrics.responseTimes = 
            MetricsMiddleware.instance.metrics.responseTimes.slice(-1000);
        }

        // Track errors (4xx and 5xx responses)
        if (res.statusCode >= 400) {
          MetricsMiddleware.instance.metrics.totalErrors++;
          
          // Record error in Prometheus metrics
          let errorType = 'client_error';
          let severity = 'medium';
          
          if (res.statusCode >= 500) {
            errorType = 'server_error';
            severity = 'high';
          }
          
          metricsService.recordError('http', 'api', severity as 'low' | 'medium' | 'high' | 'critical');
        }

        // Remove from active connections
        MetricsMiddleware.instance.metrics.activeConnections.delete(requestId);
        
        // Extract route information
        const route = req.route?.path || req.path || 'unknown';
        const method = req.method;
        const userId = req.user?.id;
        const companyId = req.company?.id;
        
        // Record metrics in Prometheus
        metricsService.recordHttpRequest(
          method,
          route,
          res.statusCode,
          responseTime,
          userId,
          companyId
        );
        
        // Update health service with latest metrics
        healthService.incrementRequests();
        healthService.updateActiveConnections(
          MetricsMiddleware.instance.metrics.activeConnections.size
        );
        healthService.updateErrorRate(
          MetricsMiddleware.instance.getErrorRate()
        );
        healthService.updateAverageResponseTime(
          MetricsMiddleware.instance.getAverageResponseTime()
        );

        // Log slow requests
        if (responseTime > 2000) {
          logger.logPerformance('http_request', responseTime, {
            method,
            route,
            statusCode: res.statusCode,
            userId,
            companyId,
          });
          
          metricsService.recordSlowQuery('http_request', responseTime);
        }

        // Call original end method
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  public getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      totalErrors: this.metrics.totalErrors,
      errorRate: this.getErrorRate(),
      averageResponseTime: this.getAverageResponseTime(),
      activeConnections: this.metrics.activeConnections.size,
      responseTimePercentiles: this.getResponseTimePercentiles(),
    };
  }

  private getErrorRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return (this.metrics.totalErrors / this.metrics.totalRequests) * 100;
  }

  private getAverageResponseTime(): number {
    if (this.metrics.responseTimes.length === 0) return 0;
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.responseTimes.length);
  }

  private getResponseTimePercentiles() {
    if (this.metrics.responseTimes.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.metrics.responseTimes].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      p50: sorted[Math.floor(length * 0.5)],
      p90: sorted[Math.floor(length * 0.9)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)],
    };
  }

  public reset() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      responseTimes: [],
      activeConnections: new Set(),
    };
  }
}

export default MetricsMiddleware.getInstance();