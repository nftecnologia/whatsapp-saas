# Access Token Configuration Guide

This guide covers everything you need to know about obtaining, configuring, and managing Meta access tokens for WhatsApp Cloud API integration. Access tokens are the key authentication mechanism that allows your application to interact with the WhatsApp Business API.

## Table of Contents

1. [Understanding Access Tokens](#understanding-access-tokens)
2. [Token Types](#token-types)
3. [Generating Access Tokens](#generating-access-tokens)
4. [Token Configuration](#token-configuration)
5. [Token Management](#token-management)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Understanding Access Tokens

### What Are Access Tokens?

Access tokens are secure strings that authenticate your application with Meta's APIs. They act as digital keys that:

- **Authenticate** your application's identity
- **Authorize** specific actions and data access
- **Limit** permissions to only what your app needs
- **Expire** automatically for security

### Token Structure

Meta access tokens follow a specific format:
```
Format: EAA[base64-encoded-data]
Example: EAAYourVeryLongAccessTokenStringHere123456789abcdef
Length: Typically 200-400 characters
```

### Token Lifecycle

```
1. Generate → 2. Configure → 3. Use → 4. Monitor → 5. Refresh/Rotate
    ↑                                                        ↓
    ←------------------← 6. Expire ←-----------------------←
```

---

## Token Types

### 1. User Access Tokens

**Use Case**: Testing and development
**Duration**: Short-lived (1-2 hours)
**Permissions**: Based on user's Facebook permissions

```javascript
// Example user token (for testing only)
const userToken = "EAAYourUserTokenHere...";
```

**❌ Not Recommended for Production**: User tokens expire quickly and depend on individual user accounts.

### 2. System User Access Tokens

**Use Case**: Production applications
**Duration**: Long-lived (60 days, renewable)
**Permissions**: Explicitly configured business permissions

```javascript
// System user token (recommended for production)
const systemToken = "EAAYourSystemUserTokenHere...";
```

**✅ Recommended**: System user tokens are designed for server-to-server applications.

### 3. App Access Tokens

**Use Case**: Meta app-specific operations
**Duration**: Never expire (until app secret changes)
**Format**: `{app-id}|{app-secret}`

**Limited Use**: Not typically used for WhatsApp Business API operations.

---

## Generating Access Tokens

### Method 1: Business Manager UI (Recommended)

#### Step 1: Create System User

1. **Navigate to System Users**
   - Go to Meta Business Manager: https://business.facebook.com/
   - Click **Business Settings** (gear icon)
   - Select **Users → System Users**

2. **Add New System User**
   - Click **"Add"**
   - Choose **"Create a system user"**
   - Enter details:
   ```
   Name: whatsapp-api-production
   Role: Employee
   ```

#### Step 2: Assign Assets

1. **Add WhatsApp Assets**
   - Click on your new system user
   - Go to **"Assign Assets"** tab
   - Click **"Add Assets"**
   - Select **"WhatsApp Accounts"**
   - Choose your WhatsApp Business Account
   - Assign permissions:
   ```
   ✅ Manage WhatsApp Business Account
   ✅ Manage WhatsApp Business Messages
   ✅ Read WhatsApp Business Account insights
   ```

#### Step 3: Generate Token

1. **Create Access Token**
   - In the system user page, click **"Generate New Token"**
   - Select your **WhatsApp Business Account**
   - Choose permissions:
   ```
   ✅ whatsapp_business_management
   ✅ whatsapp_business_messaging
   ✅ business_management (if needed for insights)
   ```

2. **Set Token Expiration**
   - **60 days**: Standard for production
   - **Never expire**: Use with caution (security risk)
   - **Custom**: Set specific expiration date

3. **Copy and Store Token**
   ```bash
   # Your token will look like this:
   EAAYourVeryLongSystemUserAccessTokenHere123456789abcdef
   ```

> **⚠️ Security Warning**: Copy this token immediately and store it securely. You won't be able to view it again.

### Method 2: Graph API (Advanced Users)

For programmatic token generation:

```bash
# Exchange short-lived token for long-lived token
curl -X GET "https://graph.facebook.com/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id={app-id}" \
  -d "client_secret={app-secret}" \
  -d "fb_exchange_token={short-lived-token}"
```

---

## Token Configuration

### Environment Configuration

#### Development Environment (.env.development)

```bash
# WhatsApp Cloud API Configuration
WHATSAPP_ACCESS_TOKEN=EAAYourDevelopmentTokenHere...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765

# Token Settings
TOKEN_EXPIRY_WARNING_DAYS=7
TOKEN_REFRESH_ENABLED=true
```

#### Production Environment (.env.production)

```bash
# WhatsApp Cloud API Configuration - PRODUCTION
WHATSAPP_ACCESS_TOKEN=EAAYourProductionTokenHere...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765

# Security Settings
TOKEN_EXPIRY_WARNING_DAYS=14
TOKEN_REFRESH_ENABLED=true
TOKEN_VALIDATION_ENABLED=true
```

### Application Configuration

#### Node.js Configuration

```javascript
// config/whatsapp.js
const config = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  
  // Token validation settings
  validateToken: process.env.NODE_ENV === 'production',
  tokenExpiryWarning: parseInt(process.env.TOKEN_EXPIRY_WARNING_DAYS) || 7
};

// Validation function
function validateTokenFormat(token) {
  if (!token) {
    throw new Error('Access token is required');
  }
  
  if (!token.startsWith('EAA')) {
    throw new Error('Invalid access token format. Must start with "EAA"');
  }
  
  if (token.length < 100) {
    throw new Error('Access token appears to be too short');
  }
  
  return true;
}

module.exports = { config, validateTokenFormat };
```

#### Platform Integration Configuration

In your platform's WhatsApp integration settings:

```javascript
// Integration configuration
const integrationConfig = {
  instanceName: 'production-whatsapp',
  instanceKey: 'prod-wa-001',
  integrationType: 'WHATSAPP-CLOUD-API',
  
  cloudApiConfig: {
    accessToken: 'EAAYourTokenHere...',
    phoneNumberId: '123456789012345',
    businessAccountId: '987654321098765',
    webhookVerifyToken: 'your-secure-webhook-token'
  },
  
  webhookUrl: 'https://your-domain.com/webhooks/evolution'
};
```

---

## Token Management

### Token Expiration Monitoring

#### Automated Expiry Checking

```javascript
// utils/tokenMonitor.js
const { validateTokenExpiry } = require('./metaApi');

async function checkTokenExpiry() {
  try {
    const tokenInfo = await validateTokenExpiry(config.accessToken);
    const expiresIn = tokenInfo.expires_at - Date.now();
    const daysUntilExpiry = Math.floor(expiresIn / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= config.tokenExpiryWarning) {
      console.warn(`⚠️  Access token expires in ${daysUntilExpiry} days`);
      
      // Send notification to administrators
      await notifyAdministrators({
        type: 'token_expiry_warning',
        message: `WhatsApp access token expires in ${daysUntilExpiry} days`,
        action_required: 'Generate new token before expiry'
      });
    }
  } catch (error) {
    console.error('Token expiry check failed:', error);
  }
}

// Run daily
setInterval(checkTokenExpiry, 24 * 60 * 60 * 1000);
```

#### Manual Token Validation

```bash
# Test token validity using Graph API
curl -X GET "https://graph.facebook.com/v17.0/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Check token permissions
curl -X GET "https://graph.facebook.com/v17.0/me/permissions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Token Rotation Process

#### 1. Generate New Token

```javascript
// Before current token expires
const generateNewToken = async () => {
  // Generate new system user token via Business Manager
  // This is typically done manually for security
  console.log('📋 Token Rotation Checklist:');
  console.log('1. Generate new system user token in Business Manager');
  console.log('2. Test new token with limited operations');
  console.log('3. Update environment variables');
  console.log('4. Deploy updated configuration');
  console.log('5. Verify all operations work with new token');
  console.log('6. Revoke old token');
};
```

#### 2. Graceful Token Transition

```javascript
// config/tokenRotation.js
const tokenRotation = {
  currentToken: process.env.WHATSAPP_ACCESS_TOKEN,
  newToken: process.env.WHATSAPP_ACCESS_TOKEN_NEW, // During transition
  
  async getValidToken() {
    // Try current token first
    try {
      await this.validateToken(this.currentToken);
      return this.currentToken;
    } catch (error) {
      console.warn('Current token invalid, trying new token');
      
      // Fall back to new token
      if (this.newToken) {
        await this.validateToken(this.newToken);
        return this.newToken;
      }
      
      throw new Error('No valid access token available');
    }
  }
};
```

### Token Revocation

When rotating tokens, revoke old ones:

```javascript
// Revoke old token
const revokeToken = async (token) => {
  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/me/permissions`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Token revoked successfully');
  } catch (error) {
    console.error('❌ Failed to revoke token:', error);
  }
};
```

---

## Security Best Practices

### 1. Secure Storage

#### Environment Variables (Recommended)

```bash
# ✅ Store in environment variables
export WHATSAPP_ACCESS_TOKEN="EAAYourTokenHere..."

# ❌ Never in code files
const token = "EAAYourTokenHere..."; // DON'T DO THIS
```

#### Secret Management Services

```javascript
// Using AWS Secrets Manager
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({region: 'us-east-1'});

async function getAccessToken() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'whatsapp/access-token'
  }).promise();
  
  return JSON.parse(secret.SecretString).access_token;
}
```

### 2. Access Control

#### Principle of Least Privilege

```javascript
// Only request necessary permissions
const requiredPermissions = [
  'whatsapp_business_messaging',    // Send messages
  'whatsapp_business_management'    // Manage phone numbers
  // Don't request 'business_management' unless needed for insights
];
```

#### Network Security

```bash
# Restrict API calls to specific IPs (if possible)
# Configure firewall rules
iptables -A OUTPUT -d graph.facebook.com -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -d graph.facebook.com -p tcp --dport 80 -j ACCEPT

# Use HTTPS only
curl -X GET "https://graph.facebook.com/v17.0/..." # ✅
curl -X GET "http://graph.facebook.com/v17.0/..."  # ❌
```

### 3. Monitoring and Auditing

#### Token Usage Logging

```javascript
// utils/tokenLogger.js
const logTokenUsage = (operation, success, error = null) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    success,
    tokenHash: hashToken(config.accessToken), // Don't log full token
    error: error ? error.message : null,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  
  console.log('Token Usage:', JSON.stringify(logEntry));
};

// Hash token for logging (never log full token)
const hashToken = (token) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 8);
};
```

### 4. Error Handling

#### Token-Related Error Handling

```javascript
// utils/tokenErrorHandler.js
const handleTokenError = (error) => {
  const tokenErrors = {
    'Invalid OAuth access token': 'Token is invalid or expired',
    'Error validating access token': 'Token validation failed',
    'The access token could not be decrypted': 'Token format is corrupted',
    'Application request limit reached': 'Rate limit exceeded'
  };
  
  const message = tokenErrors[error.message] || 'Unknown token error';
  
  console.error('🔑 Token Error:', {
    error: error.message,
    interpretation: message,
    action: 'Check token validity and permissions'
  });
  
  // Notify administrators for critical errors
  if (error.message.includes('Invalid OAuth')) {
    notifyAdministrators({
      type: 'critical_token_error',
      message: 'WhatsApp access token is invalid - immediate action required'
    });
  }
};
```

---

## Troubleshooting

### Common Token Issues

#### Issue 1: Token Invalid or Expired

```javascript
// Error: "Invalid OAuth access token"
❌ Symptoms:
- API calls return 401 Unauthorized
- Error message: "Invalid OAuth access token"

✅ Solutions:
1. Check token format (must start with "EAA")
2. Verify token hasn't expired
3. Confirm permissions are correctly assigned
4. Generate new token if necessary
```

#### Issue 2: Insufficient Permissions

```javascript
// Error: "Insufficient permissions"
❌ Symptoms:
- API calls return 403 Forbidden
- Error message: "This endpoint requires the 'whatsapp_business_messaging' permission"

✅ Solutions:
1. Review system user permissions in Business Manager
2. Regenerate token with correct permissions
3. Verify WhatsApp Business Account assignment
```

#### Issue 3: Token Format Issues

```javascript
// Error: "Malformed access token"
❌ Symptoms:
- Token doesn't start with "EAA"
- Token appears truncated
- Special characters in token

✅ Solutions:
1. Copy token completely from Business Manager
2. Check for hidden characters or line breaks
3. Verify environment variable is set correctly
```

### Debugging Tools

#### Token Validation Script

```javascript
// scripts/validateToken.js
const validateTokenSetup = async () => {
  console.log('🔍 Validating WhatsApp Access Token Setup...\n');
  
  // 1. Format validation
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  console.log('1. Token Format Check:');
  console.log(`   Format: ${token ? (token.startsWith('EAA') ? '✅ Valid' : '❌ Invalid') : '❌ Missing'}`);
  console.log(`   Length: ${token ? token.length : 0} characters`);
  
  // 2. API connectivity test
  console.log('\n2. API Connectivity Test:');
  try {
    const response = await fetch('https://graph.facebook.com/v17.0/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      console.log('   ✅ Token is valid and API is accessible');
      const data = await response.json();
      console.log(`   Account ID: ${data.id}`);
    } else {
      console.log('   ❌ API request failed');
      console.log(`   Status: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Network error:', error.message);
  }
  
  // 3. Permissions check
  console.log('\n3. Permissions Check:');
  try {
    const response = await fetch('https://graph.facebook.com/v17.0/me/permissions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const permissions = await response.json();
      const requiredPerms = ['whatsapp_business_messaging', 'whatsapp_business_management'];
      
      requiredPerms.forEach(perm => {
        const hasPermission = permissions.data.some(p => p.permission === perm && p.status === 'granted');
        console.log(`   ${perm}: ${hasPermission ? '✅ Granted' : '❌ Missing'}`);
      });
    }
  } catch (error) {
    console.log('   ❌ Could not check permissions:', error.message);
  }
};

// Run validation
validateTokenSetup();
```

#### Token Expiry Checker

```bash
#!/bin/bash
# scripts/check-token-expiry.sh

TOKEN=$WHATSAPP_ACCESS_TOKEN

echo "🔍 Checking access token expiry..."

# Get token info
RESPONSE=$(curl -s -X GET "https://graph.facebook.com/debug_token?input_token=$TOKEN&access_token=$TOKEN")

# Parse expiry info
EXPIRES_AT=$(echo $RESPONSE | jq '.data.expires_at')
CURRENT_TIME=$(date +%s)

if [ "$EXPIRES_AT" != "null" ] && [ "$EXPIRES_AT" != "0" ]; then
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRES_AT - $CURRENT_TIME) / 86400 ))
    
    echo "⏰ Token expires in $DAYS_UNTIL_EXPIRY days"
    
    if [ $DAYS_UNTIL_EXPIRY -lt 7 ]; then
        echo "⚠️  WARNING: Token expires soon! Generate new token."
    fi
else
    echo "✅ Token does not expire (or expiry info unavailable)"
fi
```

### Getting Help

If you're still experiencing token issues:

1. **Check Meta Business Help Center**
   - Visit: https://www.facebook.com/business/help
   - Search for "access token" issues

2. **Review Token Permissions**
   - Ensure system user has correct assets assigned
   - Verify permissions match your use case

3. **Contact Meta Support**
   - Use Business Manager support if you have a verified business
   - Include token hash (not full token) in support requests

---

## Next Steps

After configuring your access tokens:

1. **[Phone Number Verification](./phone-verification.md)** - Verify your WhatsApp Business number
2. **[Platform Integration](./platform-integration.md)** - Connect tokens to your platform
3. **[Security Configuration](../security/token-management.md)** - Implement security best practices

---

## Quick Reference

### Required Permissions
```
whatsapp_business_management    - Manage WhatsApp Business Account
whatsapp_business_messaging     - Send and receive messages
business_management             - Access insights and analytics (optional)
```

### Token Validation Endpoints
```
Token Info: https://graph.facebook.com/debug_token?input_token={token}&access_token={token}
Permissions: https://graph.facebook.com/v17.0/me/permissions
Account Info: https://graph.facebook.com/v17.0/me
```

### Security Checklist
- [ ] Use system user tokens for production
- [ ] Store tokens in environment variables
- [ ] Set appropriate expiration periods
- [ ] Monitor token expiry dates
- [ ] Implement token rotation process
- [ ] Never log full tokens
- [ ] Revoke old tokens when rotating

---

*This guide provides comprehensive information about Meta access token configuration. For implementation-specific questions, consult your platform's integration documentation.*