const tokenEncryptionService = require('../../src/services/tokenEncryptionService');
const crypto = require('crypto');

describe('Token Encryption Security Tests', () => {
  let testToken;
  let testMetadata;

  beforeEach(() => {
    testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    testMetadata = {
      userId: '123',
      deviceId: 'test-device',
      purpose: 'authentication'
    };
  });

  describe('JWT Token Encryption', () => {
    test('should encrypt JWT token with AES-256-GCM', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);

      expect(encrypted).toBeDefined();
      expect(encrypted.v).toBe(1); // version
      expect(encrypted.t).toBe('jwt'); // type
      expect(encrypted.s).toBeDefined(); // salt
      expect(encrypted.i).toBeDefined(); // iv
      expect(encrypted.d).toBeDefined(); // encrypted data
      expect(encrypted.a).toBeDefined(); // auth tag
      expect(encrypted.h).toBeDefined(); // integrity hash
      expect(encrypted.c).toBeDefined(); // created timestamp
    });

    test('should decrypt JWT token correctly', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      const decrypted = tokenEncryptionService.decryptToken(encrypted, 'jwt');

      expect(decrypted.token).toBe(testToken);
      expect(decrypted.type).toBe('jwt');
      expect(decrypted.metadata).toEqual(testMetadata);
      expect(decrypted.fingerprint).toBeDefined();
    });

    test('should fail decryption with tampered data', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      
      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted.d, 'base64');
      tamperedData[0] = tamperedData[0] ^ 0xFF;
      encrypted.d = tamperedData.toString('base64');

      expect(() => {
        tokenEncryptionService.decryptToken(encrypted, 'jwt');
      }).toThrow('Failed to decrypt token');
    });

    test('should fail decryption with incorrect integrity hash', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      
      // Tamper with integrity hash
      encrypted.h = crypto.randomBytes(32).toString('hex');

      expect(() => {
        tokenEncryptionService.decryptToken(encrypted, 'jwt');
      }).toThrow('Token integrity check failed');
    });
  });

  describe('OAuth Token Encryption', () => {
    const oauthToken = 'oauth_access_token_1234567890';
    const oauthMetadata = {
      provider: 'linkedin',
      scope: 'r_liteprofile w_member_social',
      userId: '456'
    };

    test('should encrypt OAuth token with proper configuration', () => {
      const encrypted = tokenEncryptionService.encryptToken(oauthToken, 'oauth', oauthMetadata);

      expect(encrypted.t).toBe('oauth');
      expect(encrypted.v).toBeDefined();
      
      // Verify different salt for each encryption
      const encrypted2 = tokenEncryptionService.encryptToken(oauthToken, 'oauth', oauthMetadata);
      expect(encrypted.s).not.toBe(encrypted2.s);
      expect(encrypted.i).not.toBe(encrypted2.i);
    });

    test('should maintain OAuth token metadata integrity', () => {
      const encrypted = tokenEncryptionService.encryptToken(oauthToken, 'oauth', oauthMetadata);
      const decrypted = tokenEncryptionService.decryptToken(encrypted, 'oauth');

      expect(decrypted.metadata.provider).toBe('linkedin');
      expect(decrypted.metadata.scope).toBe('r_liteprofile w_member_social');
      expect(decrypted.metadata.userId).toBe('456');
    });
  });

  describe('Session Token Security', () => {
    const sessionToken = 'session_token_abc123';
    const sessionMetadata = {
      sessionId: 'sess_123',
      userId: '789',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0'
    };

    test('should encrypt session tokens with unique IVs', () => {
      const tokens = [];
      for (let i = 0; i < 10; i++) {
        tokens.push(tokenEncryptionService.encryptToken(sessionToken, 'session', sessionMetadata));
      }

      // Check all IVs are unique
      const ivs = tokens.map(t => t.i);
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(10);
    });

    test('should detect expired session tokens', () => {
      const encrypted = tokenEncryptionService.encryptToken(sessionToken, 'session', sessionMetadata);
      
      // Mock expired token by modifying the decrypted data
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + (25 * 60 * 60 * 1000)); // 25 hours later

      expect(() => {
        tokenEncryptionService.decryptToken(encrypted, 'session');
      }).toThrow('Token expired');

      Date.now.mockRestore();
    });
  });

  describe('Key Rotation Testing', () => {
    test('should successfully rotate encryption keys', async () => {
      const newKey = crypto.randomBytes(32).toString('hex');
      const result = await tokenEncryptionService.rotateKeys(newKey);

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe(1);
      expect(result.newVersion).toBe(2);
    });

    test('should decrypt old tokens after key rotation', async () => {
      // Encrypt with current key
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      
      // Rotate keys
      const newKey = crypto.randomBytes(32).toString('hex');
      await tokenEncryptionService.rotateKeys(newKey);

      // Should still decrypt old token
      const decrypted = tokenEncryptionService.decryptToken(encrypted, 'jwt');
      expect(decrypted.token).toBe(testToken);
    });

    test('should re-encrypt tokens with new key version', async () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      const oldVersion = encrypted.v;

      // Rotate keys
      const newKey = crypto.randomBytes(32).toString('hex');
      await tokenEncryptionService.rotateKeys(newKey);

      // Re-encrypt token
      const reEncrypted = tokenEncryptionService.reEncryptToken(encrypted, 'jwt');
      expect(reEncrypted.v).toBe(oldVersion + 1);

      // Verify can decrypt
      const decrypted = tokenEncryptionService.decryptToken(reEncrypted, 'jwt');
      expect(decrypted.token).toBe(testToken);
    });
  });

  describe('Token Tampering Detection', () => {
    test('should detect modified auth tags', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      
      // Modify auth tag
      const tamperedTag = Buffer.from(encrypted.a, 'base64');
      tamperedTag[0] = tamperedTag[0] ^ 0xFF;
      encrypted.a = tamperedTag.toString('base64');

      expect(() => {
        tokenEncryptionService.decryptToken(encrypted, 'jwt');
      }).toThrow();
    });

    test('should detect token type mismatch', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);

      expect(() => {
        tokenEncryptionService.decryptToken(encrypted, 'oauth');
      }).toThrow('Invalid token type. Expected oauth, got jwt');
    });

    test('should verify token fingerprints', () => {
      const fingerprint1 = tokenEncryptionService.generateTokenFingerprint(testToken, testMetadata);
      const fingerprint2 = tokenEncryptionService.generateTokenFingerprint(testToken, testMetadata);
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(16);
    });
  });

  describe('Encryption Strength Verification', () => {
    test('should use proper key derivation', () => {
      const masterKey = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32).toString('hex');
      
      const derived1 = tokenEncryptionService.deriveKey(masterKey, salt, 'jwt_');
      const derived2 = tokenEncryptionService.deriveKey(masterKey, salt, 'oauth_');

      // Different contexts should produce different keys
      expect(derived1.equals(derived2)).toBe(false);
      expect(derived1).toHaveLength(32);
      expect(derived2).toHaveLength(32);
    });

    test('should use sufficient randomness for salts and IVs', () => {
      const salts = new Set();
      const ivs = new Set();

      for (let i = 0; i < 1000; i++) {
        const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
        salts.add(encrypted.s);
        ivs.add(encrypted.i);
      }

      // All should be unique
      expect(salts.size).toBe(1000);
      expect(ivs.size).toBe(1000);
    });

    test('should use timing-safe comparison for integrity checks', () => {
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
      
      // Multiple verifications should take similar time
      const times = [];
      for (let i = 0; i < 100; i++) {
        const start = process.hrtime.bigint();
        tokenEncryptionService.verifyIntegrity(encrypted);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }

      // Calculate variance
      const avg = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be relatively small (timing-safe)
      expect(stdDev / avg).toBeLessThan(0.5);
    });
  });

  describe('Token Binding Security', () => {
    const bindingData = {
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
      deviceId: 'device-123'
    };

    test('should generate consistent token bindings', () => {
      const binding1 = tokenEncryptionService.generateTokenBinding(testToken, bindingData);
      const binding2 = tokenEncryptionService.generateTokenBinding(testToken, bindingData);

      expect(binding1).toBe(binding2);
      expect(binding1).toHaveLength(32);
    });

    test('should detect token theft via binding mismatch', () => {
      const binding = tokenEncryptionService.generateTokenBinding(testToken, bindingData);
      
      const differentDevice = { ...bindingData, deviceId: 'device-456' };
      const isValid = tokenEncryptionService.verifyTokenBinding(testToken, binding, differentDevice);

      expect(isValid).toBe(false);
    });
  });

  describe('Token Storage Security', () => {
    test('should store encrypted tokens securely', async () => {
      const tokenId = crypto.randomUUID();
      const userId = '123';
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);

      const result = await tokenEncryptionService.storeEncryptedToken(
        tokenId,
        encrypted,
        userId,
        { purpose: 'authentication', deviceInfo: { name: 'Test Device' } }
      );

      expect(result.success).toBe(true);
      expect(result.tokenId).toBe(tokenId);
    });

    test('should retrieve and validate stored tokens', async () => {
      const tokenId = crypto.randomUUID();
      const userId = '123';
      const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);

      await tokenEncryptionService.storeEncryptedToken(tokenId, encrypted, userId);
      
      const retrieved = await tokenEncryptionService.retrieveEncryptedToken(tokenId, userId);
      expect(retrieved.encryptedPackage).toEqual(encrypted);
      expect(retrieved.tokenType).toBe('jwt');
    });

    test('should handle token revocation', async () => {
      const tokenId = crypto.randomUUID();
      const userId = '123';

      await tokenEncryptionService.revokeToken(tokenId, userId, 'security_breach');
      
      const isRevoked = await tokenEncryptionService.isTokenRevoked(tokenId);
      expect(isRevoked).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should encrypt/decrypt efficiently', () => {
      const iterations = 1000;
      const start = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
        tokenEncryptionService.decryptToken(encrypted, 'jwt');
      }

      const end = process.hrtime.bigint();
      const avgTime = Number(end - start) / iterations / 1000000; // Convert to ms

      // Average time should be under 5ms per operation
      expect(avgTime).toBeLessThan(5);
    });

    test('should handle concurrent operations safely', async () => {
      const promises = [];
      const tokenIds = [];

      // Create 100 concurrent token operations
      for (let i = 0; i < 100; i++) {
        const tokenId = crypto.randomUUID();
        tokenIds.push(tokenId);
        
        const encrypted = tokenEncryptionService.encryptToken(testToken, 'jwt', testMetadata);
        promises.push(
          tokenEncryptionService.storeEncryptedToken(tokenId, encrypted, '123')
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Token Metrics and Monitoring', () => {
    test('should track token security metrics', async () => {
      const metrics = await tokenEncryptionService.getTokenMetrics();

      expect(metrics).toHaveProperty('total_tokens');
      expect(metrics).toHaveProperty('revoked_tokens');
      expect(metrics).toHaveProperty('expired_tokens');
      expect(metrics).toHaveProperty('jwt_tokens');
      expect(metrics).toHaveProperty('oauth_tokens');
      expect(metrics).toHaveProperty('avg_token_lifetime_hours');
    });

    test('should clean up expired tokens', async () => {
      const result = await tokenEncryptionService.cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('deletedCount');
      expect(result).toHaveProperty('timestamp');
    });
  });
});