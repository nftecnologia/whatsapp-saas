import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockCampaign, mockTemplate, createMockChangeEvent } from '../helpers';
import Campaigns from '@/pages/Campaigns';
import { toast } from 'react-hot-toast';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/campaigns' }),
  };
});

describe('Campaigns Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock templates for campaign creation
    mockApiService.getTemplates.mockResolvedValue({
      success: true,
      data: [mockTemplate],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });
  });

  it('renders campaigns page with table', async () => {
    render(<Campaigns />);

    expect(screen.getByText('Campanhas')).toBeInTheDocument();
    expect(screen.getByText('Gerencie suas campanhas de mensagens')).toBeInTheDocument();
    expect(screen.getByText('Nova Campanha')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });
  });

  it('opens create campaign modal when clicking new campaign button', async () => {
    render(<Campaigns />);

    const newCampaignButton = screen.getByText('Nova Campanha');
    fireEvent.click(newCampaignButton);

    await waitFor(() => {
      expect(screen.getByText('Nova Campanha')).toBeInTheDocument();
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
      expect(screen.getByLabelText('Template')).toBeInTheDocument();
    });
  });

  it('creates a new campaign successfully', async () => {
    render(<Campaigns />);

    // Open create modal
    const newCampaignButton = screen.getByText('Nova Campanha');
    fireEvent.click(newCampaignButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText('Nome');
    const templateSelect = screen.getByLabelText('Template');

    fireEvent.change(nameInput, createMockChangeEvent('New Campaign'));
    fireEvent.change(templateSelect, createMockChangeEvent(mockTemplate.id));

    // Submit form
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApiService.createCampaign).toHaveBeenCalledWith({
        name: 'New Campaign',
        template_id: mockTemplate.id,
        variables: {},
      });
      expect(toast.success).toHaveBeenCalledWith('Campanha criada com sucesso!');
    });
  });

  it('validates required fields when creating campaign', async () => {
    render(<Campaigns />);

    // Open create modal
    const newCampaignButton = screen.getByText('Nova Campanha');
    fireEvent.click(newCampaignButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Submit form without filling required fields
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Template é obrigatório')).toBeInTheDocument();
    });

    expect(mockApiService.createCampaign).not.toHaveBeenCalled();
  });

  it('filters campaigns by search term', async () => {
    render(<Campaigns />);

    const searchInput = screen.getByPlaceholderText('Buscar campanhas...');
    fireEvent.change(searchInput, createMockChangeEvent('Test'));

    await waitFor(() => {
      expect(mockApiService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Test',
        })
      );
    });
  });

  it('filters campaigns by status', async () => {
    render(<Campaigns />);

    const statusFilter = screen.getByDisplayValue('Todos os status');
    fireEvent.change(statusFilter, createMockChangeEvent('active'));

    await waitFor(() => {
      expect(mockApiService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });
  });

  it('opens edit modal when clicking edit button', async () => {
    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Editar');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Editar Campanha')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Campaign')).toBeInTheDocument();
    });
  });

  it('updates campaign successfully', async () => {
    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    // Open edit modal
    const editButton = screen.getByTitle('Editar');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Campaign')).toBeInTheDocument();
    });

    // Update name
    const nameInput = screen.getByDisplayValue('Test Campaign');
    fireEvent.change(nameInput, createMockChangeEvent('Updated Campaign'));

    // Submit form
    const updateButton = screen.getByRole('button', { name: /atualizar/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockApiService.updateCampaign).toHaveBeenCalledWith(
        mockCampaign.id,
        expect.objectContaining({
          name: 'Updated Campaign',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Campanha atualizada com sucesso!');
    });
  });

  it('deletes campaign with confirmation', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Excluir');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Tem certeza que deseja excluir esta campanha?');
      expect(mockApiService.deleteCampaign).toHaveBeenCalledWith(mockCampaign.id);
      expect(toast.success).toHaveBeenCalledWith('Campanha excluída com sucesso!');
    });

    confirmSpy.mockRestore();
  });

  it('sends campaign successfully', async () => {
    const activeCampaign = { ...mockCampaign, status: 'active' as const };
    mockApiService.getCampaigns.mockResolvedValueOnce({
      success: true,
      data: [activeCampaign],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const sendButton = screen.getByTitle('Enviar campanha');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockApiService.sendCampaign).toHaveBeenCalledWith(activeCampaign.id);
      expect(toast.success).toHaveBeenCalledWith('Campanha iniciada com sucesso!');
    });
  });

  it('pauses running campaign', async () => {
    const runningCampaign = { ...mockCampaign, status: 'running' as const };
    mockApiService.getCampaigns.mockResolvedValueOnce({
      success: true,
      data: [runningCampaign],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const pauseButton = screen.getByTitle('Pausar campanha');
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockApiService.pauseCampaign).toHaveBeenCalledWith(runningCampaign.id);
      expect(toast.success).toHaveBeenCalledWith('Campanha pausada com sucesso!');
    });
  });

  it('resumes paused campaign', async () => {
    const pausedCampaign = { ...mockCampaign, status: 'paused' as const };
    mockApiService.getCampaigns.mockResolvedValueOnce({
      success: true,
      data: [pausedCampaign],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const resumeButton = screen.getByTitle('Retomar campanha');
    fireEvent.click(resumeButton);

    await waitFor(() => {
      expect(mockApiService.resumeCampaign).toHaveBeenCalledWith(pausedCampaign.id);
      expect(toast.success).toHaveBeenCalledWith('Campanha retomada com sucesso!');
    });
  });

  it('cancels campaign with confirmation', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const runningCampaign = { ...mockCampaign, status: 'running' as const };
    mockApiService.getCampaigns.mockResolvedValueOnce({
      success: true,
      data: [runningCampaign],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTitle('Cancelar campanha');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Tem certeza que deseja cancelar esta campanha?');
      expect(mockApiService.cancelCampaign).toHaveBeenCalledWith(runningCampaign.id);
      expect(toast.success).toHaveBeenCalledWith('Campanha cancelada com sucesso!');
    });

    confirmSpy.mockRestore();
  });

  it('displays campaign status correctly', async () => {
    const campaigns = [
      { ...mockCampaign, status: 'draft' as const },
      { ...mockCampaign, id: '2', status: 'active' as const },
      { ...mockCampaign, id: '3', status: 'running' as const },
      { ...mockCampaign, id: '4', status: 'completed' as const },
      { ...mockCampaign, id: '5', status: 'cancelled' as const },
    ];

    mockApiService.getCampaigns.mockResolvedValueOnce({
      success: true,
      data: campaigns,
      pagination: { page: 1, limit: 10, total: 5, pages: 1 },
    });

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Rascunho')).toBeInTheDocument();
      expect(screen.getByText('Ativo')).toBeInTheDocument();
      expect(screen.getByText('Executando')).toBeInTheDocument();
      expect(screen.getByText('Finalizada')).toBeInTheDocument();
      expect(screen.getByText('Cancelada')).toBeInTheDocument();
    });
  });

  it('displays campaign statistics', async () => {
    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('10 contatos')).toBeInTheDocument();
      expect(screen.getByText('0 enviadas')).toBeInTheDocument();
      expect(screen.getByText('0 entregues')).toBeInTheDocument();
      expect(screen.getByText('0 lidas')).toBeInTheDocument();
    });
  });

  it('opens contacts modal when clicking manage contacts', async () => {
    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    const manageContactsButton = screen.getByTitle('Gerenciar contatos');
    fireEvent.click(manageContactsButton);

    await waitFor(() => {
      expect(screen.getByText('Gerenciar Contatos da Campanha')).toBeInTheDocument();
    });
  });

  it('handles pagination correctly', async () => {
    // Mock response with multiple pages
    mockApiService.getCampaigns.mockResolvedValueOnce({
      success: true,
      data: [mockCampaign],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        pages: 3,
      },
    });

    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1 a 10 de 25 resultados')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockApiService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('handles API errors gracefully', async () => {
    mockApiService.createCampaign.mockRejectedValueOnce(new Error('API Error'));

    render(<Campaigns />);

    // Open create modal and submit
    const newCampaignButton = screen.getByText('Nova Campanha');
    fireEvent.click(newCampaignButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Nome');
    const templateSelect = screen.getByLabelText('Template');

    fireEvent.change(nameInput, createMockChangeEvent('Test'));
    fireEvent.change(templateSelect, createMockChangeEvent(mockTemplate.id));

    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('displays loading state correctly', async () => {
    // Mock loading state
    mockApiService.getCampaigns.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      }), 1000))
    );

    render(<Campaigns />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows stats correctly', async () => {
    render(<Campaigns />);

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Ativos')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });
  });

  it('handles campaign scheduling', async () => {
    render(<Campaigns />);

    // Open create modal
    const newCampaignButton = screen.getByText('Nova Campanha');
    fireEvent.click(newCampaignButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Fill form with scheduling
    const nameInput = screen.getByLabelText('Nome');
    const templateSelect = screen.getByLabelText('Template');
    const scheduleCheckbox = screen.getByLabelText('Agendar envio');

    fireEvent.change(nameInput, createMockChangeEvent('Scheduled Campaign'));
    fireEvent.change(templateSelect, createMockChangeEvent(mockTemplate.id));
    fireEvent.click(scheduleCheckbox);

    await waitFor(() => {
      expect(screen.getByLabelText('Data e hora do envio')).toBeInTheDocument();
    });

    const scheduledAt = screen.getByLabelText('Data e hora do envio');
    fireEvent.change(scheduledAt, createMockChangeEvent('2024-12-25T10:00'));

    // Submit form
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApiService.createCampaign).toHaveBeenCalledWith({
        name: 'Scheduled Campaign',
        template_id: mockTemplate.id,
        variables: {},
        scheduled_at: '2024-12-25T10:00',
      });
    });
  });

  it('handles campaign variables correctly', async () => {
    const templateWithVars = {
      ...mockTemplate,
      content: 'Hello {{name}}, your order {{order_id}} is ready!'
    };

    mockApiService.getTemplates.mockResolvedValue({
      success: true,
      data: [templateWithVars],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });

    render(<Campaigns />);

    // Open create modal
    const newCampaignButton = screen.getByText('Nova Campanha');
    fireEvent.click(newCampaignButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Template')).toBeInTheDocument();
    });

    const templateSelect = screen.getByLabelText('Template');
    fireEvent.change(templateSelect, createMockChangeEvent(templateWithVars.id));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('order_id')).toBeInTheDocument();
    });

    const nameVar = screen.getByPlaceholderText('name');
    const orderVar = screen.getByPlaceholderText('order_id');

    fireEvent.change(nameVar, createMockChangeEvent('Customer'));
    fireEvent.change(orderVar, createMockChangeEvent('12345'));

    const nameInput = screen.getByLabelText('Nome');
    fireEvent.change(nameInput, createMockChangeEvent('Variable Campaign'));

    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApiService.createCampaign).toHaveBeenCalledWith({
        name: 'Variable Campaign',
        template_id: templateWithVars.id,
        variables: {
          name: 'Customer',
          order_id: '12345',
        },
      });
    });
  });
});