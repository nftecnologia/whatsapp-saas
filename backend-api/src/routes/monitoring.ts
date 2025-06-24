import { Router } from 'express';
import monitoringService, { AlertRule } from '@/services/monitoringService';
import { authenticateToken } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';
import logger from '@/utils/logger';

const router = Router();

// Validation schemas
const alertRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  cooldown: z.number().min(1),
  channels: z.array(z.object({
    type: z.enum(['webhook', 'email', 'slack', 'teams', 'pagerduty']),
    config: z.record(z.any()),
    enabled: z.boolean(),
  })),
  enabled: z.boolean(),
});

/**
 * @route GET /monitoring/status
 * @desc Get monitoring service status
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = monitoringService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get monitoring status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /monitoring/alerts
 * @desc Get active alerts
 * @access Private (Admin)
 */
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const alerts = monitoringService.getActiveAlerts();
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get active alerts', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get active alerts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /monitoring/alerts/:alertId/acknowledge
 * @desc Acknowledge an alert
 * @access Private (Admin)
 */
router.post('/alerts/:alertId/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const acknowledged = monitoringService.acknowledgeAlert(alertId);
    
    if (acknowledged) {
      logger.info('Alert acknowledged via API', { 
        alertId, 
        userId: (req as any).user?.id 
      });
      
      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        alertId,
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Alert not found or already resolved',
        alertId,
      });
    }
  } catch (error) {
    logger.error('Failed to acknowledge alert', {
      alertId: req.params.alertId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /monitoring/rules
 * @desc Get all alert rules
 * @access Private (Admin)
 */
router.get('/rules', authenticateToken, async (req, res) => {
  try {
    const rules = monitoringService.getAlertRules();
    
    res.json({
      success: true,
      data: rules,
      count: rules.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get alert rules', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get alert rules',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /monitoring/rules
 * @desc Add a new alert rule
 * @access Private (Admin)
 */
router.post('/rules', authenticateToken, validateRequest({ body: alertRuleSchema }), async (req, res) => {
  try {
    const ruleData = req.body as AlertRule;
    
    // Add condition function (this would be more sophisticated in production)
    const rule: AlertRule = {
      ...ruleData,
      condition: (metrics: any, health: any) => {
        // This is a placeholder - in production, you'd have a more sophisticated
        // rule engine or allow custom JavaScript conditions
        return false;
      },
    };
    
    monitoringService.addAlertRule(rule);
    
    logger.info('Alert rule added via API', { 
      ruleId: rule.id, 
      name: rule.name,
      userId: (req as any).user?.id 
    });
    
    res.status(201).json({
      success: true,
      message: 'Alert rule added successfully',
      data: { id: rule.id, name: rule.name },
    });
  } catch (error) {
    logger.error('Failed to add alert rule', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to add alert rule',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route DELETE /monitoring/rules/:ruleId
 * @desc Remove an alert rule
 * @access Private (Admin)
 */
router.delete('/rules/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const removed = monitoringService.removeAlertRule(ruleId);
    
    if (removed) {
      logger.info('Alert rule removed via API', { 
        ruleId, 
        userId: (req as any).user?.id 
      });
      
      res.json({
        success: true,
        message: 'Alert rule removed successfully',
        ruleId,
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Alert rule not found',
        ruleId,
      });
    }
  } catch (error) {
    logger.error('Failed to remove alert rule', {
      ruleId: req.params.ruleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to remove alert rule',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /monitoring/test/:ruleId
 * @desc Test an alert rule
 * @access Private (Admin)
 */
router.post('/test/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const tested = await monitoringService.testAlert(ruleId);
    
    if (tested) {
      logger.info('Alert rule tested via API', { 
        ruleId, 
        userId: (req as any).user?.id 
      });
      
      res.json({
        success: true,
        message: 'Test alert triggered successfully',
        ruleId,
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Alert rule not found',
        ruleId,
      });
    }
  } catch (error) {
    logger.error('Failed to test alert rule', {
      ruleId: req.params.ruleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to test alert rule',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /monitoring/start
 * @desc Start monitoring service
 * @access Private (Admin)
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    monitoringService.start();
    
    logger.info('Monitoring service started via API', { 
      userId: (req as any).user?.id 
    });
    
    res.json({
      success: true,
      message: 'Monitoring service started successfully',
    });
  } catch (error) {
    logger.error('Failed to start monitoring service', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to start monitoring service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /monitoring/stop
 * @desc Stop monitoring service
 * @access Private (Admin)
 */
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    monitoringService.stop();
    
    logger.info('Monitoring service stopped via API', { 
      userId: (req as any).user?.id 
    });
    
    res.json({
      success: true,
      message: 'Monitoring service stopped successfully',
    });
  } catch (error) {
    logger.error('Failed to stop monitoring service', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to stop monitoring service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /monitoring/dashboard
 * @desc Get dashboard data for monitoring overview
 * @access Private (Admin)
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const status = monitoringService.getStatus();
    const alerts = monitoringService.getActiveAlerts();
    const rules = monitoringService.getAlertRules();
    
    // Calculate alert statistics
    const alertStats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    };
    
    const ruleStats = {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length,
    };
    
    res.json({
      success: true,
      data: {
        status,
        alerts: {
          active: alerts,
          statistics: alertStats,
        },
        rules: {
          list: rules,
          statistics: ruleStats,
        },
        overview: {
          systemHealthy: status.healthy,
          alertsActive: status.activeAlertsCount > 0,
          lastCheck: status.lastCheck,
          nextCheck: status.nextCheck,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get monitoring dashboard data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;