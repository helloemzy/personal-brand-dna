const { Pool } = require('pg');
const { createClient } = require('redis');
const logger = require('../utils/logger');

// PostgreSQL connection
let pool;

const connectDB = async () => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('✅ PostgreSQL connected successfully');
  } catch (error) {
    logger.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
};

const getDB = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return pool;
};

// Redis connection
let redisClient;

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('🟢 Redis ready');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

const getRedis = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis first.');
  }
  return redisClient;
};

// Database query helper
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    }
    
    return res;
  } catch (error) {
    logger.error(`Database query error: ${error.message}`);
    logger.error(`Query: ${text}`);
    logger.error(`Params: ${JSON.stringify(params)}`);
    throw error;
  }
};

// Transaction helper
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Cache helpers
const cache = {
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key, value, expirationInSeconds = 3600) {
    try {
      await redisClient.setEx(key, expirationInSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  },

  async del(key) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  },

  async exists(key) {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  async expire(key, seconds) {
    try {
      await redisClient.expire(key, seconds);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
    }
  }
};

// Graceful shutdown
const closeConnections = async () => {
  try {
    if (pool) {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    }
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};

process.on('SIGINT', closeConnections);
process.on('SIGTERM', closeConnections);

module.exports = {
  connectDB,
  getDB,
  connectRedis,
  getRedis,
  query,
  withTransaction,
  cache,
  closeConnections
};