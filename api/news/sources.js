const { withTransaction, query } = require('../_lib/database');
const { errorHandler } = require('../_lib/errorHandler');
const { authenticateToken } = require('../_lib/auth');

module.exports = async (req, res) => {
  try {
    // Authenticate user
    const authResult = await authenticateToken(req);
    if (!authResult.success) {
      return res.status(401).json({ error: authResult.message });
    }

    const userId = authResult.userId;

    if (req.method === 'GET') {
      // Get user's news sources
      const result = await query(
        `SELECT 
          id,
          source_name,
          source_url,
          source_type,
          categories,
          is_active,
          last_fetched_at,
          fetch_frequency_hours,
          created_at
        FROM news_sources
        WHERE user_id = $1
        ORDER BY source_name ASC`,
        [userId]
      );

      res.status(200).json({
        success: true,
        data: result.rows
      });

    } else if (req.method === 'POST') {
      // Add a new news source
      const { 
        sourceName, 
        sourceUrl, 
        sourceType = 'rss',
        categories = [],
        fetchFrequency = 6
      } = req.body;

      if (!sourceName || !sourceUrl) {
        return res.status(400).json({ error: 'Source name and URL are required' });
      }

      // Validate URL
      try {
        new URL(sourceUrl);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid source URL' });
      }

      const newSource = await withTransaction(async (client) => {
        // Check if source already exists for user
        const existing = await client.query(
          'SELECT id FROM news_sources WHERE user_id = $1 AND source_url = $2',
          [userId, sourceUrl]
        );

        if (existing.rows.length > 0) {
          throw new Error('This news source is already added');
        }

        // Add the source
        const result = await client.query(
          `INSERT INTO news_sources 
           (user_id, source_name, source_url, source_type, categories, fetch_frequency_hours, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING *`,
          [userId, sourceName, sourceUrl, sourceType, JSON.stringify(categories), fetchFrequency]
        );

        return result.rows[0];
      });

      res.status(201).json({
        success: true,
        data: newSource,
        message: 'News source added successfully'
      });

    } else if (req.method === 'DELETE') {
      // Delete a news source
      const { sourceId } = req.query;

      if (!sourceId) {
        return res.status(400).json({ error: 'Source ID is required' });
      }

      await query(
        'DELETE FROM news_sources WHERE id = $1 AND user_id = $2',
        [sourceId, userId]
      );

      res.status(200).json({
        success: true,
        message: 'News source removed successfully'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error managing news sources:', error);
    errorHandler(error, res);
  }
};