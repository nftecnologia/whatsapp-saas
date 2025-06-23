import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockContact, createMockChangeEvent } from '../helpers';
import Contacts from '@/pages/Contacts';
import { toast } from 'react-hot-toast';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/contacts' }),
  };
});

describe('Contacts Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders contacts page with table', async () => {
    render(<Contacts />);

    expect(screen.getByText('Contatos')).toBeInTheDocument();
    expect(screen.getByText('Gerencie sua base de contatos')).toBeInTheDocument();
    expect(screen.getByText('Novo Contato')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });
  });

  it('opens create contact modal when clicking new contact button', async () => {
    render(<Contacts />);

    const newContactButton = screen.getByText('Novo Contato');
    fireEvent.click(newContactButton);

    await waitFor(() => {
      expect(screen.getByText('Novo Contato')).toBeInTheDocument();
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
      expect(screen.getByLabelText('Telefone')).toBeInTheDocument();
    });
  });

  it('creates a new contact successfully', async () => {
    render(<Contacts />);

    // Open create modal
    const newContactButton = screen.getByText('Novo Contato');
    fireEvent.click(newContactButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText('Nome');
    const phoneInput = screen.getByLabelText('Telefone');
    const emailInput = screen.getByLabelText('Email');

    fireEvent.change(nameInput, createMockChangeEvent('New Contact'));
    fireEvent.change(phoneInput, createMockChangeEvent('+5511999999999'));
    fireEvent.change(emailInput, createMockChangeEvent('new@example.com'));

    // Submit form
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApiService.createContact).toHaveBeenCalledWith({
        name: 'New Contact',
        phone: '+5511999999999',
        email: 'new@example.com',
        tags: [],
      });
      expect(toast.success).toHaveBeenCalledWith('Contato criado com sucesso!');
    });
  });

  it('validates required fields when creating contact', async () => {
    render(<Contacts />);

    // Open create modal
    const newContactButton = screen.getByText('Novo Contato');
    fireEvent.click(newContactButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Submit form without filling required fields
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Telefone é obrigatório')).toBeInTheDocument();
    });

    expect(mockApiService.createContact).not.toHaveBeenCalled();
  });

  it('filters contacts by search term', async () => {
    render(<Contacts />);

    const searchInput = screen.getByPlaceholderText('Buscar contatos...');
    fireEvent.change(searchInput, createMockChangeEvent('Test'));

    await waitFor(() => {
      expect(mockApiService.getContacts).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Test',
        })
      );
    });
  });

  it('filters contacts by tags', async () => {
    render(<Contacts />);

    const tagFilter = screen.getByDisplayValue('Todas as tags');
    fireEvent.change(tagFilter, createMockChangeEvent('customer'));

    await waitFor(() => {
      expect(mockApiService.getContacts).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['customer'],
        })
      );
    });
  });

  it('opens edit modal when clicking edit button', async () => {
    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Editar');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Editar Contato')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Contact')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
    });
  });

  it('updates contact successfully', async () => {
    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    // Open edit modal
    const editButton = screen.getByTitle('Editar');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Contact')).toBeInTheDocument();
    });

    // Update name
    const nameInput = screen.getByDisplayValue('Test Contact');
    fireEvent.change(nameInput, createMockChangeEvent('Updated Contact'));

    // Submit form
    const updateButton = screen.getByRole('button', { name: /atualizar/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockApiService.updateContact).toHaveBeenCalledWith(
        mockContact.id,
        expect.objectContaining({
          name: 'Updated Contact',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Contato atualizado com sucesso!');
    });
  });

  it('deletes contact with confirmation', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Excluir');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Tem certeza que deseja excluir este contato?');
      expect(mockApiService.deleteContact).toHaveBeenCalledWith(mockContact.id);
      expect(toast.success).toHaveBeenCalledWith('Contato excluído com sucesso!');
    });

    confirmSpy.mockRestore();
  });

  it('cancels delete when user clicks cancel', async () => {
    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Excluir');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockApiService.deleteContact).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('handles pagination correctly', async () => {
    // Mock response with multiple pages
    mockApiService.getContacts.mockResolvedValueOnce({
      success: true,
      data: [mockContact],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        pages: 3,
      },
    });

    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1 a 10 de 25 resultados')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockApiService.getContacts).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('opens bulk create modal', async () => {
    render(<Contacts />);

    const bulkCreateButton = screen.getByTitle('Importar contatos');
    fireEvent.click(bulkCreateButton);

    await waitFor(() => {
      expect(screen.getByText('Importar Contatos')).toBeInTheDocument();
      expect(screen.getByText('Cole os dados dos contatos no formato CSV')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockApiService.createContact.mockRejectedValueOnce(new Error('API Error'));

    render(<Contacts />);

    // Open create modal and submit
    const newContactButton = screen.getByText('Novo Contato');
    fireEvent.click(newContactButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Nome');
    const phoneInput = screen.getByLabelText('Telefone');

    fireEvent.change(nameInput, createMockChangeEvent('Test'));
    fireEvent.change(phoneInput, createMockChangeEvent('+5511999999999'));

    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('displays loading state correctly', async () => {
    // Mock loading state
    mockApiService.getContacts.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      }), 1000))
    );

    render(<Contacts />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows stats correctly', async () => {
    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Ativos')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });
  });
});