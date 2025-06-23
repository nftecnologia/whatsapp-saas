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
  EyeIcon,
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { Template } from '@/types';
import { formatDateTime, truncateText } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const templateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  category: z.enum(['marketing', 'notification', 'support']).optional(),
});

type TemplateForm = z.infer<typeof templateSchema>;

const categoryLabels = {
  marketing: 'Marketing',
  notification: 'Notificação',
  support: 'Suporte',
};

const categoryColors = {
  marketing: 'success' as const,
  notification: 'info' as const,
  support: 'warning' as const,
};

export default function Templates() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', { search, category, page }],
    queryFn: () => apiService.getTemplates({ search, category, page, limit: 10 }),
  });

  const createMutation = useMutation({
    mutationFn: apiService.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsModalOpen(false);
      toast.success('Template criado com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Template> }) =>
      apiService.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsModalOpen(false);
      setEditingTemplate(null);
      toast.success('Template atualizado com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template excluído com sucesso!');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
  });

  const contentValue = watch('content');

  const onSubmit = async (data: TemplateForm) => {
    if (editingTemplate) {
      await updateMutation.mutateAsync({
        id: editingTemplate.id,
        data,
      });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setValue('name', template.name);
    setValue('content', template.content);
    setValue('category', template.category);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este template?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    reset();
    setIsModalOpen(true);
  };

  const extractVariables = (content: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const templates = templatesData?.data || [];
  const pagination = templatesData?.pagination;

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Templates
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Crie e gerencie templates de mensagens para suas campanhas
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar templates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            <option value="marketing">Marketing</option>
            <option value="notification">Notificação</option>
            <option value="support">Suporte</option>
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
                <TableHead>Categoria</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Variáveis</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template: Template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant={categoryColors[template.category]}>
                      {categoryLabels[template.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {truncateText(template.content, 100)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.variables?.map((variable) => (
                        <Badge key={variable} variant="default" size="sm">
                          {`{{${variable}}}`}
                        </Badge>
                      )) || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(template.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePreview(template)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
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
          setEditingTemplate(null);
          reset();
        }}
        title={editingTemplate ? 'Editar Template' : 'Novo Template'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register('name')}
            label="Nome"
            placeholder="Nome do template"
            error={errors.name?.message}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              {...register('category')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione uma categoria</option>
              <option value="marketing">Marketing</option>
              <option value="notification">Notificação</option>
              <option value="support">Suporte</option>
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conteúdo
            </label>
            <textarea
              {...register('content')}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite o conteúdo da mensagem. Use {{variavel}} para criar variáveis dinâmicas."
            />
            {errors.content && (
              <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Use {`{{variavel}}`} para criar campos dinâmicos. Ex: {`{{nome}}, {{empresa}}`}
            </p>
          </div>

          {contentValue && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variáveis detectadas
              </label>
              <div className="flex flex-wrap gap-2">
                {extractVariables(contentValue).map((variable) => (
                  <Badge key={variable} variant="info" size="sm">
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingTemplate(null);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewTemplate(null);
        }}
        title="Preview do Template"
        size="lg"
      >
        {previewTemplate && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900">{previewTemplate.name}</h4>
              <Badge variant={categoryColors[previewTemplate.category]} className="mt-1">
                {categoryLabels[previewTemplate.category]}
              </Badge>
            </div>
            
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Conteúdo:</h5>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="whitespace-pre-wrap">{previewTemplate.content}</p>
              </div>
            </div>

            {previewTemplate.variables && previewTemplate.variables.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Variáveis:</h5>
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.variables.map((variable) => (
                    <Badge key={variable} variant="info" size="sm">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}