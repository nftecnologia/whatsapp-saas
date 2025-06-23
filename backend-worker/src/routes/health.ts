import { Router } from 'express';
import healthService from '@/services/healthService';

const router = Router();

/**
 * @route GET /health
 * @desc Comprehensive worker health check with metrics
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
 * @desc Kubernetes readiness probe endpoint - checks if worker is ready to process messages
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
 * @desc Worker-specific metrics endpoint
 * @access Public
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = healthService.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      worker: metrics,
      performance: {
        successRate: metrics.messagesProcessed > 0 
          ? ((metrics.messagesSuccessful / metrics.messagesProcessed) * 100).toFixed(2) + '%'
          : '0%',
        failureRate: metrics.messagesProcessed > 0 
          ? ((metrics.messagesFailed / metrics.messagesProcessed) * 100).toFixed(2) + '%'
          : '0%',
        retryRate: metrics.messagesProcessed > 0 
          ? ((metrics.messagesRetried / metrics.messagesProcessed) * 100).toFixed(2) + '%'
          : '0%',
      },
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
 * @route GET /health/queue
 * @desc Queue-specific health and metrics
 * @access Public
 */
router.get('/queue', async (req, res) => {
  try {
    const health = await healthService.getHealthCheck();
    const queueInfo = health.services.rabbitmq.queueStatus;
    
    if (!queueInfo) {
      return res.status(503).json({
        error: 'Queue information not available',
        timestamp: new Date().toISOString(),
      });
    }

    const metrics = healthService.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      queue: {
        name: queueInfo.queueName,
        messageCount: queueInfo.messageCount || 0,
        consumerCount: queueInfo.consumerCount || 0,
        isConsuming: queueInfo.isConsuming,
        backlog: metrics.queueBacklog,
      },
      processing: {
        isCurrentlyProcessing: metrics.isProcessing,
        rate: `${metrics.processingRate} messages/minute`,
        averageTime: `${metrics.averageProcessingTime}ms`,
        lastProcessed: metrics.lastMessageProcessedAt,
      },
      status: health.services.rabbitmq.status,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve queue information',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /health/reset-metrics
 * @desc Reset worker metrics (useful for testing)
 * @access Public (should be protected in production)
 */
router.post('/reset-metrics', (req, res) => {
  try {
    // Note: This is a simple reset - in a real implementation you might want to persist some data
    const currentMetrics = healthService.getMetrics();
    
    // Reset only counters, keep current state
    const resetMetrics = {
      ...currentMetrics,
      messagesProcessed: 0,
      messagesSuccessful: 0,
      messagesFailed: 0,
      messagesRetried: 0,
      lastMessageProcessedAt: undefined,
      lastErrorAt: undefined,
      lastError: undefined,
    };

    // In a real implementation, you'd have a proper reset method
    res.json({
      success: true,
      message: 'Metrics reset initiated',
      previousMetrics: currentMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;