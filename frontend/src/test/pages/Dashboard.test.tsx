import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, mockApiService } from '../helpers';
import Dashboard from '@/pages/Dashboard';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/dashboard' }),
  };
});

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}));

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock all dashboard API calls
    mockApiService.getContactStats.mockResolvedValue({
      success: true,
      data: {
        total: 1000,
        active: 950,
        withEmail: 800,
        withTags: 600,
        recent: 150,
      },
    });

    mockApiService.getTemplateStats.mockResolvedValue({
      success: true,
      data: {
        total: 50,
        active: 45,
        withEmail: 40,
        withTags: 30,
        recent: 5,
      },
    });

    mockApiService.getCampaignStats.mockResolvedValue({
      success: true,
      data: {
        total: 100,
        active: 25,
        withEmail: 80,
        withTags: 60,
        recent: 10,
      },
    });

    mockApiService.getMessageLogStats.mockResolvedValue({
      success: true,
      data: {
        total: 5000,
        successRate: 95.5,
        deliveryRate: 90.2,
        readRate: 85.3,
        byStatus: {
          pending: 50,
          sent: 1000,
          delivered: 3000,
          read: 800,
          failed: 150,
        },
        byCampaign: {
          'Black Friday': 1500,
          'Christmas Sale': 1200,
          'New Year': 800,
          'Spring Sale': 1000,
          'Summer Sale': 500,
        },
      },
    });
  });

  it('renders dashboard page with title and description', async () => {
    render(<Dashboard />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Visão geral da sua plataforma')).toBeInTheDocument();
  });

  it('displays contact statistics correctly', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Contatos')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('950 ativos')).toBeInTheDocument();
      expect(screen.getByText('150 novos este mês')).toBeInTheDocument();
    });
  });

  it('displays template statistics correctly', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('45 ativos')).toBeInTheDocument();
      expect(screen.getByText('5 novos este mês')).toBeInTheDocument();
    });
  });

  it('displays campaign statistics correctly', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Campanhas')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('25 ativas')).toBeInTheDocument();
      expect(screen.getByText('10 novas este mês')).toBeInTheDocument();
    });
  });

  it('displays message statistics correctly', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Mensagens')).toBeInTheDocument();
      expect(screen.getByText('5,000')).toBeInTheDocument();
      expect(screen.getByText('95.5% taxa de sucesso')).toBeInTheDocument();
      expect(screen.getByText('90.2% entregues')).toBeInTheDocument();
    });
  });

  it('displays message status chart', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Status das Mensagens')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  it('displays campaign performance chart', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Performance por Campanha')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('displays message trends chart', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Tendência de Mensagens')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('displays recent activity section', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Atividade Recente')).toBeInTheDocument();
    });
  });

  it('displays quick actions section', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Ações Rápidas')).toBeInTheDocument();
      expect(screen.getByText('Novo Contato')).toBeInTheDocument();
      expect(screen.getByText('Novo Template')).toBeInTheDocument();
      expect(screen.getByText('Nova Campanha')).toBeInTheDocument();
      expect(screen.getByText('Enviar Mensagem')).toBeInTheDocument();
    });
  });

  it('handles loading state correctly', async () => {
    // Mock loading state for one of the API calls
    mockApiService.getContactStats.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: {
          total: 1000,
          active: 950,
          withEmail: 800,
          withTags: 600,
          recent: 150,
        },
      }), 1000))
    );

    render(<Dashboard />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockApiService.getContactStats.mockRejectedValueOnce(new Error('API Error'));

    render(<Dashboard />);

    await waitFor(() => {
      // Should show error state or fallback UI
      expect(screen.getByText('Erro ao carregar dados')).toBeInTheDocument();
    });
  });

  it('displays correct success rates', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('95.5%')).toBeInTheDocument();
      expect(screen.getByText('90.2%')).toBeInTheDocument();
      expect(screen.getByText('85.3%')).toBeInTheDocument();
    });
  });

  it('displays message status breakdown', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Entregues')).toBeInTheDocument();
      expect(screen.getByText('3,000')).toBeInTheDocument();
      expect(screen.getByText('Enviadas')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('Lidas')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
      expect(screen.getByText('Falharam')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });
  });

  it('displays top campaign performance', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Black Friday')).toBeInTheDocument();
      expect(screen.getByText('1,500')).toBeInTheDocument();
      expect(screen.getByText('Christmas Sale')).toBeInTheDocument();
      expect(screen.getByText('1,200')).toBeInTheDocument();
    });
  });

  it('shows time-based analytics', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Últimos 7 dias')).toBeInTheDocument();
      expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
      expect(screen.getByText('Últimos 90 dias')).toBeInTheDocument();
    });
  });

  it('displays growth indicators', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // Look for growth indicators or percentage changes
      expect(screen.getByText(/\+\d+%/)).toBeInTheDocument();
    });
  });

  it('shows system health indicators', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Sistema')).toBeInTheDocument();
      expect(screen.getByText('Operacional')).toBeInTheDocument();
    });
  });

  it('displays responsive charts', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(3);
    });
  });

  it('handles empty data gracefully', async () => {
    // Mock empty data responses
    mockApiService.getContactStats.mockResolvedValueOnce({
      success: true,
      data: {
        total: 0,
        active: 0,
        withEmail: 0,
        withTags: 0,
        recent: 0,
      },
    });

    mockApiService.getMessageLogStats.mockResolvedValueOnce({
      success: true,
      data: {
        total: 0,
        successRate: 0,
        deliveryRate: 0,
        readRate: 0,
        byStatus: {
          pending: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        },
        byCampaign: {},
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Nenhum dado disponível')).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle('Atualizar dados');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockApiService.getContactStats).toHaveBeenCalledTimes(2);
      expect(mockApiService.getTemplateStats).toHaveBeenCalledTimes(2);
      expect(mockApiService.getCampaignStats).toHaveBeenCalledTimes(2);
      expect(mockApiService.getMessageLogStats).toHaveBeenCalledTimes(2);
    });
  });

  it('displays correct date ranges', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Hoje')).toBeInTheDocument();
      expect(screen.getByText('Esta semana')).toBeInTheDocument();
      expect(screen.getByText('Este mês')).toBeInTheDocument();
    });
  });

  it('shows export functionality', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Exportar Relatório')).toBeInTheDocument();
    });
  });
});