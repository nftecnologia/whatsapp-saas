import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  CogIcon,
  LinkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

import apiService from '@/services/api';
import { WhatsAppIntegration, IntegrationSetupStep } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SecureInput } from '@/components/ui/SecureInput';
import { Stepper } from '@/components/ui/Stepper';
import { Alert } from '@/components/ui/Alert';
import Modal from '@/components/ui/Modal';

// Enhanced validation schemas
const basicInfoSchema = z.object({
  instance_name: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nome deve conter apenas letras, números, _ e -'),
  instance_key: z.string()
    .min(5, 'Chave deve ter pelo menos 5 caracteres')
    .max(100, 'Chave deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Chave deve conter apenas letras, números, _ e -'),
});

const metaConfigSchema = z.object({
  meta_token: z.string()
    .min(100, 'Token Meta parece inválido (muito curto)')
    .regex(/^[A-Za-z0-9+/=]+$/, 'Token Meta contém caracteres inválidos'),
  meta_app_id: z.string()
    .regex(/^\d+$/, 'App ID deve conter apenas números')
    .min(10, 'App ID parece inválido'),
  meta_phone_number_id: z.string()
    .regex(/^\d+$/, 'Phone Number ID deve conter apenas números')
    .min(10, 'Phone Number ID parece inválido'),
  webhook_verify_token: z.string()
    .min(20, 'Token de verificação deve ter pelo menos 20 caracteres')
    .max(100, 'Token de verificação deve ter no máximo 100 caracteres'),
});

type BasicInfoForm = z.infer<typeof basicInfoSchema>;
type MetaConfigForm = z.infer<typeof metaConfigSchema>;

interface IntegrationSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  integration?: WhatsAppIntegration | null;
}

const defaultSteps: IntegrationSetupStep[] = [
  {
    id: 'basic_info',
    title: 'Informações Básicas',
    description: 'Configure nome e chave da instância',
    status: 'pending',
    required: true,
  },
  {
    id: 'meta_config',
    title: 'Configuração Meta',
    description: 'Configure tokens e IDs da Meta Business',
    status: 'pending',
    required: true,
  },
  {
    id: 'validation',
    title: 'Validação',
    description: 'Teste a conectividade e configurações',
    status: 'pending',
    required: true,
  },
  {
    id: 'webhook_setup',
    title: 'Setup Webhook',
    description: 'Configure webhooks para receber mensagens',
    status: 'pending',
    required: false,
  },
  {
    id: 'final_test',
    title: 'Teste Final',
    description: 'Teste completo da integração',
    status: 'pending',
    required: true,
  },
];

export function IntegrationSetupWizard({
  isOpen,
  onClose,
  integration,
}: IntegrationSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState('basic_info');
  const [steps, setSteps] = useState<IntegrationSetupStep[]>(defaultSteps);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [validationResults, setValidationResults] = useState<any[]>([]);

  const queryClient = useQueryClient();
  const isEditing = !!integration;

  // Form for basic info
  const basicForm = useForm<BasicInfoForm>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      instance_name: integration?.instance_name || '',
      instance_key: integration?.instance_key || '',
    },
  });

  // Form for Meta config
  const metaForm = useForm<MetaConfigForm>({
    resolver: zodResolver(metaConfigSchema),
    defaultValues: {
      meta_token: integration?.meta_token || '',
      meta_app_id: integration?.meta_app_id || '',
      meta_phone_number_id: integration?.meta_phone_number_id || '',
      webhook_verify_token: integration?.webhook_verify_token || '',
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: apiService.createWhatsAppIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      toast.success('Integração criada com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiService.updateWhatsAppIntegration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      toast.success('Integração atualizada com sucesso!');
    },
  });

  const validateTokenMutation = useMutation({
    mutationFn: apiService.validateMetaToken,
    onSuccess: (data) => {
      if (data.valid) {
        toast.success('Token validado com sucesso!');
        updateStepStatus('meta_config', 'completed');
      } else {
        toast.error('Token inválido');
        updateStepStatus('meta_config', 'error');
      }
    },
    onError: () => {
      toast.error('Erro ao validar token');
      updateStepStatus('meta_config', 'error');
    },
  });

  const testIntegrationMutation = useMutation({
    mutationFn: integration ? 
      () => apiService.testWhatsAppIntegration(integration.id) :
      () => Promise.resolve({ results: [] }),
    onSuccess: (data) => {
      setValidationResults(data.results || []);
      const hasErrors = data.results?.some((r: any) => r.status === 'failed');
      updateStepStatus('validation', hasErrors ? 'error' : 'completed');
    },
  });

  const updateStepStatus = (stepId: string, status: IntegrationSetupStep['status']) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleBasicInfoSubmit = async (data: BasicInfoForm) => {
    try {
      if (isEditing && integration) {
        await updateMutation.mutateAsync({ id: integration.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      
      updateStepStatus('basic_info', 'completed');
      setCurrentStep('meta_config');
    } catch (error) {
      updateStepStatus('basic_info', 'error');
    }
  };

  const handleMetaConfigSubmit = async (data: MetaConfigForm) => {
    setIsValidatingToken(true);
    
    try {
      // Validate token first
      await validateTokenMutation.mutateAsync(data.meta_token);
      
      // If validation passes, update the integration
      if (integration) {
        await updateMutation.mutateAsync({ id: integration.id, data });
      }
      
      setCurrentStep('validation');
    } catch (error) {
      updateStepStatus('meta_config', 'error');
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleValidation = async () => {
    if (!integration) return;
    
    updateStepStatus('validation', 'in_progress');
    await testIntegrationMutation.mutateAsync();
    
    // Move to next step if validation passes
    const hasErrors = validationResults.some(r => r.status === 'failed');
    if (!hasErrors) {
      setCurrentStep('webhook_setup');
    }
  };

  const handleStepClick = (stepId: string) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    // Only allow going to previous steps or next step if current is completed
    if (stepIndex <= currentIndex || steps[currentIndex].status === 'completed') {
      setCurrentStep(stepId);
    }
  };

  const getCurrentStepComponent = () => {
    switch (currentStep) {
      case 'basic_info':
        return (
          <form onSubmit={basicForm.handleSubmit(handleBasicInfoSubmit)} className="space-y-4">
            <Alert variant="info" title="Configuração Básica">
              Configure o nome e a chave únicos para identificar esta integração WhatsApp.
            </Alert>

            <Input
              {...basicForm.register('instance_name')}
              label="Nome da Instância"
              placeholder="Ex: empresa-principal"
              error={basicForm.formState.errors.instance_name?.message}
              helper="Nome único para identificar esta instância (apenas letras, números, _ e -)"
            />

            <Input
              {...basicForm.register('instance_key')}
              label="Chave da Instância"
              placeholder="Ex: empresa_principal_001"
              error={basicForm.formState.errors.instance_key?.message}
              helper="Chave única para a Evolution API (apenas letras, números, _ e -)"
            />

            <div className="flex justify-end">
              <Button 
                type="submit" 
                loading={createMutation.isPending || updateMutation.isPending}
              >
                Próximo
              </Button>
            </div>
          </form>
        );

      case 'meta_config':
        return (
          <form onSubmit={metaForm.handleSubmit(handleMetaConfigSubmit)} className="space-y-4">
            <Alert variant="info" title="Configuração Meta Business" 
              actions={
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://business.facebook.com/', '_blank')}
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Abrir Meta Business Manager
                </Button>
              }
            >
              Configure os tokens e IDs da sua conta Meta Business para integração com WhatsApp Business API.
            </Alert>

            <SecureInput
              {...metaForm.register('meta_token')}
              label="Meta Access Token"
              placeholder="Insira seu token de acesso da Meta"
              error={metaForm.formState.errors.meta_token?.message}
              helper="Token permanente obtido no Meta Business Manager"
              showToggle={true}
              maskWhenHidden={true}
              allowCopy={false}
            />

            <Input
              {...metaForm.register('meta_app_id')}
              label="Meta App ID"
              placeholder="Ex: 1234567890123456"
              error={metaForm.formState.errors.meta_app_id?.message}
              helper="ID do aplicativo Meta configurado para WhatsApp"
            />

            <Input
              {...metaForm.register('meta_phone_number_id')}
              label="Phone Number ID"
              placeholder="Ex: 1234567890123456"
              error={metaForm.formState.errors.meta_phone_number_id?.message}
              helper="ID do número de telefone configurado na Meta"
            />

            <SecureInput
              {...metaForm.register('webhook_verify_token')}
              label="Webhook Verify Token"
              placeholder="Token para verificação do webhook"
              error={metaForm.formState.errors.webhook_verify_token?.message}
              helper="Token seguro para validar chamadas do webhook da Meta"
              showToggle={true}
              maskWhenHidden={true}
            />

            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setCurrentStep('basic_info')}
              >
                Anterior
              </Button>
              <Button 
                type="submit" 
                loading={isValidatingToken}
              >
                Validar e Continuar
              </Button>
            </div>
          </form>
        );

      case 'validation':
        return (
          <div className="space-y-4">
            <Alert variant="info" title="Teste de Conectividade">
              Vamos testar todas as configurações para garantir que a integração funcione corretamente.
            </Alert>

            {validationResults.length > 0 && (
              <div className="space-y-2">
                {validationResults.map((result, index) => (
                  <Alert
                    key={index}
                    variant={result.status === 'passed' ? 'success' : 
                            result.status === 'warning' ? 'warning' : 'error'}
                    title={result.test_name}
                  >
                    {result.message}
                  </Alert>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setCurrentStep('meta_config')}
              >
                Anterior
              </Button>
              <div className="space-x-2">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleValidation}
                  loading={testIntegrationMutation.isPending}
                >
                  <ShieldCheckIcon className="h-4 w-4 mr-2" />
                  Executar Testes
                </Button>
                <Button 
                  onClick={() => setCurrentStep('webhook_setup')}
                  disabled={validationResults.some(r => r.status === 'failed')}
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        );

      case 'webhook_setup':
        return (
          <div className="space-y-4">
            <Alert variant="info" title="Configuração de Webhook (Opcional)">
              Configure webhooks para receber mensagens e atualizações de status em tempo real.
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">URL do Webhook:</h4>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                {window.location.origin}/api/webhooks/whatsapp/{integration?.id}
              </code>
              <p className="text-sm text-gray-600 mt-2">
                Configure esta URL no seu Meta Business Manager para receber webhooks.
              </p>
            </div>

            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setCurrentStep('validation')}
              >
                Anterior
              </Button>
              <Button onClick={() => setCurrentStep('final_test')}>
                Continuar
              </Button>
            </div>
          </div>
        );

      case 'final_test':
        return (
          <div className="space-y-4">
            <Alert variant="success" title="Integração Configurada!">
              Sua integração WhatsApp foi configurada com sucesso e está pronta para uso.
            </Alert>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Próximos Passos:</h4>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>Teste o envio de mensagens através do painel</li>
                <li>Configure templates de mensagem</li>
                <li>Importe seus contatos</li>
                <li>Crie sua primeira campanha</li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setCurrentStep('webhook_setup')}
              >
                Anterior
              </Button>
              <Button onClick={onClose}>
                Finalizar
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('basic_info');
      setSteps(defaultSteps);
      setValidationResults([]);
      
      if (integration) {
        basicForm.setValue('instance_name', integration.instance_name);
        basicForm.setValue('instance_key', integration.instance_key);
        metaForm.setValue('meta_token', integration.meta_token || '');
        metaForm.setValue('meta_app_id', integration.meta_app_id || '');
        metaForm.setValue('meta_phone_number_id', integration.meta_phone_number_id || '');
        metaForm.setValue('webhook_verify_token', integration.webhook_verify_token || '');
      }
    }
  }, [isOpen, integration]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Integração WhatsApp' : 'Nova Integração WhatsApp'}
      size="xl"
    >
      <div className="space-y-6">
        <Stepper
          steps={steps}
          currentStep={currentStep}
          orientation="horizontal"
          onStepClick={handleStepClick}
        />

        <div className="min-h-[400px]">
          {getCurrentStepComponent()}
        </div>
      </div>
    </Modal>
  );
}