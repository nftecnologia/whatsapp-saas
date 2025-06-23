import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockAuthStore, createMockChangeEvent } from '../helpers';
import Login from '@/pages/Login';
import { toast } from 'react-hot-toast';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login', search: '' }),
  };
});

// Mock auth store
const mockLogin = vi.fn();
const mockAuthStoreWithLogin = {
  ...mockAuthStore,
  login: mockLogin,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStoreWithLogin),
}));

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStoreWithLogin.isAuthenticated = false;
    mockAuthStoreWithLogin.isLoading = false;
  });

  it('renders login page with form', () => {
    render(<Login />);

    expect(screen.getByText('WhatsApp SaaS')).toBeInTheDocument();
    expect(screen.getByText('Faça login para acessar sua conta')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<Login />);

    const submitButton = screen.getByRole('button', { name: /entrar/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('invalid-email'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates password minimum length', async () => {
    render(<Login />);

    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(passwordInput, createMockChangeEvent('123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Senha deve ter pelo menos 6 caracteres')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits form with valid credentials', async () => {
    mockLogin.mockResolvedValueOnce({ success: true });

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('handles login success', async () => {
    mockLogin.mockResolvedValueOnce({ success: true });

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Login realizado com sucesso!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('wrongpassword'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Credenciais inválidas');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows loading state during login', async () => {
    mockAuthStoreWithLogin.isLoading = true;

    render(<Login />);

    const submitButton = screen.getByRole('button', { name: /entrando/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('redirects to dashboard if already authenticated', async () => {
    mockAuthStoreWithLogin.isAuthenticated = true;

    render(<Login />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles forgot password link', () => {
    render(<Login />);

    const forgotPasswordLink = screen.getByText('Esqueceu sua senha?');
    expect(forgotPasswordLink).toBeInTheDocument();
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('handles create account link', () => {
    render(<Login />);

    const createAccountLink = screen.getByText('Criar conta');
    expect(createAccountLink).toBeInTheDocument();
    expect(createAccountLink).toHaveAttribute('href', '/register');
  });

  it('toggles password visibility', async () => {
    render(<Login />);

    const passwordInput = screen.getByLabelText('Senha');
    const toggleButton = screen.getByTitle('Mostrar senha');

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByTitle('Ocultar senha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Ocultar senha'));

    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(screen.getByTitle('Mostrar senha')).toBeInTheDocument();
    });
  });

  it('handles remember me checkbox', () => {
    render(<Login />);

    const rememberMeCheckbox = screen.getByLabelText('Lembrar de mim');
    expect(rememberMeCheckbox).toBeInTheDocument();
    expect(rememberMeCheckbox).not.toBeChecked();

    fireEvent.click(rememberMeCheckbox);
    expect(rememberMeCheckbox).toBeChecked();
  });

  it('handles enter key submission', async () => {
    mockLogin.mockResolvedValueOnce({ success: true });

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('handles OAuth login buttons', () => {
    render(<Login />);

    expect(screen.getByText('Entrar com Google')).toBeInTheDocument();
    expect(screen.getByText('Entrar com GitHub')).toBeInTheDocument();
  });

  it('handles OAuth login click', async () => {
    render(<Login />);

    const googleButton = screen.getByText('Entrar com Google');
    fireEvent.click(googleButton);

    // Should trigger OAuth flow
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(expect.any(Object), 'google');
    });
  });

  it('displays error message for network errors', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro de conexão. Tente novamente.');
    });
  });

  it('handles rate limiting error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Too many requests'));

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Muitas tentativas. Tente novamente em alguns minutos.');
    });
  });

  it('clears form on successful login', async () => {
    mockLogin.mockResolvedValueOnce({ success: true });

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });
  });

  it('focuses on email input on mount', () => {
    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toHaveFocus();
  });

  it('handles redirect parameter in URL', async () => {
    vi.mocked(useLocation).mockReturnValueOnce({
      pathname: '/login',
      search: '?redirect=/campaigns',
    });

    mockLogin.mockResolvedValueOnce({ success: true });

    render(<Login />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, createMockChangeEvent('test@example.com'));
    fireEvent.change(passwordInput, createMockChangeEvent('password123'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/campaigns');
    });
  });
});

// Fix the mock import issue
function useLocation() {
  return { pathname: '/login', search: '' };
}