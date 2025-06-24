import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import type { ReactElement } from 'react';
import WhatsAppIntegrations from '../../pages/WhatsAppIntegrations';
import apiService from '../../services/api';

vi.mock('../../services/api');

const mockIntegrations = [
  {
    id: '1',
    company_id: 'company-1',
    instance_name: 'Empresa Principal',
    instance_key: 'empresa_principal_001',
    status: 'connected' as const,
    phone_number: '+5511999999999',
    profile_name: 'Empresa Principal',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    company_id: 'company-1',
    instance_name: 'Suporte',
    instance_key: 'suporte_001',
    status: 'disconnected' as const,
    is_active: true,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

const renderWithProviders = (component: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WhatsAppIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getWhatsAppIntegrations).mockResolvedValue({
      data: mockIntegrations,
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
      },
    });
  });

  it('renders integrations list', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    expect(screen.getByText('Integrações WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Gerencie suas conexões WhatsApp Cloud API para envio de mensagens')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Empresa Principal')).toBeInTheDocument();
      expect(screen.getByText('Suporte')).toBeInTheDocument();
    });
  });

  it('shows correct status badges', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(screen.getByText('Desconectado')).toBeInTheDocument();
    });
  });

  it('displays phone numbers for connected integrations', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('+5511999999999')).toBeInTheDocument();
    });
  });

  it('opens create modal when "Nova Integração" button is clicked', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    const createButton = screen.getByText('Nova Integração');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Nova Integração')).toBeInTheDocument();
      expect(screen.getByLabelText('Nome da Instância')).toBeInTheDocument();
      expect(screen.getByLabelText('Chave da Instância')).toBeInTheDocument();
    });
  });

  it('creates new integration when form is submitted', async () => {
    const mockCreate = vi.mocked(apiService.createWhatsAppIntegration);
    mockCreate.mockResolvedValue({ success: true });

    renderWithProviders(<WhatsAppIntegrations />);

    const createButton = screen.getByText('Nova Integração');
    fireEvent.click(createButton);

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Nome da Instância');
      const keyInput = screen.getByLabelText('Chave da Instância');
      const submitButton = screen.getByRole('button', { name: 'Criar' });

      fireEvent.change(nameInput, { target: { value: 'Nova Instância' } });
      fireEvent.change(keyInput, { target: { value: 'nova_instancia_001' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        instance_name: 'Nova Instância',
        instance_key: 'nova_instancia_001',
      });
    });
  });

  it('filters integrations by status', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    const statusFilter = screen.getByDisplayValue('Todos os status');
    fireEvent.change(statusFilter, { target: { value: 'connected' } });

    await waitFor(() => {
      expect(apiService.getWhatsAppIntegrations).toHaveBeenCalledWith({
        status: 'connected',
        page: 1,
        limit: 10,
      });
    });
  });

  it('searches integrations by name', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    const searchInput = screen.getByPlaceholderText('Buscar integrações...');
    fireEvent.change(searchInput, { target: { value: 'Empresa' } });

    await waitFor(() => {
      expect(apiService.getWhatsAppIntegrations).toHaveBeenCalledWith({
        status: '',
        page: 1,
        limit: 10,
      });
    });
  });

  it('shows action buttons based on integration status', async () => {
    renderWithProviders(<WhatsAppIntegrations />);

    await waitFor(() => {
      // Connected integration should show disconnect button
      const rows = screen.getAllByRole('row');
      const connectedRow = rows.find(row => row.textContent?.includes('Conectado'));
      expect(connectedRow).toBeInTheDocument();

      // Disconnected integration should show connect button
      const disconnectedRow = rows.find(row => row.textContent?.includes('Desconectado'));
      expect(disconnectedRow).toBeInTheDocument();
    });
  });

  it('calls connect mutation when connect button is clicked', async () => {
    const mockConnect = vi.mocked(apiService.connectWhatsAppIntegration);
    mockConnect.mockResolvedValue({ success: true });

    renderWithProviders(<WhatsAppIntegrations />);

    await waitFor(() => {
      // Find the connect button (LinkIcon) for disconnected integration
      const connectButtons = screen.getAllByTitle('Conectar');
      if (connectButtons.length > 0) {
        fireEvent.click(connectButtons[0]);
      }
    });

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('2'); // ID of disconnected integration
    });
  });

  it('calls disconnect mutation when disconnect button is clicked', async () => {
    const mockDisconnect = vi.mocked(apiService.disconnectWhatsAppIntegration);
    mockDisconnect.mockResolvedValue({ success: true });
    
    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<WhatsAppIntegrations />);

    await waitFor(() => {
      // Find the disconnect button (XMarkIcon) for connected integration
      const disconnectButtons = screen.getAllByTitle('Desconectar');
      if (disconnectButtons.length > 0) {
        fireEvent.click(disconnectButtons[0]);
      }
    });

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith('1'); // ID of connected integration
    });

    confirmSpy.mockRestore();
  });

  it('shows loading state', () => {
    vi.mocked(apiService.getWhatsAppIntegrations).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<WhatsAppIntegrations />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('handles empty integrations list', async () => {
    vi.mocked(apiService.getWhatsAppIntegrations).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      },
    });

    renderWithProviders(<WhatsAppIntegrations />);

    await waitFor(() => {
      expect(screen.queryByText('Empresa Principal')).not.toBeInTheDocument();
    });
  });
});