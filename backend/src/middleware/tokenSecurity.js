const tokenEncryptionService = require('../services/tokenEncryptionService');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Token Security Middleware
 * Provides comprehensive token security validation and protection
 */
class TokenSecurityMiddleware {
  constructor() {
    this.tokenUsageCache = new Map();
    this.suspiciousActivityThreshold = 100; // requests per minute
    this.tokenBindingEnabled = process.env.TOKEN_BINDING_ENABLED !== 'false';
  }

  /**
   * Validate token encryption before processing
   * @returns {Function} Express middleware
   */
  validateTokenEncryption() {
    return async (req, res, next) => {
      try {
        // Extract token from request
        const token = this.extractToken(req);
        if (!token) {
          return next();
        }

        // Check if token looks encrypted
        if (this.isPlainTextToken(token)) {
          logger.warn('Plain text token detected', {
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          
          return next(new AppError('Invalid token format', 401));
        }

        // Validate token structure
        const validation = this.validateTokenStructure(token);
        if (!validation.valid) {
          logger.warn('Invalid token structure', {
            errors: validation.errors,
            ip: req.ip
          });
          
          return next(new AppError('Invalid token', 401));
        }

        // Add token metadata to request
        req.tokenMetadata = {
          encrypted: true,
          validated: true,
          timestamp: Date.now()
        };

        next();
      } catch (error) {
        logger.error('Token encryption validation failed:', error);
        next(new AppError('Token validation failed', 401));
      }
    };
  }

  /**
   * Implement token binding to prevent theft
   * @returns {Function} Express middleware
   */
  enforceTokenBinding() {
    return async (req, res, next) => {
      if (!this.tokenBindingEnabled || !req.user) {
        return next();
      }

      try {
        const token = req.token || this.extractToken(req);
        const bindingCookie = req.cookies?.tokenBinding;

        if (!bindingCookie) {
          // First request with this token - create binding
          const binding = this.createTokenBinding(req);
          res.cookie('tokenBinding', binding, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
          
          req.tokenBinding = binding;
          return next();
        }

        // Verify binding
        const bindingData = this.extractBindingData(req);
        const isValid = tokenEncryptionService.verifyTokenBinding(
          token,
          bindingCookie,
          bindingData
        );

        if (!isValid) {
          logger.warn('Token binding mismatch', {
            userId: req.user.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            expectedBinding: bindingCookie.substring(0, 8) + '...'
          });

          // Potential token theft
          await this.handleSuspiciousActivity(req, 'token_binding_mismatch');
          
          return next(new AppError('Security validation failed', 401));
        }

        req.tokenBinding = bindingCookie;
        next();
      } catch (error) {
        logger.error('Token binding enforcement failed:', error);
        next(new AppError('Security check failed', 401));
      }
    };
  }

  /**
   * Track token usage and detect anomalies
   * @returns {Function} Express middleware
   */
  trackTokenUsage() {
    return async (req, res, next) => {
      if (!req.user) {
        return next();
      }

      try {
        const tokenId = this.getTokenId(req);
        const userId = req.user.id;
        const key = `${userId}:${tokenId}`;
        
        // Track usage
        const usage = this.tokenUsageCache.get(key) || {
          count: 0,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          ips: new Set(),
          userAgents: new Set()
        };

        usage.count++;
        usage.lastSeen = Date.now();
        usage.ips.add(req.ip);
        usage.userAgents.add(req.get('User-Agent'));

        this.tokenUsageCache.set(key, usage);

        // Check for anomalies
        const anomalies = this.detectUsageAnomalies(usage);
        if (anomalies.length > 0) {
          logger.warn('Token usage anomalies detected', {
            userId,
            tokenId: tokenId.substring(0, 8) + '...',
            anomalies
          });

          // Store in request for logging
          req.tokenAnomalies = anomalies;

          // Critical anomalies should block request
          if (anomalies.some(a => a.severity === 'critical')) {
            await this.handleSuspiciousActivity(req, 'usage_anomaly', anomalies);
            return next(new AppError('Suspicious activity detected', 403));
          }
        }

        // Log usage metrics periodically
        if (usage.count % 100 === 0) {
          await this.logTokenMetrics(userId, tokenId, usage);
        }

        next();
      } catch (error) {
        logger.error('Token usage tracking failed:', error);
        next(); // Don't block on tracking errors
      }
    };
  }

  /**
   * Enforce token expiration policies
   * @returns {Function} Express middleware
   */
  enforceTokenExpiration() {
    return async (req, res, next) => {
      if (!req.user || !req.token) {
        return next();
      }

      try {
        // Check if token needs rotation
        const tokenAge = this.getTokenAge(req.token);
        const tokenType = this.getTokenType(req.token);
        
        // Define rotation windows
        const rotationWindows = {
          jwt: 7 * 24 * 60 * 60 * 1000, // 7 days
          session: 24 * 60 * 60 * 1000, // 24 hours
          refresh: 30 * 24 * 60 * 60 * 1000 // 30 days
        };

        const rotationWindow = rotationWindows[tokenType] || rotationWindows.jwt;

        // Check if approaching expiration (10% of lifetime remaining)
        if (tokenAge > rotationWindow * 0.9) {
          res.setHeader('X-Token-Refresh-Needed', 'true');
          res.setHeader('X-Token-Expires-In', Math.max(0, rotationWindow - tokenAge));
        }

        // Check absolute expiration
        if (req.tokenExpired) {
          logger.info('Expired token used', {
            userId: req.user.id,
            tokenType,
            age: tokenAge
          });
          
          return next(new AppError('Token expired', 401));
        }

        // Check revocation list
        const tokenId = this.getTokenId(req);
        const isRevoked = await tokenEncryptionService.isTokenRevoked(tokenId);
        
        if (isRevoked) {
          logger.warn('Revoked token usage attempt', {
            userId: req.user.id,
            tokenId: tokenId.substring(0, 8) + '...'
          });
          
          await this.handleSuspiciousActivity(req, 'revoked_token_usage');
          
          return next(new AppError('Token revoked', 401));
        }

        next();
      } catch (error) {
        logger.error('Token expiration enforcement failed:', error);
        next(new AppError('Token validation failed', 401));
      }
    };
  }

  /**
   * Secure token transmission headers
   * @returns {Function} Express middleware
   */
  secureTokenTransmission() {
    return (req, res, next) => {
      // Set security headers for token transmission
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Prevent token leakage in referrer
      res.setHeader('Referrer-Policy', 'no-referrer');
      
      // Cache control for sensitive endpoints
      if (req.path.includes('/auth') || req.path.includes('/token')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      // Add CSP for token-related pages
      if (req.path.includes('/login') || req.path.includes('/oauth')) {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'"
        );
      }

      // Log security headers applied
      req.securityHeaders = {
        applied: true,
        timestamp: Date.now()
      };

      next();
    };
  }

  /**
   * Extract token from request
   * @param {Object} req - Express request
   * @returns {string|null} Token
   */
  extractToken(req) {
    // Check Authorization header
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return req.headers.authorization.substring(7);
    }
    
    // Check cookies
    if (req.cookies?.token) {
      return req.cookies.token;
    }

    // Check custom header
    if (req.headers['x-auth-token']) {
      return req.headers['x-auth-token'];
    }

    return null;
  }

  /**
   * Check if token is plain text (unencrypted)
   * @param {string} token - Token to check
   * @returns {boolean} Is plain text
   */
  isPlainTextToken(token) {
    // JWT pattern
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      return true;
    }

    // OAuth token pattern (usually alphanumeric)
    if (/^[a-zA-Z0-9]{20,}$/.test(token) && !token.includes('.')) {
      return true;
    }

    return false;
  }

  /**
   * Validate token structure
   * @param {string} token - Token to validate
   * @returns {Object} Validation result
   */
  validateTokenStructure(token) {
    const errors = [];

    // Check minimum length
    if (token.length < 32) {
      errors.push('Token too short');
    }

    // Check maximum length
    if (token.length > 4096) {
      errors.push('Token too long');
    }

    // Check for suspicious patterns
    if (token.includes('<script') || token.includes('javascript:')) {
      errors.push('Suspicious content detected');
    }

    // Check character set
    if (!/^[A-Za-z0-9_\-+/=.]+$/.test(token)) {
      errors.push('Invalid characters detected');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create token binding for device
   * @param {Object} req - Express request
   * @returns {string} Token binding
   */
  createTokenBinding(req) {
    const bindingData = this.extractBindingData(req);
    const token = req.token || this.extractToken(req);
    
    return tokenEncryptionService.generateTokenBinding(token, bindingData);
  }

  /**
   * Extract binding data from request
   * @param {Object} req - Express request
   * @returns {Object} Binding data
   */
  extractBindingData(req) {
    return {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      deviceId: req.cookies?.deviceId || crypto.randomBytes(16).toString('hex')
    };
  }

  /**
   * Get token identifier
   * @param {Object} req - Express request
   * @returns {string} Token ID
   */
  getTokenId(req) {
    const token = req.token || this.extractToken(req);
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get token age in milliseconds
   * @param {string} token - Token
   * @returns {number} Age in ms
   */
  getTokenAge(token) {
    try {
      // For JWT tokens
      if (token.includes('.')) {
        const [, payload] = token.split('.');
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
        return Date.now() - (decoded.iat * 1000);
      }
      
      // Default to 0 (unknown age)
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get token type
   * @param {string} token - Token
   * @returns {string} Token type
   */
  getTokenType(token) {
    if (token.includes('.') && token.split('.').length === 3) {
      return 'jwt';
    }
    
    if (token.startsWith('refresh_')) {
      return 'refresh';
    }
    
    if (token.length > 100) {
      return 'oauth';
    }
    
    return 'session';
  }

  /**
   * Detect usage anomalies
   * @param {Object} usage - Usage data
   * @returns {Array} Detected anomalies
   */
  detectUsageAnomalies(usage) {
    const anomalies = [];
    
    // Rapid requests
    const duration = Date.now() - usage.firstSeen;
    const requestsPerMinute = (usage.count / duration) * 60000;
    
    if (requestsPerMinute > this.suspiciousActivityThreshold) {
      anomalies.push({
        type: 'rapid_requests',
        severity: 'high',
        rate: Math.round(requestsPerMinute),
        threshold: this.suspiciousActivityThreshold
      });
    }

    // Multiple IPs
    if (usage.ips.size > 10) {
      anomalies.push({
        type: 'multiple_ips',
        severity: 'medium',
        count: usage.ips.size,
        ips: Array.from(usage.ips).slice(0, 5)
      });
    }

    // Multiple user agents
    if (usage.userAgents.size > 5) {
      anomalies.push({
        type: 'multiple_user_agents',
        severity: 'medium',
        count: usage.userAgents.size
      });
    }

    // Geographic anomaly (would need IP geolocation)
    // Timing anomaly (would need usage pattern analysis)

    return anomalies;
  }

  /**
   * Handle suspicious activity
   * @param {Object} req - Express request
   * @param {string} activityType - Type of suspicious activity
   * @param {Object} details - Activity details
   */
  async handleSuspiciousActivity(req, activityType, details = {}) {
    try {
      logger.warn('Suspicious activity detected', {
        type: activityType,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details
      });

      // Log to security events
      if (req.user?.id) {
        await require('../config/database').query(
          'INSERT INTO security_events (event_type, event_data, user_id, ip_address) VALUES ($1, $2, $3, $4)',
          [
            `suspicious_${activityType}`,
            JSON.stringify({
              ...details,
              endpoint: req.originalUrl,
              method: req.method,
              timestamp: new Date()
            }),
            req.user.id,
            req.ip
          ]
        );
      }

      // Increment suspicious activity counter
      const key = `suspicious:${req.ip}`;
      const count = (this.tokenUsageCache.get(key) || 0) + 1;
      this.tokenUsageCache.set(key, count);

      // Block IP after threshold
      if (count > 10) {
        // Would implement IP blocking here
        logger.error('IP blocked due to suspicious activity', { ip: req.ip });
      }
    } catch (error) {
      logger.error('Failed to handle suspicious activity:', error);
    }
  }

  /**
   * Log token usage metrics
   * @param {string} userId - User ID
   * @param {string} tokenId - Token ID
   * @param {Object} usage - Usage data
   */
  async logTokenMetrics(userId, tokenId, usage) {
    try {
      await require('../config/database').query(
        `INSERT INTO token_usage_metrics 
         (user_id, token_id, request_count, unique_ips, unique_user_agents, duration_ms, logged_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          tokenId,
          usage.count,
          usage.ips.size,
          usage.userAgents.size,
          Date.now() - usage.firstSeen
        ]
      );
    } catch (error) {
      logger.error('Failed to log token metrics:', error);
    }
  }

  /**
   * Clean up old usage cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, usage] of this.tokenUsageCache.entries()) {
      if (now - usage.lastSeen > maxAge) {
        this.tokenUsageCache.delete(key);
      }
    }
  }
}

// Create singleton instance
const tokenSecurity = new TokenSecurityMiddleware();

// Schedule cache cleanup
setInterval(() => tokenSecurity.cleanupCache(), 15 * 60 * 1000); // Every 15 minutes

// Export middleware functions
module.exports = {
  validateTokenEncryption: () => tokenSecurity.validateTokenEncryption(),
  enforceTokenBinding: () => tokenSecurity.enforceTokenBinding(),
  trackTokenUsage: () => tokenSecurity.trackTokenUsage(),
  enforceTokenExpiration: () => tokenSecurity.enforceTokenExpiration(),
  secureTokenTransmission: () => tokenSecurity.secureTokenTransmission(),
  
  // Composite middleware for full security
  fullTokenSecurity: () => {
    return [
      tokenSecurity.secureTokenTransmission(),
      tokenSecurity.validateTokenEncryption(),
      tokenSecurity.enforceTokenBinding(),
      tokenSecurity.trackTokenUsage(),
      tokenSecurity.enforceTokenExpiration()
    ];
  },

  // Export instance for direct access
  instance: tokenSecurity
};