const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const oauthSecurityValidator = require('../validators/oauthSecurityValidator');
const logger = require('../utils/logger');
const db = require('../config/database');

class OAuthSecurityMiddleware {
  constructor() {
    this.pkceStore = new Map(); // In production, use Redis
    this.stateStore = new Map(); // In production, use Redis
    this.tokenRotationStore = new Map(); // Track token rotation
    
    // Security headers for OAuth endpoints
    this.securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache'
    };

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanupExpiredEntries(), 300000);
  }

  /**
   * Generate PKCE code verifier
   * @returns {string} Code verifier
   */
  generateCodeVerifier() {
    // Generate 32 bytes of random data and encode as base64url
    return crypto.randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge
   * @param {string} codeVerifier - Code verifier
   * @returns {string} Code challenge
   */
  generateCodeChallenge(codeVerifier) {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * PKCE initialization middleware
   */
  initializePKCE() {
    return (req, res, next) => {
      try {
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(codeVerifier);
        const pkceId = crypto.randomBytes(16).toString('hex');

        // Store code verifier with expiration
        this.pkceStore.set(pkceId, {
          codeVerifier,
          codeChallenge,
          userId: req.user?.id,
          createdAt: Date.now(),
          expiresAt: Date.now() + 600000 // 10 minutes
        });

        // Add to request and response
        req.pkce = {
          id: pkceId,
          codeChallenge,
          challengeMethod: 'S256'
        };

        // Set secure cookie with PKCE ID
        res.cookie('pkce_id', pkceId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 600000 // 10 minutes
        });

        next();
      } catch (error) {
        logger.error('PKCE initialization failed:', error);
        res.status(500).json({ error: 'Failed to initialize PKCE' });
      }
    };
  }

  /**
   * PKCE verification middleware
   */
  verifyPKCE() {
    return async (req, res, next) => {
      try {
        const { code_verifier: codeVerifier } = req.body;
        const pkceId = req.cookies.pkce_id || req.body.pkce_id;

        if (!pkceId || !codeVerifier) {
          return res.status(400).json({ 
            error: 'Missing PKCE parameters',
            details: 'Both PKCE ID and code verifier are required'
          });
        }

        // Retrieve stored PKCE data
        const pkceData = this.pkceStore.get(pkceId);
        if (!pkceData) {
          return res.status(400).json({ 
            error: 'Invalid or expired PKCE session'
          });
        }

        // Check expiration
        if (Date.now() > pkceData.expiresAt) {
          this.pkceStore.delete(pkceId);
          return res.status(400).json({ 
            error: 'PKCE session expired'
          });
        }

        // Validate PKCE
        const validation = oauthSecurityValidator.validatePKCE(
          codeVerifier,
          pkceData.codeChallenge,
          'S256'
        );

        if (!validation.valid) {
          logger.warn('PKCE validation failed', {
            userId: pkceData.userId,
            errors: validation.errors
          });
          return res.status(400).json({ 
            error: 'PKCE validation failed',
            details: validation.errors
          });
        }

        // Verify code verifier matches
        if (codeVerifier !== pkceData.codeVerifier) {
          return res.status(400).json({ 
            error: 'Invalid code verifier'
          });
        }

        // Clean up PKCE data
        this.pkceStore.delete(pkceId);
        res.clearCookie('pkce_id');

        // Add validated user ID to request
        req.pkceValidated = true;
        req.pkceUserId = pkceData.userId;

        next();
      } catch (error) {
        logger.error('PKCE verification failed:', error);
        res.status(500).json({ error: 'PKCE verification failed' });
      }
    };
  }

  /**
   * Validate redirect URI middleware
   */
  validateRedirectUri() {
    return (req, res, next) => {
      const redirectUri = req.query.redirect_uri || req.body.redirect_uri;

      if (!redirectUri) {
        return res.status(400).json({ 
          error: 'Redirect URI is required'
        });
      }

      const validation = oauthSecurityValidator.validateRedirectUri(redirectUri);

      if (!validation.valid) {
        logger.warn('Invalid redirect URI attempted', {
          uri: redirectUri,
          errors: validation.errors,
          ip: req.ip
        });
        return res.status(400).json({ 
          error: 'Invalid redirect URI',
          details: validation.errors
        });
      }

      // Log warnings but allow request to continue
      if (validation.warnings.length > 0) {
        logger.info('Redirect URI warnings', {
          uri: redirectUri,
          warnings: validation.warnings
        });
      }

      req.validatedRedirectUri = validation.parsedUri;
      next();
    };
  }

  /**
   * Enhanced state parameter generation and validation
   */
  generateSecureState(userId, additionalData = {}) {
    const stateData = {
      userId,
      sessionId: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
      ...additionalData
    };

    // Encrypt state data
    const key = Buffer.from(process.env.OAUTH_STATE_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(stateData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const state = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]).toString('base64url');

    // Store state for validation with expiration
    const stateId = crypto.createHash('sha256').update(state).digest('hex');
    this.stateStore.set(stateId, {
      state,
      stateData,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000 // 1 hour
    });

    return state;
  }

  /**
   * Validate and decode state parameter
   */
  validateSecureState(state) {
    try {
      // Check state format
      const validation = oauthSecurityValidator.validateStateParameter(state);
      if (!validation.valid) {
        throw new Error('State parameter validation failed');
      }

      // Decode state
      const stateBuffer = Buffer.from(state, 'base64url');
      if (stateBuffer.length < 32) { // IV (16) + authTag (16)
        throw new Error('Invalid state format');
      }

      const iv = stateBuffer.slice(0, 16);
      const authTag = stateBuffer.slice(16, 32);
      const encrypted = stateBuffer.slice(32);

      // Decrypt state
      const key = Buffer.from(process.env.OAUTH_STATE_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      const stateData = JSON.parse(decrypted);

      // Verify state hasn't expired
      if (Date.now() - stateData.timestamp > 3600000) {
        throw new Error('State parameter expired');
      }

      // Verify state exists in store
      const stateId = crypto.createHash('sha256').update(state).digest('hex');
      const storedState = this.stateStore.get(stateId);
      
      if (!storedState) {
        throw new Error('State not found or already used');
      }

      // Remove state from store (one-time use)
      this.stateStore.delete(stateId);

      return stateData;
    } catch (error) {
      logger.error('State validation failed:', error);
      throw new Error('Invalid or expired state parameter');
    }
  }

  /**
   * Token rotation middleware
   */
  enforceTokenRotation() {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return next();
        }

        // Check if token needs rotation
        const lastRotation = this.tokenRotationStore.get(userId);
        const now = Date.now();

        if (lastRotation && (now - lastRotation) < 300000) { // 5 minutes
          // Token was recently rotated, skip
          return next();
        }

        // Get current token
        const tokenRecord = await db('linkedin_oauth_tokens')
          .where({ user_id: userId, is_active: true })
          .first();

        if (!tokenRecord) {
          return next();
        }

        // Check token age
        const tokenAge = now - new Date(tokenRecord.created_at).getTime();
        const maxAge = 86400000 * 30; // 30 days

        if (tokenAge > maxAge) {
          // Force token refresh
          req.forceTokenRefresh = true;
          logger.info('Token rotation required', { userId, tokenAge });
        }

        // Update rotation timestamp
        this.tokenRotationStore.set(userId, now);

        next();
      } catch (error) {
        logger.error('Token rotation check failed:', error);
        next(); // Continue without rotation
      }
    };
  }

  /**
   * Add security headers for OAuth endpoints
   */
  addSecurityHeaders() {
    return (req, res, next) => {
      // Add all security headers
      Object.entries(this.securityHeaders).forEach(([header, value]) => {
        res.setHeader(header, value);
      });

      // Additional OAuth-specific headers
      res.setHeader('X-OAuth-Scopes', 'r_liteprofile r_emailaddress w_member_social');
      res.setHeader('X-OAuth-Client-Id', process.env.LINKEDIN_CLIENT_ID || 'not-configured');

      next();
    };
  }

  /**
   * Audit logging middleware for OAuth events
   */
  auditOAuthEvent(eventType) {
    return async (req, res, next) => {
      const startTime = Date.now();
      
      // Capture original end method
      const originalEnd = res.end;
      
      res.end = async function(...args) {
        // Call original end method
        originalEnd.apply(res, args);
        
        // Log audit event
        try {
          const duration = Date.now() - startTime;
          const auditData = {
            event_type: eventType,
            user_id: req.user?.id || req.pkceUserId || null,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
            request_id: req.id || crypto.randomBytes(16).toString('hex'),
            status_code: res.statusCode,
            duration,
            timestamp: new Date(),
            details: {
              method: req.method,
              path: req.path,
              query: req.query,
              headers: {
                referer: req.get('referer'),
                origin: req.get('origin')
              }
            }
          };

          // Remove sensitive data from audit log
          delete auditData.details.query.code;
          delete auditData.details.query.state;

          await db('oauth_audit_log').insert({
            event_type: auditData.event_type,
            user_id: auditData.user_id,
            ip_address: auditData.ip_address,
            user_agent: auditData.user_agent,
            request_id: auditData.request_id,
            status_code: auditData.status_code,
            duration: auditData.duration,
            details: JSON.stringify(auditData.details)
          });

          logger.info('OAuth audit event', auditData);
        } catch (error) {
          logger.error('Failed to log OAuth audit event:', error);
        }
      };

      next();
    };
  }

  /**
   * Rate limiting for OAuth endpoints
   */
  oauthRateLimit() {
    const attempts = new Map();

    return (req, res, next) => {
      const key = `${req.ip}:${req.path}`;
      const now = Date.now();
      const limit = 10; // 10 attempts per minute
      const window = 60000; // 1 minute

      // Get attempts for this key
      const userAttempts = attempts.get(key) || [];
      
      // Filter out old attempts
      const recentAttempts = userAttempts.filter(timestamp => 
        now - timestamp < window
      );

      if (recentAttempts.length >= limit) {
        logger.warn('OAuth rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          attempts: recentAttempts.length
        });
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((recentAttempts[0] + window - now) / 1000)
        });
      }

      // Add current attempt
      recentAttempts.push(now);
      attempts.set(key, recentAttempts);

      next();
    };
  }

  /**
   * Clean up expired entries from stores
   */
  cleanupExpiredEntries() {
    const now = Date.now();

    // Clean PKCE store
    for (const [id, data] of this.pkceStore.entries()) {
      if (data.expiresAt < now) {
        this.pkceStore.delete(id);
      }
    }

    // Clean state store
    for (const [id, data] of this.stateStore.entries()) {
      if (data.expiresAt < now) {
        this.stateStore.delete(id);
      }
    }

    // Clean old rotation timestamps
    for (const [userId, timestamp] of this.tokenRotationStore.entries()) {
      if (now - timestamp > 86400000) { // 24 hours
        this.tokenRotationStore.delete(userId);
      }
    }

    logger.debug('Cleaned up expired OAuth entries', {
      pkceStoreSize: this.pkceStore.size,
      stateStoreSize: this.stateStore.size,
      rotationStoreSize: this.tokenRotationStore.size
    });
  }
}

module.exports = new OAuthSecurityMiddleware();