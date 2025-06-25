import healthService from './healthService';
import metricsService from './metricsService';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import axios from 'axios';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: any, health: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // Minutes before re-alerting
  channels: AlertChannel[];
  enabled: boolean;
}

export interface AlertChannel {
  type: 'webhook' | 'email' | 'slack' | 'teams' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'triggered' | 'resolved' | 'acknowledged';
  triggeredAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  metadata: Record<string, any>;
}

export interface MonitoringStatus {
  healthy: boolean;
  alerts: Alert[];
  lastCheck: string;
  nextCheck: string;
  checkInterval: number;
  rulesCount: number;
  activeAlertsCount: number;
}

class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly defaultCheckIntervalMs = 30000; // 30 seconds

  constructor() {
    super();
    this.setupDefaultAlertRules();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private setupDefaultAlertRules(): void {
    // Critical system alerts
    this.addAlertRule({
      id: 'system-high-memory',
      name: 'High Memory Usage',
      description: 'System memory usage is above 90%',
      condition: (metrics, health) => health.system?.memory?.usagePercentage > 90,
      severity: 'critical',
      cooldown: 5,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    this.addAlertRule({
      id: 'system-high-cpu',
      name: 'High CPU Usage',
      description: 'System CPU usage is above 85%',
      condition: (metrics, health) => {
        const loadAvg = health.system?.cpu?.loadAverage?.[0] || 0;
        return loadAvg > 0.85;
      },
      severity: 'high',
      cooldown: 5,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    // Service health alerts
    this.addAlertRule({
      id: 'database-unhealthy',
      name: 'Database Unhealthy',
      description: 'Database connection is unhealthy',
      condition: (metrics, health) => health.services?.database?.status !== 'connected',
      severity: 'critical',
      cooldown: 2,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    this.addAlertRule({
      id: 'redis-unhealthy',
      name: 'Redis Unhealthy',
      description: 'Redis connection is unhealthy',
      condition: (metrics, health) => health.services?.redis?.status !== 'connected',
      severity: 'high',
      cooldown: 2,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    this.addAlertRule({
      id: 'rabbitmq-unhealthy',
      name: 'RabbitMQ Unhealthy',
      description: 'RabbitMQ connection is unhealthy',
      condition: (metrics, health) => health.services?.rabbitmq?.status !== 'connected',
      severity: 'high',
      cooldown: 2,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    // Performance alerts
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'HTTP error rate is above 10%',
      condition: (metrics, health) => (health.application?.errorRate || 0) > 10,
      severity: 'high',
      cooldown: 5,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    this.addAlertRule({
      id: 'slow-response-time',
      name: 'Slow Response Time',
      description: 'Average response time is above 3 seconds',
      condition: (metrics, health) => (health.application?.averageResponseTime || 0) > 3000,
      severity: 'medium',
      cooldown: 10,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });

    // Business logic alerts
    this.addAlertRule({
      id: 'message-processing-stopped',
      name: 'Message Processing Stopped',
      description: 'No messages have been processed in the last 30 minutes',
      condition: (metrics, health) => {
        const lastProcessed = health.application?.lastMessageProcessedAt;
        if (!lastProcessed) return false;
        const timeDiff = Date.now() - new Date(lastProcessed).getTime();
        return timeDiff > 30 * 60 * 1000; // 30 minutes
      },
      severity: 'high',
      cooldown: 15,
      channels: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: true },
      ],
      enabled: true,
    });
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Monitoring service is already running');
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.defaultCheckIntervalMs);

    logger.info('Monitoring service started', {
      checkInterval: this.defaultCheckIntervalMs,
      rulesCount: this.alertRules.size,
    });

    // Run initial check
    this.runHealthChecks();
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Monitoring service stopped');
  }

  private async runHealthChecks(): Promise<void> {
    try {
      const health = await healthService.getHealthCheck();
      const metrics = await metricsService.getBusinessMetrics();

      // Check each alert rule
      for (const [ruleId, rule] of this.alertRules) {
        if (!rule.enabled) continue;

        // Check cooldown
        const lastAlerted = this.alertCooldowns.get(ruleId) || 0;
        const cooldownExpired = Date.now() - lastAlerted > rule.cooldown * 60 * 1000;

        if (rule.condition(metrics, health)) {
          // Alert condition is true
          if (!this.activeAlerts.has(ruleId) && cooldownExpired) {
            await this.triggerAlert(rule, { health, metrics });
          }
        } else {
          // Alert condition is false, resolve if active
          if (this.activeAlerts.has(ruleId)) {
            await this.resolveAlert(ruleId);
          }
        }
      }

      // Log monitoring status
      logger.debug('Health check completed', {
        overallStatus: health.status,
        activeAlerts: this.activeAlerts.size,
        rulesEvaluated: this.alertRules.size,
      });

    } catch (error) {
      logger.error('Failed to run health checks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async triggerAlert(rule: AlertRule, context: any): Promise<void> {
    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: 'triggered',
      triggeredAt: new Date().toISOString(),
      metadata: context,
    };

    this.activeAlerts.set(rule.id, alert);
    this.alertCooldowns.set(rule.id, Date.now());

    // Send notifications
    await this.sendNotifications(alert, rule.channels);

    // Emit event
    this.emit('alert:triggered', alert);

    // Log alert
    logger.error(`Alert triggered: ${rule.name}`, {
      alertId: alert.id,
      ruleId: rule.id,
      severity: rule.severity,
      description: rule.description,
    });

    // Record metrics
    metricsService.recordError('business', 'alert', rule.severity);
  }

  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();

    this.activeAlerts.delete(ruleId);

    // Emit event
    this.emit('alert:resolved', alert);

    // Log resolution
    logger.info(`Alert resolved: ${alert.name}`, {
      alertId: alert.id,
      ruleId: alert.ruleId,
      duration: alert.resolvedAt && alert.triggeredAt ? 
        new Date(alert.resolvedAt).getTime() - new Date(alert.triggeredAt).getTime() : 0,
    });
  }

  private async sendNotifications(alert: Alert, channels: AlertChannel[]): Promise<void> {
    const notificationPromises = channels
      .filter(channel => channel.enabled)
      .map(channel => this.sendNotification(alert, channel));

    await Promise.allSettled(notificationPromises);
  }

  private async sendNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      switch (channel.type) {
        case 'webhook':
          await this.sendWebhookNotification(alert, channel.config);
          break;
        case 'slack':
          await this.sendSlackNotification(alert, channel.config);
          break;
        case 'teams':
          await this.sendTeamsNotification(alert, channel.config);
          break;
        case 'email':
          await this.sendEmailNotification(alert, channel.config);
          break;
        default:
          logger.warn(`Unsupported notification channel: ${channel.type}`);
      }
    } catch (error) {
      logger.error(`Failed to send ${channel.type} notification`, {
        alertId: alert.id,
        channel: channel.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async sendWebhookNotification(alert: Alert, config: any): Promise<void> {
    if (!config.url) {
      logger.warn('Webhook URL not configured');
      return;
    }

    const payload = {
      alert: {
        id: alert.id,
        name: alert.name,
        description: alert.description,
        severity: alert.severity,
        status: alert.status,
        triggeredAt: alert.triggeredAt,
      },
      service: 'WhatsApp SaaS API',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };

    await axios.post(config.url, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-SaaS-Monitor/1.0',
      },
    });

    logger.debug('Webhook notification sent', { alertId: alert.id, url: config.url });
  }

  private async sendSlackNotification(alert: Alert, config: any): Promise<void> {
    if (!config.webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const color = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff0000',
      critical: '#8b0000',
    }[alert.severity];

    const payload = {
      text: `Alert: ${alert.name}`,
      attachments: [
        {
          color,
          fields: [
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'Status', value: alert.status.toUpperCase(), short: true },
            { title: 'Description', value: alert.description, short: false },
            { title: 'Triggered At', value: alert.triggeredAt, short: true },
          ],
        },
      ],
    };

    await axios.post(config.webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    logger.debug('Slack notification sent', { alertId: alert.id });
  }

  private async sendTeamsNotification(alert: Alert, config: any): Promise<void> {
    if (!config.webhookUrl) {
      logger.warn('Teams webhook URL not configured');
      return;
    }

    const themeColor = {
      low: '00FF00',
      medium: 'FFA500',
      high: 'FF0000',
      critical: '8B0000',
    }[alert.severity];

    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `Alert: ${alert.name}`,
      themeColor,
      sections: [
        {
          activityTitle: `🚨 ${alert.name}`,
          activitySubtitle: `Severity: ${alert.severity.toUpperCase()}`,
          facts: [
            { name: 'Description', value: alert.description },
            { name: 'Status', value: alert.status.toUpperCase() },
            { name: 'Triggered At', value: alert.triggeredAt },
            { name: 'Service', value: 'WhatsApp SaaS API' },
          ],
        },
      ],
    };

    await axios.post(config.webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    logger.debug('Teams notification sent', { alertId: alert.id });
  }

  private async sendEmailNotification(alert: Alert, config: any): Promise<void> {
    // Email implementation would require an email service
    logger.debug('Email notification would be sent', { alertId: alert.id });
  }

  // Public API methods
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      // Also resolve any active alert for this rule
      if (this.activeAlerts.has(ruleId)) {
        this.resolveAlert(ruleId);
      }
      logger.info('Alert rule removed', { ruleId });
    }
    return removed;
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  public acknowledgeAlert(alertId: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.status = 'acknowledged';
        alert.acknowledgedAt = new Date().toISOString();
        
        this.emit('alert:acknowledged', alert);
        logger.info('Alert acknowledged', { alertId });
        return true;
      }
    }
    return false;
  }

  public getStatus(): MonitoringStatus {
    return {
      healthy: this.isRunning,
      alerts: this.getActiveAlerts(),
      lastCheck: new Date().toISOString(),
      nextCheck: new Date(Date.now() + this.defaultCheckIntervalMs).toISOString(),
      checkInterval: this.defaultCheckIntervalMs,
      rulesCount: this.alertRules.size,
      activeAlertsCount: this.activeAlerts.size,
    };
  }

  // Test method for triggering alerts manually
  public async testAlert(ruleId: string): Promise<boolean> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    await this.triggerAlert(rule, { test: true, timestamp: new Date().toISOString() });
    return true;
  }
}

export default MonitoringService.getInstance();