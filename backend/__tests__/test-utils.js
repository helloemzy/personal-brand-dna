/**
 * Common test utilities for API integration tests
 */

const jwt = require('jsonwebtoken');

/**
 * Generate a test JWT token
 */
const generateTestToken = (userId = 'test-user-123', email = 'test@example.com') => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

/**
 * Mock request object
 */
const createMockRequest = (overrides = {}) => {
  return {
    method: 'GET',
    headers: {},
    body: {},
    query: {},
    params: {},
    user: null,
    ...overrides
  };
};

/**
 * Mock response object
 */
const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Wait for all promises to resolve
 */
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Mock database transaction
 */
const createMockTransaction = () => {
  return {
    commit: jest.fn(),
    rollback: jest.fn()
  };
};

/**
 * Common test data generators
 */
const testData = {
  user: (overrides = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscription_tier: 'free',
    created_at: new Date('2025-01-01'),
    ...overrides
  }),

  workshopSession: (overrides = {}) => ({
    id: 'session-123',
    userId: 'test-user-123',
    status: 'in_progress',
    currentStep: 'values_audit',
    data: {},
    createdAt: new Date(),
    ...overrides
  }),

  newsFeed: (overrides = {}) => ({
    id: 'feed-123',
    userId: 'test-user-123',
    name: 'Test Feed',
    url: 'https://example.com/feed',
    type: 'rss',
    status: 'active',
    lastFetched: null,
    createdAt: new Date(),
    ...overrides
  }),

  article: (overrides = {}) => ({
    id: 'article-123',
    feedId: 'feed-123',
    title: 'Test Article',
    description: 'Test description',
    url: 'https://example.com/article',
    publishedAt: new Date(),
    relevanceScore: 0.85,
    matchedPillars: ['Technology'],
    ...overrides
  }),

  calendarEvent: (overrides = {}) => ({
    id: 'event-123',
    userId: 'test-user-123',
    title: 'Test Event',
    content: 'Test content',
    scheduledFor: new Date('2025-02-01T10:00:00Z'),
    type: 'linkedin_post',
    status: 'scheduled',
    createdAt: new Date(),
    ...overrides
  }),

  linkedinPost: (overrides = {}) => ({
    id: 'queue-123',
    userId: 'test-user-123',
    content: 'Test LinkedIn post content',
    status: 'pending',
    createdAt: new Date(),
    ...overrides
  })
};

/**
 * Assert API error response format
 */
const expectApiError = (response, statusCode, errorMessage) => {
  expect(response.status).toBe(statusCode);
  expect(response.body).toEqual({
    success: false,
    error: errorMessage
  });
};

/**
 * Assert successful API response format
 */
const expectApiSuccess = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(true);
};

/**
 * Mock rate limiter middleware
 */
const mockRateLimiter = (limited = false) => {
  return jest.fn((req, res, next) => {
    if (limited) {
      res.status(429).json({ 
        success: false, 
        error: 'Too many requests',
        retryAfter: 60
      });
    } else {
      next();
    }
  });
};

/**
 * Mock cache
 */
const createMockCache = () => {
  const cache = new Map();
  return {
    get: jest.fn(key => cache.get(key)),
    set: jest.fn((key, value) => cache.set(key, value)),
    del: jest.fn(key => cache.delete(key)),
    clear: jest.fn(() => cache.clear()),
    has: jest.fn(key => cache.has(key))
  };
};

/**
 * Date helpers
 */
const dates = {
  today: () => new Date('2025-01-27T12:00:00Z'),
  tomorrow: () => new Date('2025-01-28T12:00:00Z'),
  yesterday: () => new Date('2025-01-26T12:00:00Z'),
  nextWeek: () => new Date('2025-02-03T12:00:00Z'),
  lastWeek: () => new Date('2025-01-20T12:00:00Z')
};

/**
 * Mock external API responses
 */
const mockExternalApis = {
  openai: {
    completion: (content = 'Generated content') => ({
      choices: [{
        message: { content },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    })
  },

  linkedin: {
    profile: (overrides = {}) => ({
      id: 'li-user-123',
      firstName: 'John',
      lastName: 'Doe',
      headline: 'Software Engineer',
      profilePicture: 'https://example.com/pic.jpg',
      ...overrides
    }),

    shareResponse: (overrides = {}) => ({
      id: 'urn:li:share:123456',
      activity: 'urn:li:activity:123456',
      ...overrides
    })
  },

  google: {
    speechResponse: (transcript = 'Test transcript') => ({
      results: [{
        alternatives: [{
          transcript,
          confidence: 0.95
        }]
      }]
    })
  }
};

module.exports = {
  generateTestToken,
  createMockRequest,
  createMockResponse,
  flushPromises,
  createMockTransaction,
  testData,
  expectApiError,
  expectApiSuccess,
  mockRateLimiter,
  createMockCache,
  dates,
  mockExternalApis
};