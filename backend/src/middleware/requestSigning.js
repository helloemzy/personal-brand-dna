const crypto = require('crypto');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Configuration
const SIGNATURE_HEADER = 'x-signature';
const TIMESTAMP_HEADER = 'x-timestamp';
const SIGNATURE_WINDOW = 5 * 60 * 1000; // 5 minutes
const REPLAY_PREVENTION_CACHE = new Map(); // In production, use Redis

// Generate signature for a request
const generateSignature = (method, path, timestamp, body, secret) => {
  const payload = [
    method.toUpperCase(),
    path,
    timestamp,
    body ? JSON.stringify(body) : ''
  ].join('\n');
  
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
};

// Middleware to verify request signatures
const verifyRequestSignature = (options = {}) => {
  const {
    secret = process.env.API_SIGNING_SECRET,
    required = true,
    paths = [] // Optional: specific paths that require signing
  } = options;

  return async (req, res, next) => {
    // Skip if signing is not required for this path
    if (paths.length > 0 && !paths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip if not required and no signature present
    const signature = req.headers[SIGNATURE_HEADER];
    const timestamp = req.headers[TIMESTAMP_HEADER];
    
    if (!required && !signature) {
      return next();
    }

    // Validate required headers
    if (!signature || !timestamp) {
      logger.logSecurityEvent('missing_signature_headers', {
        path: req.path,
        method: req.method,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp
      }, req);
      
      return next(new AppError('Missing required security headers', 401));
    }

    try {
      // Validate timestamp to prevent replay attacks
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      
      if (isNaN(requestTime)) {
        return next(new AppError('Invalid timestamp format', 401));
      }
      
      if (Math.abs(now - requestTime) > SIGNATURE_WINDOW) {
        logger.logSecurityEvent('signature_timestamp_expired', {
          path: req.path,
          method: req.method,
          timestamp: requestTime,
          drift: Math.abs(now - requestTime)
        }, req);
        
        return next(new AppError('Request timestamp too old or too far in future', 401));
      }

      // Check for replay attacks
      const requestId = `${req.method}:${req.path}:${timestamp}:${signature}`;
      if (REPLAY_PREVENTION_CACHE.has(requestId)) {
        logger.logSecurityEvent('replay_attack_detected', {
          path: req.path,
          method: req.method,
          timestamp: requestTime
        }, req);
        
        return next(new AppError('Duplicate request detected', 401));
      }

      // Calculate expected signature
      const expectedSignature = generateSignature(
        req.method,
        req.originalUrl || req.url,
        timestamp,
        req.body,
        secret
      );

      // Constant-time comparison to prevent timing attacks
      const signatureValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!signatureValid) {
        logger.logSecurityEvent('invalid_signature', {
          path: req.path,
          method: req.method,
          timestamp: requestTime
        }, req);
        
        return next(new AppError('Invalid request signature', 401));
      }

      // Store request ID to prevent replay
      REPLAY_PREVENTION_CACHE.set(requestId, true);
      
      // Clean up old entries periodically (in production, use Redis with TTL)
      if (REPLAY_PREVENTION_CACHE.size > 10000) {
        const cutoff = now - SIGNATURE_WINDOW;
        for (const [key, _] of REPLAY_PREVENTION_CACHE) {
          const keyTimestamp = parseInt(key.split(':')[2]);
          if (keyTimestamp < cutoff) {
            REPLAY_PREVENTION_CACHE.delete(key);
          }
        }
      }

      // Attach signature metadata to request
      req.signatureMetadata = {
        timestamp: requestTime,
        verified: true
      };

      next();
    } catch (error) {
      logger.error('Request signature verification error:', error);
      next(new AppError('Request signature verification failed', 500));
    }
  };
};

// Helper middleware for critical endpoints
const requireSignedRequest = verifyRequestSignature({ required: true });

// Helper middleware for optional signing
const optionalSignedRequest = verifyRequestSignature({ required: false });

// Client-side helper to sign requests
const signRequest = (method, path, body, secret) => {
  const timestamp = Date.now().toString();
  const signature = generateSignature(method, path, timestamp, body, secret);
  
  return {
    [SIGNATURE_HEADER]: signature,
    [TIMESTAMP_HEADER]: timestamp
  };
};

module.exports = {
  verifyRequestSignature,
  requireSignedRequest,
  optionalSignedRequest,
  signRequest,
  generateSignature
};