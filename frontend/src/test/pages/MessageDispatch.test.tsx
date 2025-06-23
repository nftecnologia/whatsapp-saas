import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockContact, mockTemplate, createMockChangeEvent } from '../helpers';
import MessageDispatch from '@/pages/MessageDispatch';
import { toast } from 'react-hot-toast';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/message-dispatch' }),
  };
});

describe('MessageDispatch Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock contacts and templates
    mockApiService.getContacts.mockResolvedValue({
      success: true,
      data: [mockContact],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });

    mockApiService.getTemplates.mockResolvedValue({
      success: true,
      data: [mockTemplate],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });
  });

  it('renders message dispatch page with tabs', async () => {
    render(<MessageDispatch />);

    expect(screen.getByText('Envio de Mensagens')).toBeInTheDocument();
    expect(screen.getByText('Envie mensagens individuais ou em lote')).toBeInTheDocument();
    expect(screen.getByText('Mensagem Individual')).toBeInTheDocument();
    expect(screen.getByText('Envio em Lote')).toBeInTheDocument();
  });

  it('sends individual message successfully', async () => {
    render(<MessageDispatch />);

    // Fill individual message form
    const phoneInput = screen.getByLabelText('Telefone');
    const messageInput = screen.getByLabelText('Mensagem');

    fireEvent.change(phoneInput, createMockChangeEvent('+5511999999999'));
    fireEvent.change(messageInput, createMockChangeEvent('Test message'));

    // Submit form
    const sendButton = screen.getByRole('button', { name: /enviar mensagem/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockApiService.sendSingleMessage).toHaveBeenCalledWith({
        phone: '+5511999999999',
        message: 'Test message',
      });
      expect(toast.success).toHaveBeenCalledWith('Mensagem enviada com sucesso!');
    });
  });

  it('validates individual message form', async () => {
    render(<MessageDispatch />);

    // Submit without filling required fields
    const sendButton = screen.getByRole('button', { name: /enviar mensagem/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Telefone é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Mensagem é obrigatória')).toBeInTheDocument();
    });

    expect(mockApiService.sendSingleMessage).not.toHaveBeenCalled();
  });

  it('validates phone number format', async () => {
    render(<MessageDispatch />);

    const phoneInput = screen.getByLabelText('Telefone');
    const messageInput = screen.getByLabelText('Mensagem');
    const sendButton = screen.getByRole('button', { name: /enviar mensagem/i });

    fireEvent.change(phoneInput, createMockChangeEvent('invalid-phone'));
    fireEvent.change(messageInput, createMockChangeEvent('Test message'));
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Formato de telefone inválido')).toBeInTheDocument();
    });

    expect(mockApiService.sendSingleMessage).not.toHaveBeenCalled();
  });

  it('uses template for individual message', async () => {
    render(<MessageDispatch />);

    // Select template
    const templateSelect = screen.getByLabelText('Template (opcional)');
    fireEvent.change(templateSelect, createMockChangeEvent(mockTemplate.id));

    await waitFor(() => {
      const messageInput = screen.getByLabelText('Mensagem');
      expect(messageInput).toHaveValue(mockTemplate.content);
    });
  });

  it('switches to batch sending tab', async () => {
    render(<MessageDispatch />);

    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Selecionar Contatos')).toBeInTheDocument();
      expect(screen.getByText('Escolher Template')).toBeInTheDocument();
    });
  });

  it('selects contacts for batch sending', async () => {
    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    // Select contact
    const contactCheckbox = screen.getByRole('checkbox', { name: /test contact/i });
    fireEvent.click(contactCheckbox);

    expect(contactCheckbox).toBeChecked();
    expect(screen.getByText('1 contato selecionado')).toBeInTheDocument();
  });

  it('selects all contacts for batch sending', async () => {
    const multipleContacts = [
      mockContact,
      { ...mockContact, id: '2', name: 'Contact 2' },
      { ...mockContact, id: '3', name: 'Contact 3' },
    ];

    mockApiService.getContacts.mockResolvedValueOnce({
      success: true,
      data: multipleContacts,
      pagination: { page: 1, limit: 100, total: 3, pages: 1 },
    });

    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    // Select all contacts
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /selecionar todos/i });
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText('3 contatos selecionados')).toBeInTheDocument();
  });

  it('filters contacts for batch sending', async () => {
    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar contatos...')).toBeInTheDocument();
    });

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

  it('selects template for batch sending', async () => {
    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    // Select template
    const templateCard = screen.getByText('Test Template').closest('[role="button"]');
    fireEvent.click(templateCard!);

    expect(screen.getByText('Template selecionado: Test Template')).toBeInTheDocument();
  });

  it('previews batch message with template variables', async () => {
    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    // Select contact and template
    const contactCheckbox = screen.getByRole('checkbox', { name: /test contact/i });
    fireEvent.click(contactCheckbox);

    const templateCard = screen.getByText('Test Template').closest('[role="button"]');
    fireEvent.click(templateCard!);

    // Preview message
    const previewButton = screen.getByText('Pré-visualizar');
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText('Pré-visualização das Mensagens')).toBeInTheDocument();
      expect(screen.getByText('Hello Test Contact, this is a test message!')).toBeInTheDocument();
    });
  });

  it('sends batch messages successfully', async () => {
    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    // Select contact and template
    const contactCheckbox = screen.getByRole('checkbox', { name: /test contact/i });
    fireEvent.click(contactCheckbox);

    const templateCard = screen.getByText('Test Template').closest('[role="button"]');
    fireEvent.click(templateCard!);

    // Send messages
    const sendButton = screen.getByRole('button', { name: /enviar mensagens/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockApiService.sendSingleMessage).toHaveBeenCalledWith({
        contact_id: mockContact.id,
        template_id: mockTemplate.id,
        variables: {},
      });
      expect(toast.success).toHaveBeenCalledWith('Mensagens enviadas com sucesso!');
    });
  });

  it('validates batch sending requirements', async () => {
    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar mensagens/i })).toBeDisabled();
    });

    // Try to send without selections
    const sendButton = screen.getByRole('button', { name: /enviar mensagens/i });
    expect(sendButton).toBeDisabled();
  });

  it('handles template variables in batch sending', async () => {
    const templateWithVars = {
      ...mockTemplate,
      content: 'Hello {{name}}, your order {{order_id}} is ready!'
    };

    mockApiService.getTemplates.mockResolvedValueOnce({
      success: true,
      data: [templateWithVars],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });

    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    // Select template
    const templateCard = screen.getByText('Test Template').closest('[role="button"]');
    fireEvent.click(templateCard!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('order_id')).toBeInTheDocument();
    });

    // Fill variables
    const nameVar = screen.getByPlaceholderText('name');
    const orderVar = screen.getByPlaceholderText('order_id');

    fireEvent.change(nameVar, createMockChangeEvent('Customer'));
    fireEvent.change(orderVar, createMockChangeEvent('12345'));

    // Select contact and send
    const contactCheckbox = screen.getByRole('checkbox', { name: /test contact/i });
    fireEvent.click(contactCheckbox);

    const sendButton = screen.getByRole('button', { name: /enviar mensagens/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockApiService.sendSingleMessage).toHaveBeenCalledWith({
        contact_id: mockContact.id,
        template_id: templateWithVars.id,
        variables: {
          name: 'Customer',
          order_id: '12345',
        },
      });
    });
  });

  it('shows sending progress for batch messages', async () => {
    const multipleContacts = [
      mockContact,
      { ...mockContact, id: '2', name: 'Contact 2' },
      { ...mockContact, id: '3', name: 'Contact 3' },
    ];

    mockApiService.getContacts.mockResolvedValueOnce({
      success: true,
      data: multipleContacts,
      pagination: { page: 1, limit: 100, total: 3, pages: 1 },
    });

    render(<MessageDispatch />);

    // Switch to batch tab and select all
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /selecionar todos/i })).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /selecionar todos/i });
    fireEvent.click(selectAllCheckbox);

    const templateCard = screen.getByText('Test Template').closest('[role="button"]');
    fireEvent.click(templateCard!);

    const sendButton = screen.getByRole('button', { name: /enviar mensagens/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Enviando mensagens...')).toBeInTheDocument();
      expect(screen.getByText('1 de 3')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockApiService.sendSingleMessage.mockRejectedValueOnce(new Error('API Error'));

    render(<MessageDispatch />);

    const phoneInput = screen.getByLabelText('Telefone');
    const messageInput = screen.getByLabelText('Mensagem');
    const sendButton = screen.getByRole('button', { name: /enviar mensagem/i });

    fireEvent.change(phoneInput, createMockChangeEvent('+5511999999999'));
    fireEvent.change(messageInput, createMockChangeEvent('Test message'));
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('displays character count for messages', async () => {
    render(<MessageDispatch />);

    const messageInput = screen.getByLabelText('Mensagem');
    fireEvent.change(messageInput, createMockChangeEvent('Test message'));

    expect(screen.getByText('12/1000 caracteres')).toBeInTheDocument();
  });

  it('warns about long messages', async () => {
    render(<MessageDispatch />);

    const longMessage = 'a'.repeat(161);
    const messageInput = screen.getByLabelText('Mensagem');
    fireEvent.change(messageInput, createMockChangeEvent(longMessage));

    expect(screen.getByText('Esta mensagem será enviada em múltiplas partes')).toBeInTheDocument();
  });

  it('shows estimated cost for batch sending', async () => {
    const multipleContacts = Array.from({ length: 100 }, (_, i) => ({
      ...mockContact,
      id: `${i + 1}`,
      name: `Contact ${i + 1}`,
    }));

    mockApiService.getContacts.mockResolvedValueOnce({
      success: true,
      data: multipleContacts,
      pagination: { page: 1, limit: 100, total: 100, pages: 1 },
    });

    render(<MessageDispatch />);

    // Switch to batch tab
    const batchTab = screen.getByText('Envio em Lote');
    fireEvent.click(batchTab);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /selecionar todos/i })).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /selecionar todos/i });
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText('Custo estimado: R$ 10,00')).toBeInTheDocument();
  });

  it('handles media attachments', async () => {
    render(<MessageDispatch />);

    const fileInput = screen.getByLabelText('Anexar mídia (opcional)');
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });
  });

  it('validates media file size and type', async () => {
    render(<MessageDispatch />);

    const fileInput = screen.getByLabelText('Anexar mídia (opcional)');
    const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('Arquivo muito grande (máximo 16MB)')).toBeInTheDocument();
    });
  });
});