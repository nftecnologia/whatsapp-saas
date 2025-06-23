# Testing Guide

This document provides comprehensive information about the testing setup and practices for the WhatsApp SaaS Frontend.

## 📋 Overview

Our testing strategy includes:
- **Unit Tests**: Component-level testing with Vitest and React Testing Library
- **Integration Tests**: Cross-component and user flow testing
- **E2E Tests**: End-to-end testing with Playwright
- **Coverage Reporting**: Code coverage tracking and reporting

## 🛠️ Setup

### Dependencies

Testing dependencies are already installed:
- `vitest` - Fast unit test runner
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom jest matchers
- `@testing-library/user-event` - User interaction simulation
- `@playwright/test` - End-to-end testing framework

### Configuration

- **Vitest Config**: `vitest.config.ts`
- **Playwright Config**: `playwright.config.ts`
- **Test Setup**: `src/test/setup.ts`
- **Test Helpers**: `src/test/helpers.tsx`

## 🧪 Running Tests

### Unit and Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- Contacts.test.tsx

# Run tests matching pattern
npm test -- --grep "login"
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run specific E2E test
npx playwright test auth.spec.ts

# Run E2E tests in specific browser
npx playwright test --project=chromium
```

### All Tests

```bash
# Run complete test suite
npm run test:all
```

## 📁 Test Structure

```
src/test/
├── setup.ts                 # Global test setup
├── helpers.tsx              # Test utilities and mocks
├── pages/                   # Page component tests
│   ├── Contacts.test.tsx
│   ├── Templates.test.tsx
│   ├── Campaigns.test.tsx
│   ├── Dashboard.test.tsx
│   ├── Login.test.tsx
│   ├── MessageDispatch.test.tsx
│   └── MessageLogs.test.tsx
├── integration/             # Integration tests
│   └── user-flows.test.tsx
└── e2e/                     # End-to-end tests
    ├── auth.spec.ts
    ├── campaign-workflow.spec.ts
    └── message-dispatch.spec.ts
```

## 🎯 Testing Practices

### Unit Tests

Unit tests focus on individual components and their behavior:

```typescript
import { render, screen, fireEvent, waitFor } from '../helpers';
import { mockApiService } from '../helpers';
import ComponentName from '@/pages/ComponentName';

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    render(<ComponentName />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockApiService.someMethod).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together:

```typescript
describe('User Flow Integration', () => {
  it('should complete workflow: step1 → step2 → step3', async () => {
    // Test complete user journeys
    // Verify data flow between components
    // Test error handling across the flow
  });
});
```

### E2E Tests

E2E tests simulate real user interactions:

```typescript
import { test, expect } from '@playwright/test';

test('should complete user workflow', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
});
```

## 🏗️ Test Utilities

### Mock Data

Predefined mock objects are available in `helpers.tsx`:
- `mockUser` - Sample user data
- `mockCompany` - Sample company data
- `mockContact` - Sample contact data
- `mockTemplate` - Sample template data
- `mockCampaign` - Sample campaign data
- `mockMessageLog` - Sample message log data

### Mock API Service

Complete mock API service with all endpoints:

```typescript
import { mockApiService } from '../helpers';

// Mock specific API calls
mockApiService.getContacts.mockResolvedValue({
  success: true,
  data: [mockContact],
  pagination: { page: 1, limit: 10, total: 1, pages: 1 },
});
```

### Custom Render

Enhanced render function with providers:

```typescript
import { render } from '../helpers';

// Automatically wraps components with:
// - QueryClientProvider
// - BrowserRouter
// - Toaster
render(<YourComponent />);
```

### Helper Functions

- `createMockEvent()` - Create mock events
- `createMockChangeEvent()` - Create mock change events
- `waitForLoadingToFinish()` - Wait for async operations

## 📊 Coverage

### Coverage Thresholds

Minimum coverage requirements (configured in `vitest.config.ts`):
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Reports

Generated coverage reports:
- **Text**: Console output
- **JSON**: `coverage/coverage.json`
- **HTML**: `coverage/index.html`
- **LCOV**: `coverage/lcov.info`

### Viewing Coverage

```bash
# Generate and view HTML coverage report
npm run test:coverage
open coverage/index.html
```

## 🚀 CI/CD Integration

### GitHub Actions

Automated testing runs on:
- **Push** to main/develop branches
- **Pull Requests** to main/develop branches

Workflow includes:
1. **Unit Tests** - Run on Node.js 18.x and 20.x
2. **E2E Tests** - Run on Ubuntu with Playwright
3. **Type Check** - TypeScript compilation check
4. **Build** - Production build verification

### Coverage Reporting

- Coverage reports uploaded to **Codecov**
- E2E test reports uploaded as artifacts
- Build artifacts saved for deployment

## 🐛 Debugging Tests

### Unit Tests

```bash
# Debug specific test
npm test -- --reporter=verbose ComponentName.test.tsx

# Debug with browser dev tools
npm run test:ui
```

### E2E Tests

```bash
# Debug with Playwright Inspector
npx playwright test --debug

# Run with visible browser
npm run test:e2e:headed

# Generate and view test report
npx playwright show-report
```

### Common Issues

1. **Mock not working**: Ensure mocks are cleared in `beforeEach`
2. **Async timing**: Use `waitFor` for async operations
3. **DOM queries**: Use appropriate queries (`getByRole`, `getByText`, etc.)
4. **E2E flakiness**: Add proper waits and assertions

## 📝 Writing New Tests

### Adding Unit Tests

1. Create test file: `src/test/pages/NewPage.test.tsx`
2. Import testing utilities from `../helpers`
3. Write descriptive test cases
4. Test both happy path and error scenarios
5. Ensure good coverage of component logic

### Adding E2E Tests

1. Create spec file: `src/test/e2e/new-feature.spec.ts`
2. Mock API responses with `page.route()`
3. Write user-centric test scenarios
4. Use proper selectors and assertions
5. Test across different browsers/devices

### Best Practices

- **Descriptive names**: Test names should clearly describe what they test
- **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification
- **Isolation**: Each test should be independent and not rely on others
- **Mock external dependencies**: Use mocks for API calls and external services
- **Test user behavior**: Focus on testing what users actually do
- **Edge cases**: Test error conditions and boundary cases

## 🔧 Maintenance

### Updating Mocks

When API contracts change:
1. Update mock data in `helpers.tsx`
2. Update API service mocks
3. Run tests to ensure compatibility

### Performance

- Use `vi.clearAllMocks()` in `beforeEach`
- Mock heavy operations (API calls, file operations)
- Avoid testing implementation details
- Focus on user-facing behavior

### Accessibility Testing

E2E tests include basic accessibility checks:
- Keyboard navigation
- ARIA labels and roles
- Focus management
- Screen reader compatibility

---

For questions or issues with testing, please refer to:
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)