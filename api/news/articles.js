const { query } = require('../_lib/database');
const { errorHandler } = require('../_lib/errorHandler');
const { authenticateToken } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const authResult = await authenticateToken(req);
    if (!authResult.success) {
      return res.status(401).json({ error: authResult.message });
    }

    const userId = authResult.userId;
    const { 
      sourceId,
      category,
      minRelevance = 0,
      saved,
      used,
      limit = 50,
      offset = 0,
      sortBy = 'relevance'
    } = req.query;

    // Build query
    let queryText = `
      SELECT 
        na.id,
        na.source_id,
        ns.source_name,
        na.title,
        na.description,
        na.content_snippet,
        na.article_url,
        na.author,
        na.published_at,
        na.categories,
        na.relevance_score,
        na.relevance_factors,
        uia.is_saved,
        uia.is_used,
        uia.user_notes,
        uia.saved_at,
        uia.used_at
      FROM news_articles na
      INNER JOIN news_sources ns ON na.source_id = ns.id
      LEFT JOIN user_article_interactions uia ON na.id = uia.article_id AND uia.user_id = $1
      WHERE ns.user_id = $1
    `;

    const queryParams = [userId];

    // Apply filters
    if (sourceId) {
      queryText += ` AND na.source_id = $${queryParams.length + 1}`;
      queryParams.push(sourceId);
    }

    if (category) {
      queryText += ` AND na.categories @> $${queryParams.length + 1}::jsonb`;
      queryParams.push(JSON.stringify([category]));
    }

    if (minRelevance > 0) {
      queryText += ` AND na.relevance_score >= $${queryParams.length + 1}`;
      queryParams.push(minRelevance);
    }

    if (saved === 'true') {
      queryText += ` AND uia.is_saved = true`;
    }

    if (used === 'true') {
      queryText += ` AND uia.is_used = true`;
    }

    // Apply sorting
    switch (sortBy) {
      case 'date':
        queryText += ` ORDER BY na.published_at DESC`;
        break;
      case 'relevance':
      default:
        queryText += ` ORDER BY na.relevance_score DESC, na.published_at DESC`;
        break;
    }

    queryText += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    // Get articles
    const result = await query(queryText, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM news_articles na
      INNER JOIN news_sources ns ON na.source_id = ns.id
      LEFT JOIN user_article_interactions uia ON na.id = uia.article_id AND uia.user_id = $1
      WHERE ns.user_id = $1
    `;
    const countParams = [userId];

    if (sourceId) {
      countQuery += ` AND na.source_id = $${countParams.length + 1}`;
      countParams.push(sourceId);
    }

    if (category) {
      countQuery += ` AND na.categories @> $${countParams.length + 1}::jsonb`;
      countParams.push(JSON.stringify([category]));
    }

    if (minRelevance > 0) {
      countQuery += ` AND na.relevance_score >= $${countParams.length + 1}`;
      countParams.push(minRelevance);
    }

    if (saved === 'true') {
      countQuery += ` AND uia.is_saved = true`;
    }

    if (used === 'true') {
      countQuery += ` AND uia.is_used = true`;
    }

    const countResult = await query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get relevance score distribution
    const statsResult = await query(
      `SELECT 
        AVG(na.relevance_score) as avg_relevance,
        MAX(na.relevance_score) as max_relevance,
        COUNT(CASE WHEN na.relevance_score >= 0.7 THEN 1 END) as high_relevance_count,
        COUNT(CASE WHEN uia.is_saved = true THEN 1 END) as saved_count,
        COUNT(CASE WHEN uia.is_used = true THEN 1 END) as used_count
      FROM news_articles na
      INNER JOIN news_sources ns ON na.source_id = ns.id
      LEFT JOIN user_article_interactions uia ON na.id = uia.article_id AND uia.user_id = $1
      WHERE ns.user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

    res.status(200).json({
      success: true,
      data: {
        articles: result.rows.map(article => ({
          ...article,
          relevanceScore: parseFloat(article.relevance_score),
          relevanceLevel: getRelevanceLevel(parseFloat(article.relevance_score))
        })),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < totalCount
        },
        stats: {
          avgRelevance: parseFloat(stats.avg_relevance || 0),
          maxRelevance: parseFloat(stats.max_relevance || 0),
          highRelevanceCount: parseInt(stats.high_relevance_count || 0),
          savedCount: parseInt(stats.saved_count || 0),
          usedCount: parseInt(stats.used_count || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching news articles:', error);
    errorHandler(error, res);
  }
};

function getRelevanceLevel(score) {
  if (score >= 0.8) return 'very_high';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  if (score >= 0.2) return 'low';
  return 'very_low';
}