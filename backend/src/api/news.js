const express = require('express');
const router = express.Router();
const { query, withTransaction, cache } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { parseFeed, discoverFeeds } = require('../services/feedParserService');
const { calculateArticleRelevance, generateContentIdeas } = require('../services/newsRelevanceService');
const logger = require('../utils/logger');

// Validation schemas
const newsSchemas = {
  addSource: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        feedUrl: { type: 'string', format: 'uri' },
        feedType: { type: 'string', enum: ['rss', 'atom', 'json'] },
        category: { type: 'string', maxLength: 100 }
      },
      required: ['name', 'feedUrl']
    }
  },
  updatePreferences: {
    body: {
      type: 'object',
      properties: {
        keywords: { type: 'array', items: { type: 'string' } },
        excludedKeywords: { type: 'array', items: { type: 'string' } },
        preferredSources: { type: 'array', items: { type: 'string' } },
        minimumRelevanceScore: { type: 'number', minimum: 0, maximum: 1 },
        notificationFrequency: { 
          type: 'string', 
          enum: ['realtime', 'hourly', 'daily', 'weekly', 'never'] 
        },
        ideaGenerationEnabled: { type: 'boolean' },
        autoSaveHighRelevance: { type: 'boolean' },
        relevanceThresholdForAutoSave: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  }
};

// Add news source
router.post('/sources', authenticateToken, validateRequest(newsSchemas.addSource), async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, feedUrl, feedType = 'rss', category } = req.body;

    // Test feed URL
    try {
      await parseFeed(feedUrl, feedType);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid feed URL: ${error.message}` 
      });
    }

    // Add source to database
    const result = await query(
      `INSERT INTO news_sources (user_id, name, feed_url, feed_type, category) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, feed_url) 
       DO UPDATE SET name = $2, category = $4, updated_at = NOW()
       RETURNING *`,
      [userId, name, feedUrl, feedType, category]
    );

    res.json({
      success: true,
      source: result.rows[0]
    });
  } catch (error) {
    logger.error('Error adding news source:', error);
    res.status(500).json({ success: false, error: 'Failed to add news source' });
  }
});

// Get user's news sources
router.get('/sources', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT ns.*, 
        COUNT(DISTINCT na.id) as total_articles,
        MAX(na.published_at) as latest_article_date,
        nfh.fetch_status as last_fetch_status,
        nfh.fetch_completed_at as last_fetch_date
       FROM news_sources ns
       LEFT JOIN news_articles na ON ns.id = na.source_id
       LEFT JOIN LATERAL (
         SELECT fetch_status, fetch_completed_at 
         FROM news_fetch_history 
         WHERE source_id = ns.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) nfh ON true
       WHERE ns.user_id = $1
       GROUP BY ns.id, nfh.fetch_status, nfh.fetch_completed_at
       ORDER BY ns.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      sources: result.rows
    });
  } catch (error) {
    logger.error('Error getting news sources:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve news sources' });
  }
});

// Delete news source
router.delete('/sources/:sourceId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sourceId } = req.params;

    await query(
      'DELETE FROM news_sources WHERE id = $1 AND user_id = $2',
      [sourceId, userId]
    );

    res.json({
      success: true,
      message: 'News source deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting news source:', error);
    res.status(500).json({ success: false, error: 'Failed to delete news source' });
  }
});

// Discover feeds from website
router.post('/discover', authenticateToken, async (req, res) => {
  try {
    const { websiteUrl } = req.body;

    if (!websiteUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Website URL is required' 
      });
    }

    const feeds = await discoverFeeds(websiteUrl);

    res.json({
      success: true,
      feeds
    });
  } catch (error) {
    logger.error('Error discovering feeds:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to discover feeds from website' 
    });
  }
});

// Get news articles with relevance scores
router.get('/articles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      minRelevance = 0.5,
      sourceId,
      category,
      featured
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let queryText = `
      SELECT 
        na.*,
        ns.name as source_name,
        ns.category as source_category,
        ars.relevance_score,
        ars.content_pillar_matches,
        ars.is_featured,
        uai.interaction_type as user_interaction
      FROM news_articles na
      INNER JOIN news_sources ns ON na.source_id = ns.id
      LEFT JOIN article_relevance_scores ars ON na.id = ars.article_id AND ars.user_id = $1
      LEFT JOIN LATERAL (
        SELECT interaction_type 
        FROM user_article_interactions 
        WHERE article_id = na.id AND user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      ) uai ON true
      WHERE ns.user_id = $1
        AND (ars.relevance_score >= $2 OR ars.relevance_score IS NULL)
    `;

    const params = [userId, minRelevance];
    let paramIndex = 3;

    if (sourceId) {
      queryText += ` AND ns.id = $${paramIndex}`;
      params.push(sourceId);
      paramIndex++;
    }

    if (category) {
      queryText += ` AND ns.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (featured === 'true') {
      queryText += ' AND ars.is_featured = true';
    }

    queryText += `
      ORDER BY 
        CASE WHEN ars.is_featured THEN 0 ELSE 1 END,
        ars.relevance_score DESC NULLS LAST,
        na.published_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await query(queryText, params);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM news_articles na INNER JOIN news_sources ns ON na.source_id = ns.id WHERE ns.user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      articles: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting news articles:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve news articles' });
  }
});

// Save article interaction
router.post('/articles/:articleId/interact', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { articleId } = req.params;
    const { interactionType, interactionData = {} } = req.body;

    const validTypes = ['view', 'save', 'dismiss', 'use_idea', 'share'];
    if (!validTypes.includes(interactionType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid interaction type' 
      });
    }

    await query(
      `INSERT INTO user_article_interactions 
       (user_id, article_id, interaction_type, interaction_data) 
       VALUES ($1, $2, $3, $4)`,
      [userId, articleId, interactionType, interactionData]
    );

    res.json({
      success: true,
      message: 'Interaction recorded'
    });
  } catch (error) {
    logger.error('Error saving article interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to save interaction' });
  }
});

// Generate content ideas from article
router.post('/articles/:articleId/generate-ideas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { articleId } = req.params;

    // Get article data
    const articleResult = await query(
      `SELECT na.* FROM news_articles na
       INNER JOIN news_sources ns ON na.source_id = ns.id
       WHERE na.id = $1 AND ns.user_id = $2`,
      [articleId, userId]
    );

    if (articleResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Article not found' 
      });
    }

    const article = articleResult.rows[0];

    // Get user's brand profile
    const profileResult = await query(
      `SELECT 
        war.brand_voice_profile,
        war.content_pillars,
        ws.id as session_id
       FROM workshop_analysis_results war
       INNER JOIN workshop_sessions ws ON war.session_id = ws.id
       WHERE war.user_id = $1
       ORDER BY war.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please complete the brand workshop first' 
      });
    }

    const userProfile = {
      userId,
      brandVoiceProfile: profileResult.rows[0].brand_voice_profile,
      contentPillars: profileResult.rows[0].content_pillars || [],
      audiencePersonas: [] // Would fetch from workshop data
    };

    // Generate ideas
    const ideas = await generateContentIdeas(article, userProfile);

    // Save ideas to database
    await withTransaction(async (client) => {
      for (const idea of ideas) {
        await client.query(
          `INSERT INTO content_ideas 
           (user_id, article_id, idea_type, headline, hook, outline, 
            key_points, target_audience, estimated_word_count, 
            content_format, ai_confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            userId,
            articleId,
            idea.type,
            idea.headline,
            idea.hook,
            idea.outline,
            idea.keyPoints,
            idea.targetAudience,
            idea.estimatedWordCount,
            idea.contentFormat,
            idea.aiConfidenceScore
          ]
        );
      }
    });

    res.json({
      success: true,
      ideas
    });
  } catch (error) {
    logger.error('Error generating content ideas:', error);
    res.status(500).json({ success: false, error: 'Failed to generate content ideas' });
  }
});

// Get content ideas
router.get('/ideas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'suggested', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT 
        ci.*,
        na.title as article_title,
        na.article_url as article_url
       FROM content_ideas ci
       LEFT JOIN news_articles na ON ci.article_id = na.id
       WHERE ci.user_id = $1 AND ci.status = $2
       ORDER BY ci.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, status, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM content_ideas WHERE user_id = $1 AND status = $2',
      [userId, status]
    );

    res.json({
      success: true,
      ideas: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting content ideas:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve content ideas' });
  }
});

// Update idea status
router.patch('/ideas/:ideaId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { ideaId } = req.params;
    const { status } = req.body;

    const validStatuses = ['suggested', 'saved', 'drafted', 'published', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status' 
      });
    }

    const result = await query(
      `UPDATE content_ideas 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, ideaId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Content idea not found' 
      });
    }

    res.json({
      success: true,
      idea: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating idea status:', error);
    res.status(500).json({ success: false, error: 'Failed to update idea status' });
  }
});

// Get/Update news preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM user_news_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return res.json({
        success: true,
        preferences: {
          keywords: [],
          excludedKeywords: [],
          preferredSources: [],
          minimumRelevanceScore: 0.6,
          notificationFrequency: 'daily',
          ideaGenerationEnabled: true,
          autoSaveHighRelevance: false,
          relevanceThresholdForAutoSave: 0.85
        }
      });
    }

    res.json({
      success: true,
      preferences: result.rows[0]
    });
  } catch (error) {
    logger.error('Error getting news preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve preferences' });
  }
});

router.put('/preferences', authenticateToken, validateRequest(newsSchemas.updatePreferences), async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    const result = await query(
      `INSERT INTO user_news_preferences 
       (user_id, keywords, excluded_keywords, preferred_sources, 
        minimum_relevance_score, notification_frequency, 
        idea_generation_enabled, auto_save_high_relevance, 
        relevance_threshold_for_auto_save)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         keywords = EXCLUDED.keywords,
         excluded_keywords = EXCLUDED.excluded_keywords,
         preferred_sources = EXCLUDED.preferred_sources,
         minimum_relevance_score = EXCLUDED.minimum_relevance_score,
         notification_frequency = EXCLUDED.notification_frequency,
         idea_generation_enabled = EXCLUDED.idea_generation_enabled,
         auto_save_high_relevance = EXCLUDED.auto_save_high_relevance,
         relevance_threshold_for_auto_save = EXCLUDED.relevance_threshold_for_auto_save,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        preferences.keywords || [],
        preferences.excludedKeywords || [],
        preferences.preferredSources || [],
        preferences.minimumRelevanceScore || 0.6,
        preferences.notificationFrequency || 'daily',
        preferences.ideaGenerationEnabled !== false,
        preferences.autoSaveHighRelevance || false,
        preferences.relevanceThresholdForAutoSave || 0.85
      ]
    );

    res.json({
      success: true,
      preferences: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating news preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

module.exports = router;