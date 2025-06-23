import React, { useState } from 'react';
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
  PlayIcon,
  PauseIcon,
  StopIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { Campaign, Template, Contact } from '@/types';
import { formatDateTime, formatNumber } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  template_id: z.string().min(1, 'Template é obrigatório'),
  scheduled_at: z.string().optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;

const statusLabels = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Executando',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

const statusColors = {
  draft: 'default' as const,
  scheduled: 'info' as const,
  running: 'warning' as const,
  completed: 'success' as const,
  paused: 'warning' as const,
  cancelled: 'error' as const,
};

export default function Campaigns() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [editingCampaign, setCampaign] = useState<Campaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns', { search, status, page }],
    queryFn: () => apiService.getCampaigns({ search, status, page, limit: 10 }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates', { limit: 100 }],
    queryFn: () => apiService.getTemplates({ limit: 100 }),
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { limit: 100 }],
    queryFn: () => apiService.getContacts({ limit: 100 }),
    enabled: isContactsModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: apiService.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsModalOpen(false);
      toast.success('Campanha criada com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Campaign> }) =>
      apiService.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsModalOpen(false);
      setCampaign(null);
      toast.success('Campanha atualizada com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha excluída com sucesso!');
    },
  });

  const sendMutation = useMutation({
    mutationFn: apiService.sendCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha enviada com sucesso!');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: apiService.pauseCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha pausada com sucesso!');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: apiService.resumeCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha retomada com sucesso!');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: apiService.cancelCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha cancelada com sucesso!');
    },
  });

  const addContactsMutation = useMutation({
    mutationFn: ({ campaignId, contactIds }: { campaignId: string; contactIds: string[] }) =>
      apiService.addContactsToCampaign(campaignId, contactIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsContactsModalOpen(false);
      setSelectedContacts([]);
      toast.success('Contatos adicionados à campanha!');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
  });

  const onSubmit = async (data: CampaignForm) => {
    const payload = {
      ...data,
      scheduled_at: data.scheduled_at || undefined,
    };

    if (editingCampaign) {
      await updateMutation.mutateAsync({
        id: editingCampaign.id,
        data: payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setCampaign(campaign);
    setValue('name', campaign.name);
    setValue('template_id', campaign.template_id);
    setValue('scheduled_at', campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta campanha?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSend = async (id: string) => {
    if (window.confirm('Tem certeza que deseja enviar esta campanha?')) {
      await sendMutation.mutateAsync(id);
    }
  };

  const handlePause = async (id: string) => {
    await pauseMutation.mutateAsync(id);
  };

  const handleResume = async (id: string) => {
    await resumeMutation.mutateAsync(id);
  };

  const handleCancel = async (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar esta campanha?')) {
      await cancelMutation.mutateAsync(id);
    }
  };

  const openCreateModal = () => {
    setCampaign(null);
    reset();
    setIsModalOpen(true);
  };

  const openContactsModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsContactsModalOpen(true);
  };

  const handleAddContacts = async () => {
    if (selectedCampaign && selectedContacts.length > 0) {
      await addContactsMutation.mutateAsync({
        campaignId: selectedCampaign.id,
        contactIds: selectedContacts,
      });
    }
  };

  const campaigns = campaignsData?.data || [];
  const pagination = campaignsData?.pagination;
  const templates = templatesData?.data || [];
  const contacts = contactsData?.data || [];

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Campanhas
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Crie e gerencie campanhas de envio de mensagens
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar campanhas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="draft">Rascunho</option>
            <option value="scheduled">Agendada</option>
            <option value="running">Executando</option>
            <option value="completed">Concluída</option>
            <option value="paused">Pausada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contatos</TableHead>
                <TableHead>Enviadas</TableHead>
                <TableHead>Entregues</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign: Campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{campaign.template_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[campaign.status]}>
                      {statusLabels[campaign.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatNumber(campaign.total_contacts)}</TableCell>
                  <TableCell>{formatNumber(campaign.sent_count)}</TableCell>
                  <TableCell>{formatNumber(campaign.delivered_count)}</TableCell>
                  <TableCell>{formatDateTime(campaign.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openContactsModal(campaign)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Gerenciar contatos"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      
                      {campaign.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleSend(campaign.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Enviar campanha"
                          >
                            <PlayIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(campaign)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Editar"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      
                      {campaign.status === 'running' && (
                        <button
                          onClick={() => handlePause(campaign.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Pausar campanha"
                        >
                          <PauseIcon className="h-4 w-4" />
                        </button>
                      )}
                      
                      {campaign.status === 'paused' && (
                        <button
                          onClick={() => handleResume(campaign.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Retomar campanha"
                        >
                          <PlayIcon className="h-4 w-4" />
                        </button>
                      )}
                      
                      {['draft', 'scheduled', 'running', 'paused'].includes(campaign.status) && (
                        <button
                          onClick={() => handleCancel(campaign.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Cancelar campanha"
                        >
                          <StopIcon className="h-4 w-4" />
                        </button>
                      )}
                      
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleDelete(campaign.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
          setCampaign(null);
          reset();
        }}
        title={editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register('name')}
            label="Nome"
            placeholder="Nome da campanha"
            error={errors.name?.message}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template
            </label>
            <select
              {...register('template_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um template</option>
              {templates.map((template: Template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {errors.template_id && (
              <p className="mt-1 text-sm text-red-600">{errors.template_id.message}</p>
            )}
          </div>

          <Input
            {...register('scheduled_at')}
            type="datetime-local"
            label="Agendamento (opcional)"
            helper="Deixe em branco para envio imediato"
            error={errors.scheduled_at?.message}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setCampaign(null);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingCampaign ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Contacts Modal */}
      <Modal
        isOpen={isContactsModalOpen}
        onClose={() => {
          setIsContactsModalOpen(false);
          setSelectedCampaign(null);
          setSelectedContacts([]);
        }}
        title="Gerenciar Contatos da Campanha"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecione os contatos que receberão as mensagens desta campanha.
          </p>
          
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            {contacts.map((contact: Contact) => (
              <label
                key={contact.id}
                className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={selectedContacts.includes(contact.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedContacts([...selectedContacts, contact.id]);
                    } else {
                      setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                    }
                  }}
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                  <div className="text-sm text-gray-500">{contact.phone}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4">
            <span className="text-sm text-gray-600">
              {selectedContacts.length} contato(s) selecionado(s)
            </span>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsContactsModalOpen(false);
                  setSelectedCampaign(null);
                  setSelectedContacts([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddContacts}
                loading={addContactsMutation.isPending}
                disabled={selectedContacts.length === 0}
              >
                Adicionar Contatos
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}