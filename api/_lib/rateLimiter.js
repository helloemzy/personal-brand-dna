const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('redis');

let redisClient;
let rateLimiters = {};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });
    
    if (!redisClient.isOpen) {
      redisClient.connect();
    }
  }
  return redisClient;
};

const createRateLimiter = (keyPrefix, options) => {
  if (!rateLimiters[keyPrefix]) {
    const redis = getRedisClient();
    rateLimiters[keyPrefix] = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix,
      ...options,
    });
  }
  return rateLimiters[keyPrefix];
};

// Authentication rate limiter - 5 attempts per 15 minutes
const authRateLimit = async (req, res, next) => {
  try {
    const limiter = createRateLimiter('auth', {
      points: 5,
      duration: 900, // 15 minutes
    });

    const key = req.ip || 'unknown';
    await limiter.consume(key);
    next();
  } catch (rejRes) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000);
    return res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: remainingTime,
    });
  }
};

// API rate limiter - 100 requests per hour
const apiRateLimit = async (req, res, next) => {
  try {
    const limiter = createRateLimiter('api', {
      points: 100,
      duration: 3600, // 1 hour
    });

    const key = req.user?.id || req.ip || 'unknown';
    await limiter.consume(key);
    next();
  } catch (rejRes) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000);
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: remainingTime,
    });
  }
};

// Content generation rate limiter - 20 requests per hour
const contentRateLimit = async (req, res, next) => {
  try {
    const limiter = createRateLimiter('content', {
      points: 20,
      duration: 3600, // 1 hour
    });

    const key = req.user?.id || req.ip || 'unknown';
    await limiter.consume(key);
    next();
  } catch (rejRes) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000);
    return res.status(429).json({
      success: false,
      message: 'Content generation limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: remainingTime,
    });
  }
};

module.exports = {
  authRateLimit,
  apiRateLimit,
  contentRateLimit,
};