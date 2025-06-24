# Meta Business Manager Setup Guide

This comprehensive guide will walk you through setting up Meta Business Manager for WhatsApp Cloud API integration. Business Manager is the central hub for managing your business's presence across Meta platforms, including WhatsApp.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating Your Business Manager Account](#creating-your-business-manager-account)
3. [Business Verification](#business-verification)
4. [WhatsApp Business Account Setup](#whatsapp-business-account-setup)
5. [User Management](#user-management)
6. [Security Configuration](#security-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

### Required Information
- **Business Details**
  - Legal business name
  - Business address (physical location)
  - Business phone number
  - Business website (if available)
  - Tax identification number

- **Documentation** (for verification)
  - Business license or registration certificate
  - Tax documents (EIN certificate, etc.)
  - Utility bill or bank statement showing business address
  - Government-issued ID of business owner

- **Technical Requirements**
  - Valid email address (will be primary contact)
  - Phone number for SMS verification
  - Facebook account (personal account of business owner/admin)

### Important Notes

> **⚠️ Account Ownership**: Use a Facebook account that will remain with the business long-term. Avoid using personal accounts of employees who might leave.

> **📧 Business Email**: Use a professional business email address, not a personal Gmail/Yahoo account.

---

## Creating Your Business Manager Account

### Step 1: Initial Account Creation

1. **Visit Meta Business Manager**
   - Go to: https://business.facebook.com/
   - Click **"Create Account"**

2. **Enter Business Information**
   ```
   Business Name: [Your Legal Business Name]
   Your Name: [Your Full Name as Business Owner/Admin]
   Business Email: [professional-email@yourbusiness.com]
   ```

3. **Account Creation**
   - Click **"Submit"**
   - You'll receive a confirmation email
   - Click the verification link in the email

### Step 2: Complete Business Profile

1. **Business Settings Navigation**
   - After email verification, you'll be in Business Manager
   - Click **"Business Settings"** (gear icon in bottom left)

2. **Business Info Setup**
   - Navigate to **"Business Info"** in the left sidebar
   - Complete all required fields:

   ```
   Legal Business Name: [Exact name as registered]
   Business Address: [Complete physical address]
   Business Phone: [Primary business contact number]
   Business Website: [https://yourbusiness.com] (optional)
   Business Category: [Select appropriate category]
   Business Description: [Brief description of your business]
   ```

3. **Time Zone Configuration**
   - Set your business time zone
   - This affects reporting and analytics timestamps

### Step 3: Payment Method Setup

1. **Add Payment Method**
   - Go to **"Billing & Payments"**
   - Click **"Add Payment Method"**
   - Add a business credit card or bank account

2. **Set Billing Information**
   - Ensure billing address matches business address
   - Set appropriate spending limits if desired

> **💡 Tip**: Even if you're using free tier limits, having a payment method on file helps with verification and removes some API limitations.

---

## Business Verification

Business verification is highly recommended for WhatsApp Cloud API usage as it provides:
- Higher API rate limits
- Access to advanced features
- Increased trust with customers
- Better support from Meta

### Verification Process

1. **Start Verification**
   - Go to **Business Settings → Business Info**
   - Click **"Start Verification"**

2. **Upload Documents**
   Required documents may include:
   
   **Primary Documents (Choose One)**
   - Business license or registration certificate
   - Articles of incorporation
   - Tax exemption certificate

   **Secondary Documents (May Be Required)**
   - Utility bill (gas, water, electric, internet, phone)
   - Bank statement
   - Insurance statement
   - Tax statement

3. **Document Requirements**
   - Documents must be in PDF, JPG, or PNG format
   - Must be clearly visible and readable
   - Must show business name matching your Business Manager
   - Must show current business address
   - Must be dated within the last 12 months

4. **Verification Timeline**
   - Initial review: 1-3 business days
   - Additional information requests: 5-7 business days
   - Full verification: Up to 30 business days

### Verification Status Tracking

Monitor verification status in **Business Settings → Business Info**:

- **🟡 Pending**: Documents under review
- **🟢 Verified**: Business successfully verified
- **🔴 Rejected**: Additional information needed

---

## WhatsApp Business Account Setup

### Step 1: Access WhatsApp Manager

1. **Navigate to WhatsApp**
   - In Business Manager, click **"All Tools"**
   - Select **"WhatsApp Manager"**
   - If not visible, you may need to request access

2. **Get Started with WhatsApp**
   - Click **"Get Started"**
   - Follow the setup wizard

### Step 2: Create WhatsApp Business Account

1. **Account Type Selection**
   - Choose **"Create a WhatsApp Business Account"**
   - Enter your business display name (visible to customers)

2. **Business Display Information**
   ```
   Display Name: [Customer-facing business name]
   Category: [Select appropriate business category]
   Description: [Brief description for customers]
   Website: [Customer-facing website] (optional)
   Email: [Customer support email] (optional)
   ```

3. **Profile Setup**
   - Upload business logo/profile picture
   - Recommended size: 640x640 pixels
   - Format: JPG or PNG

### Step 3: Phone Number Addition

1. **Phone Number Requirements**
   - Must be a working phone number (SMS/Voice capable)
   - Cannot be registered with personal WhatsApp
   - Should be dedicated to business use
   - Supports both mobile and landline numbers

2. **Add Phone Number**
   - Go to **"Phone Numbers"** in WhatsApp Manager
   - Click **"Add Phone Number"**
   - Enter in international format: +[country code][number]
   - Example: +1234567890

3. **Verification Process**
   - Choose verification method: SMS or Voice Call
   - Enter the 6-digit verification code
   - Number status will change to "Connected"

> **⚠️ Important**: Once verified with WhatsApp Business API, the phone number cannot be used with regular WhatsApp or WhatsApp Business app.

---

## User Management

### Adding Team Members

1. **Navigate to People**
   - Go to **Business Settings → People**
   - Click **"Add"**

2. **User Roles and Permissions**

   **Admin Roles:**
   - **Business Manager Admin**: Full access to all business assets
   - **WhatsApp Manager Admin**: Full WhatsApp account management

   **Employee Roles:**
   - **WhatsApp Manager Employee**: Limited WhatsApp operations
   - **Advertiser**: Can create and manage ads
   - **Analyst**: Read-only access to reports

3. **Role Assignment Best Practices**
   ```
   CEO/Owner: Business Manager Admin
   Marketing Manager: WhatsApp Manager Admin
   Marketing Team: WhatsApp Manager Employee
   Analysts: Analyst role
   Developers: Custom role with API access
   ```

### System Users (For API Access)

1. **Create System User**
   - Go to **Business Settings → System Users**
   - Click **"Add"** and select **"Create a system user"**

2. **System User Configuration**
   ```
   Name: whatsapp-api-system-user
   Role: Employee
   ```

3. **Assign Assets**
   - Assign your WhatsApp Business Account
   - Grant necessary permissions

---

## Security Configuration

### Two-Factor Authentication

1. **Enable 2FA**
   - Go to **Account Settings → Security**
   - Enable **"Two-Factor Authentication"**
   - Use authenticator app (recommended) or SMS

2. **Backup Codes**
   - Generate and securely store backup codes
   - Store in password manager or secure document

### Access Token Security

1. **Token Generation Best Practices**
   - Use system users for API tokens
   - Set appropriate expiration periods
   - Rotate tokens before expiration
   - Never share tokens publicly

2. **Permission Minimization**
   - Grant only necessary permissions
   - Regular audit of user permissions
   - Remove unused system users

### IP Restrictions (Optional)

1. **Configure IP Allowlists**
   - Go to **Business Settings → Security**
   - Add IP addresses that can access Business Manager
   - Recommended for high-security environments

---

## Troubleshooting

### Common Issues and Solutions

#### Account Creation Problems

**Issue**: Can't create Business Manager account
```
❌ Error: "This Facebook account is already associated with a Business Manager"
```
**Solution**: 
- Use a different Facebook account
- Or request admin access to existing Business Manager
- Each Facebook account can only create one Business Manager

**Issue**: Email verification not received
```
❌ Error: Verification email not in inbox
```
**Solution**:
- Check spam/junk folder
- Wait 10-15 minutes for delivery
- Use "Resend verification email" option
- Ensure email address is typed correctly

#### Business Verification Issues

**Issue**: Documents rejected
```
❌ Error: "Documents don't meet requirements"
```
**Solution**:
- Ensure documents clearly show business name
- Check document quality (clear, readable)
- Verify dates are within 12 months
- Match business address exactly

**Issue**: Long verification delays
```
❌ Error: Verification taking longer than expected
```
**Solution**:
- Peak processing times can cause delays
- Resubmit if no response after 30 days
- Contact Meta Business Support for status updates

#### WhatsApp Account Setup Issues

**Issue**: WhatsApp Manager not available
```
❌ Error: Can't find WhatsApp Manager in tools
```
**Solution**:
- Complete business verification first
- Wait 24-48 hours after Business Manager creation
- Ensure your region supports WhatsApp Business API

**Issue**: Phone number verification fails
```
❌ Error: "Unable to verify phone number"
```
**Solution**:
- Ensure number isn't already registered with WhatsApp
- Use a different phone number
- Try verification via voice call instead of SMS
- Check if number supports SMS/Voice in your region

#### Permission and Access Issues

**Issue**: Can't access WhatsApp features
```
❌ Error: "You don't have permission to access this feature"
```
**Solution**:
- Request appropriate permissions from Business Manager admin
- Ensure your role includes WhatsApp permissions
- Wait for permission changes to propagate (up to 24 hours)

### Getting Additional Help

1. **Meta Business Help Center**
   - Visit: https://www.facebook.com/business/help
   - Search for specific error messages
   - Access live chat support (business hours)

2. **Developer Documentation**
   - Visit: https://developers.facebook.com/docs/whatsapp
   - Technical API documentation
   - Code examples and best practices

3. **Community Support**
   - Meta for Developers Facebook Group
   - Stack Overflow (tag: whatsapp-business-api)
   - Developer forums and communities

---

## Next Steps

Once your Meta Business Manager is set up:

1. **[Configure Access Tokens](./access-tokens.md)** - Generate API access tokens
2. **[Verify Phone Number](./phone-verification.md)** - Complete phone verification process
3. **[Platform Integration](./platform-integration.md)** - Connect to your messaging platform

---

## Checklist

Use this checklist to ensure complete setup:

### Account Setup
- [ ] Business Manager account created
- [ ] Business information completed
- [ ] Payment method added
- [ ] Business verification initiated/completed

### WhatsApp Setup
- [ ] WhatsApp Business Account created
- [ ] Business profile configured
- [ ] Phone number added and verified
- [ ] Display name and description set

### Security
- [ ] Two-factor authentication enabled
- [ ] System user created for API access
- [ ] Appropriate user roles assigned
- [ ] Access tokens generated securely

### Documentation
- [ ] Business verification documents uploaded
- [ ] Account details documented securely
- [ ] Access credentials stored safely
- [ ] Team members trained on platform

---

*This guide provides comprehensive setup instructions for Meta Business Manager. For specific technical issues, consult the [Troubleshooting Guide](../troubleshooting/common-issues.md) or contact Meta Business Support.*