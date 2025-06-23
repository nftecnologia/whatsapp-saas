import { Pool } from 'pg';
import Redis from 'redis';

// Mock external dependencies
jest.mock('@/config/database', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

jest.mock('@/config/redis', () => ({
  connect: jest.fn(),
  ping: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

jest.mock('@/config/rabbitmq', () => ({
  connect: jest.fn(),
  getChannel: jest.fn(),
  publishToQueue: jest.fn(),
  close: jest.fn(),
}));

// Mock Stack Auth
jest.mock('@stack-auth/node', () => ({
  stackAuth: {
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  },
}));

// Global test configuration
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5672';
});

afterAll(async () => {
  // Cleanup after all tests
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

// Test helpers
export const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  role: 'user' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockCompany = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Company',
  email: 'company@example.com',
  phone: '+1234567890',
  plan: 'basic' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockContact = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Contact',
  phone: '+1234567890',
  email: 'contact@example.com',
  tags: ['customer', 'vip'],
  custom_fields: { department: 'Sales' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockTemplate = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Template',
  content: 'Hello {{name}}, this is a test message!',
  category: 'marketing' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockCampaign = {
  id: '123e4567-e89b-12d3-a456-426614174004',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  template_id: '123e4567-e89b-12d3-a456-426614174003',
  name: 'Test Campaign',
  status: 'draft' as const,
  scheduled_at: null,
  variables: { product: 'WhatsApp SaaS' },
  total_contacts: 0,
  sent_count: 0,
  delivered_count: 0,
  read_count: 0,
  failed_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockMessageLog = {
  id: '123e4567-e89b-12d3-a456-426614174005',
  campaign_id: '123e4567-e89b-12d3-a456-426614174004',
  contact_id: '123e4567-e89b-12d3-a456-426614174002',
  phone: '+1234567890',
  message_content: 'Hello Test Contact, this is a test message!',
  status: 'sent' as const,
  whatsapp_message_id: 'wamid.test123',
  evolution_api_response: { success: true },
  created_at: new Date().toISOString(),
  sent_at: new Date().toISOString(),
  delivered_at: null,
  read_at: null,
  error_message: null,
};

// Database mock helpers
export const mockDbQuery = (returnValue: any) => {
  const mockPool = require('@/config/database');
  mockPool.query.mockResolvedValue({ rows: Array.isArray(returnValue) ? returnValue : [returnValue] });
  return mockPool;
};

export const mockDbError = (error: Error) => {
  const mockPool = require('@/config/database');
  mockPool.query.mockRejectedValue(error);
  return mockPool;
};

// Redis mock helpers
export const mockRedisSuccess = () => {
  const mockRedis = require('@/config/redis');
  mockRedis.ping.mockResolvedValue('PONG');
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.del.mockResolvedValue(1);
  return mockRedis;
};

// RabbitMQ mock helpers
export const mockRabbitMQSuccess = () => {
  const mockRabbitMQ = require('@/config/rabbitmq');
  const mockChannel = {
    sendToQueue: jest.fn().mockResolvedValue(true),
    assertQueue: jest.fn().mockResolvedValue({}),
  };
  mockRabbitMQ.getChannel.mockReturnValue(mockChannel);
  mockRabbitMQ.publishToQueue.mockResolvedValue(true);
  return { mockRabbitMQ, mockChannel };
};