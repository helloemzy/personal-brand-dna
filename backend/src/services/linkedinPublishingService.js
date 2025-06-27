const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');
const linkedinOAuthService = require('./linkedinOAuthService');

const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';
const LINKEDIN_SHARE_URL = `${LINKEDIN_API_URL}/shares`;

// Rate limiting configuration
const RATE_LIMITS = {
  post: {
    daily: 10,
    hourly: 3,
    minimumInterval: 30 * 60 * 1000, // 30 minutes in ms
    weekly: 50,
    monthly: 150
  }
};

// Content safety configuration
const SAFETY_CHECKS = {
  maxLength: 3000,
  maxHashtags: 30,
  maxMentions: 20,
  maxUrls: 10,
  profanityWords: [] // Would be loaded from external source
};

class LinkedInPublishingService {
  /**
   * Add content to publishing queue
   * @param {object} params - Publishing parameters
   * @returns {object} Queue entry
   */
  async addToQueue({ userId, contentId, postText, postType = 'text', mediaUrls = [], scheduledFor = null }) {
    // Validate content
    const safetyCheckResults = await this.performSafetyChecks(postText);
    
    if (!safetyCheckResults.passed) {
      throw new Error(`Content failed safety checks: ${safetyCheckResults.failureReasons.join(', ')}`);
    }
    
    // Check rate limits
    const rateLimitStatus = await this.checkRateLimits(userId);
    if (!rateLimitStatus.canPost) {
      throw new Error(`Rate limit exceeded: ${rateLimitStatus.reason}`);
    }
    
    // Create queue entry
    const queueEntry = await db('linkedin_publishing_queue').insert({
      user_id: userId,
      content_id: contentId,
      post_text: postText,
      post_type: postType,
      media_urls: JSON.stringify(mediaUrls),
      scheduled_for: scheduledFor,
      status: scheduledFor ? 'scheduled' : 'pending',
      approval_status: 'pending_review',
      metadata: JSON.stringify({
        characterCount: postText.length,
        hashtagCount: (postText.match(/#\w+/g) || []).length,
        urlCount: (postText.match(/https?:\/\/[^\s]+/g) || []).length
      })
    }).returning('*');
    
    // Store safety check results
    for (const [checkType, result] of Object.entries(safetyCheckResults.checks)) {
      await db('linkedin_content_safety_checks').insert({
        queue_id: queueEntry[0].id,
        check_type: checkType,
        passed: result.passed,
        details: JSON.stringify(result.details)
      });
    }
    
    // Log compliance event
    await linkedinOAuthService.logComplianceEvent(userId, 'post_submitted', {
      queueId: queueEntry[0].id,
      postType,
      scheduled: !!scheduledFor
    });
    
    return queueEntry[0];
  }

  /**
   * Perform content safety checks
   * @param {string} content - Content to check
   * @returns {object} Safety check results
   */
  async performSafetyChecks(content) {
    const results = {
      passed: true,
      failureReasons: [],
      checks: {}
    };
    
    // Length check
    results.checks.content_length = {
      passed: content.length <= SAFETY_CHECKS.maxLength,
      details: { length: content.length, maxLength: SAFETY_CHECKS.maxLength }
    };
    
    if (!results.checks.content_length.passed) {
      results.passed = false;
      results.failureReasons.push('Content exceeds maximum length');
    }
    
    // Hashtag limit check
    const hashtags = content.match(/#\w+/g) || [];
    results.checks.hashtag_limit = {
      passed: hashtags.length <= SAFETY_CHECKS.maxHashtags,
      details: { count: hashtags.length, maxCount: SAFETY_CHECKS.maxHashtags, hashtags }
    };
    
    if (!results.checks.hashtag_limit.passed) {
      results.passed = false;
      results.failureReasons.push('Too many hashtags');
    }
    
    // URL safety check
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    results.checks.url_safety = {
      passed: urls.length <= SAFETY_CHECKS.maxUrls,
      details: { count: urls.length, maxCount: SAFETY_CHECKS.maxUrls, urls }
    };
    
    if (!results.checks.url_safety.passed) {
      results.passed = false;
      results.failureReasons.push('Too many URLs');
    }
    
    // Profanity check (simplified)
    results.checks.profanity = {
      passed: true, // Would implement actual profanity checking
      details: { clean: true }
    };
    
    // Duplicate content check
    const isDuplicate = await this.checkDuplicateContent(content);
    results.checks.duplicate = {
      passed: !isDuplicate,
      details: { isDuplicate }
    };
    
    if (isDuplicate) {
      results.passed = false;
      results.failureReasons.push('Duplicate content detected');
    }
    
    // Sensitive information check
    const hasSensitiveInfo = this.checkSensitiveInformation(content);
    results.checks.sensitive_info = {
      passed: !hasSensitiveInfo,
      details: { hasSensitiveInfo }
    };
    
    if (hasSensitiveInfo) {
      results.passed = false;
      results.failureReasons.push('Contains potentially sensitive information');
    }
    
    return results;
  }

  /**
   * Check for duplicate content
   * @param {string} content - Content to check
   * @returns {boolean} Is duplicate
   */
  async checkDuplicateContent(content) {
    const recentPosts = await db('linkedin_publishing_queue')
      .where('post_text', content)
      .andWhere('created_at', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .first();
    
    return !!recentPosts;
  }

  /**
   * Check for sensitive information
   * @param {string} content - Content to check
   * @returns {boolean} Has sensitive info
   */
  checkSensitiveInformation(content) {
    // Simple patterns for demonstration
    const sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b\d{16}\b/, // Credit card pattern
      /password\s*[:=]\s*\S+/i, // Password pattern
      /api[_-]?key\s*[:=]\s*\S+/i // API key pattern
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check rate limits for user
   * @param {string} userId - User ID
   * @returns {object} Rate limit status
   */
  async checkRateLimits(userId) {
    const now = new Date();
    const checks = [];
    
    // Check daily limit
    const dailyCount = await db('linkedin_rate_limits')
      .where({ user_id: userId, action_type: 'post' })
      .andWhere('window_start', '>=', new Date(now - 24 * 60 * 60 * 1000))
      .sum('count as total')
      .first();
    
    if (dailyCount.total >= RATE_LIMITS.post.daily) {
      return { canPost: false, reason: 'Daily posting limit reached' };
    }
    
    // Check hourly limit
    const hourlyCount = await db('linkedin_rate_limits')
      .where({ user_id: userId, action_type: 'post' })
      .andWhere('window_start', '>=', new Date(now - 60 * 60 * 1000))
      .sum('count as total')
      .first();
    
    if (hourlyCount.total >= RATE_LIMITS.post.hourly) {
      return { canPost: false, reason: 'Hourly posting limit reached' };
    }
    
    // Check minimum interval
    const lastPost = await db('linkedin_publishing_queue')
      .where({ user_id: userId, status: 'published' })
      .orderBy('published_at', 'desc')
      .first();
    
    if (lastPost && (now - new Date(lastPost.published_at)) < RATE_LIMITS.post.minimumInterval) {
      const waitTime = Math.ceil((RATE_LIMITS.post.minimumInterval - (now - new Date(lastPost.published_at))) / 60000);
      return { canPost: false, reason: `Please wait ${waitTime} minutes before posting again` };
    }
    
    return { canPost: true, reason: null };
  }

  /**
   * Approve content for publishing
   * @param {string} queueId - Queue entry ID
   * @param {string} approverId - User ID of approver
   * @returns {object} Updated queue entry
   */
  async approveContent(queueId, approverId) {
    const queueEntry = await db('linkedin_publishing_queue')
      .where({ id: queueId })
      .first();
    
    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }
    
    if (queueEntry.approval_status !== 'pending_review') {
      throw new Error('Content has already been reviewed');
    }
    
    const updated = await db('linkedin_publishing_queue')
      .where({ id: queueId })
      .update({
        approval_status: 'approved',
        approved_by: approverId,
        approved_at: new Date(),
        status: queueEntry.scheduled_for ? 'scheduled' : 'approved'
      })
      .returning('*');
    
    // Log compliance event
    await linkedinOAuthService.logComplianceEvent(queueEntry.user_id, 'post_approved', {
      queueId,
      approverId
    });
    
    return updated[0];
  }

  /**
   * Reject content
   * @param {string} queueId - Queue entry ID
   * @param {string} approverId - User ID of approver
   * @param {string} reason - Rejection reason
   * @returns {object} Updated queue entry
   */
  async rejectContent(queueId, approverId, reason) {
    const queueEntry = await db('linkedin_publishing_queue')
      .where({ id: queueId })
      .first();
    
    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }
    
    const updated = await db('linkedin_publishing_queue')
      .where({ id: queueId })
      .update({
        approval_status: 'rejected',
        approved_by: approverId,
        approved_at: new Date(),
        rejection_reason: reason,
        status: 'rejected'
      })
      .returning('*');
    
    // Log compliance event
    await linkedinOAuthService.logComplianceEvent(queueEntry.user_id, 'post_rejected', {
      queueId,
      approverId,
      reason
    });
    
    return updated[0];
  }

  /**
   * Publish approved content to LinkedIn
   * @param {string} queueId - Queue entry ID
   * @returns {object} Publishing result
   */
  async publishContent(queueId) {
    const queueEntry = await db('linkedin_publishing_queue')
      .where({ id: queueId })
      .first();
    
    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }
    
    if (queueEntry.approval_status !== 'approved') {
      throw new Error('Content must be approved before publishing');
    }
    
    if (queueEntry.status === 'published') {
      throw new Error('Content has already been published');
    }
    
    // Check rate limits again
    const rateLimitStatus = await this.checkRateLimits(queueEntry.user_id);
    if (!rateLimitStatus.canPost) {
      throw new Error(`Cannot publish: ${rateLimitStatus.reason}`);
    }
    
    // Get user's LinkedIn token
    const tokenData = await linkedinOAuthService.getActiveToken(queueEntry.user_id);
    if (!tokenData) {
      throw new Error('No active LinkedIn connection found');
    }
    
    try {
      // Update status to publishing
      await db('linkedin_publishing_queue')
        .where({ id: queueId })
        .update({ status: 'publishing' });
      
      // Prepare share content
      const shareContent = this.prepareShareContent(queueEntry, tokenData.linkedinUserId);
      
      // Publish to LinkedIn
      const response = await axios.post(LINKEDIN_SHARE_URL, shareContent, {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });
      
      // Extract post ID from response
      const linkedinPostId = response.headers['x-restli-id'] || response.data.id;
      const linkedinPostUrl = `https://www.linkedin.com/feed/update/${linkedinPostId}`;
      
      // Update queue entry
      await db('linkedin_publishing_queue')
        .where({ id: queueId })
        .update({
          status: 'published',
          published_at: new Date(),
          linkedin_post_id: linkedinPostId,
          linkedin_post_url: linkedinPostUrl
        });
      
      // Update rate limits
      await this.updateRateLimits(queueEntry.user_id, 'post');
      
      // Log compliance event
      await linkedinOAuthService.logComplianceEvent(queueEntry.user_id, 'post_published', {
        queueId,
        linkedinPostId,
        postType: queueEntry.post_type
      });
      
      // Initialize analytics entry
      await db('linkedin_post_analytics').insert({
        user_id: queueEntry.user_id,
        linkedin_post_id: linkedinPostId,
        queue_id: queueId
      });
      
      return {
        success: true,
        linkedinPostId,
        linkedinPostUrl
      };
    } catch (error) {
      // Update status to failed
      await db('linkedin_publishing_queue')
        .where({ id: queueId })
        .update({
          status: 'failed',
          error_message: error.message,
          retry_count: db.raw('retry_count + 1')
        });
      
      logger.error('LinkedIn publishing failed:', error);
      throw new Error(`Publishing failed: ${error.message}`);
    }
  }

  /**
   * Prepare share content for LinkedIn API
   * @param {object} queueEntry - Queue entry
   * @param {string} linkedinUserId - LinkedIn user ID
   * @returns {object} Share content
   */
  prepareShareContent(queueEntry, linkedinUserId) {
    const shareContent = {
      author: `urn:li:person:${linkedinUserId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: queueEntry.post_text
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };
    
    // Add media if present
    if (queueEntry.media_urls && queueEntry.media_urls.length > 0) {
      // Would implement media upload logic here
      // This is simplified for demonstration
    }
    
    return shareContent;
  }

  /**
   * Update rate limits
   * @param {string} userId - User ID
   * @param {string} actionType - Action type
   */
  async updateRateLimits(userId, actionType) {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setMinutes(0, 0, 0);
    
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    await db('linkedin_rate_limits')
      .insert({
        user_id: userId,
        action_type: actionType,
        count: 1,
        window_start: windowStart,
        window_end: windowEnd
      })
      .onConflict(['user_id', 'action_type', 'window_start'])
      .merge({
        count: db.raw('linkedin_rate_limits.count + 1'),
        updated_at: now
      });
  }

  /**
   * Get user's publishing queue
   * @param {string} userId - User ID
   * @param {object} filters - Filter options
   * @returns {array} Queue entries
   */
  async getUserQueue(userId, filters = {}) {
    let query = db('linkedin_publishing_queue')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    
    if (filters.status) {
      query = query.where({ status: filters.status });
    }
    
    if (filters.approvalStatus) {
      query = query.where({ approval_status: filters.approvalStatus });
    }
    
    const results = await query;
    
    // Add safety check results
    for (const entry of results) {
      entry.safetyChecks = await db('linkedin_content_safety_checks')
        .where({ queue_id: entry.id })
        .select('check_type', 'passed', 'details');
    }
    
    return results;
  }

  /**
   * Get rate limit status for user
   * @param {string} userId - User ID
   * @returns {object} Rate limit status
   */
  async getRateLimitStatus(userId) {
    const now = new Date();
    
    // Get counts for different time windows
    const [daily, hourly, weekly, monthly] = await Promise.all([
      db('linkedin_rate_limits')
        .where({ user_id: userId, action_type: 'post' })
        .andWhere('window_start', '>=', new Date(now - 24 * 60 * 60 * 1000))
        .sum('count as total')
        .first(),
      
      db('linkedin_rate_limits')
        .where({ user_id: userId, action_type: 'post' })
        .andWhere('window_start', '>=', new Date(now - 60 * 60 * 1000))
        .sum('count as total')
        .first(),
      
      db('linkedin_rate_limits')
        .where({ user_id: userId, action_type: 'post' })
        .andWhere('window_start', '>=', new Date(now - 7 * 24 * 60 * 60 * 1000))
        .sum('count as total')
        .first(),
      
      db('linkedin_rate_limits')
        .where({ user_id: userId, action_type: 'post' })
        .andWhere('window_start', '>=', new Date(now - 30 * 24 * 60 * 60 * 1000))
        .sum('count as total')
        .first()
    ]);
    
    return {
      daily: {
        used: daily.total || 0,
        limit: RATE_LIMITS.post.daily,
        remaining: RATE_LIMITS.post.daily - (daily.total || 0)
      },
      hourly: {
        used: hourly.total || 0,
        limit: RATE_LIMITS.post.hourly,
        remaining: RATE_LIMITS.post.hourly - (hourly.total || 0)
      },
      weekly: {
        used: weekly.total || 0,
        limit: RATE_LIMITS.post.weekly,
        remaining: RATE_LIMITS.post.weekly - (weekly.total || 0)
      },
      monthly: {
        used: monthly.total || 0,
        limit: RATE_LIMITS.post.monthly,
        remaining: RATE_LIMITS.post.monthly - (monthly.total || 0)
      }
    };
  }
}

module.exports = new LinkedInPublishingService();