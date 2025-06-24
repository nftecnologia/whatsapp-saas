import axios, { AxiosResponse } from 'axios';
import { WhatsAppInstanceModel } from '@/models/WhatsAppInstanceModel';
import { encrypt, decrypt } from '@/utils/encryption';
import logger from '@/utils/logger';
import { z } from 'zod';

// Types for Evolution API v2 Cloud API integration
interface EvolutionAPIInstance {
  instanceName: string;
  instanceKey: string;
  integration: 'WHATSAPP-BUSINESS';
  token: string;
  number: string;
  businessId: string;
  qrcode: boolean;
  webhookUrl?: string;
  webhookEvents?: string[];
}

interface EvolutionAPIResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
    serverUrl: string;
    apikey: string;
  };
  hash: {
    apikey: string;
  };
  webhook?: {
    webhook: boolean;
    webhookUrl: string;
    events: string[];
  };
}

interface MetaTokenValidationResult {
  valid: boolean;
  details?: {
    id: string;
    name: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating?: string;
  };
  error?: string;
}

export class WhatsAppInstanceService {
  private static readonly EVOLUTION_API_BASE_URL = process.env.EVOLUTION_API_BASE_URL || 'http://evolution-api:8080';
  private static readonly EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'whatsapp_saas_evolution_cloud_api_key_2024';
  private static readonly WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://backend-api:3000';

  /**
   * Create and configure Evolution API instance automatically
   */
  static async createInstance(data: {
    companyId: string;
    instanceName: string;
    metaAccessToken: string;
    metaPhoneNumberId: string;
    metaBusinessId: string;
  }): Promise<{ success: boolean; instance?: any; error?: string }> {
    try {
      logger.info('Creating WhatsApp instance', {
        companyId: data.companyId,
        instanceName: data.instanceName,
        phoneNumberId: data.metaPhoneNumberId
      });

      // Step 1: Validate Meta Business Token
      const tokenValidation = await this.validateMetaToken(
        data.metaAccessToken,
        data.metaPhoneNumberId
      );

      if (!tokenValidation.valid) {
        return {
          success: false,
          error: `Meta token validation failed: ${tokenValidation.error}`
        };
      }

      // Step 2: Create instance in Evolution API v2
      const evolutionInstance = await this.createEvolutionAPIInstance({
        instanceName: data.instanceName,
        instanceKey: data.instanceName,
        integration: 'WHATSAPP-BUSINESS',
        token: data.metaAccessToken,
        number: data.metaPhoneNumberId,
        businessId: data.metaBusinessId,
        qrcode: false,
        webhookUrl: `${this.WEBHOOK_BASE_URL}/webhooks/evolution`,
        webhookEvents: [
          'MESSAGES_UPDATE',
          'MESSAGE_STATUS_UPDATE',
          'CONNECTION_UPDATE'
        ]
      });

      if (!evolutionInstance.success) {
        return {
          success: false,
          error: `Evolution API instance creation failed: ${evolutionInstance.error}`
        };
      }

      // Step 3: Save to database with encrypted token
      const encryptedToken = encrypt(data.metaAccessToken);
      
      const dbInstance = await WhatsAppInstanceModel.create({
        company_id: data.companyId,
        instance_name: data.instanceName,
        integration_type: 'WHATSAPP-BUSINESS',
        meta_access_token: encryptedToken,
        meta_phone_number_id: data.metaPhoneNumberId,
        meta_business_id: data.metaBusinessId,
        status: 'connected'
      });

      logger.info('WhatsApp instance created successfully', {
        companyId: data.companyId,
        instanceId: dbInstance.id,
        evolutionInstanceId: evolutionInstance.data?.instance?.instanceId
      });

      return {
        success: true,
        instance: {
          ...dbInstance,
          meta_access_token: this.maskToken(data.metaAccessToken),
          evolution_details: evolutionInstance.data,
          meta_details: tokenValidation.details
        }
      };

    } catch (error) {
      logger.error('Failed to create WhatsApp instance', {
        companyId: data.companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Connect existing instance to Evolution API
   */
  static async connectInstance(instanceId: string, companyId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    try {
      const instance = await WhatsAppInstanceModel.findById(instanceId, companyId);
      if (!instance) {
        return { success: false, error: 'Instance not found' };
      }

      // Decrypt token for API calls
      const decryptedToken = decrypt(instance.meta_access_token);

      // Validate token is still valid
      const tokenValidation = await this.validateMetaToken(
        decryptedToken,
        instance.meta_phone_number_id
      );

      if (!tokenValidation.valid) {
        await WhatsAppInstanceModel.updateStatus(instanceId, companyId, 'error');
        return {
          success: false,
          error: `Meta token is no longer valid: ${tokenValidation.error}`
        };
      }

      // Connect to Evolution API
      const connectionResult = await this.connectToEvolutionAPI({
        instanceName: instance.instance_name,
        instanceKey: instance.instance_name,
        integration: 'WHATSAPP-BUSINESS',
        token: decryptedToken,
        number: instance.meta_phone_number_id,
        businessId: instance.meta_business_id,
        qrcode: false,
        webhookUrl: `${this.WEBHOOK_BASE_URL}/webhooks/evolution`
      });

      if (!connectionResult.success) {
        await WhatsAppInstanceModel.updateStatus(instanceId, companyId, 'error');
        return {
          success: false,
          error: connectionResult.error
        };
      }

      // Update status to connected
      await WhatsAppInstanceModel.updateStatus(instanceId, companyId, 'connected');

      logger.info('Instance connected successfully', {
        instanceId,
        companyId
      });

      return { success: true, status: 'connected' };

    } catch (error) {
      logger.error('Failed to connect instance', {
        instanceId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await WhatsAppInstanceModel.updateStatus(instanceId, companyId, 'error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Disconnect instance from Evolution API
   */
  static async disconnectInstance(instanceId: string, companyId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const instance = await WhatsAppInstanceModel.findById(instanceId, companyId);
      if (!instance) {
        return { success: false, error: 'Instance not found' };
      }

      // Logout from Evolution API
      await this.logoutFromEvolutionAPI(instance.instance_name);

      // Update status to disconnected
      await WhatsAppInstanceModel.updateStatus(instanceId, companyId, 'disconnected');

      logger.info('Instance disconnected successfully', {
        instanceId,
        companyId
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to disconnect instance', {
        instanceId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnection failed'
      };
    }
  }

  /**
   * Delete instance from Evolution API and database
   */
  static async deleteInstance(instanceId: string, companyId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const instance = await WhatsAppInstanceModel.findById(instanceId, companyId);
      if (!instance) {
        return { success: false, error: 'Instance not found' };
      }

      // Delete from Evolution API first
      await this.deleteFromEvolutionAPI(instance.instance_name);

      // Delete from database
      const deleted = await WhatsAppInstanceModel.delete(instanceId, companyId);
      if (!deleted) {
        return { success: false, error: 'Failed to delete from database' };
      }

      logger.info('Instance deleted successfully', {
        instanceId,
        companyId
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to delete instance', {
        instanceId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deletion failed'
      };
    }
  }

  /**
   * Get real-time status from Evolution API and Meta
   */
  static async getInstanceStatus(instanceId: string, companyId: string): Promise<{
    success: boolean;
    status?: {
      database_status: string;
      evolution_status?: string;
      meta_status?: string;
      last_activity?: string;
      details?: any;
    };
    error?: string;
  }> {
    try {
      const instance = await WhatsAppInstanceModel.findById(instanceId, companyId);
      if (!instance) {
        return { success: false, error: 'Instance not found' };
      }

      // Check Evolution API status
      const evolutionStatus = await this.checkEvolutionAPIStatus(instance.instance_name);
      
      // Check Meta API status
      const decryptedToken = decrypt(instance.meta_access_token);
      const metaValidation = await this.validateMetaToken(
        decryptedToken,
        instance.meta_phone_number_id
      );

      const status = {
        database_status: instance.status,
        evolution_status: evolutionStatus.status,
        meta_status: metaValidation.valid ? 'valid' : 'invalid',
        last_activity: new Date().toISOString(),
        details: {
          evolution: evolutionStatus.details,
          meta: metaValidation.details || { error: metaValidation.error }
        }
      };

      // Update database status if needed
      const newStatus = this.determineOverallStatus(status);
      if (newStatus !== instance.status) {
        await WhatsAppInstanceModel.updateStatus(instanceId, companyId, newStatus);
      }

      return { success: true, status };

    } catch (error) {
      logger.error('Failed to get instance status', {
        instanceId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }

  /**
   * Sync all instances status for a company
   */
  static async syncCompanyInstances(companyId: string): Promise<{
    success: boolean;
    synced: number;
    errors: string[];
  }> {
    try {
      const { instances } = await WhatsAppInstanceModel.findByCompanyId(companyId, {});
      const errors: string[] = [];
      let synced = 0;

      for (const instance of instances) {
        try {
          const statusResult = await this.getInstanceStatus(instance.id, companyId);
          if (statusResult.success) {
            synced++;
          } else {
            errors.push(`${instance.instance_name}: ${statusResult.error}`);
          }
        } catch (error) {
          errors.push(`${instance.instance_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      logger.info('Company instances synced', {
        companyId,
        totalInstances: instances.length,
        synced,
        errors: errors.length
      });

      return { success: true, synced, errors };

    } catch (error) {
      logger.error('Failed to sync company instances', {
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        synced: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed']
      };
    }
  }

  // Private helper methods

  /**
   * Validate Meta Business token with Graph API
   */
  private static async validateMetaToken(
    token: string,
    phoneNumberId: string
  ): Promise<MetaTokenValidationResult> {
    try {
      const response: AxiosResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.status === 200 && response.data) {
        return {
          valid: true,
          details: {
            id: response.data.id,
            name: response.data.name,
            display_phone_number: response.data.display_phone_number,
            verified_name: response.data.verified_name,
            quality_rating: response.data.quality_rating
          }
        };
      }

      return { valid: false, error: 'Invalid response from Meta API' };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        return {
          valid: false,
          error: `Meta API error (${status}): ${message}`
        };
      }

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Create instance in Evolution API v2
   */
  private static async createEvolutionAPIInstance(
    config: EvolutionAPIInstance
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response: AxiosResponse<EvolutionAPIResponse> = await axios.post(
        `${this.EVOLUTION_API_BASE_URL}/instance/create`,
        config,
        {
          headers: {
            'apikey': this.EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.status === 201 || response.status === 200) {
        logger.info('Evolution API instance created', {
          instanceName: config.instanceName,
          instanceId: response.data.instance?.instanceId
        });

        return { success: true, data: response.data };
      }

      return { success: false, error: 'Invalid response from Evolution API' };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error('Evolution API instance creation failed', {
          instanceName: config.instanceName,
          status,
          message,
          responseData: error.response?.data
        });

        return {
          success: false,
          error: `Evolution API error (${status}): ${message}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Evolution API request failed'
      };
    }
  }

  /**
   * Connect to existing Evolution API instance
   */
  private static async connectToEvolutionAPI(
    config: EvolutionAPIInstance
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // First, try to fetch existing instance
      const fetchResponse = await axios.get(
        `${this.EVOLUTION_API_BASE_URL}/instance/fetchInstances`,
        {
          headers: { 'apikey': this.EVOLUTION_API_KEY },
          timeout: 15000
        }
      );

      const existingInstance = fetchResponse.data?.find(
        (inst: any) => inst.instance?.instanceName === config.instanceName
      );

      if (existingInstance) {
        // Instance exists, try to connect
        const connectResponse = await axios.get(
          `${this.EVOLUTION_API_BASE_URL}/instance/connect/${config.instanceName}`,
          {
            headers: { 'apikey': this.EVOLUTION_API_KEY },
            timeout: 15000
          }
        );

        return { success: true, data: connectResponse.data };
      } else {
        // Instance doesn't exist, create it
        return await this.createEvolutionAPIInstance(config);
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Check Evolution API instance status
   */
  private static async checkEvolutionAPIStatus(instanceName: string): Promise<{
    status: string;
    details?: any;
  }> {
    try {
      const response = await axios.get(
        `${this.EVOLUTION_API_BASE_URL}/instance/connectionState/${instanceName}`,
        {
          headers: { 'apikey': this.EVOLUTION_API_KEY },
          timeout: 10000
        }
      );

      return {
        status: response.data?.instance?.state || 'unknown',
        details: response.data
      };

    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Status check failed'
        }
      };
    }
  }

  /**
   * Logout from Evolution API
   */
  private static async logoutFromEvolutionAPI(instanceName: string): Promise<void> {
    try {
      await axios.delete(
        `${this.EVOLUTION_API_BASE_URL}/instance/logout/${instanceName}`,
        {
          headers: { 'apikey': this.EVOLUTION_API_KEY },
          timeout: 15000
        }
      );
    } catch (error) {
      logger.warn('Failed to logout from Evolution API', {
        instanceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete instance from Evolution API
   */
  private static async deleteFromEvolutionAPI(instanceName: string): Promise<void> {
    try {
      await axios.delete(
        `${this.EVOLUTION_API_BASE_URL}/instance/delete/${instanceName}`,
        {
          headers: { 'apikey': this.EVOLUTION_API_KEY },
          timeout: 15000
        }
      );
    } catch (error) {
      logger.warn('Failed to delete from Evolution API', {
        instanceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Determine overall status from multiple checks
   */
  private static determineOverallStatus(status: {
    database_status: string;
    evolution_status?: string;
    meta_status?: string;
  }): 'connected' | 'disconnected' | 'error' {
    if (status.meta_status === 'invalid') {
      return 'error';
    }

    if (status.evolution_status === 'open' && status.meta_status === 'valid') {
      return 'connected';
    }

    if (status.evolution_status === 'close' || status.evolution_status === 'connecting') {
      return 'disconnected';
    }

    return 'error';
  }

  /**
   * Mask token for logging and responses
   */
  private static maskToken(token: string): string {
    if (!token || token.length < 8) return '****';
    return token.substring(0, 4) + '****' + token.substring(token.length - 4);
  }
}