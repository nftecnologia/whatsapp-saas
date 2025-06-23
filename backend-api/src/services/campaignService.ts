import { CampaignModel } from '@/models/Campaign';
import { TemplateModel } from '@/models/Template';
import { ContactModel } from '@/models/Contact';
import { MessageLogModel } from '@/models/MessageLog';
import rabbitmq from '@/config/rabbitmq';
import { createError } from '@/middleware/errorHandler';
import { SendMessageJob } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import metricsService from './metricsService';
import apmService from './apmService';
import logger from '@/utils/logger';

export class CampaignService {
  static async sendCampaign(
    campaignId: string, 
    companyId: string,
    integrationId?: string
  ): Promise<{
    campaign: any;
    jobsCreated: number;
    estimatedTime: string;
  }> {
    const traceId = apmService.startTrace('campaign_send', {
      campaignId,
      companyId,
      integrationId: integrationId || 'default',
    });

    try {
      const campaign = await CampaignModel.findById(campaignId, companyId);
      
      if (!campaign) {
        throw createError('Campaign not found', 404);
      }

      if (campaign.status === 'running') {
        throw createError('Campaign is already running', 400);
      }

      if (campaign.status === 'completed') {
        throw createError('Campaign is already completed', 400);
      }

      if (campaign.total_contacts === 0) {
        throw createError('Campaign has no contacts', 400);
      }

      const template = await TemplateModel.findById(campaign.template_id, companyId);
      if (!template) {
        throw createError('Campaign template not found', 400);
      }

      // Record business metrics
      metricsService.recordCampaign('started', companyId, campaign.type || 'broadcast');
      
      // Add trace metadata
      apmService.addTraceMetadata(traceId, 'campaignType', campaign.type);
      apmService.addTraceMetadata(traceId, 'totalContacts', campaign.total_contacts);

      await CampaignModel.update(campaignId, companyId, {
        status: 'running',
        started_at: new Date()
      });

      logger.logBusinessMetric('campaign_started', 1, 'count', {
        campaignId,
        companyId,
        campaignType: campaign.type,
        totalContacts: campaign.total_contacts.toString(),
      });

    const { contacts } = await CampaignModel.getCampaignContacts(campaignId, {
      status: 'pending',
      limit: 10000
    });

    const jobs: SendMessageJob[] = [];

    for (const contact of contacts) {
      const messageContent = TemplateModel.replaceVariables(
        template.content,
        campaign.variables || {}
      );

      const job: SendMessageJob = {
        id: uuidv4(),
        campaign_id: campaignId,
        contact_id: contact.contact_id,
        phone: contact.phone,
        message_content: messageContent,
        template_variables: campaign.variables,
        company_id: companyId,
        integration_id: integrationId || '',
        retry_count: 0,
        created_at: new Date()
      };

      jobs.push(job);

      await MessageLogModel.create({
        company_id: companyId,
        campaign_id: campaignId,
        contact_id: contact.contact_id,
        phone: contact.phone,
        message_content: messageContent,
        status: 'pending'
      });

      // Record message queued metric
      metricsService.recordMessage('queued', campaignId, companyId, 'text');
    }

    let publishedJobs = 0;
    const batchSize = 10;

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      
      for (const job of batch) {
        try {
          await rabbitmq.publishSendMessage(job);
          publishedJobs++;
        } catch (error) {
          console.error(`Failed to publish job for contact ${job.contact_id}:`, error);
          
          await MessageLogModel.create({
            company_id: companyId,
            campaign_id: campaignId,
            contact_id: job.contact_id,
            phone: job.phone,
            message_content: job.message_content,
            status: 'failed',
            error_message: 'Failed to queue message'
          });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const estimatedTimeMinutes = Math.ceil(publishedJobs / 10);
    const estimatedTime = `${estimatedTimeMinutes} minutes`;

    logger.info('Campaign started successfully', {
      campaignId,
      companyId,
      jobsPublished: publishedJobs,
      estimatedTime,
    });

    // Record campaign completion metrics
    logger.logBusinessMetric('campaign_jobs_created', publishedJobs, 'count', {
      campaignId,
      companyId,
      estimatedTime,
    });

    // Finish APM trace
    apmService.addTraceMetadata(traceId, 'jobsCreated', publishedJobs);
    apmService.finishTrace(traceId);

    return {
      campaign: await CampaignModel.findById(campaignId, companyId),
      jobsCreated: publishedJobs,
      estimatedTime
    };
    } catch (error) {
      apmService.finishTrace(traceId, error as Error);
      metricsService.recordCampaign('failed', companyId, 'broadcast');
      throw error;
    }
  }

  static async pauseCampaign(campaignId: string, companyId: string): Promise<any> {
    const campaign = await CampaignModel.findById(campaignId, companyId);
    
    if (!campaign) {
      throw createError('Campaign not found', 404);
    }

    if (campaign.status !== 'running') {
      throw createError('Campaign is not running', 400);
    }

    return await CampaignModel.update(campaignId, companyId, {
      status: 'paused'
    });
  }

  static async resumeCampaign(campaignId: string, companyId: string): Promise<any> {
    const campaign = await CampaignModel.findById(campaignId, companyId);
    
    if (!campaign) {
      throw createError('Campaign not found', 404);
    }

    if (campaign.status !== 'paused') {
      throw createError('Campaign is not paused', 400);
    }

    return await CampaignModel.update(campaignId, companyId, {
      status: 'running'
    });
  }

  static async cancelCampaign(campaignId: string, companyId: string): Promise<any> {
    const campaign = await CampaignModel.findById(campaignId, companyId);
    
    if (!campaign) {
      throw createError('Campaign not found', 404);
    }

    if (!['running', 'paused', 'scheduled'].includes(campaign.status)) {
      throw createError('Campaign cannot be cancelled', 400);
    }

    return await CampaignModel.update(campaignId, companyId, {
      status: 'cancelled',
      completed_at: new Date()
    });
  }

  static async sendSingleMessage(
    companyId: string,
    contactId: string,
    templateId: string,
    variables: Record<string, string> = {},
    integrationId?: string
  ): Promise<{
    messageLog: any;
    jobCreated: boolean;
  }> {
    const contact = await ContactModel.findById(contactId, companyId);
    if (!contact) {
      throw createError('Contact not found', 404);
    }

    const template = await TemplateModel.findById(templateId, companyId);
    if (!template) {
      throw createError('Template not found', 404);
    }

    const messageContent = TemplateModel.replaceVariables(template.content, variables);

    const messageLog = await MessageLogModel.create({
      company_id: companyId,
      contact_id: contactId,
      phone: contact.phone,
      message_content: messageContent,
      status: 'pending'
    });

    const job: SendMessageJob = {
      id: uuidv4(),
      contact_id: contactId,
      phone: contact.phone,
      message_content: messageContent,
      template_variables: variables,
      company_id: companyId,
      integration_id: integrationId || '',
      retry_count: 0,
      created_at: new Date()
    };

    let jobCreated = false;
    try {
      await rabbitmq.publishSendMessage(job);
      jobCreated = true;
    } catch (error) {
      console.error('Failed to publish single message job:', error);
      
      await MessageLogModel.updateStatus(messageLog.id, 'failed', {
        error_message: 'Failed to queue message'
      });
    }

    return {
      messageLog,
      jobCreated
    };
  }

  static async checkCampaignCompletion(campaignId: string): Promise<void> {
    try {
      const { contacts } = await CampaignModel.getCampaignContacts(campaignId, {
        status: 'pending',
        limit: 1
      });

      if (contacts.length === 0) {
        const campaign = await CampaignModel.findById(campaignId, '');
        if (campaign && campaign.status === 'running') {
          await CampaignModel.update(campaignId, campaign.company_id, {
            status: 'completed',
            completed_at: new Date()
          });
          
          console.log(`Campaign ${campaignId} completed automatically`);
        }
      }
    } catch (error) {
      console.error(`Error checking campaign completion for ${campaignId}:`, error);
    }
  }

  static async getScheduledCampaigns(): Promise<any[]> {
    const { campaigns } = await CampaignModel.findAll('', {
      status: 'scheduled',
      limit: 100
    });

    return campaigns.filter(campaign => 
      campaign.scheduled_at && 
      new Date(campaign.scheduled_at) <= new Date()
    );
  }

  static async processScheduledCampaigns(): Promise<void> {
    try {
      const scheduledCampaigns = await this.getScheduledCampaigns();
      
      for (const campaign of scheduledCampaigns) {
        try {
          console.log(`Processing scheduled campaign: ${campaign.id}`);
          await this.sendCampaign(campaign.id, campaign.company_id);
        } catch (error) {
          console.error(`Failed to process scheduled campaign ${campaign.id}:`, error);
          
          await CampaignModel.update(campaign.id, campaign.company_id, {
            status: 'cancelled'
          });
        }
      }
    } catch (error) {
      console.error('Error processing scheduled campaigns:', error);
    }
  }
}