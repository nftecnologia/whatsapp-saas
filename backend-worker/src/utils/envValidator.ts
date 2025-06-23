import { z } from 'zod';
import crypto from 'crypto';

// Environment variable schema for worker service
const WorkerEnvSchema = z.object({
  // Basic configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3001),
  
  // Database configuration
  DATABASE_URL: z.string().url().min(1, 'Database URL is required'),
  DB_HOST: z.string().min(1, 'Database host is required'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1, 'Database name is required'),
  DB_USER: z.string().min(1, 'Database user is required'),
  DB_PASSWORD: z.string().min(1, 'Database password is required'),
  DB_SSL: z.enum(['require', 'prefer', 'disable']).default('prefer'),
  DB_MAX_CONNECTIONS: z.coerce.number().min(1).max(100).default(10),
  
  // Redis configuration
  REDIS_URL: z.string().url().min(1, 'Redis URL is required'),
  REDIS_HOST: z.string().min(1, 'Redis host is required'),
  REDIS_PORT: z.coerce.number().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).max(15).default(0),
  
  // RabbitMQ configuration
  RABBITMQ_URL: z.string().url().min(1, 'RabbitMQ URL is required'),
  RABBITMQ_HOST: z.string().min(1, 'RabbitMQ host is required'),
  RABBITMQ_PORT: z.coerce.number().min(1).max(65535).default(5672),
  RABBITMQ_USER: z.string().min(1, 'RabbitMQ user is required'),
  RABBITMQ_PASSWORD: z.string().min(1, 'RabbitMQ password is required'),
  RABBITMQ_VHOST: z.string().default('/'),
  RABBITMQ_QUEUE: z.string().default('send_message'),
  RABBITMQ_DEAD_LETTER_QUEUE: z.string().default('send_message_dlx'),
  
  // Evolution API configuration
  EVOLUTION_API_BASE_URL: z.string().url().min(1, 'Evolution API base URL is required'),
  EVOLUTION_API_KEY: z.string().min(1, 'Evolution API key is required'),
  EVOLUTION_API_TIMEOUT: z.coerce.number().min(5000).max(60000).default(30000),
  
  // Worker configuration
  WORKER_CONCURRENCY: z.coerce.number().min(1).max(100).default(5),
  MAX_RETRY_ATTEMPTS: z.coerce.number().min(1).max(10).default(3),
  RETRY_DELAY_MS: z.coerce.number().min(1000).max(300000).default(5000),
  DEAD_LETTER_TTL: z.coerce.number().min(60000).max(604800000).default(86400000), // 24 hours
  
  // Security configuration
  ENABLE_API_VALIDATION: z.enum(['true', 'false']).default('true'),
  ENABLE_REQUEST_LOGGING: z.enum(['true', 'false']).default('true'),
  ENABLE_ERROR_REPORTING: z.enum(['true', 'false']).default('true'),
  
  // Monitoring and logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.enum(['true', 'false']).default('false'),
  HEALTH_CHECK_PORT: z.coerce.number().min(1000).max(65535).default(3002),
  
  // Application settings
  APP_NAME: z.string().default('WhatsApp SaaS Worker'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Optional integrations
  SENTRY_DSN: z.string().url().optional(),
  WEBHOOK_URL: z.string().url().optional(),
  WEBHOOK_SECRET: z.string().min(32, 'Webhook secret must be at least 32 characters').optional(),
});

type WorkerEnvConfig = z.infer<typeof WorkerEnvSchema>;

class WorkerEnvValidator {
  private static instance: WorkerEnvValidator;
  private config: WorkerEnvConfig;
  private criticalSecrets: string[] = [
    'DATABASE_URL',
    'REDIS_URL',
    'RABBITMQ_URL',
    'EVOLUTION_API_KEY',
    'WEBHOOK_SECRET',
  ];

  private constructor() {
    this.config = this.validateEnvironment();
    this.validateSecrets();
  }

  public static getInstance(): WorkerEnvValidator {
    if (!WorkerEnvValidator.instance) {
      WorkerEnvValidator.instance = new WorkerEnvValidator();
    }
    return WorkerEnvValidator.instance;
  }

  private validateEnvironment(): WorkerEnvConfig {
    try {
      const parsed = WorkerEnvSchema.parse(process.env);
      console.log('✅ Worker environment validation passed');
      return parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Worker environment validation failed:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        
        // Show missing required variables
        const missingVars = error.errors
          .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
          .map(err => err.path.join('.'));
          
        if (missingVars.length > 0) {
          console.error('\n📝 Missing required environment variables:');
          missingVars.forEach(variable => {
            console.error(`  - ${variable}`);
          });
        }
      }
      
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      process.exit(1);
    }
  }

  private validateSecrets(): void {
    const weakSecrets: string[] = [];
    
    this.criticalSecrets.forEach(secretName => {
      const secretValue = this.config[secretName as keyof WorkerEnvConfig] as string;
      if (secretValue && this.isWeakSecret(secretValue)) {
        weakSecrets.push(secretName);
      }
    });
    
    if (weakSecrets.length > 0) {
      console.warn('⚠️  Weak secrets detected:');
      weakSecrets.forEach(secret => {
        console.warn(`  - ${secret}: Consider using a stronger secret`);
      });
      
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Weak secrets are not allowed in production');
        process.exit(1);
      }
    }
  }

  private isWeakSecret(secret: string): boolean {
    // Check for common weak patterns
    const weakPatterns = [
      /^(secret|password|key|token)$/i,
      /^(123|test|dev|demo)/i,
      /^(.)\1{7,}$/, // Repeated characters
      /^(qwerty|password|admin|root)/i,
    ];
    
    // Check minimum length
    if (secret.length < 16) return true;
    
    // Check for weak patterns
    if (weakPatterns.some(pattern => pattern.test(secret))) return true;
    
    // Check for sufficient entropy
    const uniqueChars = new Set(secret).size;
    if (uniqueChars < 8) return true;
    
    return false;
  }

  public getConfig(): WorkerEnvConfig {
    return { ...this.config };
  }

  public get<K extends keyof WorkerEnvConfig>(key: K): WorkerEnvConfig[K] {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  // Get sanitized config for logging (removes sensitive data)
  public getSanitizedConfig(): Partial<WorkerEnvConfig> {
    const sanitized = { ...this.config };
    
    // Remove sensitive values
    const sensitiveKeys = [
      'DATABASE_URL',
      'DB_PASSWORD',
      'REDIS_PASSWORD',
      'RABBITMQ_PASSWORD',
      'EVOLUTION_API_KEY',
      'WEBHOOK_SECRET',
    ];
    
    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        (sanitized as any)[key] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }

  // Health check for critical services
  public getCriticalServices(): Array<{ name: string; url: string; required: boolean }> {
    return [
      { name: 'PostgreSQL', url: this.config.DATABASE_URL, required: true },
      { name: 'Redis', url: this.config.REDIS_URL, required: true },
      { name: 'RabbitMQ', url: this.config.RABBITMQ_URL, required: true },
      { 
        name: 'Evolution API', 
        url: this.config.EVOLUTION_API_BASE_URL, 
        required: true 
      },
    ];
  }

  // Validate worker-specific configuration
  public validateWorkerConfig(): boolean {
    // Check if worker concurrency is reasonable
    if (this.config.WORKER_CONCURRENCY > 20) {
      console.warn('⚠️  High worker concurrency may impact performance');
    }

    // Check retry configuration
    if (this.config.MAX_RETRY_ATTEMPTS > 5) {
      console.warn('⚠️  High retry attempts may delay error detection');
    }

    // Check dead letter TTL
    if (this.config.DEAD_LETTER_TTL < 3600000) { // 1 hour
      console.warn('⚠️  Short dead letter TTL may cause data loss');
    }

    return true;
  }
}

// Export singleton instance
export const workerEnvValidator = WorkerEnvValidator.getInstance();
export type { WorkerEnvConfig };
export default workerEnvValidator;