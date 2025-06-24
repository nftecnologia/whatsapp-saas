import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  QrCodeIcon,
  ArrowPathIcon,
  LinkIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { WhatsAppIntegration } from '@/types';
import { formatDateTime } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const integrationSchema = z.object({
  instance_name: z.string().min(1, 'Nome da instância é obrigatório'),
  meta_access_token: z.string()
    .min(50, 'Token Meta deve ter pelo menos 50 caracteres')
    .regex(/^[A-Za-z0-9_-]+$/, 'Token Meta contém caracteres inválidos'),
  meta_phone_number_id: z.string()
    .min(1, 'Phone Number ID é obrigatório')
    .regex(/^\d+$/, 'Phone Number ID deve conter apenas números'),
  meta_business_id: z.string()
    .min(1, 'Business Account ID é obrigatório')
    .regex(/^\d+$/, 'Business Account ID deve conter apenas números'),
});

type IntegrationForm = z.infer<typeof integrationSchema>;

const statusLabels = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  error: 'Erro',
};

const statusColors = {
  disconnected: 'default' as const,
  connecting: 'warning' as const,
  connected: 'success' as const,
  error: 'error' as const,
};

const statusIcons = {
  disconnected: XMarkIcon,
  connecting: ClockIcon,
  connected: CheckCircleIcon,
  error: ExclamationTriangleIcon,
};

export default function WhatsAppIntegrations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<WhatsAppIntegration | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ qr_code: string; instance_name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: integrationsData, isLoading } = useQuery({
    queryKey: ['whatsapp-integrations', { search, status: statusFilter, page }],
    queryFn: () => apiService.getWhatsAppIntegrations({ status: statusFilter, page, limit: 10 }),
    refetchInterval: 10000, // Refresh every 10 seconds to update status
  });

  const createMutation = useMutation({
    mutationFn: apiService.createWhatsAppIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      setIsModalOpen(false);
      toast.success('Integração criada com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WhatsAppIntegration> }) =>
      apiService.updateWhatsAppIntegration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      setIsModalOpen(false);
      setEditingIntegration(null);
      toast.success('Integração atualizada com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteWhatsAppIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      toast.success('Integração excluída com sucesso!');
    },
  });

  const connectMutation = useMutation({
    mutationFn: apiService.connectWhatsAppIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      toast.success('Iniciando conexão...');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: apiService.disconnectWhatsAppIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      toast.success('Desconectado com sucesso!');
    },
  });

  const qrCodeMutation = useMutation({
    mutationFn: apiService.getWhatsAppIntegrationQRCode,
    onSuccess: (data) => {
      setQrCodeData(data);
      setIsQRModalOpen(true);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: apiService.refreshWhatsAppIntegrationStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integrations'] });
      toast.success('Status atualizado!');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<IntegrationForm>({
    resolver: zodResolver(integrationSchema),
  });

  const onSubmit = async (data: IntegrationForm) => {
    if (editingIntegration) {
      await updateMutation.mutateAsync({
        id: editingIntegration.id,
        data,
      });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (integration: WhatsAppIntegration) => {
    setEditingIntegration(integration);
    setValue('instance_name', integration.instance_name);
    setValue('instance_key', integration.instance_key);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta integração?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleConnect = async (id: string) => {
    await connectMutation.mutateAsync(id);
  };

  const handleDisconnect = async (id: string) => {
    if (window.confirm('Tem certeza que deseja desconectar esta integração?')) {
      await disconnectMutation.mutateAsync(id);
    }
  };

  const handleShowQRCode = async (id: string) => {
    await qrCodeMutation.mutateAsync(id);
  };

  const handleRefreshStatus = async (id: string) => {
    await refreshMutation.mutateAsync(id);
  };

  const openCreateModal = () => {
    setEditingIntegration(null);
    reset();
    setIsModalOpen(true);
  };

  const integrations = integrationsData?.data || [];
  const pagination = integrationsData?.pagination;

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Integrações WhatsApp
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Gerencie suas conexões WhatsApp Cloud API para envio de mensagens
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nova Integração
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar integrações..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="connected">Conectado</option>
            <option value="disconnected">Desconectado</option>
            <option value="connecting">Conectando</option>
            <option value="error">Erro</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label="Carregando integrações"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Instância</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Nome do Perfil</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration: WhatsAppIntegration) => {
                const StatusIcon = statusIcons[integration.status];
                return (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">{integration.instance_name}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[integration.status]} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusLabels[integration.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{integration.phone_number || '-'}</TableCell>
                    <TableCell>{integration.profile_name || '-'}</TableCell>
                    <TableCell>{formatDateTime(integration.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {integration.status === 'disconnected' && (
                          <button
                            onClick={() => handleConnect(integration.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Conectar"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </button>
                        )}
                        {integration.status === 'connecting' && (
                          <button
                            onClick={() => handleShowQRCode(integration.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Mostrar QR Code"
                          >
                            <QrCodeIcon className="h-4 w-4" />
                          </button>
                        )}
                        {integration.status === 'connected' && (
                          <button
                            onClick={() => handleDisconnect(integration.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Desconectar"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRefreshStatus(integration.id)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Atualizar Status"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(integration)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(integration.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} resultados
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.pages}
                onClick={() => setPage(page + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIntegration(null);
          reset();
        }}
        title={editingIntegration ? 'Editar Integração' : 'Nova Integração'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register('instance_name')}
            label="Nome da Instância"
            placeholder="Ex: Empresa Principal"
            error={errors.instance_name?.message}
            helper="Nome único para identificar esta instância"
          />

          <Input
            {...register('instance_key')}
            label="Chave da Instância"
            placeholder="Ex: empresa_principal_001"
            error={errors.instance_key?.message}
            helper="Chave única para identificar esta instância na Evolution API"
          />

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <QrCodeIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Como configurar sua integração
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Configure sua instância na Evolution API</li>
                    <li>Insira o nome e chave da instância acima</li>
                    <li>Após criar, clique em "Conectar" para gerar o QR Code</li>
                    <li>Escaneie o QR Code com seu WhatsApp</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingIntegration(null);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingIntegration ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={isQRModalOpen}
        onClose={() => {
          setIsQRModalOpen(false);
          setQrCodeData(null);
        }}
        title="QR Code para Conexão"
        size="lg"
      >
        {qrCodeData && (
          <div className="text-center space-y-4">
            <div className="bg-white p-4 rounded-lg border">
              <img
                src={qrCodeData.qr_code}
                alt="QR Code"
                className="mx-auto max-w-full h-auto"
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {qrCodeData.instance_name}
              </h4>
              <p className="text-sm text-gray-600 mt-2">
                Abra o WhatsApp no seu celular e escaneie este QR Code para conectar
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Importante
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      O QR Code expira em poucos minutos. Se não conseguir conectar,
                      clique em "Atualizar Status" e tente novamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}