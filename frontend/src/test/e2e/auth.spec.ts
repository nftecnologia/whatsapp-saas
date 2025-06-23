import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/auth/login', async route => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postData();
        const { email, password } = JSON.parse(postData || '{}');
        
        if (email === 'test@example.com' && password === 'password123') {
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
                token: 'fake-jwt-token',
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Invalid credentials',
            }),
          });
        }
      }
    });

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
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('WhatsApp SaaS')).toBeVisible();
    await expect(page.getByText('Faça login para acessar sua conta')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText('Email é obrigatório')).toBeVisible();
    await expect(page.getByText('Senha é obrigatória')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Senha').fill('password123');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText('Email inválido')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Senha').fill('password123');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Senha').fill('wrongpassword');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.getByLabel('Senha');
    const toggleButton = page.getByTitle('Mostrar senha');

    await expect(passwordInput).toHaveAttribute('type', 'password');

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(page.getByTitle('Ocultar senha')).toBeVisible();

    await page.getByTitle('Ocultar senha').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should handle remember me functionality', async ({ page }) => {
    await page.goto('/login');

    const rememberCheckbox = page.getByLabel('Lembrar de mim');
    await expect(rememberCheckbox).not.toBeChecked();

    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Senha').fill('password123');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page).toHaveURL('/dashboard');

    // Mock logout API
    await page.route('**/api/auth/logout', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Logout
    await page.getByRole('button', { name: /sair/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should redirect to dashboard if already authenticated', async ({ page }) => {
    // Mock authenticated user
    await page.goto('/dashboard'); // Go directly to dashboard

    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').focus();
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Senha')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Lembrar de mim')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /entrar/i })).toBeFocused();
  });

  test('should submit form with Enter key', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Senha').fill('password123');
    await page.getByLabel('Senha').press('Enter');

    await expect(page).toHaveURL('/dashboard');
  });
});