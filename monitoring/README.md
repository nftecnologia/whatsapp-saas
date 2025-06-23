# WhatsApp SaaS - Comprehensive Monitoring & Observability

This directory contains a complete monitoring and observability stack for the WhatsApp SaaS platform, providing metrics collection, alerting, log aggregation, and performance monitoring.

## 🏗️ Architecture Overview

### Components

1. **Metrics Collection**: Prometheus + Custom Business Metrics
2. **Alerting**: AlertManager with escalation rules
3. **Visualization**: Grafana dashboards
4. **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana) + Fluentd
5. **APM**: Custom Application Performance Monitoring
6. **Distributed Tracing**: Jaeger integration
7. **Health Monitoring**: Comprehensive health checks

### Data Flow

```
Application → Metrics Service → Prometheus → Grafana
Application → Logger → Fluentd → Elasticsearch → Kibana
Application → APM Service → Traces → Analysis
Health Checks → Monitoring Service → Alerts → Notifications
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- At least 4GB RAM available for monitoring stack

### 1. Start Monitoring Stack

```bash
# Clone the repository and navigate to monitoring directory
cd monitoring

# Start the complete monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Check all services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Monitoring Interfaces

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| Grafana | http://localhost:3001 | admin / admin123 |
| Prometheus | http://localhost:9090 | - |
| AlertManager | http://localhost:9093 | - |
| Kibana | http://localhost:5601 | - |
| Elasticsearch | http://localhost:9200 | - |
| Jaeger | http://localhost:16686 | - |

### 3. Configure Application

Add to your `.env` file:

```bash
# Monitoring Configuration
LOG_LEVEL=info
PROMETHEUS_ENABLED=true
APM_ENABLED=true
MONITORING_ENABLED=true

# Alert Webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ALERT_WEBHOOK_URL=https://your-alert-webhook.com/alerts
ALERT_FROM_EMAIL=alerts@whatsapp-saas.com

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@domain.com
SMTP_PASSWORD=your-app-password

# Team Notifications
CRITICAL_ALERT_EMAILS=oncall@whatsapp-saas.com,devops@whatsapp-saas.com
HIGH_ALERT_EMAILS=team-leads@whatsapp-saas.com
BUSINESS_TEAM_EMAILS=business@whatsapp-saas.com
SECURITY_TEAM_EMAILS=security@whatsapp-saas.com
DBA_TEAM_EMAILS=dba@whatsapp-saas.com
```

## 📊 Dashboards

### Grafana Dashboards

1. **System Overview** - High-level system health and performance
2. **Business Metrics** - WhatsApp message delivery, campaigns, contacts
3. **Infrastructure** - Database, Redis, RabbitMQ, system resources
4. **Alerts & Health** - Active alerts, service health, performance trends

### Kibana Dashboards

1. **Log Overview** - Log volume, error distribution, performance
2. **Error Analysis** - Error tracking, top errors, geographic distribution
3. **Security Monitoring** - Security events, suspicious activity
4. **Performance Insights** - Slow requests, database queries, API calls

## 🚨 Alerting

### Alert Categories

1. **Critical Alerts** (Immediate Response)
   - Service down
   - Database connection failures
   - Critical memory/CPU usage
   - Security incidents

2. **High Severity** (30min Response)
   - High error rates
   - Performance degradation
   - Queue backlogs

3. **Medium/Warning** (2hr Response)
   - Slow queries
   - High memory usage
   - Rate limit violations

4. **Business Alerts** (4hr Response)
   - Low campaign success rates
   - Message processing issues
   - Unusual traffic patterns

### Escalation Rules

1. **Immediate**: Slack + Email
2. **15min**: PagerDuty + SMS
3. **30min**: Phone calls to on-call
4. **1hr**: Manager escalation

## 📈 Metrics

### System Metrics

- HTTP request rate, response times, error rates
- Memory usage, CPU usage, disk usage
- Database connections, query performance
- Redis operations, cache hit rates
- RabbitMQ queue sizes, message rates

### Business Metrics

- Messages sent/delivered/failed by campaign
- Campaign success rates
- Contact growth rates
- Template usage statistics
- Evolution API performance
- User authentication events

### APM Metrics

- Request tracing across services
- Database query analysis
- External API call monitoring
- Performance bottleneck identification
- Error correlation and analysis

## 🔍 Log Analysis

### Log Types

1. **Application Logs**: Structured JSON logs with context
2. **Access Logs**: HTTP request/response details
3. **Error Logs**: Exception tracking and stack traces
4. **Security Logs**: Authentication, authorization events
5. **Business Logs**: Campaign, message, user events

### Log Structure

```json
{
  "@timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "api",
  "message": "Campaign started successfully",
  "requestId": "req_123456",
  "userId": "user_789",
  "companyId": "comp_456",
  "metadata": {
    "campaignId": "camp_123",
    "jobsCreated": 1500,
    "estimatedTime": "15 minutes"
  },
  "tags": {
    "environment": "production",
    "version": "1.0.0"
  }
}
```

## 🛠️ Customization

### Adding Custom Metrics

```typescript
import metricsService from '@/services/metricsService';

// Record business event
metricsService.recordMessage('sent', campaignId, companyId, 'text');

// Create custom metric
const customGauge = metricsService.createCustomGauge(
  'active_users',
  'Number of active users',
  ['company_id']
);

customGauge.set({ company_id: 'comp_123' }, 150);
```

### Adding Custom Alerts

```typescript
import monitoringService from '@/services/monitoringService';

monitoringService.addAlertRule({
  id: 'custom-business-alert',
  name: 'Low Conversion Rate',
  description: 'Message conversion rate below threshold',
  condition: (metrics, health) => {
    // Custom business logic
    return conversionRate < 0.1;
  },
  severity: 'high',
  cooldown: 10,
  channels: [
    { type: 'slack', config: { url: SLACK_URL }, enabled: true }
  ],
  enabled: true
});
```

### Custom Log Processing

```typescript
import logger from '@/utils/logger';

// Business metric logging
logger.logBusinessMetric('conversion_rate', 0.15, 'percentage', {
  campaignId: 'camp_123',
  source: 'whatsapp',
  period: 'daily'
});

// Performance logging
logger.logPerformance('database_query', duration, {
  query: 'SELECT_CAMPAIGNS',
  table: 'campaigns',
  companyId: 'comp_123'
});
```

## 🔧 Maintenance

### Regular Tasks

1. **Daily**
   - Review alert notifications
   - Check dashboard health
   - Monitor error rates

2. **Weekly**
   - Review performance trends
   - Update alert thresholds
   - Analyze log patterns

3. **Monthly**
   - Archive old logs
   - Review dashboard configurations
   - Update monitoring rules

### Troubleshooting

#### Common Issues

1. **High Memory Usage**
   ```bash
   # Check Elasticsearch heap
   curl -X GET "localhost:9200/_cat/nodes?v&h=heap.percent"
   
   # Restart if needed
   docker-compose restart elasticsearch
   ```

2. **Missing Metrics**
   ```bash
   # Check Prometheus targets
   curl http://localhost:9090/api/v1/targets
   
   # Verify application metrics endpoint
   curl http://localhost:3000/health/prometheus
   ```

3. **Log Ingestion Issues**
   ```bash
   # Check Fluentd logs
   docker-compose logs fluentd
   
   # Verify Elasticsearch indices
   curl -X GET "localhost:9200/_cat/indices?v"
   ```

### Performance Optimization

1. **Elasticsearch**
   - Adjust heap size based on data volume
   - Configure index lifecycle management
   - Use index templates for optimal mapping

2. **Prometheus**
   - Tune retention policies
   - Optimize scrape intervals
   - Use recording rules for complex queries

3. **Grafana**
   - Cache dashboard queries
   - Optimize panel refresh rates
   - Use template variables efficiently

## 📚 API Documentation

### Health Endpoints

- `GET /health` - Overall system health
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/metrics` - Application metrics (JSON)
- `GET /health/prometheus` - Prometheus metrics format
- `GET /health/business-metrics` - Business metrics summary

### Monitoring Endpoints

- `GET /monitoring/status` - Monitoring service status
- `GET /monitoring/alerts` - Active alerts
- `POST /monitoring/alerts/:id/acknowledge` - Acknowledge alert
- `GET /monitoring/rules` - Alert rules
- `POST /monitoring/test/:ruleId` - Test alert rule

### APM Endpoints

- `GET /apm/status` - APM service status
- `GET /apm/transactions` - Transaction summaries
- `GET /apm/traces` - Recent traces
- `GET /apm/metrics` - Performance metrics
- `GET /apm/errors` - Error analysis
- `POST /apm/control` - Control APM service

## 🔐 Security

### Access Control

- Use environment variables for sensitive configuration
- Implement proper authentication for monitoring interfaces
- Restrict network access to monitoring ports
- Enable TLS for external access

### Data Privacy

- Sanitize sensitive data in logs
- Use field exclusion for PII
- Implement log retention policies
- Encrypt data at rest and in transit

## 🚀 Production Deployment

### Resource Requirements

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Prometheus | 1-2 cores | 2-4GB | 100GB SSD |
| Elasticsearch | 2-4 cores | 4-8GB | 200GB SSD |
| Grafana | 0.5-1 core | 512MB-1GB | 10GB |
| Fluentd | 1-2 cores | 1-2GB | 20GB |

### High Availability

- Deploy Prometheus in HA mode with external storage
- Use Elasticsearch cluster with multiple nodes
- Configure Grafana with external database
- Implement load balancing for monitoring services

### Backup and Recovery

- Regular Grafana dashboard exports
- Elasticsearch snapshot policies
- Prometheus data backup strategies
- Configuration version control

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review logs in Kibana
3. Check alert notifications
4. Contact the DevOps team

## 📝 License

This monitoring configuration is part of the WhatsApp SaaS platform.
All configurations and custom code are proprietary and confidential.