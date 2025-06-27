const { query, withTransaction } = require('../config/database');
const { parseFeed } = require('../services/feedParserService');
const { calculateArticleRelevance } = require('../services/newsRelevanceService');
const logger = require('../utils/logger');

/**
 * Fetch articles from all active news sources
 */
async function fetchAllActiveFeeds() {
  try {
    logger.info('Starting news fetch worker run');
    
    // Get all active sources that need fetching
    const sources = await query(
      `SELECT * FROM news_sources 
       WHERE is_active = TRUE 
       AND (last_fetched_at IS NULL OR 
            last_fetched_at < NOW() - INTERVAL '1 minute' * fetch_frequency_minutes)
       ORDER BY last_fetched_at ASC NULLS FIRST`,
      []
    );

    logger.info(`Found ${sources.rows.length} sources to fetch`);

    // Process each source
    const results = await Promise.allSettled(
      sources.rows.map(source => fetchSourceArticles(source))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.info(`News fetch completed: ${successful} successful, ${failed} failed`);
    
    return { successful, failed };
  } catch (error) {
    logger.error('Error in news fetch worker:', error);
    throw error;
  }
}

/**
 * Fetch articles from a single source
 */
async function fetchSourceArticles(source) {
  const fetchStartTime = new Date();
  
  try {
    logger.info(`Fetching articles from ${source.name} (${source.feed_url})`);
    
    // Parse the feed
    const feedData = await parseFeed(source.feed_url, source.feed_type);
    
    if (!feedData || !feedData.articles) {
      throw new Error('No articles found in feed');
    }

    const articlesFound = feedData.articles.length;
    let articlesNew = 0;
    let articlesUpdated = 0;

    await withTransaction(async (client) => {
      // Process each article
      for (const article of feedData.articles) {
        try {
          // Check if article already exists
          const existingArticle = await client.query(
            'SELECT id, title FROM news_articles WHERE source_id = $1 AND external_id = $2',
            [source.id, article.externalId]
          );

          if (existingArticle.rows.length === 0) {
            // Insert new article
            const insertResult = await client.query(
              `INSERT INTO news_articles 
               (source_id, external_id, title, summary, content, author, 
                published_at, article_url, image_url, categories, tags, raw_data)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               RETURNING id`,
              [
                source.id,
                article.externalId,
                article.title,
                article.summary,
                article.content,
                article.author,
                article.publishedAt || new Date(),
                article.articleUrl,
                article.imageUrl,
                article.categories || [],
                article.tags || [],
                article.rawData || {}
              ]
            );

            articlesNew++;

            // Calculate relevance for the user
            await calculateAndStoreRelevance(
              insertResult.rows[0].id, 
              source.user_id,
              article
            );
          } else if (existingArticle.rows[0].title !== article.title) {
            // Update existing article if title changed
            await client.query(
              `UPDATE news_articles 
               SET title = $1, summary = $2, content = $3, 
                   updated_at = NOW()
               WHERE id = $4`,
              [
                article.title,
                article.summary,
                article.content,
                existingArticle.rows[0].id
              ]
            );
            articlesUpdated++;
          }
        } catch (articleError) {
          logger.error(`Error processing article "${article.title}":`, articleError);
        }
      }

      // Update source fetch status
      await client.query(
        `UPDATE news_sources 
         SET last_fetched_at = NOW(), error_count = 0, last_error = NULL 
         WHERE id = $1`,
        [source.id]
      );

      // Log fetch history
      await client.query(
        `INSERT INTO news_fetch_history 
         (source_id, fetch_started_at, fetch_completed_at, 
          articles_found, articles_new, articles_updated, fetch_status)
         VALUES ($1, $2, NOW(), $3, $4, $5, 'success')`,
        [source.id, fetchStartTime, articlesFound, articlesNew, articlesUpdated]
      );
    });

    logger.info(`Successfully fetched ${source.name}: ${articlesNew} new, ${articlesUpdated} updated`);
    
    return {
      sourceId: source.id,
      sourceName: source.name,
      articlesFound,
      articlesNew,
      articlesUpdated,
      status: 'success'
    };
  } catch (error) {
    logger.error(`Error fetching ${source.name}:`, error);
    
    // Update error status
    await query(
      `UPDATE news_sources 
       SET error_count = error_count + 1, 
           last_error = $1,
           is_active = CASE WHEN error_count >= 4 THEN FALSE ELSE is_active END
       WHERE id = $2`,
      [error.message, source.id]
    );

    // Log failed fetch
    await query(
      `INSERT INTO news_fetch_history 
       (source_id, fetch_started_at, fetch_completed_at, 
        articles_found, fetch_status, error_message)
       VALUES ($1, $2, NOW(), 0, 'failed', $3)`,
      [source.id, fetchStartTime, error.message]
    );

    throw error;
  }
}

/**
 * Calculate and store relevance score for an article
 */
async function calculateAndStoreRelevance(articleId, userId, articleData) {
  try {
    // Get user's brand profile
    const profileResult = await query(
      `SELECT 
        war.brand_voice_profile,
        war.content_pillars,
        unp.keywords,
        unp.excluded_keywords,
        unp.auto_save_high_relevance,
        unp.relevance_threshold_for_auto_save
       FROM users u
       LEFT JOIN workshop_analysis_results war ON u.id = war.user_id
       LEFT JOIN user_news_preferences unp ON u.id = unp.user_id
       WHERE u.id = $1
       ORDER BY war.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (profileResult.rows.length === 0 || !profileResult.rows[0].brand_voice_profile) {
      // No brand profile yet, skip relevance calculation
      return;
    }

    const profile = profileResult.rows[0];
    const userProfile = {
      userId,
      brandVoiceProfile: profile.brand_voice_profile,
      contentPillars: profile.content_pillars || [],
      preferences: {
        keywords: profile.keywords || [],
        excludedKeywords: profile.excluded_keywords || []
      }
    };

    // Calculate relevance
    const relevance = await calculateArticleRelevance(
      { id: articleId, ...articleData },
      userProfile
    );

    // Store relevance score
    await query(
      `INSERT INTO article_relevance_scores 
       (article_id, user_id, relevance_score, content_pillar_matches, 
        audience_match_score, tone_match_score, topic_similarity_score, 
        scoring_metadata, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (article_id, user_id) 
       DO UPDATE SET 
         relevance_score = EXCLUDED.relevance_score,
         content_pillar_matches = EXCLUDED.content_pillar_matches,
         is_featured = EXCLUDED.is_featured,
         created_at = NOW()`,
      [
        articleId,
        userId,
        relevance.relevanceScore,
        relevance.contentPillarMatches,
        relevance.audienceMatchScore,
        relevance.toneMatchScore,
        relevance.topicSimilarityScore,
        relevance.scoringMetadata,
        relevance.isFeatured
      ]
    );

    // Auto-save if enabled and above threshold
    if (profile.auto_save_high_relevance && 
        relevance.relevanceScore >= profile.relevance_threshold_for_auto_save) {
      await query(
        `INSERT INTO user_article_interactions 
         (user_id, article_id, interaction_type, interaction_data)
         VALUES ($1, $2, 'save', $3)`,
        [userId, articleId, { autoSaved: true, relevanceScore: relevance.relevanceScore }]
      );
    }
  } catch (error) {
    logger.error(`Error calculating relevance for article ${articleId}:`, error);
  }
}

/**
 * Clean up old articles
 */
async function cleanupOldArticles(daysToKeep = 30) {
  try {
    logger.info(`Cleaning up articles older than ${daysToKeep} days`);
    
    const result = await query(
      `DELETE FROM news_articles 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       AND id NOT IN (
         SELECT DISTINCT article_id 
         FROM user_article_interactions 
         WHERE interaction_type IN ('save', 'use_idea')
       )
       RETURNING id`,
      [daysToKeep]
    );

    logger.info(`Deleted ${result.rowCount} old articles`);
    
    return result.rowCount;
  } catch (error) {
    logger.error('Error cleaning up old articles:', error);
    throw error;
  }
}

// Export functions
module.exports = {
  fetchAllActiveFeeds,
  fetchSourceArticles,
  cleanupOldArticles
};

// Run as standalone script
if (require.main === module) {
  const runWorker = async () => {
    try {
      await require('../config/database').connectDB();
      await require('../config/database').connectRedis();
      
      // Run fetch
      await fetchAllActiveFeeds();
      
      // Cleanup old articles
      await cleanupOldArticles();
      
      process.exit(0);
    } catch (error) {
      logger.error('Worker failed:', error);
      process.exit(1);
    }
  };

  runWorker();
}