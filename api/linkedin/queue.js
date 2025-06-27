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
      // Get queued posts
      const { status = 'all', limit = 20, offset = 0 } = req.query;

      let queryText = `
        SELECT 
          lpq.id,
          lpq.content_text,
          lpq.media_urls,
          lpq.status,
          lpq.scheduled_for,
          lpq.approval_notes,
          lpq.rejection_reason,
          lpq.safety_check_results,
          lpq.created_at,
          lpq.updated_at,
          gc.id as content_id,
          gc.content_type,
          gc.topic
        FROM linkedin_publishing_queue lpq
        LEFT JOIN generated_content gc ON lpq.content_id = gc.id
        WHERE lpq.user_id = $1
      `;

      const queryParams = [userId];

      if (status !== 'all') {
        queryText += ` AND lpq.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      queryText += ` ORDER BY lpq.scheduled_for ASC, lpq.created_at DESC
                     LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      
      queryParams.push(limit, offset);

      const result = await query(queryText, queryParams);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM linkedin_publishing_queue WHERE user_id = $1';
      const countParams = [userId];
      
      if (status !== 'all') {
        countQuery += ' AND status = $2';
        countParams.push(status);
      }

      const countResult = await query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.status(200).json({
        success: true,
        data: {
          queue: result.rows,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < totalCount
          }
        }
      });

    } else if (req.method === 'POST') {
      // Add to queue
      const { 
        contentId, 
        contentText, 
        mediaUrls = [], 
        scheduledFor = null 
      } = req.body;

      if (!contentText || contentText.trim().length === 0) {
        return res.status(400).json({ error: 'Content text is required' });
      }

      // Perform safety checks
      const safetyResults = performSafetyChecks(contentText);
      
      if (!safetyResults.passed) {
        return res.status(400).json({ 
          error: 'Content failed safety checks',
          safetyResults 
        });
      }

      const queueItem = await withTransaction(async (client) => {
        // Check rate limits
        const rateLimitCheck = await checkRateLimits(client, userId);
        if (!rateLimitCheck.allowed) {
          throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
        }

        // Check for duplicate content in last 7 days
        const duplicateCheck = await client.query(
          `SELECT id FROM linkedin_publishing_queue 
           WHERE user_id = $1 
           AND content_text = $2 
           AND created_at > NOW() - INTERVAL '7 days'
           AND status != 'rejected'`,
          [userId, contentText]
        );

        if (duplicateCheck.rows.length > 0) {
          throw new Error('Duplicate content detected. This content was already posted in the last 7 days.');
        }

        // Add to queue
        const result = await client.query(
          `INSERT INTO linkedin_publishing_queue 
           (user_id, content_id, content_text, media_urls, status, scheduled_for, safety_check_results)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6)
           RETURNING *`,
          [userId, contentId, contentText, JSON.stringify(mediaUrls), scheduledFor, JSON.stringify(safetyResults)]
        );

        // Log to compliance
        await client.query(
          `INSERT INTO linkedin_compliance_log 
           (user_id, action, details, ip_address, user_agent)
           VALUES ($1, 'content_queued', $2, $3, $4)`,
          [userId, JSON.stringify({ queueId: result.rows[0].id }), req.headers['x-forwarded-for'] || req.socket.remoteAddress, req.headers['user-agent']]
        );

        return result.rows[0];
      });

      res.status(201).json({
        success: true,
        data: queueItem,
        message: 'Content added to publishing queue. Manual approval required before publishing.'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error managing LinkedIn queue:', error);
    errorHandler(error, res);
  }
};

// Safety check functions
function performSafetyChecks(content) {
  const results = {
    passed: true,
    checks: {
      length: { passed: true },
      hashtags: { passed: true },
      urls: { passed: true },
      profanity: { passed: true },
      spam: { passed: true },
      sensitive: { passed: true }
    },
    warnings: []
  };

  // Length check (LinkedIn limit is 3000 characters)
  if (content.length > 3000) {
    results.checks.length.passed = false;
    results.checks.length.message = `Content is ${content.length} characters (max 3000)`;
    results.passed = false;
  }

  // Hashtag check (max 30)
  const hashtags = content.match(/#\w+/g) || [];
  if (hashtags.length > 30) {
    results.checks.hashtags.passed = false;
    results.checks.hashtags.message = `Too many hashtags: ${hashtags.length} (max 30)`;
    results.passed = false;
  }

  // URL check (max 10)
  const urls = content.match(/https?:\/\/[^\s]+/g) || [];
  if (urls.length > 10) {
    results.checks.urls.passed = false;
    results.checks.urls.message = `Too many URLs: ${urls.length} (max 10)`;
    results.passed = false;
  }

  // Sensitive information check
  const sensitivePatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{16}\b/, // Credit card
    /\bpassword\s*[:=]\s*\S+/i, // Passwords
    /\b(api[_-]?key|secret[_-]?key)\s*[:=]\s*\S+/i // API keys
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(content)) {
      results.checks.sensitive.passed = false;
      results.checks.sensitive.message = 'Sensitive information detected';
      results.passed = false;
      break;
    }
  }

  // Add warnings for best practices
  if (hashtags.length === 0) {
    results.warnings.push('Consider adding hashtags for better reach');
  }
  if (content.length < 100) {
    results.warnings.push('Content might be too short for good engagement');
  }

  return results;
}

// Rate limit checking
async function checkRateLimits(client, userId) {
  const now = new Date();
  
  // Get or create rate limit record
  const result = await client.query(
    `INSERT INTO linkedin_rate_limits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [userId]
  );

  const limits = result.rows[0];

  // Check minimum interval (30 minutes)
  if (limits.last_post_at) {
    const minutesSinceLastPost = (now - new Date(limits.last_post_at)) / 1000 / 60;
    if (minutesSinceLastPost < 30) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(30 - minutesSinceLastPost)} more minutes before posting again`
      };
    }
  }

  // Check hourly limit
  if (limits.hourly_posts >= 3) {
    return { allowed: false, reason: 'Hourly limit reached (3 posts)' };
  }

  // Check daily limit
  if (limits.daily_posts >= 10) {
    return { allowed: false, reason: 'Daily limit reached (10 posts)' };
  }

  // Check weekly limit
  if (limits.weekly_posts >= 50) {
    return { allowed: false, reason: 'Weekly limit reached (50 posts)' };
  }

  // Check monthly limit
  if (limits.monthly_posts >= 150) {
    return { allowed: false, reason: 'Monthly limit reached (150 posts)' };
  }

  return { allowed: true };
}