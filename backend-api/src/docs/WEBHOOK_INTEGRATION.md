# Evolution API v2 Webhook Integration

This document describes the webhook integration with Evolution API v2 for real-time message status updates.

## Overview

The webhook endpoints handle incoming notifications from Evolution API v2 to update message statuses in real-time. This ensures accurate delivery tracking and campaign analytics.

## Webhook Endpoints

### POST /webhooks/evolution
**Main webhook endpoint for Evolution API v2 unified webhooks**

Handles all webhook events from Evolution API and routes them to specific handlers based on event type.

**Request Headers:**
- `Content-Type: application/json`
- `x-api-key: <your-api-key>` (optional)
- `Authorization: Bearer <token>` (optional)

**Request Body:**
```json
{
  "instance": "your-instance-name",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": true,
      "id": "message-id-from-whatsapp"
    },
    "messageTimestamp": 1640995200,
    "status": "DELIVERY_ACK",
    "participant": "5511999999999@s.whatsapp.net"
  },
  "destination": "5511888888888@s.whatsapp.net",
  "date_time": "2023-01-01T12:00:00Z",
  "sender": "evolution-api",
  "server_url": "https://your-evolution-api.com",
  "apikey": "your-api-key",
  "webhook": "https://your-app.com/webhooks/evolution",
  "events": ["MESSAGES_UPDATE"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageLogId": "uuid",
    "oldStatus": "sent",
    "newStatus": "delivered",
    "updatedAt": "2023-01-01T12:00:00Z"
  },
  "message": "Message status updated successfully"
}
```

### POST /webhooks/evolution/messages
**Specific endpoint for message status updates**

Handles only message status update events.

### POST /webhooks/evolution/instance
**Specific endpoint for instance status updates**

Handles WhatsApp instance connection status changes.

### GET /webhooks/health
**Health check endpoint**

Returns the health status of webhook services.

## Evolution API Status Mapping

The webhook handler maps Evolution API status values to our internal message statuses:

| Evolution API Status | Internal Status | Description |
|---------------------|----------------|-------------|
| `PENDING` | `pending` | Message queued for sending |
| `SERVER_ACK` | `sent` | Message sent to WhatsApp servers |
| `DELIVERY_ACK` | `delivered` | Message delivered to recipient |
| `READ` | `read` | Message read by recipient |
| `PLAYED` | `read` | Audio message played by recipient |
| `ERROR` | `failed` | Message failed to send |

## Webhook Events

### MESSAGES_UPDATE / MESSAGE_STATUS_UPDATE
Triggered when a message status changes (sent, delivered, read, failed).

**Key Fields:**
- `data.key.id`: WhatsApp message ID
- `data.status`: New message status
- `data.messageTimestamp`: Timestamp of status change

### CONNECTION_UPDATE
Triggered when WhatsApp instance connection status changes.

**Key Fields:**
- `data.instance.state`: Connection state (open, connecting, close)
- `data.instance.displayName`: WhatsApp account display name

### QRCODE_UPDATED
Triggered when a new QR code is generated for instance connection.

## Security

### Authentication
Webhooks support multiple authentication methods:

1. **API Key in Header**: `x-api-key: your-api-key`
2. **API Key in Body**: `apikey: "your-api-key"`
3. **Bearer Token**: `Authorization: Bearer your-token`

### Rate Limiting
- Maximum 100 requests per minute per IP + instance combination
- Configurable via environment variables
- Uses in-memory storage (consider Redis for production)

### Request Validation
- Validates required fields (instance, data, date_time, events)
- Checks data types and structure
- Logs suspicious requests

## Error Handling

### Common Error Responses

**400 Bad Request - Invalid Payload**
```json
{
  "success": false,
  "message": "Invalid webhook payload",
  "error": "Instance is required, Data object is required"
}
```

**401 Unauthorized - Missing Authentication**
```json
{
  "success": false,
  "message": "Webhook authentication required"
}
```

**429 Too Many Requests - Rate Limited**
```json
{
  "success": false,
  "message": "Rate limit exceeded"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Error processing webhook"
}
```

## Message Status Updates

### Status Progression
The system prevents status regression by checking status priority:

1. `pending` (0)
2. `sent` (1)
3. `delivered` (2)
4. `read` (3)
5. `failed` (-1, can occur at any stage)

### Timestamp Updates
- `sent_at`: Set when status changes to 'sent'
- `delivered_at`: Set when status changes to 'delivered'
- `read_at`: Set when status changes to 'read'

### Database Updates
- Updates `message_logs` table with new status
- Stores webhook payload in `evolution_api_response` field
- Maintains audit trail of status changes

## Configuration

### Environment Variables
```env
# Webhook authentication (optional)
WEBHOOK_API_KEY=your-webhook-api-key
WEBHOOK_AUTH_REQUIRED=true

# Rate limiting
WEBHOOK_RATE_LIMIT_WINDOW=60000  # 1 minute
WEBHOOK_RATE_LIMIT_MAX=100       # Max requests per window

# Development vs Production
NODE_ENV=production
```

### Evolution API Configuration
Configure your Evolution API instance to send webhooks to:
```
https://your-app.com/webhooks/evolution
```

**Recommended Events:**
- `MESSAGES_UPDATE`
- `MESSAGE_STATUS_UPDATE`
- `CONNECTION_UPDATE`
- `QRCODE_UPDATED`

## Monitoring and Logging

### Structured Logging
All webhook events are logged with structured data:

```json
{
  "level": "info",
  "message": "Evolution API webhook received",
  "instance": "your-instance",
  "events": ["MESSAGES_UPDATE"],
  "messageId": "message-id",
  "status": "DELIVERY_ACK",
  "timestamp": "2023-01-01T12:00:00Z"
}
```

### Metrics
- Webhook request count by instance
- Status update success/failure rates
- Processing time metrics
- Error rates by error type

### Health Checks
- Database connectivity
- Message log update functionality
- Response time monitoring

## Testing

### Unit Tests
```bash
cd backend-api
npm test -- tests/controllers/webhookController.test.ts
```

### Integration Tests
```bash
cd backend-api
npm test -- tests/integration/webhookRoutes.test.ts
```

### Manual Testing
```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/webhooks/evolution \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": true,
        "id": "test-message-id"
      },
      "status": "DELIVERY_ACK"
    },
    "date_time": "2023-01-01T12:00:00Z",
    "events": ["MESSAGES_UPDATE"]
  }'
```

## Troubleshooting

### Common Issues

**1. Message Not Found**
- Ensure `whatsapp_message_id` is properly set when sending messages
- Check if message log exists in database
- Verify Evolution API is using correct message IDs

**2. Status Not Updating**
- Check if webhook is reaching the endpoint (check logs)
- Verify status progression logic
- Ensure database permissions for updates

**3. Rate Limiting**
- Reduce webhook frequency from Evolution API
- Implement exponential backoff in Evolution API
- Consider increasing rate limits for legitimate traffic

**4. Authentication Failures**
- Verify API key configuration
- Check webhook URL in Evolution API settings
- Ensure HTTPS is used in production

### Debug Mode
Enable debug logging by setting `LOG_LEVEL=debug` to see detailed webhook processing information.

## Production Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Database Indexes**: Ensure `whatsapp_message_id` index exists
3. **Rate Limiting**: Use Redis for distributed rate limiting
4. **Monitoring**: Set up alerts for webhook failures
5. **Backup**: Ensure webhook payloads are logged for replay capability
6. **Scaling**: Consider webhook queue for high-volume scenarios

## API Documentation

For detailed API documentation, see the OpenAPI specification at `/docs/api-spec.yaml`.