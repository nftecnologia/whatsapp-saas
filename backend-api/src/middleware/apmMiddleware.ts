import { Request, Response, NextFunction } from 'express';
import apmService from '@/services/apmService';
import logger from '@/utils/logger';

interface TracedRequest extends Request {
  traceId?: string;
  apmTrace?: {
    finish: (res: any, error?: Error) => void;
  };
}

interface TracedResponse extends Response {
  traceId?: string;
}

class APMMiddleware {
  private static instance: APMMiddleware;

  public static getInstance(): APMMiddleware {
    if (!APMMiddleware.instance) {
      APMMiddleware.instance = new APMMiddleware();
    }
    return APMMiddleware.instance;
  }

  public getMiddleware() {
    return (req: TracedRequest, res: TracedResponse, next: NextFunction) => {
      if (!apmService.isEnabled()) {
        return next();
      }

      // Start HTTP request trace
      const trace = apmService.traceHttpRequest(req);
      req.apmTrace = trace;

      // Add trace ID to request and response for correlation
      const traceId = `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.traceId = traceId;
      res.traceId = traceId;

      // Add trace ID to response headers for debugging
      res.setHeader('X-Trace-ID', traceId);

      // Override res.end to capture response data
      const originalEnd = res.end;
      const originalSend = res.send;
      const originalJson = res.json;

      let responseBody: any;
      let responseSize = 0;

      // Capture response body and size
      res.send = function(this: Response, body?: any) {
        responseBody = body;
        responseSize = Buffer.isBuffer(body) ? body.length : 
                      typeof body === 'string' ? Buffer.byteLength(body) : 
                      JSON.stringify(body || '').length;
        return originalSend.call(this, body);
      };

      res.json = function(this: Response, obj?: any) {
        responseBody = obj;
        responseSize = JSON.stringify(obj || '').length;
        return originalJson.call(this, obj);
      };

      res.end = function(this: Response, ...args: any[]) {
        try {
          // Finish the trace
          if (req.apmTrace) {
            req.apmTrace.finish(res);
          }

          // Log additional APM data
          const duration = Date.now() - parseInt(traceId.split('_')[1]);
          
          apmService.recordPerformanceMetric('response_size', responseSize, 'bytes', {
            method: req.method,
            endpoint: req.route?.path || req.path,
            statusCode: res.statusCode.toString(),
          });

          // Record slow response times
          if (duration > 1000) {
            apmService.recordPerformanceMetric('slow_response', duration, 'ms', {
              method: req.method,
              endpoint: req.route?.path || req.path,
              statusCode: res.statusCode.toString(),
              severity: duration > 5000 ? 'critical' : duration > 3000 ? 'high' : 'medium',
            });
          }

          // Record error responses
          if (res.statusCode >= 400) {
            apmService.recordPerformanceMetric('error_response', 1, 'count', {
              method: req.method,
              endpoint: req.route?.path || req.path,
              statusCode: res.statusCode.toString(),
              errorType: res.statusCode >= 500 ? 'server_error' : 'client_error',
            });
          }

        } catch (error) {
          logger.error('Error in APM middleware cleanup', {
            error: error instanceof Error ? error.message : 'Unknown error',
            traceId: req.traceId,
          });
        }

        // Call original end method
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  // Middleware for tracing database operations
  public getDatabaseMiddleware() {
    return {
      query: (originalQuery: Function) => {
        return function(this: any, text: string, params?: any[], callback?: Function) {
          if (!apmService.isEnabled()) {
            return originalQuery.call(this, text, params, callback);
          }

          const trace = apmService.traceDbQuery(text, params || []);
          const startTime = Date.now();

          // Handle callback-style queries
          if (typeof callback === 'function') {
            const originalCallback = callback;
            callback = (error: Error | null, result?: any) => {
              trace.finish(error || undefined, result);
              originalCallback(error, result);
            };
          }

          // Handle promise-style queries
          const result = originalQuery.call(this, text, params, callback);
          
          if (result && typeof result.then === 'function') {
            return result
              .then((queryResult: any) => {
                trace.finish(undefined, queryResult);
                return queryResult;
              })
              .catch((error: Error) => {
                trace.finish(error);
                throw error;
              });
          }

          return result;
        };
      },
    };
  }

  // Middleware for tracing Redis operations
  public getRedisMiddleware() {
    return {
      command: (originalCommand: Function, operation: string) => {
        return function(this: any, ...args: any[]) {
          if (!apmService.isEnabled()) {
            return originalCommand.apply(this, args);
          }

          const key = args[0] || 'unknown';
          const trace = apmService.traceRedisOperation(operation, key);

          const result = originalCommand.apply(this, args);

          if (result && typeof result.then === 'function') {
            return result
              .then((redisResult: any) => {
                trace.finish();
                return redisResult;
              })
              .catch((error: Error) => {
                trace.finish(error);
                throw error;
              });
          }

          trace.finish();
          return result;
        };
      },
    };
  }

  // Middleware for tracing RabbitMQ operations
  public getRabbitMQMiddleware() {
    return {
      publish: (originalPublish: Function) => {
        return function(this: any, exchange: string, routingKey: string, content: Buffer, options?: any) {
          if (!apmService.isEnabled()) {
            return originalPublish.call(this, exchange, routingKey, content, options);
          }

          const messageId = options?.messageId || `msg_${Date.now()}`;
          const trace = apmService.traceRabbitMQOperation('publish', routingKey, messageId);

          try {
            const result = originalPublish.call(this, exchange, routingKey, content, options);
            trace.finish();
            return result;
          } catch (error) {
            trace.finish(error as Error);
            throw error;
          }
        };
      },

      consume: (originalConsume: Function) => {
        return function(this: any, queue: string, callback: Function, options?: any) {
          if (!apmService.isEnabled()) {
            return originalConsume.call(this, queue, callback, options);
          }

          const wrappedCallback = (msg: any) => {
            const messageId = msg?.properties?.messageId || `msg_${Date.now()}`;
            const trace = apmService.traceRabbitMQOperation('consume', queue, messageId);

            try {
              const result = callback(msg);
              
              if (result && typeof result.then === 'function') {
                return result
                  .then((consumeResult: any) => {
                    trace.finish();
                    return consumeResult;
                  })
                  .catch((error: Error) => {
                    trace.finish(error);
                    throw error;
                  });
              }

              trace.finish();
              return result;
            } catch (error) {
              trace.finish(error as Error);
              throw error;
            }
          };

          return originalConsume.call(this, queue, wrappedCallback, options);
        };
      },
    };
  }

  // Middleware for tracing external API calls
  public getAxiosMiddleware() {
    return {
      request: (config: any) => {
        if (!apmService.isEnabled()) {
          return config;
        }

        const service = this.extractServiceName(config.url || '');
        const trace = apmService.traceExternalCall(
          service,
          config.method?.toUpperCase() || 'GET',
          config.url || 'unknown'
        );

        config.metadata = config.metadata || {};
        config.metadata.apmTrace = trace;
        config.metadata.startTime = Date.now();

        return config;
      },

      response: (response: any) => {
        if (!apmService.isEnabled()) {
          return response;
        }

        const trace = response.config?.metadata?.apmTrace;
        if (trace) {
          trace.finish(response.status);
          
          // Record additional metrics
          const duration = Date.now() - (response.config.metadata.startTime || Date.now());
          apmService.recordPerformanceMetric('external_api_duration', duration, 'ms', {
            service: this.extractServiceName(response.config.url || ''),
            method: response.config.method?.toUpperCase() || 'GET',
            statusCode: response.status.toString(),
          });
        }

        return response;
      },

      error: (error: any) => {
        if (!apmService.isEnabled()) {
          return Promise.reject(error);
        }

        const trace = error.config?.metadata?.apmTrace;
        if (trace) {
          const statusCode = error.response?.status || 0;
          trace.finish(statusCode, error);
        }

        return Promise.reject(error);
      },
    };
  }

  private extractServiceName(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Extract service name from hostname
      if (hostname.includes('evolution-api')) return 'evolution-api';
      if (hostname.includes('stackauth')) return 'stack-auth';
      if (hostname.includes('cloudflare')) return 'cloudflare-r2';
      if (hostname.includes('railway')) return 'railway';
      
      return hostname.split('.')[0] || 'external-api';
    } catch {
      return 'external-api';
    }
  }
}

export default APMMiddleware.getInstance();