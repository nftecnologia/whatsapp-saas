import { test, expect } from '@playwright/test';

test.describe('WhatsApp Integrations Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: '1',
              email: 'test@example.com',
              name: 'Test User',
              company_id: 'company-1',
              role: 'admin',
            },
            company: {
              id: 'company-1',
              name: 'Test Company',
              plan: 'premium',
            },
          },
        }),
      });
    });

    // Mock integrations API
    await page.route('**/api/integrations/whatsapp**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: '1',
                company_id: 'company-1',
                instance_name: 'Empresa Principal',
                instance_key: 'empresa_principal_001',
                status: 'connected',
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
                status: 'disconnected',
                is_active: true,
                created_at: '2024-01-02T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
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
      }
    });

    await page.goto('/integrations');
  });

  test('should display integrations list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Integrações WhatsApp');
    await expect(page.locator('text=Empresa Principal')).toBeVisible();
    await expect(page.locator('text=Suporte')).toBeVisible();
  });

  test('should show correct status badges', async ({ page }) => {
    await expect(page.locator('text=Conectado')).toBeVisible();
    await expect(page.locator('text=Desconectado')).toBeVisible();
  });

  test('should open create modal', async ({ page }) => {
    await page.click('text=Nova Integração');
    
    await expect(page.locator('text=Nova Integração')).toBeVisible();
    await expect(page.locator('label:has-text("Nome da Instância")')).toBeVisible();
    await expect(page.locator('label:has-text("Chave da Instância")')).toBeVisible();
  });

  test('should create new integration', async ({ page }) => {
    // Mock create integration API
    await page.route('**/api/integrations/whatsapp', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: '3',
              instance_name: 'Nova Instância',
              instance_key: 'nova_instancia_001',
              status: 'disconnected',
            },
          }),
        });
      }
    });

    await page.click('text=Nova Integração');
    
    await page.fill('input[name="instance_name"]', 'Nova Instância');
    await page.fill('input[name="instance_key"]', 'nova_instancia_001');
    
    await page.click('button:has-text("Criar")');
    
    // Should show success message
    await expect(page.locator('text=Integração criada com sucesso!')).toBeVisible();
  });

  test('should filter integrations by status', async ({ page }) => {
    await page.selectOption('select', 'connected');
    
    // Should still see connected integration
    await expect(page.locator('text=Empresa Principal')).toBeVisible();
  });

  test('should search integrations', async ({ page }) => {
    await page.fill('input[placeholder="Buscar integrações..."]', 'Empresa');
    
    // Should filter results based on search
    await expect(page.locator('text=Empresa Principal')).toBeVisible();
  });

  test('should show QR code modal for connecting integration', async ({ page }) => {
    // Mock QR code API
    await page.route('**/api/integrations/whatsapp/2/qr', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            instance_name: 'Suporte',
          },
        }),
      });
    });

    // Click QR code button for disconnected integration
    await page.click('[title="Mostrar QR Code"]');
    
    await expect(page.locator('text=QR Code para Conexão')).toBeVisible();
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();
  });

  test('should disconnect integration with confirmation', async ({ page }) => {
    // Mock disconnect API
    await page.route('**/api/integrations/whatsapp/1/disconnect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
        }),
      });
    });

    // Mock the confirmation dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('desconectar');
      await dialog.accept();
    });

    // Click disconnect button for connected integration
    await page.click('[title="Desconectar"]');
    
    // Should show success message
    await expect(page.locator('text=Desconectado com sucesso!')).toBeVisible();
  });

  test('should edit integration', async ({ page }) => {
    // Mock update API
    await page.route('**/api/integrations/whatsapp/1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
          }),
        });
      }
    });

    await page.click('[title="Editar"]');
    
    await expect(page.locator('text=Editar Integração')).toBeVisible();
    
    // Update the instance name
    await page.fill('input[name="instance_name"]', 'Empresa Principal Atualizada');
    
    await page.click('button:has-text("Atualizar")');
    
    // Should show success message
    await expect(page.locator('text=Integração atualizada com sucesso!')).toBeVisible();
  });

  test('should delete integration with confirmation', async ({ page }) => {
    // Mock delete API
    await page.route('**/api/integrations/whatsapp/2', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
          }),
        });
      }
    });

    // Mock the confirmation dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('excluir');
      await dialog.accept();
    });

    await page.click('[title="Excluir"]');
    
    // Should show success message
    await expect(page.locator('text=Integração excluída com sucesso!')).toBeVisible();
  });

  test('should refresh integration status', async ({ page }) => {
    // Mock refresh API
    await page.route('**/api/integrations/whatsapp/1/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
        }),
      });
    });

    await page.click('[title="Atualizar Status"]');
    
    // Should show success message
    await expect(page.locator('text=Status atualizado!')).toBeVisible();
  });

  test('should show instructions in create modal', async ({ page }) => {
    await page.click('text=Nova Integração');
    
    await expect(page.locator('text=Como configurar sua integração')).toBeVisible();
    await expect(page.locator('text=Configure sua instância na Evolution API')).toBeVisible();
    await expect(page.locator('text=Escaneie o QR Code com seu WhatsApp')).toBeVisible();
  });

  test('should handle form validation', async ({ page }) => {
    await page.click('text=Nova Integração');
    
    // Try to submit empty form
    await page.click('button:has-text("Criar")');
    
    // Should show validation errors
    await expect(page.locator('text=Nome da instância é obrigatório')).toBeVisible();
    await expect(page.locator('text=Chave da instância é obrigatória')).toBeVisible();
  });
});