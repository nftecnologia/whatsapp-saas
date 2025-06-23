import { Router } from 'express';
import healthService from '@/services/healthService';
import metricsMiddleware from '@/middleware/metricsMiddleware';
import metricsService from '@/services/metricsService';

const router = Router();

/**
 * @route GET /health
 * @desc Comprehensive health check with all service statuses and metrics
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const health = await healthService.getHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/live
 * @desc Kubernetes liveness probe endpoint
 * @access Public
 */
router.get('/live', async (req, res) => {
  try {
    const liveness = await healthService.getLivenessCheck();
    res.status(200).json(liveness);
  } catch (error) {
    res.status(503).json({
      status: 'dead',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/ready
 * @desc Kubernetes readiness probe endpoint
 * @access Public
 */
router.get('/ready', async (req, res) => {
  try {
    const readiness = await healthService.getReadinessCheck();
    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/metrics
 * @desc Application metrics endpoint (JSON format)
 * @access Public
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = metricsMiddleware.getMetrics();
    const healthMetrics = healthService.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      http: metrics,
      application: healthMetrics,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/prometheus
 * @desc Prometheus metrics endpoint (Prometheus format)
 * @access Public
 */
router.get('/prometheus', async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', metricsService.getContentType());
    res.send(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve Prometheus metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/business-metrics
 * @desc Business metrics endpoint for dashboards
 * @access Public
 */
router.get('/business-metrics', async (req, res) => {
  try {
    const businessMetrics = await metricsService.getBusinessMetrics();
    const healthMetrics = healthService.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      business: businessMetrics,
      application: healthMetrics,
      summary: {
        totalMessages: businessMetrics.messages.reduce((sum: number, m: any) => sum + m.value, 0),
        totalCampaigns: businessMetrics.campaigns.reduce((sum: number, c: any) => sum + c.value, 0),
        totalContacts: businessMetrics.contacts.reduce((sum: number, c: any) => sum + c.value, 0),
        totalErrors: businessMetrics.errors.reduce((sum: number, e: any) => sum + e.value, 0),
        uptime: Math.round((Date.now() - (process as any).startTime) / 1000) || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve business metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/deep
 * @desc Deep health check with extended diagnostics
 * @access Public
 */
router.get('/deep', async (req, res) => {
  try {
    const health = await healthService.getHealthCheck();
    const metrics = metricsMiddleware.getMetrics();
    
    // Additional deep checks
    const deepChecks = {
      database: {
        ...health.services.database,
        poolInfo: await getDatabasePoolInfo(),
      },
      redis: {
        ...health.services.redis,
        memoryUsage: await getRedisMemoryInfo(),
      },
      rabbitmq: {
        ...health.services.rabbitmq,
        queueInfo: await getRabbitMQQueueInfo(),
      },
    };

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;

    res.status(statusCode).json({
      ...health,
      services: deepChecks,
      httpMetrics: metrics,
      diagnostics: {
        memoryLeakCheck: checkMemoryTrend(),
        performanceScore: calculatePerformanceScore(health, metrics),
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Deep health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Helper functions for deep health checks
async function getDatabasePoolInfo() {
  try {
    // This would need to be implemented based on your pool library
    return {
      totalConnections: 'N/A', // pool.totalCount or similar
      idleConnections: 'N/A',  // pool.idleCount or similar
      waitingCount: 'N/A',     // pool.waitingCount or similar
    };
  } catch {
    return { error: 'Unable to retrieve pool info' };
  }
}

async function getRedisMemoryInfo() {
  try {
    // This would require Redis INFO command
    return {
      usedMemory: 'N/A',
      peakMemory: 'N/A',
      memoryFragmentation: 'N/A',
    };
  } catch {
    return { error: 'Unable to retrieve Redis memory info' };
  }
}

async function getRabbitMQQueueInfo() {
  try {
    // This would require RabbitMQ management API or direct queue inspection
    return {
      queueLength: 'N/A',
      consumers: 'N/A',
      messageRate: 'N/A',
    };
  } catch {
    return { error: 'Unable to retrieve queue info' };
  }
}

function checkMemoryTrend() {
  const usage = process.memoryUsage();
  // In a real implementation, you'd track this over time
  return {
    current: Math.round(usage.heapUsed / 1024 / 1024),
    trend: 'stable', // This would be calculated from historical data
    warning: usage.heapUsed > 500 * 1024 * 1024, // 500MB threshold
  };
}

function calculatePerformanceScore(health: any, metrics: any) {
  let score = 100;
  
  // Deduct points for service issues
  if (health.status === 'degraded') score -= 20;
  if (health.status === 'unhealthy') score -= 50;
  
  // Deduct points for high error rate
  if (metrics.errorRate > 5) score -= 15;
  if (metrics.errorRate > 10) score -= 25;
  
  // Deduct points for slow response times
  if (metrics.averageResponseTime > 1000) score -= 10;
  if (metrics.averageResponseTime > 2000) score -= 20;
  
  // Deduct points for high memory usage
  if (health.system.memory.usagePercentage > 80) score -= 10;
  if (health.system.memory.usagePercentage > 90) score -= 20;
  
  return Math.max(0, score);
}

export default router;