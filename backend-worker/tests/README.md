# Backend Worker Tests

This directory contains comprehensive tests for the WhatsApp SaaS Backend Worker Service.

## Test Structure

```
tests/
├── setup.ts                           # Global test setup and mocks
├── config/
│   └── rabbitmq.test.ts              # RabbitMQ configuration tests
├── services/
│   ├── messageProcessor.test.ts       # Core message processing logic
│   ├── evolutionApiService.test.ts    # Evolution API integration tests
│   ├── databaseService.test.ts        # Database operations tests
│   └── healthService.test.ts          # Health monitoring tests
├── integration/
│   └── workerService.test.ts          # End-to-end worker service tests
├── error-handling/
│   └── retry-logic.test.ts            # Error handling and retry logic tests
└── README.md                          # This file
```

## Test Categories

### Unit Tests
- **MessageProcessor**: Tests core message processing logic, validation, integration handling, and stats tracking
- **EvolutionAPIService**: Tests WhatsApp API integration, phone number formatting, and error handling
- **DatabaseService**: Tests database operations, message logging, and campaign tracking
- **HealthService**: Tests health monitoring, metrics collection, and service status checks

### Integration Tests
- **WorkerService**: Tests the main worker service startup, shutdown, and message processing flow
- **RabbitMQ Configuration**: Tests queue setup, message consumption, and retry logic

### Error Handling Tests
- **Retry Logic**: Tests message retry mechanisms, circuit breaker patterns, and DLQ handling
- **Resource Cleanup**: Tests proper cleanup of resources during failures

## Test Coverage

The test suite covers:

✅ **Message Processing**
- Valid message job processing
- Job validation and error handling
- WhatsApp integration lookup
- Evolution API communication
- Database logging
- Campaign status updates

✅ **Evolution API Integration**
- Text and media message sending
- Instance management (create, delete, status)
- QR code generation and logout
- Phone number formatting and validation
- Error response handling

✅ **Database Operations**
- Message log creation and updates
- Integration management
- Campaign contact status tracking
- Worker activity logging
- Error handling for database failures

✅ **RabbitMQ Operations**
- Queue connection and setup
- Message consumption
- Retry logic with exponential backoff
- Dead letter queue handling
- Connection error recovery

✅ **Health Monitoring**
- Service health checks (Database, Redis, RabbitMQ)
- System metrics collection
- Worker metrics tracking
- Liveness and readiness probes
- Processing time analytics

✅ **Error Handling**
- API timeout and rate limiting
- Database connection failures
- Malformed message handling
- Circuit breaker patterns
- Resource cleanup on errors

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test messageProcessor.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with verbose output
npm test -- --verbose
```

## Test Configuration

Tests are configured with:
- TypeScript support via ts-jest
- Path mapping for `@/` imports
- Global mocks for external dependencies
- 10-second timeout for async operations
- Automatic mock clearing between tests

## Mock Strategy

The test suite uses comprehensive mocking:
- **Database**: Mocked PostgreSQL pool with query responses
- **Redis**: Mocked Redis client with connection and operations
- **RabbitMQ**: Mocked AMQP connection, channels, and messaging
- **HTTP Client**: Mocked Axios for Evolution API calls
- **System**: Mocked environment variables and system resources

## Key Test Utilities

### Mock Factories
- `createMockSendMessageJob()`: Creates realistic message job objects
- `createMockWhatsAppIntegration()`: Creates integration configurations
- `createMockEvolutionAPIResponse()`: Creates API response objects
- `createMockMessageLog()`: Creates database log entries

### Test Helpers
- Automatic environment variable setup
- Mock reset between tests
- Global mock objects accessible via `global.testMocks`
- Realistic error simulation scenarios

## CI/CD Integration

Tests are designed to run in CI environments with:
- No external dependencies required
- Deterministic test execution
- Comprehensive error scenarios
- Performance benchmarking capabilities

## Adding New Tests

When adding new tests:
1. Follow the existing directory structure
2. Use the mock factories from `setup.ts`
3. Test both success and failure scenarios
4. Include proper cleanup in test teardown
5. Add realistic error conditions
6. Update this README if adding new test categories