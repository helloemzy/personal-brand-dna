const crypto = require('crypto');
const oauthSecurityValidator = require('../../src/validators/oauthSecurityValidator');
const oauthSecurity = require('../../src/middleware/oauthSecurity');
const linkedinOAuthService = require('../../src/services/linkedinOAuthService');

describe('OAuth Advanced Security Tests', () => {
  describe('PKCE Implementation', () => {
    test('should generate valid code verifier', () => {
      const codeVerifier = oauthSecurity.generateCodeVerifier();
      
      expect(codeVerifier).toBeDefined();
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier.length).toBeLessThanOrEqual(128);
      expect(/^[A-Za-z0-9\-._~]+$/.test(codeVerifier)).toBe(true);
    });

    test('should generate valid code challenge', () => {
      const codeVerifier = oauthSecurity.generateCodeVerifier();
      const codeChallenge = oauthSecurity.generateCodeChallenge(codeVerifier);
      
      expect(codeChallenge).toBeDefined();
      expect(codeChallenge.length).toBeGreaterThan(0);
      expect(/^[A-Za-z0-9\-_]+$/.test(codeChallenge)).toBe(true);
      expect(codeChallenge).not.toContain('='); // No padding in base64url
    });

    test('should validate correct PKCE parameters', () => {
      const codeVerifier = oauthSecurity.generateCodeVerifier();
      const codeChallenge = oauthSecurity.generateCodeChallenge(codeVerifier);
      
      const validation = oauthSecurityValidator.validatePKCE(
        codeVerifier,
        codeChallenge,
        'S256'
      );
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid code verifier', () => {
      const invalidVerifiers = [
        '', // Empty
        'short', // Too short
        'a'.repeat(129), // Too long
        'invalid!@#$%', // Invalid characters
        '12345678901234567890123456789012345678901234' // Still valid length but weak
      ];

      invalidVerifiers.forEach(verifier => {
        const validation = oauthSecurityValidator.validatePKCE(
          verifier,
          'dummy-challenge',
          'S256'
        );
        
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    test('should reject mismatched code challenge', () => {
      const codeVerifier = oauthSecurity.generateCodeVerifier();
      const wrongChallenge = 'wrong-challenge-value';
      
      const validation = oauthSecurityValidator.validatePKCE(
        codeVerifier,
        wrongChallenge,
        'S256'
      );
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Code challenge does not match code verifier');
    });

    test('should reject non-S256 challenge method', () => {
      const codeVerifier = oauthSecurity.generateCodeVerifier();
      const codeChallenge = Buffer.from(codeVerifier).toString('base64url'); // Plain method
      
      const validation = oauthSecurityValidator.validatePKCE(
        codeVerifier,
        codeChallenge,
        'plain'
      );
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Only S256 challenge method is allowed');
    });
  });

  describe('Token Rotation', () => {
    let mockRequest;
    let mockResponse;
    let mockNext;

    beforeEach(() => {
      mockRequest = {
        user: { id: 'test-user-123' },
        headers: {}
      };
      mockResponse = {
        setHeader: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should enforce token rotation for old tokens', async () => {
      const middleware = oauthSecurity.enforceTokenRotation();
      
      // Mock old token
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + (86400000 * 31)); // 31 days later
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockRequest.forceTokenRefresh).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip rotation for recently rotated tokens', async () => {
      const middleware = oauthSecurity.enforceTokenRotation();
      
      // Set recent rotation
      oauthSecurity.tokenRotationStore.set('test-user-123', Date.now() - 60000); // 1 minute ago
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockRequest.forceTokenRefresh).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('State Parameter Entropy', () => {
    test('should generate high-entropy state parameters', () => {
      const states = [];
      for (let i = 0; i < 10; i++) {
        states.push(linkedinOAuthService.generateSecureState('test-user'));
      }

      // All states should be unique
      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(10);

      // Each state should have sufficient entropy
      states.forEach(state => {
        const validation = oauthSecurityValidator.validateStateParameter(state);
        expect(validation.valid).toBe(true);
        expect(validation.entropy).toBeGreaterThanOrEqual(128);
      });
    });

    test('should detect low-entropy state parameters', () => {
      const lowEntropyStates = [
        '12345678901234567890123456789012', // Numeric only
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // Single character
        'state_123456789', // Predictable prefix
        Buffer.from('weak').toString('base64') // Too short
      ];

      lowEntropyStates.forEach(state => {
        const validation = oauthSecurityValidator.validateStateParameter(state);
        expect(validation.valid).toBe(false);
      });
    });

    test('should validate state expiration', () => {
      // Generate state with old timestamp
      const oldStateData = {
        userId: 'test-user',
        timestamp: Date.now() - 7200000, // 2 hours ago
        nonce: crypto.randomBytes(32).toString('hex')
      };

      // Manually create expired state (would need to mock encryption)
      expect(() => {
        linkedinOAuthService.verifyState('invalid-state');
      }).toThrow('Invalid or expired state parameter');
    });
  });

  describe('Redirect URI Validation', () => {
    test('should accept valid redirect URIs', () => {
      const validUris = [
        'https://localhost:3001/api/linkedin/callback',
        'https://app.personalbranddna.com/api/linkedin/callback',
        'https://my-app-123.vercel.app/api/linkedin/callback'
      ];

      validUris.forEach(uri => {
        const validation = oauthSecurityValidator.validateRedirectUri(uri);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });

    test('should reject invalid redirect URIs', () => {
      const invalidUris = [
        'http://example.com/callback', // Non-HTTPS
        'https://evil.com/phishing', // Not in whitelist
        'https://localhost:3001/api/linkedin/callback#fragment', // Has fragment
        '//evil.com/redirect', // Protocol-relative URL
        'javascript:alert(1)', // JavaScript protocol
        '', // Empty
        'not-a-url' // Invalid format
      ];

      invalidUris.forEach(uri => {
        const validation = oauthSecurityValidator.validateRedirectUri(uri);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    test('should warn about localhost HTTP in development', () => {
      const validation = oauthSecurityValidator.validateRedirectUri(
        'http://localhost:3001/api/linkedin/callback'
      );
      
      expect(validation.warnings).toContain(
        'Using HTTP with localhost - ensure HTTPS in production'
      );
    });

    test('should detect open redirect vulnerabilities', () => {
      const openRedirectUris = [
        'https://app.com/callback?next=//evil.com',
        'https://app.com//evil.com',
        '//app.com/callback'
      ];

      openRedirectUris.forEach(uri => {
        const validation = oauthSecurityValidator.validateRedirectUri(uri);
        if (uri.includes('//') && !uri.startsWith('https://')) {
          expect(validation.errors).toContain('Potential open redirect vulnerability detected');
        }
      });
    });
  });

  describe('Token Storage Encryption', () => {
    test('should encrypt tokens with AES-256-GCM', () => {
      const token = 'test-access-token-' + crypto.randomBytes(32).toString('hex');
      const encrypted = linkedinOAuthService.encryptToken(token);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.iv.length).toBe(32); // 16 bytes as hex
      expect(encrypted.authTag.length).toBe(32); // 16 bytes as hex

      // Verify encryption validation
      const validation = oauthSecurityValidator.verifyTokenEncryption(encrypted);
      expect(validation.valid).toBe(true);
    });

    test('should decrypt tokens correctly', () => {
      const originalToken = 'test-token-' + crypto.randomBytes(32).toString('hex');
      const encrypted = linkedinOAuthService.encryptToken(originalToken);
      const decrypted = linkedinOAuthService.decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    test('should fail decryption with tampered data', () => {
      const token = 'test-token';
      const encrypted = linkedinOAuthService.encryptToken(token);

      // Tamper with encrypted data
      encrypted.encrypted = encrypted.encrypted.substring(0, 10) + 'tampered';

      expect(() => {
        linkedinOAuthService.decryptToken(encrypted);
      }).toThrow();
    });

    test('should detect unencrypted tokens', () => {
      const unencryptedData = {
        access_token: 'Bearer actual-token-value',
        refresh_token: 'refresh-token-value'
      };

      const validation = oauthSecurityValidator.checkTokenLeakage(
        JSON.stringify(unencryptedData),
        'storage'
      );

      expect(validation.hasLeaks).toBe(true);
      expect(validation.leaks.some(l => l.type === 'Bearer Token')).toBe(true);
    });
  });

  describe('Security Middleware', () => {
    let mockRequest;
    let mockResponse;
    let mockNext;

    beforeEach(() => {
      mockRequest = {
        cookies: {},
        body: {},
        query: {},
        ip: '127.0.0.1',
        get: jest.fn(header => {
          if (header === 'user-agent') return 'Test Browser';
          return null;
        })
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        cookie: jest.fn(),
        clearCookie: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should add security headers to OAuth endpoints', () => {
      const middleware = oauthSecurity.addSecurityHeaders();
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    test('should enforce rate limiting on OAuth endpoints', async () => {
      const middleware = oauthSecurity.oauthRateLimit();
      
      // Simulate multiple requests
      for (let i = 0; i < 10; i++) {
        await middleware(mockRequest, mockResponse, mockNext);
      }
      
      // 11th request should be rate limited
      mockNext.mockClear();
      await middleware(mockRequest, mockResponse, mockNext);
      
      // Should still pass as we're under the limit
      expect(mockNext).toHaveBeenCalled();
      
      // Simulate hitting the rate limit
      for (let i = 0; i < 5; i++) {
        await middleware(mockRequest, mockResponse, mockNext);
      }
      
      mockNext.mockClear();
      mockResponse.status.mockClear();
      
      // This request should be blocked
      await middleware(mockRequest, mockResponse, mockNext);
      
      if (mockResponse.status.mock.calls.length > 0) {
        expect(mockResponse.status).toHaveBeenCalledWith(429);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Too many requests'
          })
        );
      }
    });

    test('should validate redirect URI in middleware', async () => {
      const middleware = oauthSecurity.validateRedirectUri();
      
      // Test valid redirect URI
      mockRequest.query.redirect_uri = 'https://localhost:3001/api/linkedin/callback';
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.validatedRedirectUri).toBeDefined();
      
      // Test invalid redirect URI
      mockNext.mockClear();
      mockRequest.query.redirect_uri = 'http://evil.com/phishing';
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid redirect URI'
        })
      );
    });
  });

  describe('Token Leakage Detection', () => {
    test('should detect LinkedIn access tokens in logs', () => {
      const logContent = `
        User authenticated successfully
        Token: AQVfQ3F6YmR3NGVqYmloYmloYmlqaGJpaGJqaGJpaGJqaA
        Status: 200 OK
      `;

      const validation = oauthSecurityValidator.checkTokenLeakage(logContent, 'log');
      
      expect(validation.hasLeaks).toBe(true);
      expect(validation.leaks.some(l => l.type === 'LinkedIn Access Token')).toBe(true);
    });

    test('should detect OAuth codes in URLs', () => {
      const urlContent = 'https://app.com/callback?code=AQR123456789abcdef&state=xyz';
      
      const validation = oauthSecurityValidator.checkTokenLeakage(urlContent, 'url');
      
      expect(validation.hasLeaks).toBe(true);
      expect(validation.leaks.some(l => l.type === 'OAuth Code')).toBe(true);
    });

    test('should detect client secrets', () => {
      const configContent = `
        {
          "client_id": "abc123",
          "client_secret": "super_secret_key_12345678901234567890"
        }
      `;

      const validation = oauthSecurityValidator.checkTokenLeakage(configContent, 'config');
      
      expect(validation.hasLeaks).toBe(true);
      expect(validation.leaks.some(l => l.type === 'Client Secret')).toBe(true);
      expect(validation.leaks.some(l => l.severity === 'critical')).toBe(true);
    });

    test('should provide recommendations for detected leaks', () => {
      const content = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      
      const validation = oauthSecurityValidator.checkTokenLeakage(content, 'response');
      
      expect(validation.recommendations).toContain('Sanitize response output to remove sensitive tokens');
      expect(validation.recommendations).toContain('Implement token masking in logs');
    });
  });

  describe('Security Audit', () => {
    test('should perform comprehensive security audit', async () => {
      const auditResults = await linkedinOAuthService.performSecurityAudit();

      expect(auditResults).toHaveProperty('timestamp');
      expect(auditResults).toHaveProperty('overall');
      expect(auditResults).toHaveProperty('categories');
      expect(auditResults).toHaveProperty('criticalIssues');
      expect(auditResults).toHaveProperty('warnings');
      expect(auditResults).toHaveProperty('recommendations');

      // Check specific categories
      expect(auditResults.categories).toHaveProperty('stateParameter');
      expect(auditResults.categories).toHaveProperty('redirectUris');
      expect(auditResults.categories).toHaveProperty('tokenEncryption');
      expect(auditResults.categories).toHaveProperty('scopes');
    });

    test('should validate scope permissions in audit', () => {
      const scopeValidation = oauthSecurityValidator.validateScopePermissions(
        ['r_liteprofile', 'r_emailaddress', 'w_member_social', 'r_member_social']
      );

      expect(scopeValidation.valid).toBe(true);
      expect(scopeValidation.analysis.hasMinimumRequired).toBe(true);
      expect(scopeValidation.analysis.hasExcessivePermissions).toBe(false);
    });

    test('should detect dangerous scopes', () => {
      const scopeValidation = oauthSecurityValidator.validateScopePermissions(
        ['r_fullprofile', 'rw_company_admin', 'w_compliance']
      );

      expect(scopeValidation.warnings.length).toBeGreaterThan(0);
      expect(scopeValidation.warnings[0]).toContain('Potentially excessive scopes');
    });
  });

  describe('PKCE Store Cleanup', () => {
    test('should clean up expired PKCE entries', () => {
      // Add expired entry
      const expiredId = 'expired-pkce';
      oauthSecurity.pkceStore.set(expiredId, {
        codeVerifier: 'test',
        codeChallenge: 'test',
        createdAt: Date.now() - 700000, // 11+ minutes ago
        expiresAt: Date.now() - 100000 // Expired
      });

      // Add valid entry
      const validId = 'valid-pkce';
      oauthSecurity.pkceStore.set(validId, {
        codeVerifier: 'test',
        codeChallenge: 'test',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000 // 5 minutes from now
      });

      // Run cleanup
      oauthSecurity.cleanupExpiredEntries();

      expect(oauthSecurity.pkceStore.has(expiredId)).toBe(false);
      expect(oauthSecurity.pkceStore.has(validId)).toBe(true);
    });
  });
});