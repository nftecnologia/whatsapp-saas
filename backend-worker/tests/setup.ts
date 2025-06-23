import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5672';
process.env.EVOLUTION_API_BASE_URL = 'http://localhost:8080';
process.env.EVOLUTION_API_KEY = 'test-api-key';
process.env.WORKER_ID = 'test-worker-001';
process.env.SEND_MESSAGE_QUEUE = 'test_send_message';
process.env.DLQ_SEND_MESSAGE_QUEUE = 'test_send_message_dlq';
process.env.MAX_CONCURRENT_JOBS = '5';
process.env.MAX_RETRY_ATTEMPTS = '3';
process.env.RETRY_DELAY_MS = '1000';
process.env.PROCESSING_DELAY_MS = '100';

// Mock database pool
const mockPool = {
  query: jest.fn(),
  end: jest.fn(),
  connect: jest.fn(),
};

// Mock Redis client
const mockRedis = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
};

// Mock RabbitMQ
const mockRabbitMQ = {
  connect: jest.fn(),
  close: jest.fn(),
  consumeMessages: jest.fn(),
  getChannel: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
};

// Mock amqplib
const mockChannel = {
  assertQueue: jest.fn(),
  prefetch: jest.fn(),
  consume: jest.fn(),
  ack: jest.fn(),
  nack: jest.fn(),
  publish: jest.fn(),
  close: jest.fn(),
};

const mockConnection = {
  createChannel: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
};

// Setup mock return values
(mockConnection.createChannel as any).mockResolvedValue(mockChannel);

// Mock axios
const mockAxios = {
  create: jest.fn().mockReturnThis(),
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Apply mocks
jest.mock('@/config/database', () => mockPool);
jest.mock('@/config/redis', () => mockRedis);
jest.mock('@/config/rabbitmq', () => mockRabbitMQ);
// Mock amqplib with deferred setup
const mockAmqpConnect = jest.fn();
jest.mock('amqplib', () => ({
  connect: mockAmqpConnect,
}));

// Setup mock return value after declaration
(mockAmqpConnect as any).mockResolvedValue(mockConnection);
jest.mock('axios', () => mockAxios);
jest.mock('@/utils/logger', () => mockLogger);

// Global test utilities
declare global {
  var testMocks: {
    pool: typeof mockPool;
    redis: typeof mockRedis;
    rabbitmq: typeof mockRabbitMQ;
    channel: typeof mockChannel;
    connection: typeof mockConnection;
    axios: typeof mockAxios;
    logger: typeof mockLogger;
  };
}

global.testMocks = {
  pool: mockPool,
  redis: mockRedis,
  rabbitmq: mockRabbitMQ,
  channel: mockChannel,
  connection: mockConnection,
  axios: mockAxios,
  logger: mockLogger,
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Helper functions for common test scenarios
export const createMockSendMessageJob = (overrides = {}) => ({
  id: 'test-job-123',
  campaign_id: 'campaign-456',
  contact_id: 'contact-789',
  phone: '+5511999999999',
  message_content: 'Test message content',
  company_id: 'company-123',
  integration_id: 'integration-456',
  retry_count: 0,
  created_at: new Date(),
  ...overrides,
});

export const createMockWhatsAppIntegration = (overrides = {}) => ({
  id: 'integration-456',
  company_id: 'company-123',
  instance_name: 'test-instance',
  instance_key: 'test-instance-key',
  status: 'connected' as const,
  phone_number: '+5511999999999',
  profile_name: 'Test Profile',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const createMockMessageLog = (overrides = {}) => ({
  id: 'log-123',
  company_id: 'company-123',
  campaign_id: 'campaign-456',
  contact_id: 'contact-789',
  phone: '+5511999999999',
  message_content: 'Test message content',
  status: 'pending' as const,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const createMockEvolutionAPIResponse = (success = true, overrides = {}) => ({
  success,
  data: success ? { messageId: 'msg-123', status: 'sent' } : null,
  messageId: success ? 'msg-123' : undefined,
  error: success ? undefined : 'Test error message',
  ...overrides,
});