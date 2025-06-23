import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockTemplate, createMockChangeEvent } from '../helpers';
import Templates from '@/pages/Templates';
import { toast } from 'react-hot-toast';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/templates' }),
  };
});

describe('Templates Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders templates page with table', async () => {
    render(<Templates />);

    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Gerencie seus templates de mensagens')).toBeInTheDocument();
    expect(screen.getByText('Novo Template')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });
  });

  it('opens create template modal when clicking new template button', async () => {
    render(<Templates />);

    const newTemplateButton = screen.getByText('Novo Template');
    fireEvent.click(newTemplateButton);

    await waitFor(() => {
      expect(screen.getByText('Novo Template')).toBeInTheDocument();
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
      expect(screen.getByLabelText('Conteúdo')).toBeInTheDocument();
    });
  });

  it('creates a new template successfully', async () => {
    render(<Templates />);

    // Open create modal
    const newTemplateButton = screen.getByText('Novo Template');
    fireEvent.click(newTemplateButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText('Nome');
    const contentInput = screen.getByLabelText('Conteúdo');
    const categorySelect = screen.getByLabelText('Categoria');

    fireEvent.change(nameInput, createMockChangeEvent('New Template'));
    fireEvent.change(contentInput, createMockChangeEvent('Hello {{name}}, this is a new template!'));
    fireEvent.change(categorySelect, createMockChangeEvent('marketing'));

    // Submit form
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApiService.createTemplate).toHaveBeenCalledWith({
        name: 'New Template',
        content: 'Hello {{name}}, this is a new template!',
        category: 'marketing',
      });
      expect(toast.success).toHaveBeenCalledWith('Template criado com sucesso!');
    });
  });

  it('validates required fields when creating template', async () => {
    render(<Templates />);

    // Open create modal
    const newTemplateButton = screen.getByText('Novo Template');
    fireEvent.click(newTemplateButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    // Submit form without filling required fields
    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Conteúdo é obrigatório')).toBeInTheDocument();
    });

    expect(mockApiService.createTemplate).not.toHaveBeenCalled();
  });

  it('filters templates by search term', async () => {
    render(<Templates />);

    const searchInput = screen.getByPlaceholderText('Buscar templates...');
    fireEvent.change(searchInput, createMockChangeEvent('Test'));

    await waitFor(() => {
      expect(mockApiService.getTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Test',
        })
      );
    });
  });

  it('filters templates by category', async () => {
    render(<Templates />);

    const categoryFilter = screen.getByDisplayValue('Todas as categorias');
    fireEvent.change(categoryFilter, createMockChangeEvent('marketing'));

    await waitFor(() => {
      expect(mockApiService.getTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'marketing',
        })
      );
    });
  });

  it('opens edit modal when clicking edit button', async () => {
    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Editar');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Editar Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Hello {{name}}, this is a test message!')).toBeInTheDocument();
    });
  });

  it('updates template successfully', async () => {
    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    // Open edit modal
    const editButton = screen.getByTitle('Editar');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
    });

    // Update name
    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, createMockChangeEvent('Updated Template'));

    // Submit form
    const updateButton = screen.getByRole('button', { name: /atualizar/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockApiService.updateTemplate).toHaveBeenCalledWith(
        mockTemplate.id,
        expect.objectContaining({
          name: 'Updated Template',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Template atualizado com sucesso!');
    });
  });

  it('deletes template with confirmation', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Excluir');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Tem certeza que deseja excluir este template?');
      expect(mockApiService.deleteTemplate).toHaveBeenCalledWith(mockTemplate.id);
      expect(toast.success).toHaveBeenCalledWith('Template excluído com sucesso!');
    });

    confirmSpy.mockRestore();
  });

  it('cancels delete when user clicks cancel', async () => {
    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Excluir');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockApiService.deleteTemplate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('opens preview modal when clicking preview button', async () => {
    mockApiService.previewTemplate.mockResolvedValueOnce({
      success: true,
      content: 'Hello Test User, this is a test message!',
    });

    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    const previewButton = screen.getByTitle('Visualizar');
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText('Pré-visualização do Template')).toBeInTheDocument();
      expect(mockApiService.previewTemplate).toHaveBeenCalledWith(mockTemplate.id, {});
    });
  });

  it('handles pagination correctly', async () => {
    // Mock response with multiple pages
    mockApiService.getTemplates.mockResolvedValueOnce({
      success: true,
      data: [mockTemplate],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        pages: 3,
      },
    });

    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1 a 10 de 25 resultados')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockApiService.getTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('handles API errors gracefully', async () => {
    mockApiService.createTemplate.mockRejectedValueOnce(new Error('API Error'));

    render(<Templates />);

    // Open create modal and submit
    const newTemplateButton = screen.getByText('Novo Template');
    fireEvent.click(newTemplateButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Nome');
    const contentInput = screen.getByLabelText('Conteúdo');

    fireEvent.change(nameInput, createMockChangeEvent('Test'));
    fireEvent.change(contentInput, createMockChangeEvent('Test content'));

    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('displays loading state correctly', async () => {
    // Mock loading state
    mockApiService.getTemplates.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      }), 1000))
    );

    render(<Templates />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows stats correctly', async () => {
    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Ativos')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });
  });

  it('displays category badges with correct colors', async () => {
    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    const marketingBadge = screen.getByText('Marketing');
    expect(marketingBadge).toHaveClass('bg-green-100');
  });

  it('validates template variables in preview', async () => {
    mockApiService.previewTemplate.mockResolvedValueOnce({
      success: true,
      content: 'Hello John Doe, this is a test message!',
    });

    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    const previewButton = screen.getByTitle('Visualizar');
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText('Pré-visualização do Template')).toBeInTheDocument();
    });

    // Test with custom variables
    const nameInput = screen.getByPlaceholderText('name');
    fireEvent.change(nameInput, createMockChangeEvent('John Doe'));

    const previewBtn = screen.getByRole('button', { name: /visualizar/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(mockApiService.previewTemplate).toHaveBeenCalledWith(mockTemplate.id, {
        name: 'John Doe',
      });
    });
  });

  it('shows template usage count', async () => {
    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('0 campanhas')).toBeInTheDocument();
    });
  });

  it('handles template content with multiple variables', async () => {
    const templateWithMultipleVars = {
      ...mockTemplate,
      content: 'Hello {{name}}, your order {{order_id}} for {{product}} is ready!',
    };

    mockApiService.getTemplates.mockResolvedValueOnce({
      success: true,
      data: [templateWithMultipleVars],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    render(<Templates />);

    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    const previewButton = screen.getByTitle('Visualizar');
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('order_id')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('product')).toBeInTheDocument();
    });
  });
});