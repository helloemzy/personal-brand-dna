const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { getRedis } = require('../config/database');
const logger = require('../utils/logger');

// Fallback to memory if Redis is not available
let rateLimiter;
let authRateLimiter;
let contentRateLimiter;
let voiceRateLimiter;

const initializeRateLimiters = () => {
  try {
    const redisClient = getRedis();
    
    // General API rate limiter (100 requests per 15 minutes)
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'general_rate_limit',
      points: 100, // Number of requests
      duration: 900, // 15 minutes
      blockDuration: 900, // Block for 15 minutes
      execEvenly: true, // Distribute requests evenly across duration
    });

    // Authentication rate limiter (5 attempts per 15 minutes)
    authRateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'auth_rate_limit',
      points: 5,
      duration: 900, // 15 minutes
      blockDuration: 1800, // Block for 30 minutes
    });

    // Content generation rate limiter (20 requests per hour)
    contentRateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'content_rate_limit',
      points: 20,
      duration: 3600, // 1 hour
      blockDuration: 3600, // Block for 1 hour
    });

    // Voice analysis rate limiter (3 requests per hour)
    voiceRateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'voice_rate_limit',
      points: 3,
      duration: 3600, // 1 hour
      blockDuration: 3600, // Block for 1 hour
    });

    logger.info('✅ Rate limiters initialized with Redis');
  } catch (error) {
    logger.warn('⚠️ Redis not available, falling back to memory rate limiters');
    
    // Fallback to memory-based rate limiters
    rateLimiter = new RateLimiterMemory({
      points: 100,
      duration: 900,
      blockDuration: 900,
    });

    authRateLimiter = new RateLimiterMemory({
      points: 5,
      duration: 900,
      blockDuration: 1800,
    });

    contentRateLimiter = new RateLimiterMemory({
      points: 20,
      duration: 3600,
      blockDuration: 3600,
    });

    voiceRateLimiter = new RateLimiterMemory({
      points: 3,
      duration: 3600,
      blockDuration: 3600,
    });
  }
};

// Initialize rate limiters
initializeRateLimiters();

// Helper function to get client identifier
const getClientId = (req) => {
  // Use user ID if authenticated, otherwise use IP address
  return req.user?.id || req.ip || req.connection.remoteAddress;
};

// Helper function to handle rate limit exceeded
const handleRateLimitExceeded = (rateLimiterRes, req, res) => {
  const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
  
  // Log security event
  logger.logSecurityEvent('rate_limit_exceeded', {
    clientId: getClientId(req),
    endpoint: req.originalUrl,
    remainingPoints: rateLimiterRes.remainingPoints,
    msBeforeNext: rateLimiterRes.msBeforeNext
  }, req);

  res.set('Retry-After', String(secs));
  res.status(429).json({
    status: 'error',
    message: 'Too many requests, please try again later',
    retryAfter: secs,
    timestamp: new Date().toISOString()
  });
};

// General rate limiter middleware
const generalRateLimit = async (req, res, next) => {
  try {
    const clientId = getClientId(req);
    await rateLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes.remainingPoints !== undefined) {
      handleRateLimitExceeded(rateLimiterRes, req, res);
    } else {
      logger.error('Rate limiter error:', rateLimiterRes);
      next(); // Continue if rate limiter fails
    }
  }
};

// Authentication rate limiter middleware
const authRateLimit = async (req, res, next) => {
  try {
    const clientId = getClientId(req);
    await authRateLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes.remainingPoints !== undefined) {
      handleRateLimitExceeded(rateLimiterRes, req, res);
    } else {
      logger.error('Auth rate limiter error:', rateLimiterRes);
      next();
    }
  }
};

// Content generation rate limiter middleware
const contentRateLimit = async (req, res, next) => {
  try {
    const clientId = getClientId(req);
    
    // Check user's subscription tier for different limits
    let points = 20; // Default limit
    if (req.user?.subscription_tier === 'free') {
      points = 3; // Free tier gets 3 per hour
    } else if (req.user?.subscription_tier === 'professional') {
      points = 50; // Professional gets 50 per hour
    } else if (req.user?.subscription_tier === 'executive') {
      points = 200; // Executive gets 200 per hour
    } else if (req.user?.subscription_tier === 'enterprise') {
      points = 1000; // Enterprise gets 1000 per hour
    }

    // Create custom rate limiter for this user if needed
    let userContentLimiter = contentRateLimiter;
    if (req.user?.subscription_tier !== 'professional') {
      try {
        const redisClient = getRedis();
        userContentLimiter = new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: `content_rate_limit_${req.user?.subscription_tier || 'free'}`,
          points,
          duration: 3600,
          blockDuration: 3600,
        });
      } catch (error) {
        userContentLimiter = new RateLimiterMemory({
          points,
          duration: 3600,
          blockDuration: 3600,
        });
      }
    }

    await userContentLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes.remainingPoints !== undefined) {
      handleRateLimitExceeded(rateLimiterRes, req, res);
    } else {
      logger.error('Content rate limiter error:', rateLimiterRes);
      next();
    }
  }
};

// Voice analysis rate limiter middleware
const voiceRateLimit = async (req, res, next) => {
  try {
    const clientId = getClientId(req);
    
    // Adjust limits based on subscription tier
    let points = 3;
    if (req.user?.subscription_tier === 'professional') {
      points = 10;
    } else if (req.user?.subscription_tier === 'executive') {
      points = 25;
    } else if (req.user?.subscription_tier === 'enterprise') {
      points = 100;
    }

    let userVoiceLimiter = voiceRateLimiter;
    if (req.user?.subscription_tier !== 'free') {
      try {
        const redisClient = getRedis();
        userVoiceLimiter = new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: `voice_rate_limit_${req.user?.subscription_tier}`,
          points,
          duration: 3600,
          blockDuration: 3600,
        });
      } catch (error) {
        userVoiceLimiter = new RateLimiterMemory({
          points,
          duration: 3600,
          blockDuration: 3600,
        });
      }
    }

    await userVoiceLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes.remainingPoints !== undefined) {
      handleRateLimitExceeded(rateLimiterRes, req, res);
    } else {
      logger.error('Voice rate limiter error:', rateLimiterRes);
      next();
    }
  }
};

// Admin endpoints - more restrictive
const adminRateLimit = async (req, res, next) => {
  try {
    const adminLimiter = new RateLimiterMemory({
      points: 10, // 10 requests
      duration: 60, // per minute
      blockDuration: 300, // block for 5 minutes
    });

    const clientId = getClientId(req);
    await adminLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes.remainingPoints !== undefined) {
      handleRateLimitExceeded(rateLimiterRes, req, res);
    } else {
      next();
    }
  }
};

module.exports = {
  rateLimiter: generalRateLimit,
  authRateLimit,
  contentRateLimit,
  voiceRateLimit,
  adminRateLimit
};