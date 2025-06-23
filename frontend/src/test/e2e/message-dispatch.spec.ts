import { test, expect } from '@playwright/test';

test.describe('Message Dispatch', () => {
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
            },
            {
              id: 'contact-2',
              name: 'Jane Smith',
              phone: '+5511888888888',
              email: 'jane@example.com',
              tags: ['lead'],
            },
          ],
          pagination: { page: 1, limit: 100, total: 2, pages: 1 },
        }),
      });
    });

    // Mock templates API
    await page.route('**/api/templates**', async route => {
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
            },
            {
              id: 'template-2',
              name: 'Promotion Template',
              content: 'Hi {{name}}, check out our {{discount}}% discount!',
              category: 'marketing',
            },
          ],
          pagination: { page: 1, limit: 100, total: 2, pages: 1 },
        }),
      });
    });

    // Mock send message API
    await page.route('**/api/messages/send', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Message sent successfully',
        }),
      });
    });
  });

  test('should send individual message', async ({ page }) => {
    await page.goto('/message-dispatch');

    await expect(page.getByText('Envio de Mensagens')).toBeVisible();
    await expect(page.getByText('Mensagem Individual')).toBeVisible();

    // Fill individual message form
    await page.getByLabel('Telefone').fill('+5511999999999');
    await page.getByLabel('Mensagem').fill('Hello, this is a test message!');

    // Send message
    await page.getByRole('button', { name: /enviar mensagem/i }).click();

    await expect(page.getByText('Mensagem enviada com sucesso!')).toBeVisible();
  });

  test('should validate individual message form', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Submit without filling required fields
    await page.getByRole('button', { name: /enviar mensagem/i }).click();

    await expect(page.getByText('Telefone é obrigatório')).toBeVisible();
    await expect(page.getByText('Mensagem é obrigatória')).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/message-dispatch');

    await page.getByLabel('Telefone').fill('invalid-phone');
    await page.getByLabel('Mensagem').fill('Test message');
    await page.getByRole('button', { name: /enviar mensagem/i }).click();

    await expect(page.getByText('Formato de telefone inválido')).toBeVisible();
  });

  test('should use template for individual message', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Select template
    await page.getByLabel('Template (opcional)').selectOption('template-1');

    // Check if message field is filled with template content
    await expect(page.getByLabel('Mensagem')).toHaveValue('Welcome {{name}}! Thanks for joining us.');

    // Fill phone number
    await page.getByLabel('Telefone').fill('+5511999999999');

    // Send message
    await page.getByRole('button', { name: /enviar mensagem/i }).click();

    await expect(page.getByText('Mensagem enviada com sucesso!')).toBeVisible();
  });

  test('should display character count', async ({ page }) => {
    await page.goto('/message-dispatch');

    await page.getByLabel('Mensagem').fill('Test message');

    await expect(page.getByText('12/1000 caracteres')).toBeVisible();
  });

  test('should warn about long messages', async ({ page }) => {
    await page.goto('/message-dispatch');

    const longMessage = 'a'.repeat(161);
    await page.getByLabel('Mensagem').fill(longMessage);

    await expect(page.getByText('Esta mensagem será enviada em múltiplas partes')).toBeVisible();
  });

  test('should switch to batch sending tab', async ({ page }) => {
    await page.goto('/message-dispatch');

    await page.getByText('Envio em Lote').click();

    await expect(page.getByText('Selecionar Contatos')).toBeVisible();
    await expect(page.getByText('Escolher Template')).toBeVisible();
  });

  test('should select contacts for batch sending', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Wait for contacts to load
    await expect(page.getByText('John Doe')).toBeVisible();

    // Select individual contact
    await page.getByRole('checkbox', { name: /john doe/i }).check();
    await expect(page.getByText('1 contato selecionado')).toBeVisible();

    // Select all contacts
    await page.getByRole('checkbox', { name: /selecionar todos/i }).check();
    await expect(page.getByText('2 contatos selecionados')).toBeVisible();
  });

  test('should filter contacts for batch sending', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Search for contacts
    await page.getByPlaceholder('Buscar contatos...').fill('John');

    // Should show filtered results
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test('should select template for batch sending', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Wait for templates to load
    await expect(page.getByText('Welcome Template')).toBeVisible();

    // Select template
    await page.getByText('Welcome Template').click();

    await expect(page.getByText('Template selecionado: Welcome Template')).toBeVisible();
  });

  test('should handle template variables in batch sending', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Select template with variables
    await page.getByText('Promotion Template').click();

    // Fill variables
    await expect(page.getByPlaceholder('name')).toBeVisible();
    await expect(page.getByPlaceholder('discount')).toBeVisible();

    await page.getByPlaceholder('name').fill('Customer');
    await page.getByPlaceholder('discount').fill('20');

    // Select contacts
    await page.getByRole('checkbox', { name: /selecionar todos/i }).check();

    // Send messages
    await page.getByRole('button', { name: /enviar mensagens/i }).click();

    await expect(page.getByText('Mensagens enviadas com sucesso!')).toBeVisible();
  });

  test('should preview batch messages', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Select contact and template
    await page.getByRole('checkbox', { name: /john doe/i }).check();
    await page.getByText('Welcome Template').click();

    // Preview messages
    await page.getByText('Pré-visualizar').click();

    await expect(page.getByText('Pré-visualização das Mensagens')).toBeVisible();
    await expect(page.getByText('Welcome John Doe! Thanks for joining us.')).toBeVisible();
  });

  test('should validate batch sending requirements', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Send button should be disabled without selections
    await expect(page.getByRole('button', { name: /enviar mensagens/i })).toBeDisabled();

    // Select template only
    await page.getByText('Welcome Template').click();
    await expect(page.getByRole('button', { name: /enviar mensagens/i })).toBeDisabled();

    // Select contact only (deselect template first)
    await page.getByText('Welcome Template').click(); // deselect
    await page.getByRole('checkbox', { name: /john doe/i }).check();
    await expect(page.getByRole('button', { name: /enviar mensagens/i })).toBeDisabled();

    // Select both
    await page.getByText('Welcome Template').click();
    await expect(page.getByRole('button', { name: /enviar mensagens/i })).not.toBeDisabled();
  });

  test('should show estimated cost for batch sending', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Select all contacts
    await page.getByRole('checkbox', { name: /selecionar todos/i }).check();

    await expect(page.getByText('Custo estimado: R$ 0,20')).toBeVisible();
  });

  test('should handle media attachments', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Test file input exists
    await expect(page.getByLabel('Anexar mídia (opcional)')).toBeVisible();

    // Note: File upload testing with Playwright requires special setup
    // This is a basic test to ensure the element exists
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/messages/send', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
        }),
      });
    });

    await page.goto('/message-dispatch');

    await page.getByLabel('Telefone').fill('+5511999999999');
    await page.getByLabel('Mensagem').fill('Test message');
    await page.getByRole('button', { name: /enviar mensagem/i }).click();

    await expect(page.getByText('Erro ao enviar mensagem')).toBeVisible();
  });

  test('should show sending progress for batch messages', async ({ page }) => {
    // Mock slower API response to test loading state
    await page.route('**/api/messages/send', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Message sent successfully',
        }),
      });
    });

    await page.goto('/message-dispatch');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Select contacts and template
    await page.getByRole('checkbox', { name: /selecionar todos/i }).check();
    await page.getByText('Welcome Template').click();

    // Send messages
    await page.getByRole('button', { name: /enviar mensagens/i }).click();

    // Should show progress
    await expect(page.getByText('Enviando mensagens...')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Telefone')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Template (opcional)')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Mensagem')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /enviar mensagem/i })).toBeFocused();
  });

  test('should persist form data during tab switches', async ({ page }) => {
    await page.goto('/message-dispatch');

    // Fill individual message form
    await page.getByLabel('Telefone').fill('+5511999999999');
    await page.getByLabel('Mensagem').fill('Test message');

    // Switch to batch tab
    await page.getByText('Envio em Lote').click();

    // Switch back to individual tab
    await page.getByText('Mensagem Individual').click();

    // Data should be preserved
    await expect(page.getByLabel('Telefone')).toHaveValue('+5511999999999');
    await expect(page.getByLabel('Mensagem')).toHaveValue('Test message');
  });
});