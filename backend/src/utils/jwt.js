const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const tokenEncryptionService = require('../services/tokenEncryptionService');
const { query } = require('../config/database');
const logger = require('./logger');

/**
 * Enhanced JWT Utilities with Encryption Layer
 * Provides secure JWT handling with additional encryption and security features
 */
class JWTManager {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.secret;
    this.issuer = 'pbdna-api';
    this.audience = 'pbdna-frontend';
    
    // Token configuration
    this.tokenConfig = {
      access: {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        type: 'access'
      },
      refresh: {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
        type: 'refresh'
      },
      passwordReset: {
        expiresIn: '1h',
        type: 'password_reset'
      },
      emailVerification: {
        expiresIn: '24h',
        type: 'email_verification'
      }
    };

    // Security configuration
    this.securityConfig = {
      enableEncryption: process.env.JWT_ENCRYPTION_ENABLED !== 'false',
      enableFingerprinting: process.env.JWT_FINGERPRINTING_ENABLED !== 'false',
      enableRevocationList: process.env.JWT_REVOCATION_ENABLED !== 'false',
      keyRotationInterval: parseInt(process.env.JWT_KEY_ROTATION_DAYS || '90') * 24 * 60 * 60 * 1000
    };

    // Revocation list cache (in production, use Redis)
    this.revocationCache = new Map();
    this.fingerprintCache = new Map();
  }

  /**
   * Generate secure JWT token with encryption
   * @param {Object} payload - Token payload
   * @param {string} tokenType - Type of token (access, refresh, etc.)
   * @param {Object} options - Additional options
   * @returns {Object} Token data with encrypted token
   */
  async generateToken(payload, tokenType = 'access', options = {}) {
    try {
      const config = this.tokenConfig[tokenType] || this.tokenConfig.access;
      const tokenId = crypto.randomUUID();
      
      // Add security claims
      const securePayload = {
        ...payload,
        jti: tokenId, // JWT ID for revocation
        type: config.type,
        iss: this.issuer,
        aud: this.audience,
        iat: Math.floor(Date.now() / 1000),
        // Add random entropy to prevent rainbow table attacks
        entropy: crypto.randomBytes(16).toString('hex')
      };

      // Add fingerprint if enabled
      let fingerprint = null;
      if (this.securityConfig.enableFingerprinting && options.req) {
        fingerprint = this.generateFingerprint(options.req);
        securePayload.fingerprint = crypto
          .createHash('sha256')
          .update(fingerprint)
          .digest('hex');
      }

      // Generate JWT
      const jwtToken = jwt.sign(securePayload, this.getSigningKey(tokenType), {
        expiresIn: config.expiresIn,
        algorithm: 'HS512' // Use stronger algorithm
      });

      // Encrypt token if enabled
      let finalToken = jwtToken;
      let encryptedPackage = null;
      
      if (this.securityConfig.enableEncryption) {
        encryptedPackage = tokenEncryptionService.encryptToken(
          jwtToken,
          'jwt',
          {
            tokenId,
            tokenType,
            userId: payload.userId,
            fingerprint: fingerprint ? crypto.createHash('sha256').update(fingerprint).digest('hex') : null
          }
        );
        
        // Encode encrypted package as base64 for transmission
        finalToken = Buffer.from(JSON.stringify(encryptedPackage)).toString('base64url');
      }

      // Store token metadata for tracking
      if (payload.userId) {
        await this.storeTokenMetadata(tokenId, payload.userId, tokenType, options);
      }

      // Log token generation
      logger.debug('Token generated', {
        tokenId,
        tokenType,
        userId: payload.userId,
        encrypted: this.securityConfig.enableEncryption
      });

      return {
        token: finalToken,
        tokenId,
        type: tokenType,
        expiresIn: config.expiresIn,
        expiresAt: new Date(Date.now() + this.parseExpiration(config.expiresIn)),
        fingerprint,
        encrypted: this.securityConfig.enableEncryption
      };
    } catch (error) {
      logger.error('Token generation failed:', error);
      throw new Error('Failed to generate token');
    }
  }

  /**
   * Verify and decrypt JWT token
   * @param {string} token - Token to verify
   * @param {string} expectedType - Expected token type
   * @param {Object} options - Verification options
   * @returns {Object} Decoded token payload
   */
  async verifyToken(token, expectedType = null, options = {}) {
    try {
      let jwtToken = token;
      let encryptedPackage = null;

      // Decrypt if token is encrypted
      if (this.securityConfig.enableEncryption && this.isEncryptedToken(token)) {
        try {
          encryptedPackage = JSON.parse(Buffer.from(token, 'base64url').toString());
          const decrypted = tokenEncryptionService.decryptToken(encryptedPackage, 'jwt');
          jwtToken = decrypted.token;
        } catch (error) {
          throw new Error('Token decryption failed');
        }
      }

      // Verify JWT
      const decoded = jwt.verify(jwtToken, this.getVerificationKey(expectedType || 'access'), {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS512']
      });

      // Verify token type
      if (expectedType && decoded.type !== expectedType) {
        throw new Error(`Invalid token type. Expected ${expectedType}, got ${decoded.type}`);
      }

      // Check revocation list
      if (this.securityConfig.enableRevocationList) {
        const isRevoked = await this.isTokenRevoked(decoded.jti);
        if (isRevoked) {
          throw new Error('Token has been revoked');
        }
      }

      // Verify fingerprint if present
      if (decoded.fingerprint && options.req) {
        const currentFingerprint = this.generateFingerprint(options.req);
        const expectedHash = crypto
          .createHash('sha256')
          .update(currentFingerprint)
          .digest('hex');
        
        if (decoded.fingerprint !== expectedHash) {
          logger.warn('Token fingerprint mismatch', {
            tokenId: decoded.jti,
            userId: decoded.userId
          });
          throw new Error('Token fingerprint mismatch');
        }
      }

      // Update token usage
      if (decoded.userId) {
        await this.updateTokenUsage(decoded.jti, decoded.userId);
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      
      logger.error('Token verification failed:', error);
      throw error;
    }
  }

  /**
   * Generate refresh token with enhanced security
   * @param {Object} payload - Token payload
   * @param {Object} options - Generation options
   * @returns {Object} Refresh token data
   */
  async generateRefreshToken(payload, options = {}) {
    const refreshPayload = {
      ...payload,
      scope: 'refresh',
      // Limit refresh token claims
      email: undefined,
      permissions: undefined
    };

    return this.generateToken(refreshPayload, 'refresh', options);
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @param {Object} options - Refresh options
   * @returns {Object} New token pair
   */
  async refreshAccessToken(refreshToken, options = {}) {
    try {
      // Verify refresh token
      const decoded = await this.verifyToken(refreshToken, 'refresh', options);

      // Get user data for new token
      const userResult = await query(
        'SELECT id, email, subscription_tier FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Generate new access token
      const accessToken = await this.generateToken({
        userId: user.id,
        email: user.email,
        subscriptionTier: user.subscription_tier
      }, 'access', options);

      // Optionally rotate refresh token
      let newRefreshToken = null;
      if (options.rotateRefresh) {
        // Revoke old refresh token
        await this.revokeToken(decoded.jti);
        
        // Generate new refresh token
        newRefreshToken = await this.generateRefreshToken({
          userId: user.id
        }, options);
      }

      logger.info('Token refreshed', {
        userId: user.id,
        oldTokenId: decoded.jti,
        newTokenId: accessToken.tokenId,
        refreshRotated: !!newRefreshToken
      });

      return {
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt,
        refreshToken: newRefreshToken?.token || refreshToken,
        refreshTokenExpiresAt: newRefreshToken?.expiresAt
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Revoke token
   * @param {string} tokenId - JWT ID to revoke
   * @param {string} reason - Revocation reason
   */
  async revokeToken(tokenId, reason = 'user_requested') {
    try {
      // Add to revocation list
      await query(
        'INSERT INTO jwt_revocation_list (jti, revoked_at, reason) VALUES ($1, NOW(), $2)',
        [tokenId, reason]
      );

      // Update cache
      this.revocationCache.set(tokenId, {
        revokedAt: Date.now(),
        reason
      });

      // Also revoke in token encryption service
      await tokenEncryptionService.revokeToken(tokenId, null, reason);

      logger.info('Token revoked', { tokenId, reason });
    } catch (error) {
      logger.error('Token revocation failed:', error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for user
   * @param {string} userId - User ID
   * @param {string} reason - Revocation reason
   */
  async revokeAllUserTokens(userId, reason = 'security') {
    try {
      const result = await query(
        `INSERT INTO jwt_revocation_list (jti, revoked_at, reason)
         SELECT token_id, NOW(), $2
         FROM token_metadata
         WHERE user_id = $1 AND expires_at > NOW()
         RETURNING jti`,
        [userId, reason]
      );

      const revokedCount = result.rows.length;

      logger.info('All user tokens revoked', {
        userId,
        count: revokedCount,
        reason
      });

      return { revokedCount };
    } catch (error) {
      logger.error('Failed to revoke user tokens:', error);
      throw error;
    }
  }

  /**
   * Check if token is revoked
   * @param {string} tokenId - JWT ID
   * @returns {boolean} Is revoked
   */
  async isTokenRevoked(tokenId) {
    // Check cache first
    if (this.revocationCache.has(tokenId)) {
      return true;
    }

    try {
      const result = await query(
        'SELECT 1 FROM jwt_revocation_list WHERE jti = $1',
        [tokenId]
      );

      const isRevoked = result.rows.length > 0;
      
      if (isRevoked) {
        // Update cache
        this.revocationCache.set(tokenId, { revokedAt: Date.now() });
      }

      return isRevoked;
    } catch (error) {
      logger.error('Failed to check token revocation:', error);
      return true; // Fail secure
    }
  }

  /**
   * Store token metadata for tracking
   * @param {string} tokenId - JWT ID
   * @param {string} userId - User ID
   * @param {string} tokenType - Token type
   * @param {Object} options - Storage options
   */
  async storeTokenMetadata(tokenId, userId, tokenType, options = {}) {
    try {
      const expiresAt = new Date(
        Date.now() + this.parseExpiration(this.tokenConfig[tokenType].expiresIn)
      );

      await query(
        `INSERT INTO token_metadata 
         (token_id, user_id, token_type, expires_at, device_info, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tokenId,
          userId,
          tokenType,
          expiresAt,
          options.deviceInfo ? JSON.stringify(options.deviceInfo) : null,
          options.req?.ip,
          options.req?.get('User-Agent')
        ]
      );
    } catch (error) {
      logger.error('Failed to store token metadata:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Update token usage statistics
   * @param {string} tokenId - JWT ID
   * @param {string} userId - User ID
   */
  async updateTokenUsage(tokenId, userId) {
    try {
      await query(
        `UPDATE token_metadata 
         SET last_used_at = NOW(), usage_count = usage_count + 1
         WHERE token_id = $1 AND user_id = $2`,
        [tokenId, userId]
      );
    } catch (error) {
      // Don't throw - this is not critical
    }
  }

  /**
   * Generate device fingerprint
   * @param {Object} req - Express request
   * @returns {string} Device fingerprint
   */
  generateFingerprint(req) {
    const components = [
      req.get('User-Agent'),
      req.get('Accept-Language'),
      req.get('Accept-Encoding'),
      req.ip,
      req.get('DNT'),
      req.get('X-Forwarded-For')
    ].filter(Boolean);

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Check if token is encrypted
   * @param {string} token - Token to check
   * @returns {boolean} Is encrypted
   */
  isEncryptedToken(token) {
    try {
      // Encrypted tokens are base64url encoded JSON
      const decoded = Buffer.from(token, 'base64url').toString();
      const parsed = JSON.parse(decoded);
      
      // Check for encryption package structure
      return !!(parsed.v && parsed.i && parsed.d && parsed.a);
    } catch {
      return false;
    }
  }

  /**
   * Get signing key for token type
   * @param {string} tokenType - Token type
   * @returns {string} Signing key
   */
  getSigningKey(tokenType) {
    if (tokenType === 'refresh') {
      return this.refreshSecret;
    }
    return this.secret;
  }

  /**
   * Get verification key for token type
   * @param {string} tokenType - Token type
   * @returns {string} Verification key
   */
  getVerificationKey(tokenType) {
    if (tokenType === 'refresh') {
      return this.refreshSecret;
    }
    return this.secret;
  }

  /**
   * Parse expiration string to milliseconds
   * @param {string} expiration - Expiration string (e.g., '1h', '7d')
   * @returns {number} Milliseconds
   */
  parseExpiration(expiration) {
    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Rotate JWT signing keys
   * @param {string} newSecret - New secret
   * @param {string} newRefreshSecret - New refresh secret
   */
  async rotateKeys(newSecret, newRefreshSecret) {
    try {
      // Store old keys for grace period
      await query(
        `INSERT INTO jwt_key_rotation 
         (old_secret_hash, new_secret_hash, rotated_at, grace_period_end)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours')`,
        [
          crypto.createHash('sha256').update(this.secret).digest('hex'),
          crypto.createHash('sha256').update(newSecret).digest('hex')
        ]
      );

      // Update keys
      this.secret = newSecret;
      this.refreshSecret = newRefreshSecret || newSecret;

      logger.info('JWT keys rotated successfully');

      return {
        success: true,
        gracePeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      logger.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    try {
      // Clean revocation list
      await query(
        'DELETE FROM jwt_revocation_list WHERE revoked_at < NOW() - INTERVAL \'90 days\''
      );

      // Clean token metadata
      await query(
        'DELETE FROM token_metadata WHERE expires_at < NOW() - INTERVAL \'30 days\''
      );

      // Clean revocation cache
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const [tokenId, data] of this.revocationCache.entries()) {
        if (now - data.revokedAt > maxAge) {
          this.revocationCache.delete(tokenId);
        }
      }

      logger.debug('JWT cleanup completed');
    } catch (error) {
      logger.error('JWT cleanup failed:', error);
    }
  }

  /**
   * Get token statistics
   * @param {string} userId - User ID (optional)
   * @returns {Object} Token statistics
   */
  async getTokenStatistics(userId = null) {
    try {
      const userClause = userId ? 'WHERE user_id = $1' : '';
      const params = userId ? [userId] : [];

      const stats = await query(
        `SELECT 
           COUNT(*) as total_tokens,
           COUNT(CASE WHEN token_type = 'access' THEN 1 END) as access_tokens,
           COUNT(CASE WHEN token_type = 'refresh' THEN 1 END) as refresh_tokens,
           COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_tokens,
           AVG(usage_count)::numeric(10,2) as avg_usage_count,
           MAX(last_used_at) as last_activity
         FROM token_metadata ${userClause}`,
        params
      );

      const revoked = await query(
        `SELECT COUNT(*) as count FROM jwt_revocation_list ${userClause}`,
        params
      );

      return {
        ...stats.rows[0],
        revoked_tokens: revoked.rows[0].count
      };
    } catch (error) {
      logger.error('Failed to get token statistics:', error);
      throw error;
    }
  }
}

// Create singleton instance
const jwtManager = new JWTManager();

// Schedule cleanup
setInterval(() => jwtManager.cleanup(), 60 * 60 * 1000); // Every hour

// Export functions
module.exports = {
  generateToken: (payload, type, options) => jwtManager.generateToken(payload, type, options),
  verifyToken: (token, type, options) => jwtManager.verifyToken(token, type, options),
  generateRefreshToken: (payload, options) => jwtManager.generateRefreshToken(payload, options),
  refreshAccessToken: (refreshToken, options) => jwtManager.refreshAccessToken(refreshToken, options),
  revokeToken: (tokenId, reason) => jwtManager.revokeToken(tokenId, reason),
  revokeAllUserTokens: (userId, reason) => jwtManager.revokeAllUserTokens(userId, reason),
  isTokenRevoked: (tokenId) => jwtManager.isTokenRevoked(tokenId),
  rotateKeys: (newSecret, newRefreshSecret) => jwtManager.rotateKeys(newSecret, newRefreshSecret),
  getTokenStatistics: (userId) => jwtManager.getTokenStatistics(userId),
  
  // Export instance for advanced usage
  instance: jwtManager
};