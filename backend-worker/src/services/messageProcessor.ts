import { SendMessageJob, EvolutionAPIResponse } from '@/types';
import evolutionApiService from './evolutionApiService';
import { DatabaseService } from './databaseService';

export class MessageProcessor {
  private static stats = {
    processedMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    retryMessages: 0,
    startTime: new Date()
  };

  static async processMessage(job: SendMessageJob): Promise<void> {
    console.log(`🔄 Processing message job: ${job.id}`);
    
    try {
      await this.validateJob(job);
      
      const integration = await this.getIntegration(job);
      
      if (!evolutionApiService.isValidPhone(job.phone)) {
        throw new Error(`Invalid phone number: ${job.phone}`);
      }

      const formattedPhone = evolutionApiService.formatPhoneNumber(job.phone);
      
      console.log(`📱 Sending message to ${formattedPhone} via ${integration.instance_key} (${integration.integration_type || 'WHATSAPP-BAILEYS'})`);
      
      // Use the smart message sending method that auto-detects or uses the integration type
      const response = await evolutionApiService.sendMessage(
        integration.instance_key,
        formattedPhone,
        job.message_content,
        integration.integration_type || 'WHATSAPP-BAILEYS'
      );

      await this.handleResponse(job, response, integration);
      
      this.stats.processedMessages++;
      
      await this.addProcessingDelay();
      
    } catch (error) {
      console.error(`❌ Error processing message job ${job.id}:`, error);
      await this.handleError(job, error as Error);
      this.stats.failedMessages++;
    }
  }

  private static async validateJob(job: SendMessageJob): Promise<void> {
    if (!job.id || !job.phone || !job.message_content || !job.company_id) {
      throw new Error('Invalid job data: missing required fields');
    }

    if (job.message_content.length > 4096) {
      throw new Error('Message content too long (max 4096 characters)');
    }
  }

  private static async getIntegration(job: SendMessageJob): Promise<any> {
    let integration;

    if (job.integration_id) {
      integration = await DatabaseService.getWhatsAppIntegration(
        job.integration_id,
        job.company_id
      );
    }

    if (!integration) {
      integration = await DatabaseService.getActiveWhatsAppIntegration(job.company_id);
    }

    if (!integration) {
      throw new Error('No active WhatsApp integration found for company');
    }

    if (integration.status !== 'connected') {
      throw new Error(`WhatsApp integration is ${integration.status}, not connected`);
    }

    return integration;
  }

  private static async handleResponse(
    job: SendMessageJob,
    response: EvolutionAPIResponse,
    integration: any
  ): Promise<void> {
    if (response.success) {
      console.log(`✅ Message sent successfully: ${job.id}`);
      
      const messageLog = await DatabaseService.createMessageLog({
        company_id: job.company_id,
        campaign_id: job.campaign_id,
        contact_id: job.contact_id,
        phone: job.phone,
        message_content: job.message_content,
        status: 'sent',
        whatsapp_message_id: response.messageId,
        evolution_api_response: {
          jobId: job.id,
          instanceKey: integration.instance_key,
          response: response.data
        }
      });

      if (job.campaign_id && job.contact_id) {
        await DatabaseService.updateCampaignContactStatus(
          job.campaign_id,
          job.contact_id,
          'sent'
        );
      }

      this.stats.successfulMessages++;
      
      await DatabaseService.logWorkerActivity(
        process.env.WORKER_ID || 'worker-001',
        'message_sent',
        {
          jobId: job.id,
          phone: job.phone,
          messageLogId: messageLog.id
        }
      );

    } else {
      throw new Error(response.error || 'Unknown Evolution API error');
    }
  }

  private static async handleError(job: SendMessageJob, error: Error): Promise<void> {
    console.error(`❌ Message failed: ${job.id} - ${error.message}`);
    
    const messageLog = await DatabaseService.createMessageLog({
      company_id: job.company_id,
      campaign_id: job.campaign_id,
      contact_id: job.contact_id,
      phone: job.phone,
      message_content: job.message_content,
      status: 'failed',
      error_message: error.message,
      evolution_api_response: {
        jobId: job.id,
        error: error.message
      }
    });

    if (job.campaign_id && job.contact_id) {
      await DatabaseService.updateCampaignContactStatus(
        job.campaign_id,
        job.contact_id,
        'failed',
        error.message
      );
    }

    await DatabaseService.logWorkerActivity(
      process.env.WORKER_ID || 'worker-001',
      'message_failed',
      {
        jobId: job.id,
        phone: job.phone,
        error: error.message,
        messageLogId: messageLog.id
      }
    );
  }

  private static async addProcessingDelay(): Promise<void> {
    const delay = parseInt(process.env.PROCESSING_DELAY_MS || '1000');
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  static getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime()
    };
  }

  static resetStats(): void {
    this.stats = {
      processedMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      retryMessages: 0,
      startTime: new Date()
    };
  }
}