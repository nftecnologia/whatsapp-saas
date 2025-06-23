import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockMessageLog, mockCampaign, createMockChangeEvent } from '../helpers';
import MessageLogs from '@/pages/MessageLogs';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/message-logs' }),
    useParams: () => ({ campaignId: undefined }),
  };
});

describe('MessageLogs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock campaigns for filter
    mockApiService.getCampaigns.mockResolvedValue({
      success: true,
      data: [mockCampaign],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });
  });

  it('renders message logs page with table', async () => {
    render(<MessageLogs />);

    expect(screen.getByText('Logs de Mensagens')).toBeInTheDocument();
    expect(screen.getByText('Acompanhe o status de todas as mensagens enviadas')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
      expect(screen.getByText('+1234567890')).toBeInTheDocument();
    });
  });

  it('displays message log details correctly', async () => {
    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
      expect(screen.getByText('+1234567890')).toBeInTheDocument();
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
      expect(screen.getByText('Enviada')).toBeInTheDocument();
    });
  });

  it('filters logs by search term', async () => {
    render(<MessageLogs />);

    const searchInput = screen.getByPlaceholderText('Buscar por contato, telefone...');
    fireEvent.change(searchInput, createMockChangeEvent('Test Contact'));

    await waitFor(() => {
      expect(mockApiService.getMessageLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Test Contact',
        })
      );
    });
  });

  it('filters logs by status', async () => {
    render(<MessageLogs />);

    const statusFilter = screen.getByDisplayValue('Todos os status');
    fireEvent.change(statusFilter, createMockChangeEvent('sent'));

    await waitFor(() => {
      expect(mockApiService.getMessageLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
        })
      );
    });
  });

  it('filters logs by campaign', async () => {
    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Todas as campanhas')).toBeInTheDocument();
    });

    const campaignFilter = screen.getByDisplayValue('Todas as campanhas');
    fireEvent.change(campaignFilter, createMockChangeEvent(mockCampaign.id));

    await waitFor(() => {
      expect(mockApiService.getMessageLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: mockCampaign.id,
        })
      );
    });
  });

  it('filters logs by date range', async () => {
    render(<MessageLogs />);

    const startDateInput = screen.getByLabelText('Data inicial');
    const endDateInput = screen.getByLabelText('Data final');

    fireEvent.change(startDateInput, createMockChangeEvent('2024-01-01'));
    fireEvent.change(endDateInput, createMockChangeEvent('2024-01-31'));

    await waitFor(() => {
      expect(mockApiService.getMessageLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        })
      );
    });
  });

  it('displays status badges with correct colors', async () => {
    const logsWithDifferentStatuses = [
      { ...mockMessageLog, id: '1', status: 'pending' as const },
      { ...mockMessageLog, id: '2', status: 'sent' as const },
      { ...mockMessageLog, id: '3', status: 'delivered' as const },
      { ...mockMessageLog, id: '4', status: 'read' as const },
      { ...mockMessageLog, id: '5', status: 'failed' as const },
    ];

    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: logsWithDifferentStatuses,
      pagination: { page: 1, limit: 10, total: 5, pages: 1 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Pendente')).toBeInTheDocument();
      expect(screen.getByText('Enviada')).toBeInTheDocument();
      expect(screen.getByText('Entregue')).toBeInTheDocument();
      expect(screen.getByText('Lida')).toBeInTheDocument();
      expect(screen.getByText('Falhou')).toBeInTheDocument();
    });

    // Check badge colors
    const pendingBadge = screen.getByText('Pendente');
    expect(pendingBadge).toHaveClass('bg-yellow-100');

    const sentBadge = screen.getByText('Enviada');
    expect(sentBadge).toHaveClass('bg-blue-100');

    const deliveredBadge = screen.getByText('Entregue');
    expect(deliveredBadge).toHaveClass('bg-green-100');

    const readBadge = screen.getByText('Lida');
    expect(readBadge).toHaveClass('bg-purple-100');

    const failedBadge = screen.getByText('Falhou');
    expect(failedBadge).toHaveClass('bg-red-100');
  });

  it('opens message details modal', async () => {
    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const viewButton = screen.getByTitle('Ver detalhes');
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Detalhes da Mensagem')).toBeInTheDocument();
      expect(screen.getByText('Hello Test Contact, this is a test message!')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp ID: wamid.test123')).toBeInTheDocument();
    });
  });

  it('displays error message in details modal', async () => {
    const failedLog = {
      ...mockMessageLog,
      status: 'failed' as const,
      error_message: 'Invalid phone number',
    };

    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: [failedLog],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const viewButton = screen.getByTitle('Ver detalhes');
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Erro: Invalid phone number')).toBeInTheDocument();
    });
  });

  it('handles pagination correctly', async () => {
    // Mock response with multiple pages
    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: [mockMessageLog],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        pages: 3,
      },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1 a 10 de 25 resultados')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockApiService.getMessageLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('exports logs to CSV', async () => {
    render(<MessageLogs />);

    const exportButton = screen.getByText('Exportar CSV');
    fireEvent.click(exportButton);

    await waitFor(() => {
      // Mock CSV export functionality
      expect(mockApiService.getMessageLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          export: true,
        })
      );
    });
  });

  it('displays delivery timeline for successful messages', async () => {
    const deliveredLog = {
      ...mockMessageLog,
      status: 'delivered' as const,
      sent_at: '2024-01-01T10:00:00Z',
      delivered_at: '2024-01-01T10:00:30Z',
    };

    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: [deliveredLog],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const viewButton = screen.getByTitle('Ver detalhes');
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Timeline de Entrega')).toBeInTheDocument();
      expect(screen.getByText('Enviada em')).toBeInTheDocument();
      expect(screen.getByText('Entregue em')).toBeInTheDocument();
    });
  });

  it('shows retry button for failed messages', async () => {
    const failedLog = {
      ...mockMessageLog,
      status: 'failed' as const,
      error_message: 'Temporary failure',
    };

    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: [failedLog],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const retryButton = screen.getByTitle('Tentar novamente');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockApiService.sendSingleMessage).toHaveBeenCalledWith({
        phone: failedLog.phone,
        message: failedLog.message_content,
      });
    });
  });

  it('displays loading state correctly', async () => {
    // Mock loading state
    mockApiService.getMessageLogs.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      }), 1000))
    );

    render(<MessageLogs />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows empty state when no logs found', async () => {
    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum log encontrado')).toBeInTheDocument();
      expect(screen.getByText('Tente ajustar os filtros ou envie algumas mensagens primeiro')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockApiService.getMessageLogs.mockRejectedValueOnce(new Error('API Error'));

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar logs')).toBeInTheDocument();
    });
  });

  it('displays campaign-specific logs when campaignId is provided', async () => {
    // Mock useParams to return a campaignId
    vi.mocked(useParams).mockReturnValueOnce({ campaignId: mockCampaign.id });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText(`Logs da Campanha: ${mockCampaign.name}`)).toBeInTheDocument();
    });

    expect(mockApiService.getCampaignLogs).toHaveBeenCalledWith(mockCampaign.id, expect.any(Object));
  });

  it('shows bulk actions for selected logs', async () => {
    const multipleLogs = [
      { ...mockMessageLog, id: '1', status: 'failed' as const },
      { ...mockMessageLog, id: '2', status: 'failed' as const },
    ];

    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: multipleLogs,
      pagination: { page: 1, limit: 10, total: 2, pages: 1 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')).toHaveLength(3); // 2 rows + select all
    });

    // Select logs
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    const secondCheckbox = screen.getAllByRole('checkbox')[2];

    fireEvent.click(firstCheckbox);
    fireEvent.click(secondCheckbox);

    expect(screen.getByText('2 itens selecionados')).toBeInTheDocument();
    expect(screen.getByText('Tentar novamente selecionados')).toBeInTheDocument();
  });

  it('performs bulk retry for selected failed messages', async () => {
    const multipleLogs = [
      { ...mockMessageLog, id: '1', status: 'failed' as const },
      { ...mockMessageLog, id: '2', status: 'failed' as const },
    ];

    mockApiService.getMessageLogs.mockResolvedValueOnce({
      success: true,
      data: multipleLogs,
      pagination: { page: 1, limit: 10, total: 2, pages: 1 },
    });

    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    });

    // Select all logs
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(selectAllCheckbox);

    const bulkRetryButton = screen.getByText('Tentar novamente selecionados');
    fireEvent.click(bulkRetryButton);

    await waitFor(() => {
      expect(mockApiService.sendSingleMessage).toHaveBeenCalledTimes(2);
    });
  });

  it('shows statistics summary', async () => {
    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Total de Mensagens')).toBeInTheDocument();
      expect(screen.getByText('5,000')).toBeInTheDocument();
      expect(screen.getByText('Taxa de Sucesso')).toBeInTheDocument();
      expect(screen.getByText('95.5%')).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    render(<MessageLogs />);

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle('Atualizar');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockApiService.getMessageLogs).toHaveBeenCalledTimes(2);
    });
  });
});

// Fix the mock import issue
function useParams() {
  return { campaignId: undefined };
}