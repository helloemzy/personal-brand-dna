# End-to-End Tests

This directory contains comprehensive end-to-end tests for the Personal Brand DNA System, covering complete user journeys and integration scenarios.

## Test Coverage

### 1. User Journey Tests (`user-journey.test.js`)
- **User Registration and Authentication**: Complete signup, login, and token management flow
- **Voice Discovery and Analysis**: Voice profile creation and analysis
- **Content Generation**: AI-powered content creation with voice matching
- **Subscription and Payments**: Plan selection and payment processing
- **Analytics and Performance**: Content performance tracking
- **Profile Management**: User settings and preference updates
- **Error Handling**: Rate limiting, invalid requests, expired tokens

### 2. Demo Flow Tests (`demo-flow.test.js`)
- **Instant Demo Access**: Zero-friction demo login
- **Demo Feature Access**: Professional tier features for demo users
- **Demo Restrictions**: Limitations on account modifications
- **Demo Data Isolation**: Session-specific data handling
- **Conversion Tracking**: Demo to paid user conversion flow

### 3. Workshop Flow Tests (`workshop-flow.test.js`)
- **5-Step Brand Workshop**: Complete workshop journey
  - Values Audit
  - Tone Preferences
  - Audience Builder
  - Writing Sample Analysis
  - Personality Quiz
- **Workshop Progress**: Save and resume functionality
- **Brand Report Generation**: Comprehensive brand DNA report
- **Workshop Integration**: Voice profile enhancement

### 4. News Integration Tests (`news-integration.test.js`)
- **Feed Configuration**: RSS and JSON feed setup
- **Content Pillars**: Relevance scoring configuration
- **Article Discovery**: AI-powered article analysis
- **Content Idea Generation**: News-inspired content creation
- **Weekly Digests**: Automated news summaries
- **Performance Analytics**: News content performance tracking

### 5. Calendar & LinkedIn Tests (`calendar-linkedin.test.js`)
- **Content Scheduling**: Calendar management and bulk scheduling
- **Content Series**: Campaign creation and management
- **LinkedIn OAuth**: Account connection and authentication
- **Publishing Workflow**: Approval and publishing process
- **Analytics Sync**: LinkedIn performance data integration
- **Calendar Export**: iCal and Google Calendar integration

## Running the Tests

### Prerequisites
1. Node.js 18+ installed
2. PostgreSQL and Redis running (or Docker installed)
3. Test environment variables configured

### Setup Test Environment
```bash
# Copy test environment template
cp .env.test.example .env.test

# Install dependencies
npm install

# Run database migrations for test database
NODE_ENV=test npm run migrate
```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
# Run only user journey tests
npm run test:e2e user-journey

# Run only demo flow tests
npm run test:e2e demo-flow

# Run with watch mode
npm run test:e2e:watch
```

### Run with Coverage
```bash
npm run test:e2e -- --coverage
```

### Environment Variables
The following environment variables should be set in `.env.test`:

```env
# Database
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/pbdna_test
TEST_REDIS_URL=redis://localhost:6379/1

# Authentication
JWT_SECRET=test-jwt-secret-e2e

# External Services (can be mocked)
OPENAI_API_KEY=sk-test-mock
STRIPE_SECRET_KEY=sk_test_mock
GOOGLE_APPLICATION_CREDENTIALS=/tmp/mock-google-creds.json

# Test Configuration
USE_DOCKER_DB=false
CLEANUP_TEST_FILES=true
```

### Using Docker for Tests
If you prefer to use Docker for test databases:

1. Create `docker-compose.test.yml`:
```yaml
version: '3.8'
services:
  postgres-test:
    image: postgres:14
    environment:
      POSTGRES_DB: pbdna_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
  
  redis-test:
    image: redis:7
    ports:
      - "6380:6379"
```

2. Set `USE_DOCKER_DB=true` in `.env.test`

3. Run tests:
```bash
npm run test:e2e
```

## Test Structure

Each test suite follows this pattern:

1. **Setup**: Create test user and authenticate
2. **Test Scenarios**: Execute user flows
3. **Assertions**: Verify expected behavior
4. **Cleanup**: Remove test data

## Writing New E2E Tests

When adding new e2e tests:

1. Create a new file in `__tests__/e2e/`
2. Import required modules:
```javascript
const request = require('supertest');
const app = require('../../src/server');
```

3. Structure your tests:
```javascript
describe('Feature End-to-End Tests', () => {
  let authToken;
  
  beforeAll(async () => {
    // Setup
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  describe('User Flow', () => {
    test('should complete action', async () => {
      const response = await request(app)
        .post('/api/endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: 'value' })
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true
      });
    });
  });
});
```

## Debugging Tests

### View Test Logs
```bash
# Run with verbose output
npm run test:e2e -- --verbose

# Run single test with debugging
node --inspect-brk ./node_modules/.bin/jest --config jest.e2e.config.js --runInBand user-journey
```

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL and Redis are running
   - Check DATABASE_URL in .env.test

2. **Port Conflicts**
   - Check if ports 3001, 5432, 6379 are available
   - Modify ports in docker-compose.test.yml if needed

3. **Timeout Errors**
   - E2E tests have 30-second timeout
   - Increase in jest.e2e.config.js if needed

4. **Authentication Failures**
   - Ensure JWT_SECRET is set in test environment
   - Check token generation in test setup

## Best Practices

1. **Data Isolation**: Use unique identifiers for test data
2. **Cleanup**: Always clean up test data in afterAll hooks
3. **Realistic Flows**: Test complete user journeys, not isolated endpoints
4. **Error Cases**: Include negative test cases and error handling
5. **Performance**: Monitor test execution time and optimize slow tests

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: |
    npm run test:e2e
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

## Maintenance

- Review and update tests when adding new features
- Run full test suite before major releases
- Monitor test flakiness and fix unstable tests
- Keep test data realistic and up-to-date