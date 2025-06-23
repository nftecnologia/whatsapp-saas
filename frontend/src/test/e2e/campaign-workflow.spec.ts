import { test, expect } from '@playwright/test';

test.describe('Campaign Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: '123',
              email: 'test@example.com',
              name: 'Test User',
              company_id: '456',
              role: 'user',
            },
            company: {
              id: '456',
              name: 'Test Company',
              email: 'company@example.com',
              plan: 'basic',
            },
          },
        }),
      });
    });

    // Mock contacts API
    await page.route('**/api/contacts**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'contact-1',
                name: 'John Doe',
                phone: '+5511999999999',
                email: 'john@example.com',
                tags: ['customer'],
                created_at: '2024-01-01T00:00:00Z',
              },
              {
                id: 'contact-2',
                name: 'Jane Smith',
                phone: '+5511888888888',
                email: 'jane@example.com',
                tags: ['lead'],
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 2,
              pages: 1,
            },
          }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'new-contact',
              name: 'New Contact',
              phone: '+5511777777777',
              email: 'new@example.com',
              tags: [],
              created_at: '2024-01-01T00:00:00Z',
            },
          }),
        });
      }
    });

    // Mock templates API
    await page.route('**/api/templates**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'template-1',
                name: 'Welcome Template',
                content: 'Welcome {{name}}! Thanks for joining us.',
                category: 'marketing',
                created_at: '2024-01-01T00:00:00Z',
              },
              {
                id: 'template-2',
                name: 'Promotion Template',
                content: 'Hi {{name}}, check out our {{discount}}% discount!',
                category: 'marketing',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 2,
              pages: 1,
            },
          }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'new-template',
              name: 'New Template',
              content: 'Hello {{name}}, this is a new template!',
              category: 'marketing',
              created_at: '2024-01-01T00:00:00Z',
            },
          }),
        });
      }
    });

    // Mock campaigns API
    await page.route('**/api/campaigns**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'campaign-1',
                name: 'Test Campaign',
                template_id: 'template-1',
                status: 'draft',
                total_contacts: 2,
                sent_count: 0,
                delivered_count: 0,
                read_count: 0,
                failed_count: 0,
                template_name: 'Welcome Template',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              pages: 1,
            },
          }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'new-campaign',
              name: 'New Campaign',
              template_id: 'template-1',
              status: 'draft',
              total_contacts: 0,
              sent_count: 0,
              delivered_count: 0,
              read_count: 0,
              failed_count: 0,
              template_name: 'Welcome Template',
              created_at: '2024-01-01T00:00:00Z',
            },
          }),
        });
      }
    });

    // Mock campaign send API
    await page.route('**/api/campaigns/*/send', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Campaign sent successfully',
        }),
      });
    });

    // Mock stats APIs
    await page.route('**/api/contacts/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { total: 2, active: 2, recent: 0 },
        }),
      });
    });

    await page.route('**/api/templates/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { total: 2, active: 2, recent: 0 },
        }),
      });
    });

    await page.route('**/api/campaigns/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { total: 1, active: 0, recent: 1 },
        }),
      });
    });
  });

  test('should complete full campaign workflow: create contact → create template → create campaign → send', async ({ page }) => {
    await page.goto('/dashboard');

    // Step 1: Create a contact
    await page.getByRole('link', { name: /contatos/i }).click();
    await expect(page).toHaveURL('/contacts');
    await expect(page.getByText('Contatos')).toBeVisible();

    await page.getByText('Novo Contato').click();
    await expect(page.getByText('Novo Contato')).toBeVisible();

    await page.getByLabel('Nome').fill('New Contact');
    await page.getByLabel('Telefone').fill('+5511777777777');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByRole('button', { name: /criar/i }).click();

    await expect(page.getByText('Contato criado com sucesso!')).toBeVisible();

    // Step 2: Create a template
    await page.getByRole('link', { name: /templates/i }).click();
    await expect(page).toHaveURL('/templates');
    await expect(page.getByText('Templates')).toBeVisible();

    await page.getByText('Novo Template').click();
    await expect(page.getByText('Novo Template')).toBeVisible();

    await page.getByLabel('Nome').fill('New Template');
    await page.getByLabel('Conteúdo').fill('Hello {{name}}, this is a new template!');
    await page.getByLabel('Categoria').selectOption('marketing');
    await page.getByRole('button', { name: /criar/i }).click();

    await expect(page.getByText('Template criado com sucesso!')).toBeVisible();

    // Step 3: Create a campaign
    await page.getByRole('link', { name: /campanhas/i }).click();
    await expect(page).toHaveURL('/campaigns');
    await expect(page.getByText('Campanhas')).toBeVisible();

    await page.getByText('Nova Campanha').click();
    await expect(page.getByText('Nova Campanha')).toBeVisible();

    await page.getByLabel('Nome').fill('New Campaign');
    await page.getByLabel('Template').selectOption('template-1');
    await page.getByRole('button', { name: /criar/i }).click();

    await expect(page.getByText('Campanha criada com sucesso!')).toBeVisible();

    // Step 4: Send the campaign
    await expect(page.getByText('New Campaign')).toBeVisible();
    await page.getByTitle('Enviar campanha').click();

    await expect(page.getByText('Campanha iniciada com sucesso!')).toBeVisible();
  });

  test('should create and configure campaign with contacts', async ({ page }) => {
    await page.goto('/campaigns');

    // Create campaign
    await page.getByText('Nova Campanha').click();
    await page.getByLabel('Nome').fill('Marketing Campaign');
    await page.getByLabel('Template').selectOption('template-2');

    // Fill template variables
    await page.getByPlaceholder('name').fill('Customer');
    await page.getByPlaceholder('discount').fill('20');

    await page.getByRole('button', { name: /criar/i }).click();
    await expect(page.getByText('Campanha criada com sucesso!')).toBeVisible();

    // Configure contacts
    await page.getByTitle('Gerenciar contatos').click();
    await expect(page.getByText('Gerenciar Contatos da Campanha')).toBeVisible();

    // Select contacts
    await page.getByRole('checkbox').first().check();
    await page.getByText('Adicionar Selecionados').click();

    await expect(page.getByText('Contatos adicionados com sucesso!')).toBeVisible();
  });

  test('should handle campaign status changes', async ({ page }) => {
    // Mock different campaign statuses
    await page.route('**/api/campaigns/*/pause', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Campaign paused successfully',
        }),
      });
    });

    await page.route('**/api/campaigns/*/resume', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Campaign resumed successfully',
        }),
      });
    });

    await page.route('**/api/campaigns/*/cancel', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Campaign cancelled successfully',
        }),
      });
    });

    await page.goto('/campaigns');

    // Test campaign controls
    await page.getByTitle('Enviar campanha').click();
    await expect(page.getByText('Campanha iniciada com sucesso!')).toBeVisible();

    // Mock running campaign
    await page.route('**/api/campaigns**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'campaign-1',
                name: 'Test Campaign',
                template_id: 'template-1',
                status: 'running',
                total_contacts: 2,
                sent_count: 1,
                delivered_count: 0,
                read_count: 0,
                failed_count: 0,
                template_name: 'Welcome Template',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, pages: 1 },
          }),
        });
      }
    });

    await page.reload();

    // Pause campaign
    await page.getByTitle('Pausar campanha').click();
    await expect(page.getByText('Campanha pausada com sucesso!')).toBeVisible();

    // Resume campaign
    await page.getByTitle('Retomar campanha').click();
    await expect(page.getByText('Campanha retomada com sucesso!')).toBeVisible();

    // Cancel campaign
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Tem certeza');
      await dialog.accept();
    });

    await page.getByTitle('Cancelar campanha').click();
    await expect(page.getByText('Campanha cancelada com sucesso!')).toBeVisible();
  });

  test('should display campaign analytics', async ({ page }) => {
    await page.goto('/campaigns');

    // Check campaign statistics
    await expect(page.getByText('2 contatos')).toBeVisible();
    await expect(page.getByText('0 enviadas')).toBeVisible();
    await expect(page.getByText('0 entregues')).toBeVisible();
    await expect(page.getByText('0 lidas')).toBeVisible();

    // Check status badge
    await expect(page.getByText('Rascunho')).toBeVisible();
  });

  test('should handle campaign scheduling', async ({ page }) => {
    await page.goto('/campaigns');

    await page.getByText('Nova Campanha').click();
    await page.getByLabel('Nome').fill('Scheduled Campaign');
    await page.getByLabel('Template').selectOption('template-1');

    // Enable scheduling
    await page.getByLabel('Agendar envio').check();
    await expect(page.getByLabel('Data e hora do envio')).toBeVisible();

    await page.getByLabel('Data e hora do envio').fill('2024-12-25T10:00');
    await page.getByRole('button', { name: /criar/i }).click();

    await expect(page.getByText('Campanha criada com sucesso!')).toBeVisible();
  });

  test('should filter and search campaigns', async ({ page }) => {
    await page.goto('/campaigns');

    // Search campaigns
    await page.getByPlaceholder('Buscar campanhas...').fill('Test');
    await expect(page.getByText('Test Campaign')).toBeVisible();

    // Filter by status
    await page.getByDisplayValue('Todos os status').selectOption('draft');
    await expect(page.getByText('Test Campaign')).toBeVisible();

    // Clear search
    await page.getByPlaceholder('Buscar campanhas...').clear();
    await page.getByDisplayValue('draft').selectOption('');
  });

  test('should handle pagination', async ({ page }) => {
    // Mock multiple campaigns
    await page.route('**/api/campaigns**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: Array.from({ length: 10 }, (_, i) => ({
              id: `campaign-${i + 1}`,
              name: `Campaign ${i + 1}`,
              template_id: 'template-1',
              status: 'draft',
              total_contacts: 2,
              sent_count: 0,
              delivered_count: 0,
              read_count: 0,
              failed_count: 0,
              template_name: 'Welcome Template',
              created_at: '2024-01-01T00:00:00Z',
            })),
            pagination: {
              page: 1,
              limit: 10,
              total: 25,
              pages: 3,
            },
          }),
        });
      }
    });

    await page.goto('/campaigns');

    await expect(page.getByText('Mostrando 1 a 10 de 25 resultados')).toBeVisible();
    await expect(page.getByRole('button', { name: /próximo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /próximo/i })).not.toBeDisabled();
  });
});