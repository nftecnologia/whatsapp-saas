import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { globalRateLimit } from '@/middleware/rateLimiter';
import authRoutes from '@/routes/auth';
import contactRoutes from '@/routes/contacts';
import templateRoutes from '@/routes/templates';
import campaignRoutes from '@/routes/campaigns';
import companyRoutes from '@/routes/companies';
import userRoutes from '@/routes/users';
import messageLogRoutes from '@/routes/messageLogs';
import { Scheduler } from '@/utils/scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(globalRateLimit);

app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1');
    const redisResult = await redis.ping();
    
    res.json({
      success: true,
      message: 'Server is healthy',
      services: {
        database: dbResult.rows.length > 0 ? 'connected' : 'disconnected',
        redis: redisResult === 'PONG' ? 'connected' : 'disconnected',
        rabbitmq: rabbitmq.getChannel() ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp SaaS Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

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
    await redis.connect();
    console.log('✅ Redis connected successfully');
    
    await rabbitmq.connect();
    console.log('✅ RabbitMQ connected successfully');

    const dbResult = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully at:', dbResult.rows[0].now);

    app.listen(PORT, () => {
      console.log(`🚀 Backend API server running on port ${PORT}`);
      console.log(`📝 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'production') {
        Scheduler.startScheduledCampaignProcessor();
        Scheduler.startCampaignCompletionChecker();
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  console.log('🔄 Graceful shutdown initiated...');
  
  try {
    Scheduler.stopAllSchedulers();
    console.log('✅ All schedulers stopped');
    
    await redis.quit();
    console.log('✅ Redis connection closed');
    
    await rabbitmq.close();
    console.log('✅ RabbitMQ connection closed');
    
    await pool.end();
    console.log('✅ PostgreSQL connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();