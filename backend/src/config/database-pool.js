/**
 * Database Connection Pooling Configuration
 * Optimized for serverless environments (Vercel, AWS Lambda, etc.)
 */

const { Pool } = require('pg');
const { createClient } = require('redis');
const logger = require('../utils/logger');

// Connection pool singleton
let pgPool = null;
let redisClient = null;

// Serverless-optimized pool configuration
const SERVERLESS_PG_CONFIG = {
  // Connection pool settings
  max: 3, // Lower max connections for serverless
  min: 0, // Allow pool to shrink to 0
  idleTimeoutMillis: 10000, // 10 seconds (aggressive cleanup)
  connectionTimeoutMillis: 3000, // 3 seconds timeout
  
  // Connection reuse
  allowExitOnIdle: true, // Allow process to exit when idle
  
  // Query timeout
  query_timeout: 30000, // 30 seconds
  statement_timeout: 30000, // 30 seconds
  
  // Keep-alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // SSL configuration
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    // Additional SSL options for production
  } : false
};

// Standard server pool configuration
const STANDARD_PG_CONFIG = {
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 60000,
  statement_timeout: 60000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

// Redis configuration for serverless
const SERVERLESS_REDIS_CONFIG = {
  socket: {
    connectTimeout: 3000,
    keepAlive: 5000,
    noDelay: true
  },
  reconnectStrategy: (retries) => {
    if (retries > 3) {
      logger.error('Redis connection failed after 3 retries');
      return false; // Stop retrying
    }
    return Math.min(retries * 100, 3000);
  }
};

class DatabasePool {
  constructor() {
    this.isServerless = this._detectServerlessEnvironment();
    this.connections = new Map(); // Track active connections
    this.queryCache = new Map(); // Simple in-memory cache
    this.preparedStatements = new Map(); // Prepared statement cache
  }

  _detectServerlessEnvironment() {
    return !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.SERVERLESS ||
      process.env.NETLIFY
    );
  }

  async getPool() {
    if (!pgPool) {
      const config = {
        connectionString: process.env.DATABASE_URL,
        ...(this.isServerless ? SERVERLESS_PG_CONFIG : STANDARD_PG_CONFIG)
      };

      pgPool = new Pool(config);

      // Set up event handlers
      pgPool.on('error', (err, client) => {
        logger.error('Unexpected error on idle client', err);
      });

      pgPool.on('connect', (client) => {
        logger.debug('New client connected to pool');
        // Set runtime parameters for each new connection
        client.query('SET statement_timeout = 30000');
        client.query('SET lock_timeout = 10000');
        client.query('SET idle_in_transaction_session_timeout = 60000');
      });

      pgPool.on('acquire', (client) => {
        const clientId = client.processID;
        this.connections.set(clientId, {
          acquiredAt: Date.now(),
          queryCount: 0
        });
      });

      pgPool.on('remove', (client) => {
        const clientId = client.processID;
        this.connections.delete(clientId);
      });

      // Test connection
      try {
        const client = await pgPool.connect();
        await client.query('SELECT 1');
        client.release();
        logger.info(`✅ PostgreSQL pool initialized (${this.isServerless ? 'serverless' : 'standard'} mode)`);
      } catch (error) {
        logger.error('Failed to initialize PostgreSQL pool:', error);
        pgPool = null;
        throw error;
      }
    }

    return pgPool;
  }

  async getRedis() {
    if (!redisClient || !redisClient.isOpen) {
      try {
        redisClient = createClient({
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          ...(this.isServerless ? SERVERLESS_REDIS_CONFIG : {})
        });

        redisClient.on('error', (err) => {
          logger.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
          logger.info(`✅ Redis connected (${this.isServerless ? 'serverless' : 'standard'} mode)`);
        });

        await redisClient.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        redisClient = null;
        // Don't throw - Redis is optional for caching
      }
    }

    return redisClient;
  }

  // Optimized query method with caching
  async query(text, params, options = {}) {
    const { 
      cached = false, 
      cacheTTL = 300, // 5 minutes default
      prepared = false // Use prepared statements
    } = options;

    // Generate cache key
    const cacheKey = cached ? this._generateCacheKey(text, params) : null;

    // Check cache first
    if (cached && cacheKey) {
      const cachedResult = await this._getFromCache(cacheKey);
      if (cachedResult) {
        logger.debug(`Cache hit for query: ${text.substring(0, 50)}...`);
        return cachedResult;
      }
    }

    const pool = await this.getPool();
    const start = Date.now();
    
    try {
      let result;
      
      if (prepared && !this.isServerless) {
        // Use prepared statements for better performance (not in serverless)
        result = await this._executePrepared(pool, text, params);
      } else {
        // Regular query execution
        result = await pool.query(text, params);
      }

      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 100) {
        logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
      }

      // Cache the result if requested
      if (cached && cacheKey) {
        await this._setCache(cacheKey, result, cacheTTL);
      }

      // Update connection stats
      this._updateQueryStats(duration);

      return result;
    } catch (error) {
      logger.error(`Query error: ${error.message}`);
      logger.error(`Query: ${text}`);
      logger.error(`Params: ${JSON.stringify(params)}`);
      throw error;
    }
  }

  // Batch query operations
  async batchQuery(queries) {
    const pool = await this.getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const { text, params } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Connection reuse for multiple queries
  async withConnection(callback) {
    const pool = await this.getPool();
    const client = await pool.connect();
    
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  // Prepared statement optimization
  async _executePrepared(pool, text, params) {
    const statementName = `stmt_${this._hashQuery(text)}`;
    
    if (!this.preparedStatements.has(statementName)) {
      // Prepare the statement
      await pool.query({
        text: `PREPARE ${statementName} AS ${text}`,
        values: []
      });
      this.preparedStatements.set(statementName, true);
    }

    // Execute prepared statement
    return await pool.query({
      text: `EXECUTE ${statementName}`,
      values: params
    });
  }

  // Cache helpers
  async _getFromCache(key) {
    try {
      // Try Redis first
      const redis = await this.getRedis();
      if (redis && redis.isOpen) {
        const cached = await redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      }
      
      // Fallback to in-memory cache
      const memCached = this.queryCache.get(key);
      if (memCached && memCached.expires > Date.now()) {
        return memCached.data;
      }
      
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async _setCache(key, data, ttl) {
    try {
      // Try Redis first
      const redis = await this.getRedis();
      if (redis && redis.isOpen) {
        await redis.setEx(key, ttl, JSON.stringify(data));
      }
      
      // Also set in-memory cache (with size limit)
      if (this.queryCache.size > 1000) {
        // Evict oldest entries
        const oldestKey = this.queryCache.keys().next().value;
        this.queryCache.delete(oldestKey);
      }
      
      this.queryCache.set(key, {
        data,
        expires: Date.now() + (ttl * 1000)
      });
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  _generateCacheKey(query, params) {
    const paramStr = JSON.stringify(params || []);
    return `query:${this._hashQuery(query + paramStr)}`;
  }

  _hashQuery(query) {
    // Simple hash function for query identification
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  _updateQueryStats(duration) {
    // Update connection statistics
    for (const [clientId, stats] of this.connections) {
      if (stats.acquiredAt + 60000 < Date.now()) {
        // Connection held for too long
        logger.warn(`Connection ${clientId} held for over 60 seconds`);
      }
      stats.queryCount++;
    }
  }

  // Get pool statistics
  getPoolStats() {
    if (!pgPool) {
      return null;
    }

    return {
      total: pgPool.totalCount,
      idle: pgPool.idleCount,
      waiting: pgPool.waitingCount,
      active: this.connections.size,
      cacheSize: this.queryCache.size,
      preparedStatements: this.preparedStatements.size,
      isServerless: this.isServerless
    };
  }

  // Cleanup for serverless
  async cleanup() {
    logger.info('Cleaning up database connections...');
    
    // Clear caches
    this.queryCache.clear();
    this.preparedStatements.clear();
    this.connections.clear();
    
    // Close Redis
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
    }
    
    // Close PostgreSQL pool
    if (pgPool) {
      await pgPool.end();
      pgPool = null;
    }
  }

  // Serverless-specific optimization: warm connection
  async warmConnection() {
    if (this.isServerless) {
      try {
        const pool = await this.getPool();
        await pool.query('SELECT 1');
        logger.debug('Connection warmed successfully');
      } catch (error) {
        logger.error('Failed to warm connection:', error);
      }
    }
  }
}

// Export singleton instance
const databasePool = new DatabasePool();

// Cleanup on process termination
process.on('SIGINT', () => databasePool.cleanup());
process.on('SIGTERM', () => databasePool.cleanup());

// For serverless, cleanup after each invocation
if (databasePool.isServerless) {
  process.on('beforeExit', () => {
    databasePool.cleanup().catch(console.error);
  });
}

module.exports = databasePool;