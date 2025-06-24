# WhatsApp Cloud API Integration with Evolution API v2

This document describes the comprehensive Cloud API integration features added to the EvolutionApiService class in the backend-worker service.

## Overview

The enhanced EvolutionApiService now supports both WhatsApp integrations:
- **WHATSAPP-BAILEYS**: Traditional Baileys-based integration (existing)
- **WHATSAPP-CLOUD-API**: Meta's official WhatsApp Cloud API (new)

## Key Features

### 1. Dual Integration Support
- Backwards compatible with existing Baileys integrations
- Full support for WhatsApp Cloud API through Evolution API v2
- Smart auto-detection of integration type
- Unified interface for both integration types

### 2. Cloud API Specific Features
- Instance creation with Meta access tokens
- Template message support
- Webhook configuration management
- Cloud API compliant message formats
- Business account integration

### 3. Enhanced Error Handling
- Intelligent retry mechanism with exponential backoff
- Distinction between retryable and non-retryable errors
- Comprehensive error logging and monitoring
- Rate limiting handling

### 4. Security & Validation
- Strict validation of Cloud API configurations
- Access token format validation
- Webhook URL security checks
- Input sanitization and validation

## Configuration

### Environment Variables

```bash
# Evolution API Configuration
EVOLUTION_API_BASE_URL=http://your-evolution-api-url:8080
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_API_TIMEOUT=30000

# Retry Configuration
EVOLUTION_API_MAX_RETRIES=3
EVOLUTION_API_RETRY_DELAY=1000

# Test Environment (disables retries)
NODE_ENV=test
```

### Cloud API Configuration Object

```typescript
interface CloudAPIConfig {
  accessToken: string;          // Meta access token (starts with EAA)
  phoneNumberId: string;        // WhatsApp Business phone number ID
  businessAccountId: string;    // Meta Business Account ID
  webhookVerifyToken?: string;  // Webhook verification token
}
```

## Usage Examples

### 1. Creating a Cloud API Instance

```typescript
import evolutionApiService from './services/evolutionApiService';

const config = {
  instanceName: 'my-company-whatsapp',
  instanceKey: 'my-company-whatsapp',
  integration: 'WHATSAPP-CLOUD-API',
  cloudApiConfig: {
    accessToken: 'EAAYourMetaAccessToken...',
    phoneNumberId: '123456789012345',
    businessAccountId: '987654321098765',
    webhookVerifyToken: 'your-webhook-token'
  },
  webhookUrl: 'https://your-domain.com/webhook'
};

const result = await evolutionApiService.createCloudAPIInstance(config);
if (result.success) {
  console.log('Instance created:', result.data);
}
```

### 2. Sending Text Messages

```typescript
// Cloud API format
const message = {
  messaging_product: 'whatsapp',
  to: '5511999999999',
  type: 'text',
  text: { body: 'Hello from Cloud API!' }
};

const result = await evolutionApiService.sendCloudAPIMessage('instance-key', message);
```

### 3. Sending Template Messages

```typescript
const template = {
  name: 'hello_world',
  language: 'en_US',
  parameters: [
    { type: 'text', text: 'Customer Name' }
  ]
};

const result = await evolutionApiService.sendCloudAPITemplate(
  'instance-key',
  '5511999999999',
  template
);
```

### 4. Smart Message Sending (Auto-Detection)

```typescript
// Automatically detects integration type and uses appropriate method
const result = await evolutionApiService.sendMessage(
  'instance-key',
  '5511999999999',
  'Your message here'
);
```

### 5. Media Messages

```typescript
const mediaMessage = {
  messaging_product: 'whatsapp',
  to: '5511999999999',
  type: 'image',
  image: {
    link: 'https://your-domain.com/image.jpg',
    caption: 'Check this out!'
  }
};

const result = await evolutionApiService.sendCloudAPIMessage('instance-key', mediaMessage);
```

## Integration with Message Processor

The message processor has been updated to intelligently handle both integration types:

```typescript
// In messageProcessor.ts
const response = await evolutionApiService.sendMessage(
  integration.instance_key,
  formattedPhone,
  job.message_content,
  integration.integration_type // Auto-detects if not provided
);
```

## Database Schema Updates

The WhatsApp integrations table now includes:

```sql
ALTER TABLE whatsapp_integrations ADD COLUMN integration_type VARCHAR(50) DEFAULT 'WHATSAPP-BAILEYS';
ALTER TABLE whatsapp_integrations ADD COLUMN cloud_api_config JSONB;
ALTER TABLE whatsapp_integrations ADD COLUMN webhook_url TEXT;
```

## Webhook Configuration

Cloud API instances support webhook configuration for real-time updates:

```typescript
await evolutionApiService.updateCloudAPIWebhook(
  'instance-key',
  'https://your-domain.com/webhook',
  ['MESSAGE_RECEIVED', 'MESSAGE_STATUS_UPDATE']
);
```

## Error Handling

The service includes comprehensive error handling:

```typescript
const result = await evolutionApiService.sendCloudAPIMessage(instanceKey, message);

if (!result.success) {
  console.error('Message failed:', result.error);
  // Handle specific error types
  if (result.error.includes('access token')) {
    // Handle authentication error
  } else if (result.error.includes('rate limit')) {
    // Handle rate limiting
  }
}
```

## Retry Mechanism

The service automatically retries failed requests with exponential backoff:

- Network errors (ECONNRESET, ETIMEDOUT)
- Server errors (5xx status codes)
- Rate limiting (429 status code)
- Configurable retry count and delay
- Disabled during testing (NODE_ENV=test)

## Validation Features

### Cloud API Configuration Validation
- Access token format (must start with 'EAA')
- Required fields validation
- Business account ID format

### Message Validation
- messaging_product must be 'whatsapp'
- Required fields per message type
- Media URL security checks (HTTPS only)
- Template format validation

### Security Features
- Input sanitization
- Webhook URL validation (HTTPS only)
- Error message sanitization (removes sensitive data)
- Request/response logging for audit

## Testing

The service includes comprehensive test coverage:

```bash
# Run tests
npm test -- --testPathPattern=evolutionApiService.test.ts

# Run with coverage
npm run test:coverage
```

Test categories:
- Cloud API instance creation
- Message sending (text, media, templates)
- Error handling and retries
- Smart message detection
- Webhook management
- Validation functions

## Migration from Baileys

Existing Baileys integrations continue to work without changes. To migrate:

1. Update integration_type in database
2. Add cloud_api_config with Meta credentials
3. Update instance through Evolution API
4. Test message sending

## Monitoring and Logging

The service provides detailed logging:

```
✅ Cloud API instance created: my-company-whatsapp
📱 Sending message to 5511999999999 via instance-key (WHATSAPP-CLOUD-API)
✅ Message sent successfully: wamid.123456789
⚠️  Evolution API Rate Limit Exceeded
⏳ Retrying in 2000ms...
```

## Performance Considerations

- Connection pooling for HTTP requests
- Configurable timeouts
- Rate limiting awareness
- Exponential backoff for retries
- Memory-efficient error handling

## Troubleshooting

### Common Issues

1. **Access Token Invalid**
   - Ensure token starts with 'EAA'
   - Verify token has required permissions
   - Check token expiration

2. **Phone Number Format**
   - Use international format without '+'
   - Example: 5511999999999 (not +55 11 99999-9999)

3. **Template Not Found**
   - Verify template is approved in Meta Business Manager
   - Check template name and language code
   - Ensure parameters match template definition

4. **Webhook Issues**
   - Use HTTPS URLs only
   - Verify webhook endpoint is accessible
   - Check webhook verification token

### Debug Mode

Enable detailed logging by setting log level:

```typescript
// In development
console.log = console.debug = (...args) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};
```

## Future Enhancements

Planned features:
- Flow API integration
- Interactive message support
- Catalog API integration
- Advanced analytics
- Multi-instance management
- Real-time status monitoring

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Evolution API v2 documentation
3. Verify Meta Cloud API configuration
4. Check service logs for detailed error information

---

*This integration provides a robust, production-ready WhatsApp Cloud API solution through Evolution API v2, maintaining full backwards compatibility with existing Baileys integrations.*