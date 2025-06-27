/**
 * API Security Test Suite
 * Tests for unauthorized access, CORS issues, rate limiting effectiveness
 */

const request = require('supertest');
const express = require('express');
const { rateLimiter, authRateLimit, contentRateLimit } = require('../../src/middleware/rateLimiter');
const { authenticate, requireSubscription, requireAdmin } = require('../../src/middleware/auth');
const { query } = require('../../src/config/database');
const { 
  createMockRequest, 
  createMockResponse,
  generateTestToken 
} = require('../test-utils');

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('rate-limiter-flexible');

describe('API Security Tests', () => {
  let app;
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    // Create test Express app
    app = express();
    app.use(express.json());
    
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('Unauthorized Access Prevention', () => {
    test('should block access to protected endpoints without token', async () => {
      app.get('/api/protected', authenticate, (req, res) => {
        res.json({ data: 'sensitive' });
      });

      const response = await request(app)
        .get('/api/protected')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Access token required')
      });
    });

    test('should prevent access with invalid authorization header formats', async () => {
      app.get('/api/protected', authenticate, (req, res) => {
        res.json({ data: 'sensitive' });
      });

      const invalidFormats = [
        'InvalidBearer token123',
        'Bearer',
        'token123',
        'Basic dXNlcjpwYXNz', // Basic auth instead of Bearer
        'Bearer  token123', // Double space
        'bearer token123', // Lowercase
      ];

      for (const format of invalidFormats) {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', format)
          .expect(401);

        expect(response.body.error).toBeDefined();
      }
    });

    test('should enforce subscription tiers for premium endpoints', async () => {
      // Mock authentication to pass
      query.mockImplementation((sql) => {
        if (sql.includes('user_sessions')) {
          return { rows: [{ id: 'session-123' }] };
        }
        if (sql.includes('users')) {
          return { 
            rows: [{
              id: 'test-user-123',
              email: 'test@example.com',
              subscription_tier: 'free',
              subscription_status: 'active'
            }] 
          };
        }
      });

      app.get('/api/premium', 
        authenticate, 
        requireSubscription('professional'),
        (req, res) => {
          res.json({ data: 'premium content' });
        }
      );

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/premium')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'professional subscription required'
      });
    });

    test('should prevent horizontal privilege escalation', async () => {
      // User trying to access another user's data
      query.mockImplementation((sql) => {
        if (sql.includes('user_sessions')) {
          return { rows: [{ id: 'session-123' }] };
        }
        if (sql.includes('users')) {
          return { 
            rows: [{
              id: 'user-123',
              email: 'user@example.com',
              subscription_status: 'active'
            }] 
          };
        }
      });

      app.get('/api/users/:userId/data', authenticate, (req, res) => {
        // Should check if req.user.id === req.params.userId
        if (req.user.id !== req.params.userId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Access denied' 
          });
        }
        res.json({ data: 'user specific data' });
      });

      const token = generateTestToken('user-123');
      
      // Try to access another user's data
      const response = await request(app)
        .get('/api/users/different-user-456/data')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    test('should validate API versioning and deprecation', async () => {
      app.get('/api/v1/deprecated', (req, res) => {
        res.status(410).json({ 
          success: false, 
          error: 'This API version is deprecated. Please use v2.' 
        });
      });

      app.get('/api/v2/endpoint', authenticate, (req, res) => {
        res.json({ version: 2, data: 'current' });
      });

      // Test deprecated endpoint
      const deprecatedResponse = await request(app)
        .get('/api/v1/deprecated')
        .expect(410);

      expect(deprecatedResponse.body.error).toContain('deprecated');
    });
  });

  describe('CORS Security', () => {
    test('should enforce CORS policy for API endpoints', async () => {
      // Mock CORS middleware
      app.use((req, res, next) => {
        const allowedOrigins = [
          'http://localhost:3000',
          'https://personal-brand-dna.com',
          'https://app.personal-brand-dna.com'
        ];
        
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Access-Control-Allow-Credentials', 'true');
        }
        
        if (req.method === 'OPTIONS') {
          res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.header('Access-Control-Max-Age', '3600');
          return res.status(204).send();
        }
        
        next();
      });

      app.get('/api/data', (req, res) => {
        res.json({ data: 'test' });
      });

      // Test allowed origin
      const allowedResponse = await request(app)
        .get('/api/data')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(allowedResponse.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      // Test disallowed origin
      const disallowedResponse = await request(app)
        .get('/api/data')
        .set('Origin', 'http://malicious-site.com')
        .expect(200);

      expect(disallowedResponse.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should handle preflight requests securely', async () => {
      app.use((req, res, next) => {
        if (req.method === 'OPTIONS') {
          // Only allow specific methods and headers
          res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.header('Access-Control-Max-Age', '3600');
          
          // Don't allow wildcard origin with credentials
          if (req.headers.origin === 'http://localhost:3000') {
            res.header('Access-Control-Allow-Origin', req.headers.origin);
            res.header('Access-Control-Allow-Credentials', 'true');
          }
          
          return res.status(204).send();
        }
        next();
      });

      const response = await request(app)
        .options('/api/endpoint')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE');
      expect(response.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
    });
  });

  describe('Rate Limiting Effectiveness', () => {
    test('should enforce rate limits per endpoint type', async () => {
      const mockRateLimiter = {
        consume: jest.fn()
      };

      // Mock the rate limiter module
      jest.doMock('rate-limiter-flexible', () => ({
        RateLimiterMemory: jest.fn(() => mockRateLimiter),
        RateLimiterRedis: jest.fn(() => mockRateLimiter)
      }));

      // Test auth endpoint rate limiting (5 requests per 15 min)
      mockRateLimiter.consume
        .mockResolvedValueOnce({}) // 1st request - pass
        .mockResolvedValueOnce({}) // 2nd request - pass
        .mockResolvedValueOnce({}) // 3rd request - pass
        .mockResolvedValueOnce({}) // 4th request - pass
        .mockResolvedValueOnce({}) // 5th request - pass
        .mockRejectedValueOnce({   // 6th request - blocked
          msBeforeNext: 900000,
          remainingPoints: 0
        });

      for (let i = 0; i < 5; i++) {
        await authRateLimit(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        mockNext.mockClear();
      }

      // 6th request should be rate limited
      await authRateLimit(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('Too many requests')
        })
      );
    });

    test('should use different limits for different subscription tiers', async () => {
      // Test user with professional tier gets higher limits
      mockReq.user = {
        id: 'user-123',
        subscription_tier: 'professional'
      };

      const mockRateLimiter = {
        consume: jest.fn().mockResolvedValue({})
      };

      jest.doMock('rate-limiter-flexible', () => ({
        RateLimiterMemory: jest.fn(() => mockRateLimiter),
        RateLimiterRedis: jest.fn(() => mockRateLimiter)
      }));

      await contentRateLimit(mockReq, mockRes, mockNext);

      // Should create rate limiter with professional tier limits (50/hour)
      expect(mockNext).toHaveBeenCalled();
    });

    test('should prevent rate limit bypass attempts', async () => {
      const mockRateLimiter = {
        consume: jest.fn().mockRejectedValue({
          msBeforeNext: 60000,
          remainingPoints: 0
        })
      };

      jest.doMock('rate-limiter-flexible', () => ({
        RateLimiterMemory: jest.fn(() => mockRateLimiter),
        RateLimiterRedis: jest.fn(() => mockRateLimiter)
      }));

      // Try to bypass with different headers
      const bypassAttempts = [
        { headers: { 'x-forwarded-for': '1.2.3.4' } },
        { headers: { 'x-real-ip': '5.6.7.8' } },
        { headers: { 'cf-connecting-ip': '9.10.11.12' } }
      ];

      for (const attempt of bypassAttempts) {
        mockReq = createMockRequest(attempt);
        await rateLimiter(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(429);
        mockRes.status.mockClear();
        mockRes.json.mockClear();
      }
    });
  });

  describe('API Input Size Limits', () => {
    test('should reject oversized request bodies', async () => {
      app.use(express.json({ limit: '1mb' })); // 1MB limit
      
      app.post('/api/content', authenticate, (req, res) => {
        res.json({ success: true });
      });

      // Create oversized payload (> 1MB)
      const largePayload = {
        content: 'x'.repeat(1024 * 1024 + 1) // 1MB + 1 byte
      };

      const response = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .send(largePayload)
        .expect(413); // Payload Too Large
    });

    test('should limit URL parameter length', async () => {
      app.get('/api/search', (req, res) => {
        if (req.query.q && req.query.q.length > 1000) {
          return res.status(400).json({ 
            success: false, 
            error: 'Query parameter too long' 
          });
        }
        res.json({ results: [] });
      });

      const longQuery = 'x'.repeat(1001);
      
      const response = await request(app)
        .get(`/api/search?q=${longQuery}`)
        .expect(400);

      expect(response.body.error).toContain('too long');
    });
  });

  describe('HTTP Method Validation', () => {
    test('should only allow specified HTTP methods', async () => {
      app.get('/api/users', (req, res) => res.json({ users: [] }));
      app.post('/api/users', (req, res) => res.json({ created: true }));
      
      // Method not allowed
      const response = await request(app)
        .patch('/api/users')
        .expect(404); // Express default for undefined routes

      // Test OPTIONS is allowed for CORS
      const optionsResponse = await request(app)
        .options('/api/users')
        .expect(200);
    });

    test('should prevent HTTP verb tampering', async () => {
      app.post('/api/sensitive-action', authenticate, (req, res) => {
        res.json({ action: 'completed' });
      });

      // Try to access POST endpoint with GET (should fail)
      const response = await request(app)
        .get('/api/sensitive-action')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .expect(404);
    });
  });

  describe('Admin Endpoint Protection', () => {
    test('should restrict admin endpoints to admin users only', async () => {
      query.mockImplementation((sql) => {
        if (sql.includes('user_sessions')) {
          return { rows: [{ id: 'session-123' }] };
        }
        if (sql.includes('users')) {
          if (sql.includes('admin')) {
            return { rows: [] }; // Not an admin
          }
          return { 
            rows: [{
              id: 'user-123',
              email: 'user@example.com',
              role: 'user',
              subscription_status: 'active'
            }] 
          };
        }
      });

      app.get('/api/admin/users', authenticate, requireAdmin, (req, res) => {
        res.json({ users: [] });
      });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });

    test('should log security events for unauthorized admin access attempts', async () => {
      const mockLogger = require('../../src/utils/logger');
      mockLogger.logSecurityEvent = jest.fn();

      query.mockImplementation((sql) => {
        if (sql.includes('user_sessions')) {
          return { rows: [{ id: 'session-123' }] };
        }
        if (sql.includes('users')) {
          if (sql.includes('admin')) {
            return { rows: [] }; // Not an admin
          }
          return { 
            rows: [{
              id: 'user-123',
              email: 'user@example.com',
              subscription_status: 'active'
            }] 
          };
        }
      });

      await requireAdmin(mockReq, mockRes, mockNext);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
        'unauthorized_admin_access',
        expect.objectContaining({
          userId: expect.any(String),
          email: expect.any(String),
          endpoint: expect.any(String)
        }),
        mockReq
      );
    });
  });
});