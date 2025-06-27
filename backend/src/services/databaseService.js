/**
 * Database Service Layer
 * Provides optimized database operations with caching, batching, and query optimization
 */

const databasePool = require('../config/database-pool');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.batchQueue = new Map(); // For batching operations
    this.batchTimeout = null;
    this.batchDelay = 10; // milliseconds
  }

  // ==================== Core Query Methods ====================

  /**
   * Execute a single query with optional caching
   */
  async query(text, params, options = {}) {
    return databasePool.query(text, params, options);
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    return databasePool.withConnection(async (client) => {
      await client.query('BEGIN');
      try {
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
      }
    });
  }

  /**
   * Execute queries in batch for better performance
   */
  async batchQuery(queries) {
    return databasePool.batchQuery(queries);
  }

  // ==================== User Authentication Optimizations ====================

  /**
   * Optimized user lookup by email with caching
   */
  async getUserByEmail(email) {
    const query = `
      SELECT u.*, vp.id as voice_profile_id, vp.is_active as voice_profile_active
      FROM users u
      LEFT JOIN voice_profiles vp ON u.id = vp.user_id AND vp.is_active = true
      WHERE u.email = $1
    `;
    
    const result = await this.query(query, [email], {
      cached: true,
      cacheTTL: 300, // 5 minutes
      prepared: true
    });

    return result.rows[0] || null;
  }

  /**
   * Batch user lookup for multiple emails
   */
  async getUsersByEmails(emails) {
    const query = `
      SELECT u.*, vp.id as voice_profile_id
      FROM users u
      LEFT JOIN voice_profiles vp ON u.id = vp.user_id AND vp.is_active = true
      WHERE u.email = ANY($1::text[])
    `;
    
    const result = await this.query(query, [emails]);
    return result.rows;
  }

  /**
   * Update user login timestamp efficiently
   */
  async updateUserLastLogin(userId) {
    // Use batch queue for non-critical updates
    this._addToBatchQueue('user_login_updates', {
      userId,
      timestamp: new Date()
    });
  }

  // ==================== Workshop Session Optimizations ====================

  /**
   * Get active workshop session with all related data
   */
  async getActiveWorkshopSession(userId) {
    const query = `
      WITH session_data AS (
        SELECT * FROM workshop_sessions 
        WHERE user_id = $1 AND status = 'in_progress'
        ORDER BY created_at DESC
        LIMIT 1
      )
      SELECT 
        s.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'value_name', wv.value_name,
            'is_core', wv.is_core,
            'rank', wv.rank
          )) FILTER (WHERE wv.id IS NOT NULL), 
          '[]'::json
        ) as values,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'dimension', wtp.dimension,
            'score', wtp.score
          )) FILTER (WHERE wtp.id IS NOT NULL),
          '[]'::json
        ) as tone_preferences,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'persona_name', wap.persona_name,
            'industry', wap.industry,
            'is_primary', wap.is_primary
          )) FILTER (WHERE wap.id IS NOT NULL),
          '[]'::json
        ) as audience_personas
      FROM session_data s
      LEFT JOIN workshop_values wv ON s.id = wv.session_id
      LEFT JOIN workshop_tone_preferences wtp ON s.id = wtp.session_id
      LEFT JOIN workshop_audience_personas wap ON s.id = wap.session_id
      GROUP BY s.id, s.user_id, s.status, s.current_step, s.progress_data, 
               s.created_at, s.updated_at, s.completed_at
    `;

    const result = await this.query(query, [userId], {
      cached: true,
      cacheTTL: 60 // 1 minute cache for active sessions
    });

    return result.rows[0] || null;
  }

  /**
   * Save workshop session data efficiently
   */
  async saveWorkshopSession(sessionId, updates) {
    const updateFields = [];
    const values = [sessionId];
    let paramCount = 1;

    Object.entries(updates).forEach(([field, value]) => {
      paramCount++;
      updateFields.push(`${field} = $${paramCount}`);
      values.push(value);
    });

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    const query = `
      UPDATE workshop_sessions
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    // Invalidate cache for this user
    await this._invalidateUserWorkshopCache(sessionId);

    return this.query(query, values);
  }

  // ==================== News Article Optimizations ====================

  /**
   * Get relevant news articles with optimized scoring
   */
  async getRelevantNewsArticles(userId, limit = 20, minScore = 0.7) {
    const query = `
      WITH user_pillars AS (
        SELECT pillar_name, keywords, priority
        FROM content_pillars
        WHERE user_id = $1 AND is_active = true
      ),
      scored_articles AS (
        SELECT 
          na.*,
          nc.categories,
          GREATEST(
            na.relevance_score,
            -- Boost score if matches user's content pillars
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM user_pillars up
                WHERE na.content @@ plainto_tsquery('english', up.keywords)
              ) THEN na.relevance_score * 1.2
              ELSE na.relevance_score
            END
          ) as final_score
        FROM news_articles na
        LEFT JOIN LATERAL (
          SELECT array_agg(category) as categories
          FROM news_article_categories
          WHERE article_id = na.id
        ) nc ON true
        WHERE na.user_id = $1
          AND na.relevance_score >= $3
          AND na.published_at > NOW() - INTERVAL '7 days'
      )
      SELECT * FROM scored_articles
      WHERE final_score >= $3
      ORDER BY final_score DESC, published_at DESC
      LIMIT $2
    `;

    const result = await this.query(query, [userId, limit, minScore], {
      cached: true,
      cacheTTL: 300 // 5 minutes
    });

    return result.rows;
  }

  /**
   * Batch update article read status
   */
  async markArticlesAsRead(articleIds) {
    if (articleIds.length === 0) return;

    const query = `
      UPDATE news_articles
      SET is_read = true, read_at = NOW()
      WHERE id = ANY($1::uuid[])
    `;

    return this.query(query, [articleIds]);
  }

  // ==================== Calendar Event Optimizations ====================

  /**
   * Get calendar events for a date range with efficient loading
   */
  async getCalendarEvents(userId, startDate, endDate) {
    const query = `
      WITH events AS (
        SELECT 
          ce.*,
          cg.content,
          cg.content_type,
          cg.template_used,
          CASE 
            WHEN crp.id IS NOT NULL THEN
              json_build_object(
                'pattern_type', crp.pattern_type,
                'interval_value', crp.interval_value,
                'days_of_week', crp.days_of_week,
                'day_of_month', crp.day_of_month
              )
            ELSE NULL
          END as recurrence_pattern
        FROM calendar_events ce
        LEFT JOIN content_generated cg ON ce.content_id = cg.id
        LEFT JOIN calendar_recurring_patterns crp ON ce.id = crp.event_id AND crp.is_active = true
        WHERE ce.user_id = $1
          AND ce.scheduled_for BETWEEN $2 AND $3
          AND ce.status != 'cancelled'
      )
      SELECT * FROM events
      ORDER BY scheduled_for ASC
    `;

    const result = await this.query(query, [userId, startDate, endDate], {
      cached: true,
      cacheTTL: 180 // 3 minutes
    });

    return result.rows;
  }

  /**
   * Batch create calendar events
   */
  async createCalendarEventsBatch(events) {
    const values = [];
    const placeholders = [];
    let paramCount = 0;

    events.forEach((event, index) => {
      const start = paramCount;
      values.push(
        event.user_id,
        event.title,
        event.description,
        event.event_type,
        event.scheduled_for,
        event.duration_minutes || 30,
        event.content_id || null,
        event.status || 'scheduled',
        event.metadata || {}
      );
      paramCount += 9;

      placeholders.push(
        `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6}, $${start + 7}, $${start + 8}, $${start + 9})`
      );
    });

    const query = `
      INSERT INTO calendar_events 
        (user_id, title, description, event_type, scheduled_for, duration_minutes, content_id, status, metadata)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    return this.query(query, values);
  }

  // ==================== LinkedIn Queue Optimizations ====================

  /**
   * Get next posts to publish from LinkedIn queue
   */
  async getLinkedInPublishQueue(limit = 10) {
    const query = `
      WITH eligible_posts AS (
        SELECT 
          lp.*,
          lot.access_token,
          lot.expires_at as token_expires_at,
          u.email,
          u.full_name
        FROM linkedin_posts lp
        INNER JOIN linkedin_oauth_tokens lot ON lp.user_id = lot.user_id
        INNER JOIN users u ON lp.user_id = u.id
        WHERE lp.status = 'scheduled'
          AND lp.scheduled_at <= NOW()
          AND lot.is_active = true
          AND lot.expires_at > NOW()
          AND (lp.next_retry_at IS NULL OR lp.next_retry_at <= NOW())
      )
      SELECT * FROM eligible_posts
      ORDER BY scheduled_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED -- Prevent concurrent processing
    `;

    const result = await this.query(query, [limit]);
    return result.rows;
  }

  /**
   * Batch update LinkedIn post statuses
   */
  async updateLinkedInPostStatuses(updates) {
    const queries = updates.map(update => ({
      text: `
        UPDATE linkedin_posts
        SET status = $2, 
            linkedin_post_id = $3,
            published_at = $4,
            error_message = $5,
            retry_count = COALESCE($6, retry_count),
            next_retry_at = $7,
            updated_at = NOW()
        WHERE id = $1
      `,
      params: [
        update.id,
        update.status,
        update.linkedin_post_id || null,
        update.published_at || null,
        update.error_message || null,
        update.retry_count,
        update.next_retry_at || null
      ]
    }));

    return this.batchQuery(queries);
  }

  // ==================== Performance Monitoring ====================

  /**
   * Get database performance statistics
   */
  async getPerformanceStats() {
    const stats = databasePool.getPoolStats();
    
    // Get additional database statistics
    const dbStats = await this.query(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_queries,
        pg_database_size(current_database()) as database_size
    `);

    return {
      pool: stats,
      database: dbStats.rows[0]
    };
  }

  // ==================== Cache Management ====================

  /**
   * Invalidate cache for specific patterns
   */
  async invalidateCache(pattern) {
    const redis = await databasePool.getRedis();
    if (!redis || !redis.isOpen) return;

    try {
      const keys = await redis.keys(`query:*${pattern}*`);
      if (keys.length > 0) {
        await redis.del(keys);
        logger.debug(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(userId) {
    const warmupQueries = [
      () => this.getUserByEmail(userId), // Assuming userId is email for this example
      () => this.getActiveWorkshopSession(userId),
      () => this.getRelevantNewsArticles(userId, 10),
      () => this.getCalendarEvents(userId, new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    ];

    await Promise.all(warmupQueries.map(q => q().catch(err => {
      logger.error('Cache warmup error:', err);
    })));
  }

  // ==================== Private Helper Methods ====================

  /**
   * Add operation to batch queue
   */
  _addToBatchQueue(operation, data) {
    if (!this.batchQueue.has(operation)) {
      this.batchQueue.set(operation, []);
    }

    this.batchQueue.get(operation).push(data);

    // Schedule batch processing
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this._processBatchQueue();
      }, this.batchDelay);
    }
  }

  /**
   * Process queued batch operations
   */
  async _processBatchQueue() {
    this.batchTimeout = null;

    for (const [operation, items] of this.batchQueue) {
      if (items.length === 0) continue;

      try {
        switch (operation) {
          case 'user_login_updates':
            await this._batchUpdateUserLogins(items);
            break;
          // Add more batch operations as needed
        }
      } catch (error) {
        logger.error(`Batch operation ${operation} failed:`, error);
      }
    }

    this.batchQueue.clear();
  }

  /**
   * Batch update user login timestamps
   */
  async _batchUpdateUserLogins(updates) {
    const userIds = updates.map(u => u.userId);
    const query = `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = ANY($1::int[])
    `;
    
    await this.query(query, [userIds]);
  }

  /**
   * Invalidate workshop session cache
   */
  async _invalidateUserWorkshopCache(sessionId) {
    const userQuery = await this.query(
      'SELECT user_id FROM workshop_sessions WHERE id = $1',
      [sessionId]
    );
    
    if (userQuery.rows.length > 0) {
      await this.invalidateCache(`workshop_${userQuery.rows[0].user_id}`);
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();