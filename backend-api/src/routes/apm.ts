import { Router } from 'express';
import apmService from '@/services/apmService';
import { authenticateToken } from '@/middleware/auth';
import logger from '@/utils/logger';

const router = Router();

/**
 * @route GET /apm/status
 * @desc Get APM service status and overview
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = apmService.getAPMStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get APM status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get APM status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /apm/transactions
 * @desc Get transaction summaries with performance metrics
 * @access Private (Admin)
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const summaries = apmService.getTransactionSummaries();
    
    // Calculate additional insights
    const totalTransactions = summaries.reduce((sum, t) => sum + t.count, 0);
    const avgErrorRate = summaries.length > 0 ? 
      summaries.reduce((sum, t) => sum + t.errorRate, 0) / summaries.length : 0;
    const slowestTransaction = summaries.length > 0 ? 
      summaries.reduce((slowest, current) => 
        current.avgDuration > slowest.avgDuration ? current : slowest) : null;
    
    res.json({
      success: true,
      data: {
        transactions: summaries,
        insights: {
          totalTransactions,
          avgErrorRate: Math.round(avgErrorRate * 100) / 100,
          slowestTransaction: slowestTransaction?.name || null,
          slowestAvgDuration: slowestTransaction?.avgDuration || 0,
          transactionCount: summaries.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get transaction summaries', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction summaries',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /apm/traces
 * @desc Get recent traces for analysis
 * @access Private (Admin)
 */
router.get('/traces', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const traces = apmService.exportTraces(limit);
    
    // Filter traces based on query parameters
    let filteredTraces = traces;
    
    if (req.query.status) {
      filteredTraces = filteredTraces.filter(t => t.status === req.query.status);
    }
    
    if (req.query.minDuration) {
      const minDuration = parseInt(req.query.minDuration as string);
      filteredTraces = filteredTraces.filter(t => (t.duration || 0) >= minDuration);
    }
    
    if (req.query.name) {
      filteredTraces = filteredTraces.filter(t => 
        t.name.toLowerCase().includes((req.query.name as string).toLowerCase())
      );
    }
    
    res.json({
      success: true,
      data: {
        traces: filteredTraces,
        total: traces.length,
        filtered: filteredTraces.length,
        filters: {
          status: req.query.status,
          minDuration: req.query.minDuration,
          name: req.query.name,
          limit,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get traces', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get traces',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /apm/metrics
 * @desc Get performance metrics
 * @access Private (Admin)
 */
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const metrics = apmService.exportMetrics(limit);
    
    // Group metrics by name for analysis
    const metricsByName = metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric);
      return acc;
    }, {} as Record<string, typeof metrics>);
    
    // Calculate summary statistics for each metric
    const summaries = Object.entries(metricsByName).map(([name, metricList]) => {
      const values = metricList.map(m => m.value);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      return {
        name,
        count: metricList.length,
        average: Math.round(avg * 100) / 100,
        minimum: min,
        maximum: max,
        unit: metricList[0]?.unit || 'unknown',
        latest: metricList[metricList.length - 1]?.value || 0,
        trend: this.calculateTrend(values),
      };
    });
    
    res.json({
      success: true,
      data: {
        metrics: metrics,
        summaries: summaries.sort((a, b) => b.count - a.count),
        total: metrics.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get performance metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /apm/errors
 * @desc Get error analysis from traces
 * @access Private (Admin)
 */
router.get('/errors', authenticateToken, async (req, res) => {
  try {
    const traces = apmService.exportTraces();
    const errorTraces = traces.filter(t => t.status === 'error');
    
    // Group errors by message
    const errorsByMessage = errorTraces.reduce((acc, trace) => {
      const message = trace.error?.message || 'Unknown error';
      if (!acc[message]) {
        acc[message] = {
          message,
          count: 0,
          traces: [],
          firstOccurrence: trace.startTime,
          lastOccurrence: trace.startTime,
        };
      }
      
      acc[message].count++;
      acc[message].traces.push({
        id: trace.id,
        name: trace.name,
        timestamp: trace.startTime,
        tags: trace.tags,
      });
      
      if (trace.startTime < acc[message].firstOccurrence) {
        acc[message].firstOccurrence = trace.startTime;
      }
      if (trace.startTime > acc[message].lastOccurrence) {
        acc[message].lastOccurrence = trace.startTime;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    const errorSummaries = Object.values(errorsByMessage)
      .sort((a: any, b: any) => b.count - a.count);
    
    // Calculate error rate trends
    const hourlyErrors = this.calculateHourlyErrorCounts(errorTraces);
    
    res.json({
      success: true,
      data: {
        errors: errorSummaries,
        hourlyTrend: hourlyErrors,
        totalErrors: errorTraces.length,
        uniqueErrors: errorSummaries.length,
        errorRate: traces.length > 0 ? (errorTraces.length / traces.length) * 100 : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get error analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get error analysis',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /apm/performance
 * @desc Get performance analysis and insights
 * @access Private (Admin)
 */
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const status = apmService.getAPMStatus();
    const traces = apmService.exportTraces();
    
    // Calculate performance insights
    const completedTraces = traces.filter(t => t.duration !== undefined);
    const durations = completedTraces.map(t => t.duration!);
    
    const performanceInsights = {
      totalRequests: traces.length,
      avgResponseTime: status.averageResponseTime,
      medianResponseTime: this.calculateMedian(durations),
      p95ResponseTime: this.calculatePercentile(durations, 95),
      p99ResponseTime: this.calculatePercentile(durations, 99),
      slowRequestsCount: durations.filter(d => d > 2000).length,
      fastRequestsCount: durations.filter(d => d < 100).length,
      errorRate: status.erroredTraces / (status.completedTraces + status.erroredTraces) * 100,
      throughput: this.calculateThroughput(traces),
      bottlenecks: this.identifyBottlenecks(status.transactionSummaries),
    };
    
    res.json({
      success: true,
      data: {
        insights: performanceInsights,
        slowestTransactions: status.slowestTransactions,
        recommendations: this.generateRecommendations(performanceInsights),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get performance analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get performance analysis',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /apm/control
 * @desc Control APM service (enable/disable/clear)
 * @access Private (Admin)
 */
router.post('/control', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body;
    
    switch (action) {
      case 'enable':
        apmService.enable();
        break;
      case 'disable':
        apmService.disable();
        break;
      case 'clear':
        apmService.clear();
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use: enable, disable, or clear',
        });
    }
    
    logger.info(`APM service ${action} action performed`, {
      userId: (req as any).user?.id,
      action,
    });
    
    res.json({
      success: true,
      message: `APM service ${action} action completed successfully`,
      action,
      enabled: apmService.isEnabled(),
    });
  } catch (error) {
    logger.error('Failed to control APM service', {
      action: req.body.action,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to control APM service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper methods
function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
  
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}

function calculateHourlyErrorCounts(errorTraces: any[]): Array<{ hour: string; count: number }> {
  const hourCounts: Record<string, number> = {};
  
  errorTraces.forEach(trace => {
    const hour = new Date(trace.startTime).toISOString().substr(0, 13);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function calculateThroughput(traces: any[]): number {
  if (traces.length === 0) return 0;
  
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const recentTraces = traces.filter(t => t.startTime > oneHourAgo);
  
  return recentTraces.length / 3600; // requests per second
}

function identifyBottlenecks(summaries: any[]): Array<{ name: string; issue: string; severity: string }> {
  const bottlenecks: Array<{ name: string; issue: string; severity: string }> = [];
  
  summaries.forEach(summary => {
    if (summary.avgDuration > 5000) {
      bottlenecks.push({
        name: summary.name,
        issue: `Very slow average response time: ${summary.avgDuration}ms`,
        severity: 'critical',
      });
    } else if (summary.avgDuration > 2000) {
      bottlenecks.push({
        name: summary.name,
        issue: `Slow average response time: ${summary.avgDuration}ms`,
        severity: 'high',
      });
    }
    
    if (summary.errorRate > 10) {
      bottlenecks.push({
        name: summary.name,
        issue: `High error rate: ${summary.errorRate}%`,
        severity: 'high',
      });
    }
    
    if (summary.percentiles.p99 > 10000) {
      bottlenecks.push({
        name: summary.name,
        issue: `Very slow 99th percentile: ${summary.percentiles.p99}ms`,
        severity: 'medium',
      });
    }
  });
  
  return bottlenecks.sort((a, b) => {
    const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    return (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
           (severityOrder[a.severity as keyof typeof severityOrder] || 0);
  });
}

function generateRecommendations(insights: any): string[] {
  const recommendations: string[] = [];
  
  if (insights.avgResponseTime > 2000) {
    recommendations.push('Consider optimizing slow database queries and API calls');
  }
  
  if (insights.errorRate > 5) {
    recommendations.push('Investigate and fix high error rate issues');
  }
  
  if (insights.slowRequestsCount > insights.totalRequests * 0.1) {
    recommendations.push('More than 10% of requests are slow - review performance bottlenecks');
  }
  
  if (insights.p99ResponseTime > 10000) {
    recommendations.push('99th percentile response time is very high - check for outliers');
  }
  
  if (insights.throughput < 10) {
    recommendations.push('Low throughput detected - consider scaling or optimization');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! Continue monitoring.');
  }
  
  return recommendations;
}

export default router;