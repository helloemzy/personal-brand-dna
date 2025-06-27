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

    // Check LinkedIn connection status
    const result = await query(
      `SELECT 
        linkedin_user_id,
        linkedin_name,
        expires_at,
        is_active,
        created_at,
        updated_at
      FROM linkedin_oauth_tokens
      WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          message: 'No LinkedIn account connected'
        }
      });
    }

    const token = result.rows[0];
    const isExpired = new Date(token.expires_at) < new Date();

    // Get rate limit status
    const rateLimitResult = await query(
      `SELECT 
        daily_posts,
        hourly_posts,
        weekly_posts,
        monthly_posts,
        last_post_at,
        reset_daily_at,
        reset_hourly_at,
        reset_weekly_at,
        reset_monthly_at
      FROM linkedin_rate_limits
      WHERE user_id = $1`,
      [userId]
    );

    const rateLimit = rateLimitResult.rows[0] || {
      daily_posts: 0,
      hourly_posts: 0,
      weekly_posts: 0,
      monthly_posts: 0
    };

    res.status(200).json({
      success: true,
      data: {
        connected: !isExpired,
        linkedinUserId: token.linkedin_user_id,
        linkedinName: token.linkedin_name,
        expiresAt: token.expires_at,
        connectedAt: token.created_at,
        lastUpdated: token.updated_at,
        isExpired,
        rateLimit: {
          daily: {
            used: rateLimit.daily_posts,
            limit: 10,
            remaining: Math.max(0, 10 - rateLimit.daily_posts),
            resetsAt: rateLimit.reset_daily_at
          },
          hourly: {
            used: rateLimit.hourly_posts,
            limit: 3,
            remaining: Math.max(0, 3 - rateLimit.hourly_posts),
            resetsAt: rateLimit.reset_hourly_at
          },
          weekly: {
            used: rateLimit.weekly_posts,
            limit: 50,
            remaining: Math.max(0, 50 - rateLimit.weekly_posts),
            resetsAt: rateLimit.reset_weekly_at
          },
          monthly: {
            used: rateLimit.monthly_posts,
            limit: 150,
            remaining: Math.max(0, 150 - rateLimit.monthly_posts),
            resetsAt: rateLimit.reset_monthly_at
          },
          lastPostAt: rateLimit.last_post_at
        }
      }
    });
  } catch (error) {
    console.error('Error checking LinkedIn status:', error);
    errorHandler(error, res);
  }
};