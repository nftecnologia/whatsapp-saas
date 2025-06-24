import { jest } from '@jest/globals';
import axios from 'axios';
import evolutionApiService, { CloudAPIConfig, InstanceConfig, CloudAPIMessage } from '../../src/services/evolutionApiService';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Create a mock axios instance
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

describe('EvolutionAPIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return our mock instance
    mockAxios.create.mockReturnValue(mockAxiosInstance as any);
    
    // Reset environment variables
    process.env.EVOLUTION_API_BASE_URL = 'http://test-api.com';
    process.env.EVOLUTION_API_KEY = 'test-api-key';
  });

  describe('sendTextMessage', () => {
    it('should successfully send a text message', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const message = 'Test message';
      const mockResponse = {
        status: 200,
        data: {
          messageId: 'msg-123',
          key: { id: 'msg-123' },
          status: 'sent'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/message/sendText/${instanceKey}`,
        {
          number: phone.replace(/\D/g, ''),
          text: message
        }
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data,
        messageId: 'msg-123'
      });
    });

    it('should handle API error response', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const message = 'Test message';
      const mockError = {
        response: {
          status: 400,
          data: {
            message: 'Instance not found'
          }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Instance not found',
        data: mockError.response.data
      });
    });

    it('should handle network error', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const message = 'Test message';
      const mockError = new Error('Network error');

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Network error',
        data: undefined
      });
    });

    it('should clean phone number before sending', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+55 (11) 99999-9999';
      const message = 'Test message';
      const mockResponse = { status: 200, data: { messageId: 'msg-123' } };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/message/sendText/${instanceKey}`,
        {
          number: '5511999999999', // Should be cleaned
          text: message
        }
      );
    });
  });

  describe('sendMediaMessage', () => {
    it('should successfully send a media message', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const mediaUrl = 'https://example.com/image.jpg';
      const caption = 'Test caption';
      const mediaType = 'image' as const;
      const mockResponse = {
        status: 200,
        data: {
          messageId: 'msg-123',
          key: { id: 'msg-123' }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.sendMediaMessage(
        instanceKey, 
        phone, 
        mediaUrl, 
        caption, 
        mediaType
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/message/sendMedia/${instanceKey}`,
        {
          number: phone.replace(/\D/g, ''),
          mediaMessage: {
            mediaUrl,
            caption,
            mediaType
          }
        }
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data,
        messageId: 'msg-123'
      });
    });

    it('should handle media message error', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const mediaUrl = 'https://example.com/image.jpg';
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid media URL' }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.sendMediaMessage(instanceKey, phone, mediaUrl);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid media URL',
        data: mockError.response.data
      });
    });
  });

  describe('getInstanceStatus', () => {
    it('should successfully get instance status', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: {
          instance: instanceKey,
          state: 'open'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.getInstanceStatus(instanceKey);

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/instance/connectionState/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });

    it('should handle instance status error', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockError = {
        response: {
          status: 404,
          data: { message: 'Instance not found' }
        }
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.getInstanceStatus(instanceKey);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Instance not found',
        data: mockError.response.data
      });
    });
  });

  describe('createInstance', () => {
    it('should successfully create instance', async () => {
      // Arrange
      const instanceName = 'new-instance';
      const mockResponse = {
        status: 201,
        data: {
          instance: {
            instanceName,
            status: 'created'
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.createInstance(instanceName);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instance/create', {
        instanceName,
        token: 'test-api-key',
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('deleteInstance', () => {
    it('should successfully delete instance', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: { message: 'Instance deleted' }
      };

      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.deleteInstance(instanceKey);

      // Assert
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/instance/delete/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('getQRCode', () => {
    it('should successfully get QR code', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: {
          qrcode: 'data:image/png;base64,iVBORw0KGgo...',
          code: 'qr-code-string'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.getQRCode(instanceKey);

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/instance/connect/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('logout', () => {
    it('should successfully logout instance', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: { message: 'Logout successful' }
      };

      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.logout(instanceKey);

      // Assert
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/instance/logout/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format Brazilian phone numbers correctly', () => {
      // Test cases for different Brazilian phone number formats
      const testCases = [
        { input: '11999999999', expected: '5511999999999' },
        { input: '1199999999', expected: '551199999999' },
        { input: '5511999999999', expected: '5511999999999' },
        { input: '551199999999', expected: '551199999999' },
        { input: '+55 11 99999-9999', expected: '5511999999999' },
        { input: '(11) 99999-9999', expected: '5511999999999' },
        { input: '9999999999', expected: '559999999999' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = evolutionApiService.formatPhoneNumber(input);
        expect(result).toBe(expected);
      });
    });

    it('should return cleaned number for international formats', () => {
      const internationalNumber = '+1234567890123';
      const result = evolutionApiService.formatPhoneNumber(internationalNumber);
      expect(result).toBe('1234567890123');
    });
  });

  describe('isValidPhone', () => {
    it('should validate phone numbers correctly', () => {
      const validNumbers = [
        '11999999999',
        '+5511999999999',
        '5511999999999',
        '+1234567890',
        '123456789012345'
      ];

      const invalidNumbers = [
        '123456789', // too short
        '1234567890123456', // too long
        '', // empty
        'abc123', // contains letters
      ];

      validNumbers.forEach(phone => {
        expect(evolutionApiService.isValidPhone(phone)).toBe(true);
      });

      invalidNumbers.forEach(phone => {
        expect(evolutionApiService.isValidPhone(phone)).toBe(false);
      });
    });
  });

  describe('Cloud API Integration', () => {
    const mockCloudAPIConfig: CloudAPIConfig = {
      accessToken: 'EAAtest123456789',
      phoneNumberId: '123456789012345',
      businessAccountId: '987654321098765',
      webhookVerifyToken: 'test-webhook-token'
    };

    describe('createCloudAPIInstance', () => {
      it('should successfully create a Cloud API instance', async () => {
        // Arrange
        const config: InstanceConfig = {
          instanceName: 'cloud-test-instance',
          instanceKey: 'cloud-test-key',
          integration: 'WHATSAPP-CLOUD-API',
          cloudApiConfig: mockCloudAPIConfig,
          webhookUrl: 'https://example.com/webhook'
        };

        const mockResponse = {
          status: 201,
          data: {
            instance: {
              instanceName: config.instanceName,
              integration: 'WHATSAPP-CLOUD-API',
              status: 'created',
              cloudApiConfig: mockCloudAPIConfig
            }
          }
        };

        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        // Act
        const result = await evolutionApiService.createCloudAPIInstance(config);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instance/create', {
          instanceName: config.instanceName,
          token: 'test-api-key',
          qrcode: false,
          integration: 'WHATSAPP-CLOUD-API',
          cloudApiConfig: mockCloudAPIConfig,
          webhook: config.webhookUrl,
          webhookByEvents: false,
          events: [
            'MESSAGE_RECEIVED',
            'MESSAGE_STATUS_UPDATE',
            'INSTANCE_STATUS_UPDATE',
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE'
          ]
        });
        expect(result).toEqual({
          success: true,
          data: mockResponse.data
        });
      });

      it('should validate Cloud API configuration', async () => {
        // Arrange
        const invalidConfig: InstanceConfig = {
          instanceName: 'test-instance',
          instanceKey: 'test-key',
          integration: 'WHATSAPP-CLOUD-API'
          // Missing cloudApiConfig
        };

        // Act & Assert
        const result = await evolutionApiService.createCloudAPIInstance(invalidConfig);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Cloud API configuration is required');
      });
    });

    describe('sendCloudAPIMessage', () => {
      it('should successfully send a Cloud API text message', async () => {
        // Arrange
        const instanceKey = 'cloud-test-instance';
        const message: CloudAPIMessage = {
          messaging_product: 'whatsapp',
          to: '5511999999999',
          type: 'text',
          text: { body: 'Hello from Cloud API!' }
        };

        const mockResponse = {
          status: 200,
          data: {
            messages: [{ id: 'wamid.test123' }]
          }
        };

        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        // Act
        const result = await evolutionApiService.sendCloudAPIMessage(instanceKey, message);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          `/message/sendMessage/${instanceKey}`,
          message
        );
        expect(result).toEqual({
          success: true,
          data: mockResponse.data,
          messageId: 'wamid.test123'
        });
      });

      it('should validate Cloud API message format', async () => {
        // Arrange
        const instanceKey = 'cloud-test-instance';
        const invalidMessage = {
          messaging_product: 'telegram', // Invalid
          to: '5511999999999',
          type: 'text',
          text: { body: 'Hello!' }
        } as CloudAPIMessage;

        // Act
        const result = await evolutionApiService.sendCloudAPIMessage(instanceKey, invalidMessage);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('messaging_product must be "whatsapp"');
      });

      it('should send Cloud API template message', async () => {
        // Arrange
        const instanceKey = 'cloud-test-instance';
        const phone = '+5511999999999';
        const template = {
          name: 'hello_world',
          language: 'en_US',
          parameters: [
            { type: 'text' as const, text: 'John' }
          ]
        };

        const mockResponse = {
          status: 200,
          data: {
            messages: [{ id: 'wamid.template123' }]
          }
        };

        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        // Act
        const result = await evolutionApiService.sendCloudAPITemplate(instanceKey, phone, template);

        // Assert
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('wamid.template123');
      });
    });

    describe('Smart Message Sending', () => {
      it('should auto-detect Cloud API and send message accordingly', async () => {
        // Arrange
        const instanceKey = 'cloud-test-instance';
        const phone = '+5511999999999';
        const message = 'Hello World!';

        // Mock instance status to return Cloud API
        const statusMockResponse = {
          status: 200,
          data: {
            integration: 'WHATSAPP-CLOUD-API',
            state: 'open'
          }
        };
        mockAxiosInstance.get.mockResolvedValue(statusMockResponse);

        // Mock Cloud API message send
        const messageMockResponse = {
          status: 200,
          data: {
            messages: [{ id: 'wamid.auto123' }]
          }
        };
        mockAxiosInstance.post.mockResolvedValue(messageMockResponse);

        // Act
        const result = await evolutionApiService.sendMessage(instanceKey, phone, message);

        // Assert
        expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/instance/connectionState/${instanceKey}`);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          `/message/sendMessage/${instanceKey}`,
          expect.objectContaining({
            messaging_product: 'whatsapp',
            to: '5511999999999',
            type: 'text',
            text: { body: message }
          })
        );
        expect(result.success).toBe(true);
      });

      it('should fallback to Baileys if integration detection fails', async () => {
        // Arrange
        const instanceKey = 'baileys-test-instance';
        const phone = '+5511999999999';
        const message = 'Hello World!';

        // Mock instance status to fail
        mockAxiosInstance.get.mockRejectedValue(new Error('Instance not found'));

        // Mock Baileys message send
        const messageMockResponse = {
          status: 200,
          data: {
            messageId: 'baileys-msg-123',
            key: { id: 'baileys-msg-123' }
          }
        };
        mockAxiosInstance.post.mockResolvedValue(messageMockResponse);

        // Act
        const result = await evolutionApiService.sendMessage(instanceKey, phone, message);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          `/message/sendText/${instanceKey}`,
          {
            number: '5511999999999',
            text: message
          }
        );
        expect(result.success).toBe(true);
      });
    });

    describe('Instance Management', () => {
      it('should get Cloud API instance status', async () => {
        // Arrange
        const instanceKey = 'cloud-test-instance';
        const mockResponse = {
          status: 200,
          data: {
            integration: 'WHATSAPP-CLOUD-API',
            state: 'open',
            phoneNumber: '+5511999999999'
          }
        };

        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        // Act
        const result = await evolutionApiService.getCloudAPIInstanceStatus(instanceKey);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data.isCloudAPI).toBe(true);
      });

      it('should update webhook configuration', async () => {
        // Arrange
        const instanceKey = 'cloud-test-instance';
        const webhookUrl = 'https://example.com/webhook';
        const events = ['MESSAGE_RECEIVED', 'MESSAGE_STATUS_UPDATE'];

        const mockResponse = {
          status: 200,
          data: { message: 'Webhook updated successfully' }
        };

        mockAxiosInstance.put.mockResolvedValue(mockResponse);

        // Act
        const result = await evolutionApiService.updateCloudAPIWebhook(instanceKey, webhookUrl, events);

        // Assert
        expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/webhook/set/${instanceKey}`, {
          webhook: webhookUrl,
          webhookByEvents: true,
          events
        });
        expect(result.success).toBe(true);
      });
    });

    describe('Error Handling and Retries', () => {
      it('should retry on network errors', async () => {
        // Arrange
        const instanceKey = 'test-instance';
        const phone = '+5511999999999';
        const message = 'Test message';

        // First call fails with network error
        const networkError = { code: 'ECONNRESET', message: 'Connection reset' };
        // Second call succeeds
        const mockResponse = {
          status: 200,
          data: { messageId: 'retry-success-123' }
        };

        mockAxiosInstance.post
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce(mockResponse);

        // Act
        const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('retry-success-123');
      });

      it('should retry on 5xx server errors', async () => {
        // Arrange
        const instanceKey = 'test-instance';
        const phone = '+5511999999999';
        const message = 'Test message';

        const serverError = {
          response: { status: 502, data: { message: 'Bad Gateway' } }
        };
        const mockResponse = {
          status: 200,
          data: { messageId: 'server-retry-123' }
        };

        mockAxiosInstance.post
          .mockRejectedValueOnce(serverError)
          .mockResolvedValueOnce(mockResponse);

        // Act
        const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
        expect(result.success).toBe(true);
      });

      it('should not retry on 4xx client errors', async () => {
        // Arrange
        const instanceKey = 'test-instance';
        const phone = '+5511999999999';
        const message = 'Test message';

        const clientError = {
          response: { status: 400, data: { message: 'Bad Request' } }
        };

        mockAxiosInstance.post.mockRejectedValue(clientError);

        // Act
        const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1); // No retry
        expect(result.success).toBe(false);
        expect(result.error).toBe('Bad Request');
      });

      it('should handle rate limiting with retry', async () => {
        // Arrange
        const instanceKey = 'test-instance';
        const phone = '+5511999999999';
        const message = 'Test message';

        const rateLimitError = {
          response: { status: 429, data: { message: 'Rate limit exceeded' } }
        };
        const mockResponse = {
          status: 200,
          data: { messageId: 'rate-limit-retry-123' }
        };

        mockAxiosInstance.post
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce(mockResponse);

        // Act
        const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

        // Assert
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
        expect(result.success).toBe(true);
      });
    });
  });
});