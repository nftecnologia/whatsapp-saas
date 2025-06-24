# Getting Started with WhatsApp Cloud API Integration

Welcome to the WhatsApp Cloud API integration! This guide will walk you through the complete setup process from creating your Meta Business Manager account to sending your first WhatsApp message.

## Prerequisites

Before you begin, make sure you have:

- **A Facebook account** - Required for Meta Business Manager
- **A business email address** - For business verification
- **A phone number** - For WhatsApp Business account verification
- **Administrator access** - To your organization's WhatsApp messaging platform

## Overview of the Setup Process

The complete setup involves these main steps:

1. **[Meta Business Manager Setup](#step-1-meta-business-manager-setup)** (~15 minutes)
2. **[WhatsApp Business Account Creation](#step-2-whatsapp-business-account-creation)** (~10 minutes)
3. **[Phone Number Verification](#step-3-phone-number-verification)** (~5 minutes)
4. **[Access Token Configuration](#step-4-access-token-configuration)** (~10 minutes)
5. **[Platform Integration](#step-5-platform-integration)** (~15 minutes)
6. **[Testing Your Setup](#step-6-testing-your-setup)** (~10 minutes)

**Total estimated time: 1 hour**

---

## Step 1: Meta Business Manager Setup

### 1.1 Create Your Business Manager Account

1. **Go to Meta Business Manager**
   - Visit: https://business.facebook.com/
   - Click "Create Account"

2. **Enter Business Information**
   ```
   Business Name: [Your Company Name]
   Your Name: [Your Full Name]
   Business Email: [your-business@company.com]
   ```

3. **Verify Your Business**
   - Check your email for verification link
   - Click the verification link
   - Complete the email verification process

### 1.2 Add Your Business Details

1. **Business Information**
   - Go to Business Settings → Business Info
   - Add your business address
   - Add business phone number
   - Select your business category

2. **Business Verification** (Optional but Recommended)
   - Upload business documents (tax ID, business license)
   - This helps with API limits and features

### 1.3 Create a WhatsApp Business Account

1. **Navigate to WhatsApp**
   - In Business Manager, go to "All Tools"
   - Click "WhatsApp Manager"
   - Click "Get Started"

2. **Choose Account Type**
   - Select "Create a WhatsApp Business Account"
   - Enter your business display name
   - Select your business category

> **📝 Note:** The business display name will be visible to your customers when they receive messages from you.

---

## Step 2: WhatsApp Business Account Creation

### 2.1 Account Setup

1. **Business Display Name**
   ```
   Display Name: [Your Business Name]
   Description: [Brief description of your business]
   Website: [https://your-website.com] (optional)
   ```

2. **Business Profile**
   - Add a profile picture (recommended: your business logo)
   - Add business description
   - Add website URL if available

### 2.2 Acceptance of Terms

1. **Review WhatsApp Business Terms**
   - Read the WhatsApp Business API Terms of Service
   - Read the Commerce Policy
   - Accept all required terms

2. **Set Up Business Verification**
   - Meta may require additional business verification
   - Have your business documents ready if requested

---

## Step 3: Phone Number Verification

### 3.1 Add Phone Number

1. **Phone Number Requirements**
   - Must be a valid phone number that can receive SMS/calls
   - Cannot be already registered with WhatsApp
   - Should be dedicated to business use

2. **Add Number to WhatsApp Business Account**
   - Go to WhatsApp Manager → Phone Numbers
   - Click "Add Phone Number"
   - Enter your phone number in international format
   - Example: +1234567890 (include country code)

### 3.2 Verification Process

1. **Choose Verification Method**
   - SMS verification (recommended)
   - Voice call verification

2. **Complete Verification**
   - Enter the 6-digit code received via SMS/call
   - If you don't receive the code, you can request a new one

3. **Confirm Number Registration**
   - The number will now appear in your Phone Numbers list
   - Status should show as "Connected"

> **⚠️ Important:** Once a phone number is registered with WhatsApp Business API, it cannot be used with the regular WhatsApp or WhatsApp Business app.

---

## Step 4: Access Token Configuration

### 4.1 Generate System User Access Token

1. **Create System User**
   - Go to Business Settings → Users → System Users
   - Click "Add" to create a new system user
   - Name: `whatsapp-api-user`
   - Role: Employee

2. **Generate Access Token**
   - Click on your system user
   - Click "Generate New Token"
   - Select your WhatsApp Business Account
   - Select permissions:
     ```
     ✅ whatsapp_business_management
     ✅ whatsapp_business_messaging
     ✅ business_management
     ```
   - Choose token expiration (60 days recommended for production)

3. **Copy and Secure Your Token**
   ```
   Token Format: EAA... (starts with EAA)
   Example: EAAYourLongAccessTokenHere123456789
   ```

> **🔒 Security:** Store this token securely. It provides full access to your WhatsApp Business Account. Never share it publicly or commit it to version control.

### 4.2 Get Required IDs

1. **Phone Number ID**
   - Go to WhatsApp Manager → Phone Numbers
   - Click on your phone number
   - Copy the "Phone number ID" (numeric string)

2. **WhatsApp Business Account ID**
   - Go to WhatsApp Manager
   - Copy the "WhatsApp Business Account ID" from the URL or dashboard

3. **Business Manager ID**
   - Go to Business Settings → Business Info
   - Copy the "Business Manager ID"

### 4.3 Record Your Configuration

Create a secure note with these values:

```
Access Token: EAAYourLongAccessTokenHere123456789
Phone Number ID: 123456789012345
WhatsApp Business Account ID: 987654321098765
Business Manager ID: 456789123456789
Phone Number: +1234567890
```

---

## Step 5: Platform Integration

### 5.1 Access Your Platform

1. **Log into Your WhatsApp Platform**
   - Use your administrator credentials
   - Navigate to WhatsApp Integrations section

2. **Create New Integration**
   - Click "Nova Integração" (New Integration)
   - Choose "WhatsApp Cloud API" as integration type

### 5.2 Configure Integration

1. **Basic Information**
   ```
   Instance Name: [Descriptive name, e.g., "Main Business Account"]
   Instance Key: [Unique identifier, e.g., "main-business-wa"]
   Integration Type: WHATSAPP-CLOUD-API
   ```

2. **Cloud API Configuration**
   ```
   Access Token: [Your EAA token from Step 4]
   Phone Number ID: [From Step 4]
   Business Account ID: [From Step 4]
   Webhook Verify Token: [Generate a secure random string]
   ```

3. **Webhook Configuration**
   ```
   Webhook URL: https://your-platform.com/webhooks/evolution
   ```

### 5.3 Save and Test Configuration

1. **Save Integration**
   - Click "Salvar" (Save)
   - The system will validate your configuration

2. **Initial Connection Test**
   - Click "Conectar" (Connect)
   - Status should change to "Connected"

---

## Step 6: Testing Your Setup

### 6.1 Send Test Message

1. **Access Message Dispatch**
   - Go to "Envio de Mensagens" (Message Dispatch)
   - Select your new WhatsApp integration

2. **Send Test Message**
   ```
   Recipient: [Your own phone number for testing]
   Message: Hello! This is a test message from our WhatsApp Business API.
   ```

3. **Monitor Message Delivery**
   - Check "Logs de Mensagens" (Message Logs)
   - Status should progress: pending → sent → delivered

### 6.2 Verify Webhook Functionality

1. **Test Webhook Reception**
   - Send a message to your WhatsApp Business number
   - Check logs to ensure webhook events are received

2. **Status Update Verification**
   - Send an outbound message
   - Verify status updates are received and processed

---

## Troubleshooting Quick Start Issues

### Common Setup Issues

1. **Access Token Invalid**
   ```
   ❌ Error: "Invalid access token"
   ✅ Solution: Verify token starts with "EAA" and has correct permissions
   ```

2. **Phone Number Not Found**
   ```
   ❌ Error: "Phone number ID not found"
   ✅ Solution: Ensure phone number is properly verified in Meta Business Manager
   ```

3. **Webhook Not Receiving Events**
   ```
   ❌ Error: No webhook events received
   ✅ Solution: Check webhook URL is accessible and uses HTTPS
   ```

### Getting Help

If you encounter issues during setup:

1. **Check our detailed guides**:
   - [Meta Business Manager Setup](../setup/meta-business-manager.md)
   - [Access Token Configuration](../setup/access-tokens.md)
   - [Troubleshooting Guide](../troubleshooting/common-issues.md)

2. **Review error messages** in the platform logs

3. **Verify all configuration values** match between Meta and your platform

---

## Next Steps

After completing the setup:

1. **Create Message Templates** - For marketing and notifications
2. **Import Your Contacts** - Upload your customer database
3. **Set Up Campaigns** - Create your first messaging campaign
4. **Configure Advanced Features** - Webhooks, automation, analytics

Congratulations! Your WhatsApp Cloud API integration is now ready for business use.

---

## Quick Reference

### Meta Business Manager URLs
- Business Manager: https://business.facebook.com/
- WhatsApp Manager: https://business.facebook.com/wa/manage/
- Developer Console: https://developers.facebook.com/

### Required Permissions
- `whatsapp_business_management`
- `whatsapp_business_messaging`  
- `business_management`

### Important Note
Keep your access tokens secure and rotate them before expiration to maintain uninterrupted service.