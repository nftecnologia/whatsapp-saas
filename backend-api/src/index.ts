import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import fileUpload from 'express-fileupload';

// Initialize environment variables first
dotenv.config();

// Import environment validator
import { envValidator } from '@/utils/envValidator';

// Validate environment on startup
const config = envValidator.getConfig();

import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { globalRateLimit } from '@/middleware/rateLimiter';
import securityMiddleware from '@/middleware/security';
import { auditMiddleware } from '@/middleware/auditLogger';
import { detectInjectionAttempts } from '@/middleware/validation';
import authRoutes from '@/routes/auth';
import contactRoutes from '@/routes/contacts';
import templateRoutes from '@/routes/templates';
import campaignRoutes from '@/routes/campaigns';
import companyRoutes from '@/routes/companies';
import userRoutes from '@/routes/users';
import messageLogRoutes from '@/routes/messageLogs';
import healthRoutes from '@/routes/health';
import monitoringRoutes from '@/routes/monitoring';
import apmRoutes from '@/routes/apm';
import metricsMiddleware from '@/middleware/metricsMiddleware';
import apmMiddleware from '@/middleware/apmMiddleware';
import monitoringService from '@/services/monitoringService';
import apmService from '@/services/apmService';
import logger from '@/utils/logger';
import { Scheduler } from '@/utils/scheduler';

const app = express();
const PORT = config.PORT;

// Trust proxy if behind reverse proxy
app.set('trust proxy', true);

// Security headers
app.use(securityMiddleware.securityHeaders);
app.use(securityMiddleware.additionalSecurityHeaders);

// CORS with security configuration
app.use(cors(securityMiddleware.corsConfig));

// Compression
app.use(compression());

// Request ID generation
app.use(securityMiddleware.generateRequestId);

// Logging
app.use(morgan('combined', {
  skip: (req) => req.path === '/health', // Skip health check logs
}));

// File upload security
app.use(fileUpload(securityMiddleware.secureFileUpload));

// Request size limiting
app.use(securityMiddleware.requestSizeLimit('10mb'));

// Body parsing with limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Verify JSON payload
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100,
}));

// IP validation
app.use(securityMiddleware.validateIP);

// Input sanitization
app.use(securityMiddleware.sanitizeInput);

// Injection detection
app.use(detectInjectionAttempts);

// Audit logging
app.use(auditMiddleware);

// Monitoring middleware
app.use(apmMiddleware.getMiddleware());
app.use(metricsMiddleware.getMiddleware());

// Rate limiting
app.use(globalRateLimit);

// Slow down suspicious requests
app.use(securityMiddleware.slowDownSuspicious);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp SaaS Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/health', healthRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/apm', apmRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', messageLogRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    // Store start time for metrics
    (process as any).startTime = Date.now();
    
    await redis.connect();
    logger.info('Redis connected successfully');
    
    await rabbitmq.connect();
    logger.info('RabbitMQ connected successfully');

    const dbResult = await pool.query('SELECT NOW()');
    logger.info('PostgreSQL connected successfully', { 
      connectedAt: dbResult.rows[0].now 
    });

    // Start monitoring services
    monitoringService.start();
    logger.info('Monitoring service started');
    
    apmService.enable();
    logger.info('APM service enabled');

    app.listen(PORT, () => {
      logger.info('Backend API server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/health`,
        monitoring: `http://localhost:${PORT}/monitoring/status`,
        apm: `http://localhost:${PORT}/apm/status`,
        metrics: `http://localhost:${PORT}/health/prometheus`,
      });
      
      if (process.env.NODE_ENV === 'production') {
        Scheduler.startScheduledCampaignProcessor();
        Scheduler.startCampaignCompletionChecker();
        logger.info('Schedulers started for production environment');
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  logger.info('Graceful shutdown initiated');
  
  try {
    // Stop monitoring services
    monitoringService.stop();
    logger.info('Monitoring service stopped');
    
    apmService.disable();
    logger.info('APM service disabled');
    
    Scheduler.stopAllSchedulers();
    logger.info('All schedulers stopped');
    
    await redis.quit();
    logger.info('Redis connection closed');
    
    await rabbitmq.close();
    logger.info('RabbitMQ connection closed');
    
    await pool.end();
    logger.info('PostgreSQL connection closed');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();