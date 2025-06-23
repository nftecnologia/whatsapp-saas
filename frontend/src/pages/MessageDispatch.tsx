import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import {
  PaperAirplaneIcon,
  UserPlusIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { Contact, Template } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const singleMessageSchema = z.object({
  contact_id: z.string().min(1, 'Contato é obrigatório'),
  template_id: z.string().min(1, 'Template é obrigatório'),
  variables: z.record(z.string()).optional(),
});

const batchMessageSchema = z.object({
  template_id: z.string().min(1, 'Template é obrigatório'),
  contact_ids: z.array(z.string()).min(1, 'Selecione pelo menos um contato'),
  variables: z.record(z.string()).optional(),
});

type SingleMessageForm = z.infer<typeof singleMessageSchema>;
type BatchMessageForm = z.infer<typeof batchMessageSchema>;

export default function MessageDispatch() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [previewContent, setPreviewContent] = useState('');
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { limit: 100 }],
    queryFn: () => apiService.getContacts({ limit: 100 }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates', { limit: 100 }],
    queryFn: () => apiService.getTemplates({ limit: 100 }),
  });

  const sendSingleMutation = useMutation({
    mutationFn: apiService.sendSingleMessage,
    onSuccess: () => {
      toast.success('Mensagem enviada com sucesso!');
      singleForm.reset();
    },
  });

  const previewMutation = useMutation({
    mutationFn: ({ templateId, variables }: { templateId: string; variables?: Record<string, string> }) =>
      apiService.previewTemplate(templateId, variables),
    onSuccess: (data) => {
      setPreviewContent(data.content);
      setIsPreviewModalOpen(true);
    },
  });

  const singleForm = useForm<SingleMessageForm>({
    resolver: zodResolver(singleMessageSchema),
  });

  const batchForm = useForm<BatchMessageForm>({
    resolver: zodResolver(batchMessageSchema),
  });

  const contacts = contactsData?.data || [];
  const templates = templatesData?.data || [];

  const onSubmitSingle = async (data: SingleMessageForm) => {
    await sendSingleMutation.mutateAsync(data);
  };

  const onSubmitBatch = async (data: BatchMessageForm) => {
    for (const contactId of data.contact_ids) {
      await sendSingleMutation.mutateAsync({
        contact_id: contactId,
        template_id: data.template_id,
        variables: data.variables,
      });
    }
    toast.success(`${data.contact_ids.length} mensagens enviadas com sucesso!`);
    batchForm.reset();
    setSelectedContacts([]);
  };

  const handlePreview = (templateId: string, variables?: Record<string, string>) => {
    if (!templateId) {
      toast.error('Selecione um template primeiro');
      return;
    }
    setPreviewVariables(variables || {});
    previewMutation.mutate({ templateId, variables });
  };

  const handleContactSelection = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts([...selectedContacts, contactId]);
    } else {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    }
    batchForm.setValue('contact_ids', checked 
      ? [...selectedContacts, contactId] 
      : selectedContacts.filter(id => id !== contactId)
    );
  };

  const handleSelectAll = () => {
    const allContactIds = contacts.map(c => c.id);
    setSelectedContacts(allContactIds);
    batchForm.setValue('contact_ids', allContactIds);
  };

  const handleDeselectAll = () => {
    setSelectedContacts([]);
    batchForm.setValue('contact_ids', []);
  };

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Envio de Mensagens
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Envie mensagens individuais ou em lote para seus contatos
          </p>
        </div>
      </div>

      <div className="mt-8">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('single')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'single'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserPlusIcon className="h-4 w-4 inline mr-2" />
              Mensagem Individual
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'batch'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DocumentArrowUpIcon className="h-4 w-4 inline mr-2" />
              Envio em Lote
            </button>
          </nav>
        </div>

        {/* Single Message Tab */}
        {activeTab === 'single' && (
          <div className="mt-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Enviar Mensagem Individual
              </h3>
              
              <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contato
                    </label>
                    <select
                      {...singleForm.register('contact_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione um contato</option>
                      {contacts.map((contact: Contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} - {contact.phone}
                        </option>
                      ))}
                    </select>
                    {singleForm.formState.errors.contact_id && (
                      <p className="mt-1 text-sm text-red-600">
                        {singleForm.formState.errors.contact_id.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template
                    </label>
                    <select
                      {...singleForm.register('template_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione um template</option>
                      {templates.map((template: Template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {singleForm.formState.errors.template_id && (
                      <p className="mt-1 text-sm text-red-600">
                        {singleForm.formState.errors.template_id.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variáveis (JSON)
                  </label>
                  <textarea
                    rows={3}
                    placeholder='{"nome": "João", "produto": "WhatsApp SaaS"}'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => {
                      try {
                        const variables = e.target.value ? JSON.parse(e.target.value) : {};
                        singleForm.setValue('variables', variables);
                      } catch (error) {
                        // Invalid JSON, ignore
                      }
                    }}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Formato JSON opcional para personalizar a mensagem
                  </p>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePreview(
                      singleForm.getValues('template_id'),
                      singleForm.getValues('variables')
                    )}
                    disabled={!singleForm.getValues('template_id')}
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button
                    type="submit"
                    loading={sendSingleMutation.isPending}
                    disabled={!singleForm.formState.isValid}
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    Enviar Mensagem
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Batch Message Tab */}
        {activeTab === 'batch' && (
          <div className="mt-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Envio em Lote
              </h3>

              <form onSubmit={batchForm.handleSubmit(onSubmitBatch)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template
                  </label>
                  <select
                    {...batchForm.register('template_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione um template</option>
                    {templates.map((template: Template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {batchForm.formState.errors.template_id && (
                    <p className="mt-1 text-sm text-red-600">
                      {batchForm.formState.errors.template_id.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variáveis (JSON)
                  </label>
                  <textarea
                    rows={3}
                    placeholder='{"produto": "WhatsApp SaaS", "desconto": "20%"}'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => {
                      try {
                        const variables = e.target.value ? JSON.parse(e.target.value) : {};
                        batchForm.setValue('variables', variables);
                      } catch (error) {
                        // Invalid JSON, ignore
                      }
                    }}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Formato JSON opcional para personalizar as mensagens
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Selecionar Contatos ({selectedContacts.length} selecionados)
                    </label>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                      >
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Todos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAll}
                      >
                        <XMarkIcon className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={selectedContacts.length === contacts.length && contacts.length > 0}
                              onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                            />
                          </TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Tags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact: Contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                checked={selectedContacts.includes(contact.id)}
                                onChange={(e) => handleContactSelection(contact.id, e.target.checked)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{contact.name}</TableCell>
                            <TableCell>{contact.phone}</TableCell>
                            <TableCell>{contact.email || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {contact.tags?.map((tag) => (
                                  <Badge key={tag} variant="default" className="text-xs">
                                    {tag}
                                  </Badge>
                                )) || '-'}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {batchForm.formState.errors.contact_ids && (
                    <p className="mt-1 text-sm text-red-600">
                      {batchForm.formState.errors.contact_ids.message}
                    </p>
                  )}
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePreview(
                      batchForm.getValues('template_id'),
                      batchForm.getValues('variables')
                    )}
                    disabled={!batchForm.getValues('template_id')}
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    Visualizar Mensagem
                  </Button>
                  <Button
                    type="submit"
                    loading={sendSingleMutation.isPending}
                    disabled={!batchForm.formState.isValid || selectedContacts.length === 0}
                  >
                    <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                    Enviar para {selectedContacts.length} Contatos
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Visualização da Mensagem"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Conteúdo da Mensagem:</h4>
            <div className="whitespace-pre-wrap text-sm text-gray-900 bg-white rounded border p-3">
              {previewContent}
            </div>
          </div>
          
          {Object.keys(previewVariables).length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-700 mb-2">Variáveis Utilizadas:</h4>
              <div className="text-sm text-blue-900">
                {Object.entries(previewVariables).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium">{key}:</span>
                    <span className="ml-2">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setIsPreviewModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}