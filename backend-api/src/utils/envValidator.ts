import { z } from 'zod';
import crypto from 'crypto';

// Environment variable schema
const EnvSchema = z.object({
  // Basic configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3000),
  
  // Database configuration
  DATABASE_URL: z.string().url().min(1, 'Database URL is required'),
  DB_HOST: z.string().min(1, 'Database host is required'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1, 'Database name is required'),
  DB_USER: z.string().min(1, 'Database user is required'),
  DB_PASSWORD: z.string().min(1, 'Database password is required'),
  DB_SSL: z.enum(['require', 'prefer', 'disable']).default('prefer'),
  DB_MAX_CONNECTIONS: z.coerce.number().min(1).max(100).default(20),
  
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
  
  // Authentication and security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  
  // Stack Auth configuration
  STACK_AUTH_PROJECT_ID: z.string().min(1, 'Stack Auth project ID is required'),
  STACK_AUTH_SECRET_KEY: z.string().min(1, 'Stack Auth secret key is required'),
  STACK_AUTH_PUBLISHABLE_KEY: z.string().min(1, 'Stack Auth publishable key is required'),
  
  // Evolution API configuration
  EVOLUTION_API_BASE_URL: z.string().url().min(1, 'Evolution API base URL is required'),
  EVOLUTION_API_KEY: z.string().min(1, 'Evolution API key is required'),
  EVOLUTION_API_TIMEOUT: z.coerce.number().min(5000).max(60000).default(30000),
  
  // Security configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  VALID_API_KEYS: z.string().optional(),
  BLOCKED_IPS: z.string().optional(),
  ALLOWED_COUNTRIES: z.string().optional(),
  
  // Rate limiting configuration
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(60000).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(10).default(100),
  
  // File upload configuration
  MAX_FILE_SIZE: z.coerce.number().min(1024).default(10485760), // 10MB
  UPLOAD_DIR: z.string().default('/tmp/uploads'),
  
  // Cloudflare R2 configuration (optional)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  
  // Monitoring and logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.enum(['true', 'false']).default('false'),
  SENTRY_DSN: z.string().url().optional(),
  
  // Application settings
  APP_NAME: z.string().default('WhatsApp SaaS API'),
  APP_VERSION: z.string().default('1.0.0'),
  API_PREFIX: z.string().default('/api'),
  
  // Email configuration (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().min(1).max(65535).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // Webhook configuration
  WEBHOOK_SECRET: z.string().min(32, 'Webhook secret must be at least 32 characters').optional(),
  
  // Development and testing
  ENABLE_SWAGGER: z.enum(['true', 'false']).default('false'),
  MOCK_EXTERNAL_APIS: z.enum(['true', 'false']).default('false'),
});

type EnvConfig = z.infer<typeof EnvSchema>;

class EnvValidator {
  private static instance: EnvValidator;
  private config: EnvConfig;
  private criticalSecrets: string[] = [
    'JWT_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'RABBITMQ_URL',
    'STACK_AUTH_SECRET_KEY',
    'EVOLUTION_API_KEY',
  ];

  private constructor() {
    this.config = this.validateEnvironment();
    this.validateSecrets();
  }

  public static getInstance(): EnvValidator {
    if (!EnvValidator.instance) {
      EnvValidator.instance = new EnvValidator();
    }
    return EnvValidator.instance;
  }

  private validateEnvironment(): EnvConfig {
    try {
      const parsed = EnvSchema.parse(process.env);
      console.log('✅ Environment validation passed');
      return parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Environment validation failed:');
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
      const secretValue = this.config[secretName as keyof EnvConfig] as string;
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

  public getConfig(): EnvConfig {
    return { ...this.config };
  }

  public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
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

  // Generate secure secrets for development
  public static generateSecureSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Validate database connection string
  public validateDatabaseUrl(): boolean {
    try {
      const url = new URL(this.config.DATABASE_URL);
      return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
    } catch {
      return false;
    }
  }

  // Validate Redis connection string
  public validateRedisUrl(): boolean {
    try {
      const url = new URL(this.config.REDIS_URL);
      return url.protocol === 'redis:' || url.protocol === 'rediss:';
    } catch {
      return false;
    }
  }

  // Get sanitized config for logging (removes sensitive data)
  public getSanitizedConfig(): Partial<EnvConfig> {
    const sanitized = { ...this.config };
    
    // Remove sensitive values
    const sensitiveKeys = [
      'JWT_SECRET',
      'DATABASE_URL',
      'DB_PASSWORD',
      'REDIS_PASSWORD',
      'RABBITMQ_PASSWORD',
      'STACK_AUTH_SECRET_KEY',
      'EVOLUTION_API_KEY',
      'VALID_API_KEYS',
      'R2_SECRET_ACCESS_KEY',
      'SMTP_PASS',
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
}

// Export singleton instance
export const envValidator = EnvValidator.getInstance();
export type { EnvConfig };
export default envValidator;