# BrandHack Integration Tests

This directory contains comprehensive integration tests that validate cross-feature integration between all BrandHack components.

## Test Files

### 1. `workshop-news.integration.test.js`
Tests the integration between Workshop and News features:
- Workshop data influences news relevance scoring
- Values and preferences affect article recommendations
- Tone preferences impact content idea generation
- Audience personas influence content targeting

### 2. `workshop-calendar.integration.test.js`
Tests the integration between Workshop and Calendar features:
- Workshop insights affect content type suggestions
- Content pillars influence calendar templates
- Tone preferences apply to event creation
- Audience data affects scheduling recommendations

### 3. `news-calendar.integration.test.js`
Tests the integration between News and Calendar features:
- News articles generate calendar content ideas
- Relevance scoring affects scheduling priority
- Content series creation from news topics
- Batch operations from news to calendar

### 4. `calendar-linkedin.integration.test.js`
Tests the integration between Calendar and LinkedIn features:
- Scheduled events flow to LinkedIn queue
- Platform settings control publishing
- Approval workflow for content
- Analytics tracking back to calendar

### 5. `complete-flow.integration.test.js`
Tests the complete data flow across all features:
- End-to-end journey from Workshop → News → Calendar → LinkedIn
- Data consistency across all features
- Update propagation through the system
- Performance of integrated operations

## Running Integration Tests

### Prerequisites
1. PostgreSQL running locally
2. Redis running locally
3. Test database created: `pbdna_test`

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test File
```bash
npm test -- workshop-news.integration.test.js
```

### Run with Coverage
```bash
npm run test:integration:coverage
```

## Test Environment

Integration tests use:
- Separate test database (`pbdna_test`)
- Separate Redis database (DB 2)
- Mock external services (OpenAI, Google, Stripe, etc.)
- Sequential execution to avoid conflicts

## Key Testing Patterns

### 1. Data Flow Validation
Each test verifies that data flows correctly between features:
```javascript
// Workshop → News
workshop.values → news.relevanceScoring
workshop.tonePreferences → contentIdeas.style

// News → Calendar
news.articles → contentIdeas → calendar.events
news.relevance → calendar.schedulingPriority

// Calendar → LinkedIn
calendar.scheduledEvents → linkedin.publishingQueue
calendar.status → linkedin.publishStatus
```

### 2. Consistency Checks
Tests ensure data remains consistent across features:
- Workshop profile persists through all operations
- Content maintains appropriate tone and style
- Scheduling respects user preferences
- Analytics data flows back correctly

### 3. Error Handling
Each integration test includes:
- Partial failure scenarios
- Missing data handling
- Concurrent operation safety
- Recovery mechanisms

### 4. Performance Testing
Integration tests measure:
- Bulk operation performance
- Cross-feature query efficiency
- Concurrent request handling
- End-to-end flow timing

## Test Data Management

### Setup
- Fresh database for each test run
- Isolated user accounts per test
- Realistic data volumes
- Proper cleanup after tests

### Fixtures
Tests create their own data to ensure:
- Predictable test conditions
- No dependencies between tests
- Clear data relationships
- Reproducible results

## Debugging Integration Tests

### Verbose Logging
Enable detailed logging:
```bash
DEBUG=* npm run test:integration
```

### Database Inspection
Connect to test database during tests:
```bash
psql -d pbdna_test -U postgres
```

### Slow Test Investigation
Tests have a 30-second timeout. If tests are slow:
1. Check database query performance
2. Verify external service mocks
3. Look for unnecessary waits
4. Profile async operations

## Common Issues

### Database Connection
- Ensure PostgreSQL is running
- Check DATABASE_URL in test environment
- Verify test database exists

### Redis Connection
- Ensure Redis is running
- Check REDIS_URL in test environment
- Verify Redis DB 2 is available

### Test Timeouts
- Increase timeout in jest.integration.config.js
- Check for hanging async operations
- Verify proper cleanup in afterAll hooks

### Data Conflicts
- Ensure unique test data per test
- Check for proper transaction handling
- Verify cleanup between tests

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Assertions**: Test both success and failure cases
4. **Performance**: Monitor test execution time
5. **Documentation**: Comment complex test scenarios