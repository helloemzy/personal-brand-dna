# Testing Setup Documentation
**Date**: January 12, 2025
**Status**: INITIAL SETUP COMPLETE

## Overview

Added initial test setup for the React application. Previously, the main web app had no tests while the AI agents had comprehensive test coverage. This document outlines the testing infrastructure now in place.

## Test Files Created

### 1. **src/setupTests.ts**
Global test configuration including:
- Jest DOM matchers setup
- Browser API mocks (matchMedia, IntersectionObserver, ResizeObserver)
- localStorage and sessionStorage mocks
- Console error suppression for known warnings

### 2. **src/App.test.tsx**
Basic smoke tests for the main App component:
- Renders without crashing
- Shows loading spinner initially
- Properly wraps with required providers

### 3. **src/components/workshop/WorkshopContainer.test.tsx**
Tests for the critical workshop flow:
- Component rendering
- Step navigation
- Validation logic
- Progress indicators

### 4. **src/services/archetypeService.test.ts**
Unit tests for the archetype determination logic:
- Archetype calculation for different value sets
- Hybrid archetype detection
- Confidence scoring
- Mission statement generation

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test App.test.tsx
```

## Test Coverage Areas

### ✅ Currently Covered:
- App initialization
- Workshop container basics
- Archetype service logic

### ❌ Still Need Tests:
- **Components**:
  - All workshop steps (ValuesAudit, TonePreferences, etc.)
  - Authentication components
  - Dashboard components
  - Content generation components
  - News monitoring components

- **Services**:
  - API services (authAPI, contentAPI, etc.)
  - LinkedIn integration
  - PDF generation
  - Workshop persistence
  - Analytics tracking

- **Redux Store**:
  - All slice reducers
  - Selectors
  - Middleware

- **Utilities**:
  - Workshop state helpers
  - Performance monitoring
  - Accessibility utilities

## Testing Strategy

### Unit Tests
Test individual functions and components in isolation:
- Services (business logic)
- Redux reducers
- Utility functions
- Individual components

### Integration Tests
Test how components work together:
- Workshop flow
- Authentication flow
- Content generation flow
- API integrations

### E2E Tests
Test complete user journeys (not yet implemented):
- Complete workshop from start to results
- Login and dashboard access
- Content creation and publishing

## Mock Strategies

### API Mocking
Currently mocking:
- Sentry initialization
- Tracking services
- Web Vitals

Need to add mocks for:
- Supabase client
- OpenAI API calls
- LinkedIn API

### Component Mocking
Using Testing Library's approach of testing components as users would use them, minimizing mocks.

## CI/CD Integration

The tests are configured to run with:
```json
{
  "scripts": {
    "test": "craco test",
    "test:ci": "CI=true npm test -- --coverage"
  }
}
```

For GitHub Actions integration, add to workflow:
```yaml
- name: Run tests
  run: npm test:ci
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and do
   - Avoid testing internal state

2. **Use Testing Library Queries Properly**
   - Prefer getByRole, getByLabelText
   - Avoid getByTestId unless necessary

3. **Keep Tests Maintainable**
   - Use descriptive test names
   - Group related tests with describe blocks
   - Extract common setup into helper functions

4. **Mock External Dependencies**
   - API calls
   - Browser APIs
   - Third-party services

## Next Steps

1. **High Priority**:
   - Add tests for authentication flow
   - Test workshop data persistence
   - Test error boundaries

2. **Medium Priority**:
   - Test all workshop step components
   - Test Redux slices
   - Add API service tests

3. **Low Priority**:
   - Add E2E tests with Cypress or Playwright
   - Increase coverage to 80%+
   - Add visual regression tests

## Coverage Goals

Current: ~5% (initial setup)
Target: 80% for critical paths
- Workshop flow: 90%
- Authentication: 90%
- Core services: 85%
- UI components: 70%

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)