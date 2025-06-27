// Test setup file
require('dotenv').config({ path: '../.env.test' });

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/pbdna_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Global test utilities
global.testUtils = {
  generateTestUser: () => ({
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  }),
  
  generateAuthToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
  }
};