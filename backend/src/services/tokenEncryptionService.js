const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Token Encryption Service
 * Implements AES-256-GCM encryption for all token types with key rotation and versioning
 */
class TokenEncryptionService {
  constructor() {
    // Key versioning for backward compatibility
    this.currentKeyVersion = 1;
    this.keys = this.loadEncryptionKeys();
    this.algorithm = 'aes-256-gcm';
    this.saltLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.keyDerivationIterations = 100000;
    
    // Token type configurations
    this.tokenConfigs = {
      jwt: {
        keyPrefix: 'jwt_',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        rotation: 30 * 24 * 60 * 60 * 1000 // 30 days
      },
      oauth: {
        keyPrefix: 'oauth_',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        rotation: 90 * 24 * 60 * 60 * 1000 // 90 days
      },
      session: {
        keyPrefix: 'session_',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        rotation: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      refresh: {
        keyPrefix: 'refresh_',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        rotation: 60 * 24 * 60 * 60 * 1000 // 60 days
      }
    };
  }

  /**
   * Load encryption keys from environment with fallback generation
   * @returns {object} Encryption keys by version
   */
  loadEncryptionKeys() {
    const keys = {};
    
    // Load current key
    const currentKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (currentKey) {
      keys[this.currentKeyVersion] = Buffer.from(currentKey, 'hex');
    } else {
      // Generate new key if not set
      keys[this.currentKeyVersion] = crypto.randomBytes(32);
      logger.warn('Generated new token encryption key. Set TOKEN_ENCRYPTION_KEY in environment.');
    }
    
    // Load previous keys for backward compatibility
    for (let i = 1; i <= 3; i++) {
      const oldKey = process.env[`TOKEN_ENCRYPTION_KEY_V${i}`];
      if (oldKey) {
        keys[i] = Buffer.from(oldKey, 'hex');
      }
    }
    
    return keys;
  }

  /**
   * Derive key from master key using PBKDF2
   * @param {Buffer} masterKey - Master encryption key
   * @param {string} salt - Salt for key derivation
   * @param {string} context - Context for key separation
   * @returns {Buffer} Derived key
   */
  deriveKey(masterKey, salt, context) {
    const contextSalt = Buffer.concat([
      Buffer.from(salt, 'hex'),
      Buffer.from(context, 'utf8')
    ]);
    
    return crypto.pbkdf2Sync(
      masterKey,
      contextSalt,
      this.keyDerivationIterations,
      32,
      'sha256'
    );
  }

  /**
   * Encrypt token with versioning and metadata
   * @param {string} token - Token to encrypt
   * @param {string} tokenType - Type of token (jwt, oauth, session, refresh)
   * @param {object} metadata - Additional metadata to store
   * @returns {object} Encrypted token package
   */
  encryptToken(token, tokenType = 'jwt', metadata = {}) {
    try {
      const config = this.tokenConfigs[tokenType] || this.tokenConfigs.jwt;
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive key for this specific token type
      const derivedKey = this.deriveKey(
        this.keys[this.currentKeyVersion],
        salt.toString('hex'),
        config.keyPrefix
      );
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
      
      // Prepare token data with metadata
      const tokenData = {
        token,
        type: tokenType,
        version: this.currentKeyVersion,
        created: Date.now(),
        metadata,
        fingerprint: this.generateTokenFingerprint(token, metadata)
      };
      
      // Encrypt token data
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(tokenData), 'utf8'),
        cipher.final()
      ]);
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Create encrypted package
      const encryptedPackage = {
        v: this.currentKeyVersion, // version
        t: tokenType, // type
        s: salt.toString('base64'), // salt
        i: iv.toString('base64'), // iv
        d: encrypted.toString('base64'), // data
        a: authTag.toString('base64'), // auth tag
        c: Date.now() // created timestamp
      };
      
      // Add integrity hash
      encryptedPackage.h = this.generateIntegrityHash(encryptedPackage);
      
      return encryptedPackage;
    } catch (error) {
      logger.error('Token encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt token with version handling
   * @param {object} encryptedPackage - Encrypted token package
   * @param {string} expectedType - Expected token type for validation
   * @returns {object} Decrypted token data
   */
  decryptToken(encryptedPackage, expectedType = null) {
    try {
      // Verify integrity
      if (!this.verifyIntegrity(encryptedPackage)) {
        throw new Error('Token integrity check failed');
      }
      
      // Extract components
      const version = encryptedPackage.v;
      const tokenType = encryptedPackage.t;
      const salt = Buffer.from(encryptedPackage.s, 'base64');
      const iv = Buffer.from(encryptedPackage.i, 'base64');
      const encrypted = Buffer.from(encryptedPackage.d, 'base64');
      const authTag = Buffer.from(encryptedPackage.a, 'base64');
      
      // Validate token type if specified
      if (expectedType && tokenType !== expectedType) {
        throw new Error(`Invalid token type. Expected ${expectedType}, got ${tokenType}`);
      }
      
      // Get appropriate key version
      const masterKey = this.keys[version];
      if (!masterKey) {
        throw new Error(`Unknown key version: ${version}`);
      }
      
      // Derive key
      const config = this.tokenConfigs[tokenType] || this.tokenConfigs.jwt;
      const derivedKey = this.deriveKey(
        masterKey,
        salt.toString('hex'),
        config.keyPrefix
      );
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      // Parse token data
      const tokenData = JSON.parse(decrypted.toString('utf8'));
      
      // Verify fingerprint
      const expectedFingerprint = this.generateTokenFingerprint(
        tokenData.token,
        tokenData.metadata
      );
      
      if (tokenData.fingerprint !== expectedFingerprint) {
        throw new Error('Token fingerprint mismatch');
      }
      
      // Check token age
      const age = Date.now() - tokenData.created;
      if (age > config.maxAge) {
        throw new Error('Token expired');
      }
      
      return tokenData;
    } catch (error) {
      logger.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Generate token fingerprint for tamper detection
   * @param {string} token - Token content
   * @param {object} metadata - Token metadata
   * @returns {string} Token fingerprint
   */
  generateTokenFingerprint(token, metadata = {}) {
    const fingerprintData = {
      token: token.substring(0, 10) + '...' + token.slice(-10),
      metadata: Object.keys(metadata).sort().join(','),
      timestamp: Math.floor(Date.now() / 60000) // Round to minute
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate integrity hash for encrypted package
   * @param {object} package - Encrypted package (without hash)
   * @returns {string} Integrity hash
   */
  generateIntegrityHash(package) {
    const hashData = {
      v: package.v,
      t: package.t,
      s: package.s,
      i: package.i,
      d: package.d,
      a: package.a,
      c: package.c
    };
    
    return crypto
      .createHmac('sha256', this.keys[this.currentKeyVersion])
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  /**
   * Verify integrity of encrypted package
   * @param {object} package - Encrypted package
   * @returns {boolean} Integrity valid
   */
  verifyIntegrity(package) {
    const expectedHash = this.generateIntegrityHash(package);
    return crypto.timingSafeEqual(
      Buffer.from(package.h, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }

  /**
   * Rotate encryption keys
   * @param {string} newKey - New encryption key (hex)
   * @returns {object} Rotation result
   */
  async rotateKeys(newKey) {
    try {
      // Validate new key
      if (!newKey || newKey.length !== 64) {
        throw new Error('Invalid key format. Must be 32 bytes hex encoded.');
      }
      
      // Store current key as old version
      const oldVersion = this.currentKeyVersion;
      const newVersion = oldVersion + 1;
      
      // Update keys
      this.keys[newVersion] = Buffer.from(newKey, 'hex');
      this.currentKeyVersion = newVersion;
      
      // Log rotation event
      await query(
        'INSERT INTO security_events (event_type, event_data) VALUES ($1, $2)',
        [
          'key_rotation',
          JSON.stringify({
            oldVersion,
            newVersion,
            timestamp: new Date(),
            tokenTypes: Object.keys(this.tokenConfigs)
          })
        ]
      );
      
      logger.info('Encryption keys rotated successfully', {
        oldVersion,
        newVersion
      });
      
      return {
        success: true,
        oldVersion,
        newVersion,
        message: 'Keys rotated successfully. Update TOKEN_ENCRYPTION_KEY in environment.'
      };
    } catch (error) {
      logger.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Re-encrypt token with new key version
   * @param {object} encryptedPackage - Current encrypted package
   * @param {string} tokenType - Token type
   * @returns {object} Re-encrypted package
   */
  reEncryptToken(encryptedPackage, tokenType) {
    try {
      // Decrypt with old version
      const tokenData = this.decryptToken(encryptedPackage);
      
      // Re-encrypt with current version
      return this.encryptToken(
        tokenData.token,
        tokenType || tokenData.type,
        tokenData.metadata
      );
    } catch (error) {
      logger.error('Token re-encryption failed:', error);
      throw error;
    }
  }

  /**
   * Store encrypted token securely
   * @param {string} tokenId - Unique token identifier
   * @param {object} encryptedPackage - Encrypted token package
   * @param {string} userId - Associated user ID
   * @param {object} options - Storage options
   */
  async storeEncryptedToken(tokenId, encryptedPackage, userId, options = {}) {
    try {
      const { 
        expiresAt = new Date(Date.now() + this.tokenConfigs[encryptedPackage.t].maxAge),
        purpose = 'authentication',
        deviceInfo = null
      } = options;
      
      await query(
        `INSERT INTO encrypted_tokens 
         (token_id, user_id, encrypted_data, token_type, purpose, expires_at, device_info, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (token_id) 
         DO UPDATE SET encrypted_data = $3, expires_at = $6, updated_at = NOW()`,
        [
          tokenId,
          userId,
          JSON.stringify(encryptedPackage),
          encryptedPackage.t,
          purpose,
          expiresAt,
          deviceInfo ? JSON.stringify(deviceInfo) : null
        ]
      );
      
      return { success: true, tokenId };
    } catch (error) {
      logger.error('Failed to store encrypted token:', error);
      throw error;
    }
  }

  /**
   * Retrieve encrypted token
   * @param {string} tokenId - Token identifier
   * @param {string} userId - User ID for validation
   * @returns {object} Encrypted token package
   */
  async retrieveEncryptedToken(tokenId, userId) {
    try {
      const result = await query(
        `SELECT encrypted_data, token_type, expires_at
         FROM encrypted_tokens
         WHERE token_id = $1 AND user_id = $2 AND expires_at > NOW()`,
        [tokenId, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Token not found or expired');
      }
      
      const { encrypted_data, token_type, expires_at } = result.rows[0];
      const encryptedPackage = JSON.parse(encrypted_data);
      
      // Update last accessed
      await query(
        'UPDATE encrypted_tokens SET last_accessed = NOW() WHERE token_id = $1',
        [tokenId]
      );
      
      return {
        encryptedPackage,
        tokenType: token_type,
        expiresAt: expires_at
      };
    } catch (error) {
      logger.error('Failed to retrieve encrypted token:', error);
      throw error;
    }
  }

  /**
   * Revoke token
   * @param {string} tokenId - Token to revoke
   * @param {string} userId - User ID
   * @param {string} reason - Revocation reason
   */
  async revokeToken(tokenId, userId, reason = 'user_initiated') {
    try {
      await query(
        `UPDATE encrypted_tokens 
         SET revoked = true, revoked_at = NOW(), revocation_reason = $3
         WHERE token_id = $1 AND user_id = $2`,
        [tokenId, userId, reason]
      );
      
      // Add to revocation list
      await query(
        'INSERT INTO token_revocation_list (token_id, user_id, reason, revoked_at) VALUES ($1, $2, $3, NOW())',
        [tokenId, userId, reason]
      );
      
      logger.info('Token revoked', { tokenId, userId, reason });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to revoke token:', error);
      throw error;
    }
  }

  /**
   * Check if token is revoked
   * @param {string} tokenId - Token to check
   * @returns {boolean} Is revoked
   */
  async isTokenRevoked(tokenId) {
    try {
      const result = await query(
        'SELECT 1 FROM token_revocation_list WHERE token_id = $1',
        [tokenId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check token revocation:', error);
      return true; // Fail secure
    }
  }

  /**
   * Clean up expired tokens
   * @returns {object} Cleanup results
   */
  async cleanupExpiredTokens() {
    try {
      const result = await query(
        `DELETE FROM encrypted_tokens 
         WHERE expires_at < NOW() 
         OR (revoked = true AND revoked_at < NOW() - INTERVAL '30 days')
         RETURNING token_id`
      );
      
      const deletedCount = result.rows.length;
      
      logger.info('Cleaned up expired tokens', { count: deletedCount });
      
      return {
        success: true,
        deletedCount,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Token cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get token security metrics
   * @param {string} userId - User ID (optional)
   * @returns {object} Security metrics
   */
  async getTokenMetrics(userId = null) {
    try {
      const userClause = userId ? 'WHERE user_id = $1' : '';
      const params = userId ? [userId] : [];
      
      const metrics = await query(
        `SELECT 
           COUNT(*) as total_tokens,
           COUNT(CASE WHEN revoked = true THEN 1 END) as revoked_tokens,
           COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_tokens,
           COUNT(CASE WHEN token_type = 'jwt' THEN 1 END) as jwt_tokens,
           COUNT(CASE WHEN token_type = 'oauth' THEN 1 END) as oauth_tokens,
           COUNT(CASE WHEN token_type = 'session' THEN 1 END) as session_tokens,
           COUNT(CASE WHEN token_type = 'refresh' THEN 1 END) as refresh_tokens,
           AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600)::numeric(10,2) as avg_token_lifetime_hours
         FROM encrypted_tokens ${userClause}`,
        params
      );
      
      return metrics.rows[0];
    } catch (error) {
      logger.error('Failed to get token metrics:', error);
      throw error;
    }
  }

  /**
   * Generate secure token binding
   * @param {string} token - Token to bind
   * @param {object} bindingData - Data to bind token to
   * @returns {string} Token binding
   */
  generateTokenBinding(token, bindingData) {
    const bindingString = JSON.stringify({
      userAgent: bindingData.userAgent,
      ip: bindingData.ip,
      deviceId: bindingData.deviceId,
      timestamp: Math.floor(Date.now() / 60000) // Round to minute
    });
    
    return crypto
      .createHmac('sha256', Buffer.from(token))
      .update(bindingString)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Verify token binding
   * @param {string} token - Token to verify
   * @param {string} binding - Expected binding
   * @param {object} bindingData - Current binding data
   * @returns {boolean} Binding valid
   */
  verifyTokenBinding(token, binding, bindingData) {
    const expectedBinding = this.generateTokenBinding(token, bindingData);
    return crypto.timingSafeEqual(
      Buffer.from(binding, 'hex'),
      Buffer.from(expectedBinding, 'hex')
    );
  }
}

module.exports = new TokenEncryptionService();