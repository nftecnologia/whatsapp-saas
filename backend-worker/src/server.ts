import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import healthRoutes from '@/routes/health';

export function createHealthServer(port: number = 3001) {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '1mb' }));

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'WhatsApp SaaS Worker Service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Health routes
  app.use('/health', healthRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found',
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Health server error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  });

  const server = app.listen(port, () => {
    console.log(`🏥 Worker health server running on port ${port}`);
    console.log(`📝 Health check: http://localhost:${port}/health`);
  });

  const gracefulShutdown = () => {
    console.log('🔄 Health server shutdown initiated...');
    server.close(() => {
      console.log('✅ Health server closed');
    });
  };

  return { app, server, gracefulShutdown };
}