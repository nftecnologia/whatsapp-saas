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
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { Contact } from '@/types';
import { formatPhone, formatDateTime } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const contactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  tags: z.string().optional(),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contacts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts', { search, page }],
    queryFn: () => apiService.getContacts({ search, page, limit: 10 }),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['contact-tags'],
    queryFn: () => apiService.getContactTags(),
  });

  const createMutation = useMutation({
    mutationFn: apiService.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      setIsModalOpen(false);
      toast.success('Contato criado com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      apiService.updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      setIsModalOpen(false);
      setEditingContact(null);
      toast.success('Contato atualizado com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato excluído com sucesso!');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactForm) => {
    const formattedData = {
      ...data,
      tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [],
    };

    if (editingContact) {
      await updateMutation.mutateAsync({
        id: editingContact.id,
        data: formattedData,
      });
    } else {
      await createMutation.mutateAsync(formattedData);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setValue('name', contact.name);
    setValue('phone', contact.phone);
    setValue('email', contact.email || '');
    setValue('tags', contact.tags?.join(', ') || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este contato?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const openCreateModal = () => {
    setEditingContact(null);
    reset();
    setIsModalOpen(true);
  };

  const contacts = contactsData?.data || [];
  const pagination = contactsData?.pagination;

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Contatos
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Gerencie seus contatos para campanhas de WhatsApp
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar contatos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact: Contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{formatPhone(contact.phone)}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.map((tag) => (
                        <Badge key={tag} variant="info" size="sm">
                          {tag}
                        </Badge>
                      )) || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(contact.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingContact(null);
          reset();
        }}
        title={editingContact ? 'Editar Contato' : 'Novo Contato'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register('name')}
            label="Nome"
            placeholder="Nome completo"
            error={errors.name?.message}
          />

          <Input
            {...register('phone')}
            label="Telefone"
            placeholder="(11) 99999-9999"
            error={errors.phone?.message}
          />

          <Input
            {...register('email')}
            type="email"
            label="Email (opcional)"
            placeholder="email@exemplo.com"
            error={errors.email?.message}
          />

          <Input
            {...register('tags')}
            label="Tags (separadas por vírgula)"
            placeholder="cliente, vip, interessado"
            error={errors.tags?.message}
            helper="Separe as tags com vírgulas"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingContact(null);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingContact ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}