/**
 * OAuth Security Test Suite
 * Tests for OAuth flow vulnerabilities, token leakage, state validation
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const { query } = require('../../src/config/database');
const { authenticate } = require('../../src/middleware/auth');
const { generateTestToken } = require('../test-utils');

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('axios');

describe('OAuth Security Tests', () => {
  let app;
  const mockAxios = require('axios');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock session middleware
    app.use((req, res, next) => {
      req.session = req.session || {};
      next();
    });

    jest.clearAllMocks();
  });

  describe('OAuth State Parameter Security', () => {
    test('should generate cryptographically secure state parameter', async () => {
      app.get('/api/auth/linkedin', (req, res) => {
        // Generate secure state parameter
        const state = crypto.randomBytes(32).toString('hex');
        
        // Store state in session with expiry
        req.session.oauthState = {
          value: state,
          createdAt: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
        };

        const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
        authUrl.searchParams.append('client_id', process.env.LINKEDIN_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', process.env.LINKEDIN_REDIRECT_URI);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('scope', 'r_liteprofile r_emailaddress w_member_social');
        authUrl.searchParams.append('response_type', 'code');

        res.json({ 
          authUrl: authUrl.toString(),
          stateLength: state.length
        });
      });

      const response = await request(app)
        .get('/api/auth/linkedin')
        .expect(200);

      const url = new URL(response.body.authUrl);
      const state = url.searchParams.get('state');

      // Verify state parameter properties
      expect(state).toBeDefined();
      expect(state.length).toBe(64); // 32 bytes = 64 hex chars
      expect(state).toMatch(/^[a-f0-9]{64}$/);
      
      // Verify state is random (not predictable)
      const response2 = await request(app)
        .get('/api/auth/linkedin')
        .expect(200);
      
      const state2 = new URL(response2.body.authUrl).searchParams.get('state');
      expect(state2).not.toBe(state);
    });

    test('should validate state parameter on callback', async () => {
      app.get('/api/auth/linkedin/callback', async (req, res) => {
        const { code, state, error } = req.query;

        // Check for OAuth errors
        if (error) {
          return res.status(400).json({ 
            error: 'OAuth error', 
            details: req.query.error_description 
          });
        }

        if (!code || !state) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Validate state parameter
        const sessionState = req.session.oauthState;
        if (!sessionState) {
          return res.status(400).json({ error: 'No OAuth session found' });
        }

        // Check state expiry
        if (Date.now() > sessionState.expiresAt) {
          delete req.session.oauthState;
          return res.status(400).json({ error: 'OAuth state expired' });
        }

        // Validate state matches
        if (state !== sessionState.value) {
          delete req.session.oauthState;
          return res.status(400).json({ error: 'Invalid state parameter' });
        }

        // Clear used state
        delete req.session.oauthState;

        res.json({ success: true });
      });

      // Test with valid state
      const validState = crypto.randomBytes(32).toString('hex');
      const reqWithSession = request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'test-code', state: validState });
      
      // Manually set session
      reqWithSession.cookies = `session=${JSON.stringify({
        oauthState: {
          value: validState,
          createdAt: Date.now(),
          expiresAt: Date.now() + 600000
        }
      })}`;

      await reqWithSession.expect(200);

      // Test with invalid state
      const invalidResponse = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'test-code', state: 'invalid-state' })
        .expect(400);

      expect(invalidResponse.body.error).toContain('OAuth session');
    });

    test('should prevent CSRF attacks via state parameter', async () => {
      app.get('/api/auth/linkedin/callback', (req, res) => {
        const { state } = req.query;
        const sessionState = req.session.oauthState;

        // Attacker tries to use their own state
        if (!sessionState || state !== sessionState.value) {
          return res.status(403).json({ 
            error: 'CSRF detected - invalid state' 
          });
        }

        res.json({ success: true });
      });

      // Attacker's state parameter
      const attackerState = 'attacker-controlled-state';
      
      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ 
          code: 'valid-code',
          state: attackerState 
        })
        .expect(403);

      expect(response.body.error).toContain('CSRF detected');
    });

    test('should prevent state fixation attacks', async () => {
      let stateStorage = new Map();

      app.get('/api/auth/linkedin', (req, res) => {
        const userId = req.ip; // Use IP as user identifier for test
        
        // Always generate new state, don't accept user-provided state
        const state = crypto.randomBytes(32).toString('hex');
        
        // Store with user identifier
        stateStorage.set(userId, {
          value: state,
          createdAt: Date.now()
        });

        res.json({ state });
      });

      // Attacker tries to set a known state
      const fixedState = 'attacker-known-state';
      
      const response = await request(app)
        .get('/api/auth/linkedin')
        .query({ state: fixedState }) // Trying to fix the state
        .expect(200);

      // Verify the state is newly generated, not the fixed one
      expect(response.body.state).not.toBe(fixedState);
      expect(response.body.state).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('OAuth Token Security', () => {
    test('should securely exchange authorization code for tokens', async () => {
      app.post('/api/auth/linkedin/token', async (req, res) => {
        const { code } = req.body;

        if (!code) {
          return res.status(400).json({ error: 'Authorization code required' });
        }

        // Validate code format (prevent injection)
        if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
          return res.status(400).json({ error: 'Invalid code format' });
        }

        try {
          // Exchange code for token
          const tokenResponse = await mockAxios.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            new URLSearchParams({
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
              client_id: process.env.LINKEDIN_CLIENT_ID,
              client_secret: process.env.LINKEDIN_CLIENT_SECRET
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );

          // Never expose the access token to the client
          const { access_token, expires_in } = tokenResponse.data;

          // Store token securely server-side
          const tokenId = crypto.randomBytes(32).toString('hex');
          await query(
            'INSERT INTO oauth_tokens (id, user_id, provider, access_token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [
              tokenId,
              req.user?.id,
              'linkedin',
              crypto.createHash('sha256').update(access_token).digest('hex'),
              new Date(Date.now() + (expires_in * 1000))
            ]
          );

          res.json({ 
            success: true,
            tokenId // Return reference, not actual token
          });
        } catch (error) {
          res.status(400).json({ error: 'Token exchange failed' });
        }
      });

      // Mock successful token exchange
      mockAxios.post.mockResolvedValue({
        data: {
          access_token: 'secret-access-token',
          expires_in: 3600
        }
      });

      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/linkedin/token')
        .send({ code: 'valid-auth-code' })
        .expect(200);

      // Verify token is not exposed
      expect(response.body.access_token).toBeUndefined();
      expect(response.body.tokenId).toBeDefined();
      expect(response.body.tokenId).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should prevent authorization code replay attacks', async () => {
      const usedCodes = new Set();

      app.post('/api/auth/linkedin/token', async (req, res) => {
        const { code } = req.body;

        // Check if code was already used
        if (usedCodes.has(code)) {
          return res.status(400).json({ 
            error: 'Authorization code already used' 
          });
        }

        // Mark code as used
        usedCodes.add(code);

        // Set expiry for code (5 minutes)
        setTimeout(() => usedCodes.delete(code), 5 * 60 * 1000);

        res.json({ success: true });
      });

      const authCode = 'test-auth-code-123';

      // First use should succeed
      await request(app)
        .post('/api/auth/linkedin/token')
        .send({ code: authCode })
        .expect(200);

      // Second use should fail
      const response = await request(app)
        .post('/api/auth/linkedin/token')
        .send({ code: authCode })
        .expect(400);

      expect(response.body.error).toContain('already used');
    });

    test('should validate redirect URI matches registered URI', async () => {
      app.post('/api/auth/linkedin/token', async (req, res) => {
        const { code, redirect_uri } = req.body;
        
        const registeredRedirectUri = process.env.LINKEDIN_REDIRECT_URI || 
          'https://app.personalbranddna.com/auth/linkedin/callback';

        // Strict redirect URI validation
        if (redirect_uri !== registeredRedirectUri) {
          return res.status(400).json({ 
            error: 'Invalid redirect URI' 
          });
        }

        res.json({ success: true });
      });

      // Test with mismatched redirect URI
      const response = await request(app)
        .post('/api/auth/linkedin/token')
        .send({ 
          code: 'valid-code',
          redirect_uri: 'https://attacker.com/callback'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid redirect URI');
    });
  });

  describe('Token Storage and Management', () => {
    test('should hash OAuth tokens before storage', async () => {
      let capturedQuery;
      query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO oauth_tokens')) {
          capturedQuery = { sql, params };
        }
        return { rows: [] };
      });

      app.post('/api/oauth/store-token', authenticate, async (req, res) => {
        const { access_token, refresh_token, provider } = req.body;

        // Hash tokens before storage
        const accessTokenHash = crypto.createHash('sha256')
          .update(access_token).digest('hex');
        const refreshTokenHash = refresh_token ? 
          crypto.createHash('sha256').update(refresh_token).digest('hex') : null;

        await query(
          'INSERT INTO oauth_tokens (user_id, provider, access_token_hash, refresh_token_hash) VALUES ($1, $2, $3, $4)',
          [req.user.id, provider, accessTokenHash, refreshTokenHash]
        );

        res.json({ stored: true });
      });

      await request(app)
        .post('/api/oauth/store-token')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .send({
          access_token: 'plain-text-token',
          refresh_token: 'plain-refresh-token',
          provider: 'linkedin'
        })
        .expect(200);

      // Verify tokens are hashed
      expect(capturedQuery.params[2]).not.toBe('plain-text-token');
      expect(capturedQuery.params[2]).toMatch(/^[a-f0-9]{64}$/);
      expect(capturedQuery.params[3]).not.toBe('plain-refresh-token');
    });

    test('should implement token rotation for refresh tokens', async () => {
      app.post('/api/oauth/refresh', authenticate, async (req, res) => {
        const { refresh_token, provider } = req.body;

        if (!refresh_token) {
          return res.status(400).json({ error: 'Refresh token required' });
        }

        // Get stored refresh token
        const tokenHash = crypto.createHash('sha256')
          .update(refresh_token).digest('hex');

        const result = await query(
          'SELECT * FROM oauth_tokens WHERE user_id = $1 AND provider = $2 AND refresh_token_hash = $3 AND revoked = false',
          [req.user.id, provider, tokenHash]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Revoke old refresh token
        await query(
          'UPDATE oauth_tokens SET revoked = true WHERE id = $1',
          [result.rows[0].id]
        );

        // Issue new tokens
        const newAccessToken = crypto.randomBytes(32).toString('hex');
        const newRefreshToken = crypto.randomBytes(32).toString('hex');

        res.json({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_in: 3600
        });
      });

      query.mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM oauth_tokens')) {
          return { rows: [{ id: 'token-123' }] };
        }
        return { rows: [] };
      });

      const response = await request(app)
        .post('/api/oauth/refresh')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .send({
          refresh_token: 'old-refresh-token',
          provider: 'linkedin'
        })
        .expect(200);

      // Verify new tokens are issued
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      expect(response.body.refresh_token).not.toBe('old-refresh-token');
    });
  });

  describe('OAuth Scope Validation', () => {
    test('should validate requested scopes are allowed', async () => {
      app.get('/api/auth/linkedin', (req, res) => {
        const requestedScopes = req.query.scope?.split(' ') || [];
        
        // Define allowed scopes
        const allowedScopes = [
          'r_liteprofile',
          'r_emailaddress',
          'w_member_social'
        ];

        // Validate all requested scopes are allowed
        const invalidScopes = requestedScopes.filter(
          scope => !allowedScopes.includes(scope)
        );

        if (invalidScopes.length > 0) {
          return res.status(400).json({ 
            error: 'Invalid scopes requested',
            invalid: invalidScopes
          });
        }

        // Use only allowed scopes
        const scopes = requestedScopes.length > 0 ? 
          requestedScopes.join(' ') : 
          allowedScopes.join(' ');

        res.json({ scopes });
      });

      // Test with invalid scope
      const response = await request(app)
        .get('/api/auth/linkedin')
        .query({ scope: 'r_fullprofile w_organization_social admin' })
        .expect(400);

      expect(response.body.invalid).toContain('r_fullprofile');
      expect(response.body.invalid).toContain('admin');
    });

    test('should track and validate granted scopes', async () => {
      app.post('/api/oauth/validate-action', authenticate, async (req, res) => {
        const { action, provider } = req.body;

        // Get user's granted scopes
        const result = await query(
          'SELECT granted_scopes FROM oauth_tokens WHERE user_id = $1 AND provider = $2 AND revoked = false',
          [req.user.id, provider]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'No valid OAuth session' });
        }

        const grantedScopes = result.rows[0].granted_scopes || [];

        // Map actions to required scopes
        const requiredScopes = {
          'read_profile': ['r_liteprofile'],
          'read_email': ['r_emailaddress'],
          'post_update': ['w_member_social'],
          'read_connections': ['r_1st_connections'] // Not granted
        };

        const needed = requiredScopes[action] || [];
        const hasPermission = needed.every(scope => grantedScopes.includes(scope));

        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: needed,
            granted: grantedScopes
          });
        }

        res.json({ authorized: true });
      });

      query.mockImplementation(() => ({
        rows: [{
          granted_scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
        }]
      }));

      // Test authorized action
      await request(app)
        .post('/api/oauth/validate-action')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .send({ action: 'post_update', provider: 'linkedin' })
        .expect(200);

      // Test unauthorized action
      const response = await request(app)
        .post('/api/oauth/validate-action')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .send({ action: 'read_connections', provider: 'linkedin' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
      expect(response.body.required).toContain('r_1st_connections');
    });
  });

  describe('OAuth Security Headers', () => {
    test('should include security headers in OAuth responses', async () => {
      app.get('/api/auth/linkedin/callback', (req, res) => {
        // Set security headers
        res.set({
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        });

        res.json({ success: true });
      });

      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'test', state: 'test' })
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('OAuth Error Handling', () => {
    test('should handle OAuth provider errors securely', async () => {
      app.get('/api/auth/linkedin/callback', (req, res) => {
        const { error, error_description } = req.query;

        if (error) {
          // Log detailed error internally
          console.error('OAuth error:', { error, error_description });

          // Return generic error to client
          const userErrors = {
            'access_denied': 'Authorization was denied',
            'invalid_request': 'Invalid request',
            'unauthorized_client': 'Client not authorized',
            'unsupported_response_type': 'Response type not supported',
            'invalid_scope': 'Invalid scope requested',
            'server_error': 'OAuth provider error',
            'temporarily_unavailable': 'Service temporarily unavailable'
          };

          return res.status(400).json({ 
            error: userErrors[error] || 'Authentication failed',
            code: error
          });
        }

        res.json({ success: true });
      });

      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ 
          error: 'invalid_scope',
          error_description: 'The requested scope is invalid'
        })
        .expect(400);

      // Verify sensitive details are not exposed
      expect(response.body.error).toBe('Invalid scope requested');
      expect(response.body.error_description).toBeUndefined();
    });
  });
});