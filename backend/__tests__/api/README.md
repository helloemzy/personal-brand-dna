# BrandHack API Integration Tests

This directory contains comprehensive API integration tests for all BrandHack services.

## Test Files

- **`workshop.test.js`** - Tests for the Brand Workshop API endpoints
- **`news.test.js`** - Tests for the News Integration (Newshack) API endpoints
- **`calendar.test.js`** - Tests for the Content Calendar API endpoints
- **`linkedin.test.js`** - Tests for the LinkedIn Integration API endpoints

## Running Tests

### Run all API tests
```bash
npm test -- __tests__/api/
```

### Run specific service tests
```bash
# Workshop tests only
npm test -- __tests__/api/workshop.test.js

# News tests only
npm test -- __tests__/api/news.test.js

# Calendar tests only
npm test -- __tests__/api/calendar.test.js

# LinkedIn tests only
npm test -- __tests__/api/linkedin.test.js
```

### Run tests in watch mode
```bash
npm test -- --watch __tests__/api/
```

### Run tests with coverage
```bash
npm test -- --coverage __tests__/api/
```

## Test Structure

Each test file follows a consistent structure:

1. **Setup**: Mock dependencies and create Express app
2. **Authentication**: Mock auth middleware for protected routes
3. **Endpoint Tests**: Group tests by HTTP method and endpoint
4. **Validation Tests**: Test input validation and error handling
5. **Edge Cases**: Test rate limiting, timeouts, and service failures

## Common Test Patterns

### Testing Successful Responses
```javascript
test('should create a new resource', async () => {
  const mockData = { /* ... */ };
  service.createResource.mockResolvedValue(mockData);
  
  const response = await request(app)
    .post('/api/resource')
    .set('Authorization', 'Bearer test-token')
    .send(requestData);
    
  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
});
```

### Testing Error Responses
```javascript
test('should handle validation errors', async () => {
  const response = await request(app)
    .post('/api/resource')
    .set('Authorization', 'Bearer test-token')
    .send(invalidData);
    
  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    success: false,
    error: 'Validation error message'
  });
});
```

### Testing Authentication
```javascript
test('should require authentication', async () => {
  authMiddleware.verifyToken.mockImplementationOnce((req, res) => {
    res.status(401).json({ error: 'Unauthorized' });
  });
  
  const response = await request(app)
    .get('/api/protected-route');
    
  expect(response.status).toBe(401);
});
```

## Test Coverage

Each test file verifies:

- ✅ **Request Validation**: All input parameters are validated
- ✅ **Response Format**: Consistent API response structure
- ✅ **Status Codes**: Correct HTTP status codes for each scenario
- ✅ **Error Handling**: Graceful handling of all error conditions
- ✅ **Authentication**: Protected routes require valid tokens
- ✅ **Rate Limiting**: API rate limits are enforced
- ✅ **Data Persistence**: Changes are properly saved/retrieved

## Mock Data

Common test data is available in `../test-utils.js`:

```javascript
const { testData } = require('../test-utils');

const mockUser = testData.user();
const mockSession = testData.workshopSession();
const mockArticle = testData.article();
// etc...
```

## Environment Variables

Tests use the following environment variables:
- `NODE_ENV=test`
- `JWT_SECRET=test-secret`
- `DATABASE_URL=test-database-url`

## Debugging Tests

### View detailed error output
```bash
npm test -- --verbose __tests__/api/
```

### Run a single test
```bash
npm test -- -t "should create a new workshop session"
```

### Debug in VS Code
Add breakpoints and use the "Jest: Debug" launch configuration.

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (database, services)
3. **Cleanup**: Clear mocks in `beforeEach`
4. **Descriptive Names**: Use clear test descriptions
5. **Arrange-Act-Assert**: Follow AAA pattern
6. **Error Scenarios**: Test both success and failure paths

## Contributing

When adding new endpoints:
1. Create tests for all HTTP methods
2. Test validation for all parameters
3. Test authentication requirements
4. Test rate limiting if applicable
5. Test error scenarios
6. Update this README if needed