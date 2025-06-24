/**
 * Evolution API v2 Cloud API Integration Examples
 * 
 * This file demonstrates how to use the enhanced EvolutionApiService
 * for WhatsApp Cloud API integration through Evolution API v2.
 */

const evolutionApiService = require('../dist/services/evolutionApiService').default;

async function createCloudAPIInstance() {
  console.log('Creating Cloud API instance...');
  
  const config = {
    instanceName: 'my-cloud-instance',
    instanceKey: 'my-cloud-instance',
    integration: 'WHATSAPP-CLOUD-API',
    cloudApiConfig: {
      accessToken: 'EAA...your-meta-access-token',
      phoneNumberId: '123456789012345',
      businessAccountId: '987654321098765',
      webhookVerifyToken: 'your-webhook-verify-token'
    },
    webhookUrl: 'https://your-domain.com/webhook',
    webhookByEvents: true
  };

  try {
    const result = await evolutionApiService.createCloudAPIInstance(config);
    if (result.success) {
      console.log('✅ Cloud API instance created successfully');
      console.log('Instance data:', result.data);
    } else {
      console.error('❌ Failed to create instance:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ Error creating instance:', error.message);
  }
}

async function sendCloudAPIMessage() {
  console.log('Sending Cloud API message...');
  
  const message = {
    messaging_product: 'whatsapp',
    to: '5511999999999',
    type: 'text',
    text: {
      body: 'Hello from Cloud API! 🚀'
    }
  };

  try {
    const result = await evolutionApiService.sendCloudAPIMessage('my-cloud-instance', message);
    if (result.success) {
      console.log('✅ Message sent successfully');
      console.log('Message ID:', result.messageId);
    } else {
      console.error('❌ Failed to send message:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
  }
}

async function sendCloudAPITemplate() {
  console.log('Sending Cloud API template message...');
  
  const template = {
    name: 'hello_world',
    language: 'en_US',
    parameters: [
      { type: 'text', text: 'John Doe' }
    ]
  };

  try {
    const result = await evolutionApiService.sendCloudAPITemplate(
      'my-cloud-instance',
      '5511999999999',
      template
    );
    
    if (result.success) {
      console.log('✅ Template message sent successfully');
      console.log('Message ID:', result.messageId);
    } else {
      console.error('❌ Failed to send template:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ Error sending template:', error.message);
  }
}

async function smartMessageSending() {
  console.log('Using smart message sending (auto-detects integration type)...');
  
  try {
    // This method automatically detects whether the instance uses Cloud API or Baileys
    const result = await evolutionApiService.sendMessage(
      'my-cloud-instance',
      '5511999999999',
      'Hello! This message will be sent via the correct integration automatically.'
    );
    
    if (result.success) {
      console.log('✅ Smart message sent successfully');
      console.log('Message ID:', result.messageId);
    } else {
      console.error('❌ Failed to send smart message:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ Error with smart sending:', error.message);
  }
}

async function checkInstanceStatus() {
  console.log('Checking Cloud API instance status...');
  
  try {
    const result = await evolutionApiService.getCloudAPIInstanceStatus('my-cloud-instance');
    if (result.success) {
      console.log('✅ Instance status retrieved');
      console.log('Status:', result.data);
      console.log('Is Cloud API:', result.data.isCloudAPI);
    } else {
      console.error('❌ Failed to get status:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  }
}

async function updateWebhook() {
  console.log('Updating webhook configuration...');
  
  const webhookUrl = 'https://your-domain.com/webhook';
  const events = [
    'MESSAGE_RECEIVED',
    'MESSAGE_STATUS_UPDATE',
    'INSTANCE_STATUS_UPDATE'
  ];

  try {
    const result = await evolutionApiService.updateCloudAPIWebhook(
      'my-cloud-instance',
      webhookUrl,
      events
    );
    
    if (result.success) {
      console.log('✅ Webhook updated successfully');
    } else {
      console.error('❌ Failed to update webhook:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ Error updating webhook:', error.message);
  }
}

// Example usage patterns
async function runExamples() {
  console.log('🚀 Evolution API v2 Cloud API Integration Examples\n');

  // 1. Create a Cloud API instance
  await createCloudAPIInstance();
  console.log('\n---\n');

  // 2. Send a text message via Cloud API
  await sendCloudAPIMessage();
  console.log('\n---\n');

  // 3. Send a template message
  await sendCloudAPITemplate();
  console.log('\n---\n');

  // 4. Use smart message sending (auto-detection)
  await smartMessageSending();
  console.log('\n---\n');

  // 5. Check instance status
  await checkInstanceStatus();
  console.log('\n---\n');

  // 6. Update webhook configuration
  await updateWebhook();
  console.log('\n---\n');

  console.log('✨ Examples completed!');
}

// Integration with message processor
async function processJobWithCloudAPI(job) {
  console.log('Processing message job with Cloud API integration...');
  
  try {
    // Get the integration from database (pseudo-code)
    const integration = await getWhatsAppIntegration(job.integration_id, job.company_id);
    
    if (!integration) {
      throw new Error('No integration found');
    }

    // Use the smart message sending method
    const result = await evolutionApiService.sendMessage(
      integration.instance_key,
      job.phone,
      job.message_content,
      integration.integration_type // 'WHATSAPP-CLOUD-API' or 'WHATSAPP-BAILEYS'
    );

    if (result.success) {
      console.log('✅ Job processed successfully');
      // Log to database, update campaign stats, etc.
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('❌ Error processing job:', error.message);
    throw error;
  }
}

// Environment variables needed:
/*
EVOLUTION_API_BASE_URL=http://your-evolution-api-url:8080
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_API_MAX_RETRIES=3
EVOLUTION_API_RETRY_DELAY=1000
EVOLUTION_API_TIMEOUT=30000
*/

module.exports = {
  createCloudAPIInstance,
  sendCloudAPIMessage,
  sendCloudAPITemplate,
  smartMessageSending,
  checkInstanceStatus,
  updateWebhook,
  processJobWithCloudAPI,
  runExamples
};

// Uncomment to run examples
// runExamples().catch(console.error);