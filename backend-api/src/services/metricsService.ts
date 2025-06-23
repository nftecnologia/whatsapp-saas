import promClient from 'prom-client';
import logger from '@/utils/logger';

class MetricsService {
  private static instance: MetricsService;
  private readonly register: promClient.Registry;
  
  // HTTP Metrics
  private readonly httpRequestsTotal: promClient.Counter;
  private readonly httpRequestDuration: promClient.Histogram;
  private readonly httpActiveConnections: promClient.Gauge;
  
  // Business Metrics
  private readonly messagesTotal: promClient.Counter;
  private readonly campaignsTotal: promClient.Counter;
  private readonly contactsTotal: promClient.Gauge;
  private readonly templatesTotal: promClient.Gauge;
  private readonly evolutionApiCallsTotal: promClient.Counter;
  private readonly evolutionApiCallDuration: promClient.Histogram;
  
  // System Metrics
  private readonly memoryUsage: promClient.Gauge;
  private readonly cpuUsage: promClient.Gauge;
  private readonly databaseConnections: promClient.Gauge;
  private readonly redisConnections: promClient.Gauge;
  private readonly rabbitmqMessages: promClient.Gauge;
  
  // Error Metrics
  private readonly errorsTotal: promClient.Counter;
  private readonly databaseErrors: promClient.Counter;
  private readonly authFailures: promClient.Counter;
  private readonly rateLimitExceeded: promClient.Counter;
  
  // Performance Metrics
  private readonly slowQueries: promClient.Counter;
  private readonly memoryLeaks: promClient.Gauge;
  private readonly responseTimePercentiles: promClient.Summary;

  constructor() {
    this.register = new promClient.Registry();
    
    // Add default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'whatsapp_saas_',
    });

    // Initialize HTTP metrics
    this.httpRequestsTotal = new promClient.Counter({
      name: 'whatsapp_saas_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_id', 'company_id'],
      registers: [this.register],
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: 'whatsapp_saas_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });

    this.httpActiveConnections = new promClient.Gauge({
      name: 'whatsapp_saas_http_active_connections',
      help: 'Number of active HTTP connections',
      registers: [this.register],
    });

    // Initialize business metrics
    this.messagesTotal = new promClient.Counter({
      name: 'whatsapp_saas_messages_total',
      help: 'Total number of WhatsApp messages processed',
      labelNames: ['status', 'campaign_id', 'company_id', 'message_type'],
      registers: [this.register],
    });

    this.campaignsTotal = new promClient.Counter({
      name: 'whatsapp_saas_campaigns_total',
      help: 'Total number of campaigns created',
      labelNames: ['status', 'company_id', 'campaign_type'],
      registers: [this.register],
    });

    this.contactsTotal = new promClient.Gauge({
      name: 'whatsapp_saas_contacts_total',
      help: 'Total number of contacts in the system',
      labelNames: ['company_id'],
      registers: [this.register],
    });

    this.templatesTotal = new promClient.Gauge({
      name: 'whatsapp_saas_templates_total',
      help: 'Total number of message templates',
      labelNames: ['company_id', 'template_type'],
      registers: [this.register],
    });

    this.evolutionApiCallsTotal = new promClient.Counter({
      name: 'whatsapp_saas_evolution_api_calls_total',
      help: 'Total number of Evolution API calls',
      labelNames: ['endpoint', 'method', 'status_code', 'instance_id'],
      registers: [this.register],
    });

    this.evolutionApiCallDuration = new promClient.Histogram({
      name: 'whatsapp_saas_evolution_api_call_duration_seconds',
      help: 'Duration of Evolution API calls in seconds',
      labelNames: ['endpoint', 'method'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Initialize system metrics
    this.memoryUsage = new promClient.Gauge({
      name: 'whatsapp_saas_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.register],
    });

    this.cpuUsage = new promClient.Gauge({
      name: 'whatsapp_saas_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.register],
    });

    this.databaseConnections = new promClient.Gauge({
      name: 'whatsapp_saas_database_connections',
      help: 'Number of database connections',
      labelNames: ['state'],
      registers: [this.register],
    });

    this.redisConnections = new promClient.Gauge({
      name: 'whatsapp_saas_redis_connections',
      help: 'Number of Redis connections',
      registers: [this.register],
    });

    this.rabbitmqMessages = new promClient.Gauge({
      name: 'whatsapp_saas_rabbitmq_messages',
      help: 'Number of messages in RabbitMQ queues',
      labelNames: ['queue_name', 'state'],
      registers: [this.register],
    });

    // Initialize error metrics
    this.errorsTotal = new promClient.Counter({
      name: 'whatsapp_saas_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'service', 'severity'],
      registers: [this.register],
    });

    this.databaseErrors = new promClient.Counter({
      name: 'whatsapp_saas_database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['operation', 'error_type'],
      registers: [this.register],
    });

    this.authFailures = new promClient.Counter({
      name: 'whatsapp_saas_auth_failures_total',
      help: 'Total number of authentication failures',
      labelNames: ['type', 'user_id'],
      registers: [this.register],
    });

    this.rateLimitExceeded = new promClient.Counter({
      name: 'whatsapp_saas_rate_limit_exceeded_total',
      help: 'Total number of rate limit exceeded events',
      labelNames: ['endpoint', 'user_id', 'ip'],
      registers: [this.register],
    });

    // Initialize performance metrics
    this.slowQueries = new promClient.Counter({
      name: 'whatsapp_saas_slow_queries_total',
      help: 'Total number of slow database queries',
      labelNames: ['query_type', 'duration_bucket'],
      registers: [this.register],
    });

    this.memoryLeaks = new promClient.Gauge({
      name: 'whatsapp_saas_memory_leaks',
      help: 'Potential memory leaks detected',
      labelNames: ['type'],
      registers: [this.register],
    });

    this.responseTimePercentiles = new promClient.Summary({
      name: 'whatsapp_saas_response_time_percentiles',
      help: 'Response time percentiles',
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.register],
    });

    // Start periodic system metrics collection
    this.startSystemMetricsCollection();
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  // HTTP Metrics Methods
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    userId?: string,
    companyId?: string
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      user_id: userId || 'anonymous',
      company_id: companyId || 'unknown',
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration / 1000);
    this.responseTimePercentiles.observe(duration);
  }

  public setActiveConnections(count: number): void {
    this.httpActiveConnections.set(count);
  }

  // Business Metrics Methods
  public recordMessage(
    status: 'sent' | 'delivered' | 'failed' | 'queued',
    campaignId: string,
    companyId: string,
    messageType: 'text' | 'media' | 'template'
  ): void {
    this.messagesTotal.inc({
      status,
      campaign_id: campaignId,
      company_id: companyId,
      message_type: messageType,
    });

    logger.logBusinessMetric('message_processed', 1, 'count', {
      status,
      campaignId,
      companyId,
      messageType,
    });
  }

  public recordCampaign(
    status: 'created' | 'started' | 'completed' | 'failed',
    companyId: string,
    campaignType: 'broadcast' | 'triggered' | 'scheduled'
  ): void {
    this.campaignsTotal.inc({
      status,
      company_id: companyId,
      campaign_type: campaignType,
    });

    logger.logBusinessMetric('campaign_event', 1, 'count', {
      status,
      companyId,
      campaignType,
    });
  }

  public setContactsCount(companyId: string, count: number): void {
    this.contactsTotal.set({ company_id: companyId }, count);
  }

  public setTemplatesCount(companyId: string, templateType: string, count: number): void {
    this.templatesTotal.set({ company_id: companyId, template_type: templateType }, count);
  }

  public recordEvolutionApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    instanceId?: string
  ): void {
    this.evolutionApiCallsTotal.inc({
      endpoint,
      method,
      status_code: statusCode.toString(),
      instance_id: instanceId || 'default',
    });

    this.evolutionApiCallDuration.observe({ endpoint, method }, duration / 1000);
  }

  // System Metrics Methods
  public recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.memoryUsage.set({ type: 'heap_used' }, usage.heapUsed);
    this.memoryUsage.set({ type: 'heap_total' }, usage.heapTotal);
    this.memoryUsage.set({ type: 'external' }, usage.external);
    this.memoryUsage.set({ type: 'rss' }, usage.rss);
  }

  public setCpuUsage(percentage: number): void {
    this.cpuUsage.set(percentage);
  }

  public setDatabaseConnections(active: number, idle: number, waiting: number): void {
    this.databaseConnections.set({ state: 'active' }, active);
    this.databaseConnections.set({ state: 'idle' }, idle);
    this.databaseConnections.set({ state: 'waiting' }, waiting);
  }

  public setRedisConnections(count: number): void {
    this.redisConnections.set(count);
  }

  public setRabbitMQMessages(queueName: string, ready: number, unacked: number): void {
    this.rabbitmqMessages.set({ queue_name: queueName, state: 'ready' }, ready);
    this.rabbitmqMessages.set({ queue_name: queueName, state: 'unacked' }, unacked);
  }

  // Error Metrics Methods
  public recordError(
    type: 'http' | 'database' | 'redis' | 'rabbitmq' | 'evolution_api' | 'business',
    service: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    this.errorsTotal.inc({ type, service, severity });
  }

  public recordDatabaseError(operation: string, errorType: string): void {
    this.databaseErrors.inc({ operation, error_type: errorType });
  }

  public recordAuthFailure(type: 'login' | 'token' | 'permission', userId?: string): void {
    this.authFailures.inc({ type, user_id: userId || 'unknown' });
  }

  public recordRateLimitExceeded(endpoint: string, userId?: string, ip?: string): void {
    this.rateLimitExceeded.inc({
      endpoint,
      user_id: userId || 'unknown',
      ip: ip || 'unknown',
    });
  }

  // Performance Metrics Methods
  public recordSlowQuery(queryType: string, duration: number): void {
    let bucket = 'fast';
    if (duration > 5000) bucket = 'very_slow';
    else if (duration > 2000) bucket = 'slow';
    else if (duration > 1000) bucket = 'moderate';

    this.slowQueries.inc({ query_type: queryType, duration_bucket: bucket });
  }

  public recordMemoryLeak(type: string, severity: number): void {
    this.memoryLeaks.set({ type }, severity);
  }

  // Metrics Export
  public async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  public getContentType(): string {
    return this.register.contentType;
  }

  // Custom metrics aggregation for dashboards
  public async getBusinessMetrics(): Promise<any> {
    const metrics = await this.register.getMetricsAsJSON();
    
    return {
      messages: this.extractMetricValue(metrics, 'whatsapp_saas_messages_total'),
      campaigns: this.extractMetricValue(metrics, 'whatsapp_saas_campaigns_total'),
      contacts: this.extractMetricValue(metrics, 'whatsapp_saas_contacts_total'),
      templates: this.extractMetricValue(metrics, 'whatsapp_saas_templates_total'),
      errors: this.extractMetricValue(metrics, 'whatsapp_saas_errors_total'),
      apiCalls: this.extractMetricValue(metrics, 'whatsapp_saas_evolution_api_calls_total'),
    };
  }

  private extractMetricValue(metrics: any[], metricName: string): any {
    const metric = metrics.find(m => m.name === metricName);
    return metric ? metric.values : [];
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      try {
        this.recordMemoryUsage();
        
        // CPU usage calculation would require a separate library or native code
        // For now, we'll use load average as a proxy
        const loadAverage = require('os').loadavg();
        this.setCpuUsage(loadAverage[0] * 100); // Simplified CPU usage
        
      } catch (error) {
        logger.error('Failed to collect system metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, 30000);

    // Business metrics collection every 5 minutes
    setInterval(async () => {
      try {
        await this.collectBusinessMetrics();
      } catch (error) {
        logger.error('Failed to collect business metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, 300000);
  }

  private async collectBusinessMetrics(): Promise<void> {
    try {
      // This would query the database for current counts
      // Implementation would depend on your database service
      logger.debug('Collecting business metrics');
      
      // Example: Update contact counts per company
      // const contactCounts = await this.getContactCountsByCompany();
      // contactCounts.forEach(({ companyId, count }) => {
      //   this.setContactsCount(companyId, count);
      // });
      
    } catch (error) {
      logger.error('Error collecting business metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Utility method to create custom metrics
  public createCustomGauge(name: string, help: string, labelNames: string[] = []): promClient.Gauge {
    return new promClient.Gauge({
      name: `whatsapp_saas_custom_${name}`,
      help,
      labelNames,
      registers: [this.register],
    });
  }

  public createCustomCounter(name: string, help: string, labelNames: string[] = []): promClient.Counter {
    return new promClient.Counter({
      name: `whatsapp_saas_custom_${name}`,
      help,
      labelNames,
      registers: [this.register],
    });
  }

  public createCustomHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets: number[] = [0.1, 0.5, 1, 2, 5, 10]
  ): promClient.Histogram {
    return new promClient.Histogram({
      name: `whatsapp_saas_custom_${name}`,
      help,
      labelNames,
      buckets,
      registers: [this.register],
    });
  }
}

export default MetricsService.getInstance();