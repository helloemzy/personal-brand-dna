const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');
const linkedinOAuthService = require('./linkedinOAuthService');

const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

class LinkedInAnalyticsService {
  /**
   * Fetch analytics for a published post
   * @param {string} userId - User ID
   * @param {string} linkedinPostId - LinkedIn post ID
   * @returns {object} Analytics data
   */
  async fetchPostAnalytics(userId, linkedinPostId) {
    try {
      // Get user's LinkedIn token
      const tokenData = await linkedinOAuthService.getActiveToken(userId);
      if (!tokenData) {
        throw new Error('No active LinkedIn connection found');
      }

      // Fetch share statistics from LinkedIn
      const shareStats = await this.getShareStatistics(tokenData.accessToken, linkedinPostId);
      
      // Calculate engagement metrics
      const engagementMetrics = this.calculateEngagementMetrics(shareStats);
      
      // Store analytics data
      const analytics = await this.storeAnalytics({
        userId,
        linkedinPostId,
        ...shareStats,
        ...engagementMetrics
      });
      
      // Log compliance event
      await linkedinOAuthService.logComplianceEvent(userId, 'analytics_fetched', {
        linkedinPostId,
        metrics: Object.keys(shareStats)
      });
      
      return analytics;
    } catch (error) {
      logger.error('Failed to fetch LinkedIn analytics:', error);
      throw new Error(`Analytics fetch failed: ${error.message}`);
    }
  }

  /**
   * Get share statistics from LinkedIn API
   * @param {string} accessToken - LinkedIn access token
   * @param {string} shareId - Share URN
   * @returns {object} Share statistics
   */
  async getShareStatistics(accessToken, shareId) {
    try {
      // LinkedIn API endpoint for share statistics
      const response = await axios.get(
        `${LINKEDIN_API_URL}/socialActions/${shareId}/comments`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-RestLi-Protocol-Version': '2.0.0'
          },
          params: {
            q: 'statistics'
          }
        }
      );

      // Extract statistics (simplified - actual API response structure may vary)
      const stats = response.data;
      
      return {
        impressions: stats.impressionCount || 0,
        uniqueImpressions: stats.uniqueImpressionsCount || 0,
        clicks: stats.clickCount || 0,
        likes: stats.likeCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0
      };
    } catch (error) {
      logger.error('LinkedIn API error:', error);
      
      // Return default values if API fails
      return {
        impressions: 0,
        uniqueImpressions: 0,
        clicks: 0,
        likes: 0,
        comments: 0,
        shares: 0
      };
    }
  }

  /**
   * Calculate engagement metrics
   * @param {object} stats - Raw statistics
   * @returns {object} Calculated metrics
   */
  calculateEngagementMetrics(stats) {
    const totalEngagements = stats.likes + stats.comments + stats.shares;
    const engagementRate = stats.impressions > 0 
      ? ((totalEngagements / stats.impressions) * 100).toFixed(2)
      : 0;
    
    const clickThroughRate = stats.impressions > 0
      ? ((stats.clicks / stats.impressions) * 100).toFixed(2)
      : 0;
    
    return {
      engagementRate: parseFloat(engagementRate),
      clickThroughRate: parseFloat(clickThroughRate),
      totalEngagements
    };
  }

  /**
   * Store analytics data in database
   * @param {object} analyticsData - Analytics data to store
   * @returns {object} Stored analytics record
   */
  async storeAnalytics(analyticsData) {
    const { userId, linkedinPostId, ...metrics } = analyticsData;
    
    // Get queue ID if exists
    const queueEntry = await db('linkedin_publishing_queue')
      .where({ linkedin_post_id: linkedinPostId, user_id: userId })
      .first();
    
    // Insert or update analytics
    const analytics = await db('linkedin_post_analytics')
      .insert({
        user_id: userId,
        linkedin_post_id: linkedinPostId,
        queue_id: queueEntry?.id,
        impressions: metrics.impressions,
        unique_impressions: metrics.uniqueImpressions,
        clicks: metrics.clicks,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        engagement_rate: metrics.engagementRate,
        click_through_rate: metrics.clickThroughRate,
        demographics: JSON.stringify(metrics.demographics || {})
      })
      .onConflict(['linkedin_post_id', 'fetched_at'])
      .merge({
        impressions: metrics.impressions,
        unique_impressions: metrics.uniqueImpressions,
        clicks: metrics.clicks,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        engagement_rate: metrics.engagementRate,
        click_through_rate: metrics.clickThroughRate,
        updated_at: new Date()
      })
      .returning('*');
    
    return analytics[0];
  }

  /**
   * Get analytics for all user's posts
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {array} Analytics records
   */
  async getUserAnalytics(userId, options = {}) {
    let query = db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .select(
        'lpa.*',
        'lpq.post_text',
        'lpq.post_type',
        'lpq.published_at',
        'lpq.linkedin_post_url'
      );
    
    // Apply date filters
    if (options.startDate) {
      query = query.where('lpq.published_at', '>=', options.startDate);
    }
    
    if (options.endDate) {
      query = query.where('lpq.published_at', '<=', options.endDate);
    }
    
    // Apply sorting
    const sortBy = options.sortBy || 'published_at';
    const sortOrder = options.sortOrder || 'desc';
    query = query.orderBy(`lpq.${sortBy}`, sortOrder);
    
    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    return await query;
  }

  /**
   * Get aggregated analytics summary
   * @param {string} userId - User ID
   * @param {string} period - Time period (day, week, month, all)
   * @returns {object} Analytics summary
   */
  async getAnalyticsSummary(userId, period = 'month') {
    const dateFilter = this.getDateFilterForPeriod(period);
    
    const summary = await db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .andWhere('lpq.published_at', '>=', dateFilter)
      .select(
        db.raw('COUNT(DISTINCT lpa.linkedin_post_id) as total_posts'),
        db.raw('SUM(lpa.impressions) as total_impressions'),
        db.raw('SUM(lpa.likes) as total_likes'),
        db.raw('SUM(lpa.comments) as total_comments'),
        db.raw('SUM(lpa.shares) as total_shares'),
        db.raw('AVG(lpa.engagement_rate) as avg_engagement_rate'),
        db.raw('AVG(lpa.click_through_rate) as avg_click_through_rate'),
        db.raw('MAX(lpa.impressions) as best_performing_impressions'),
        db.raw('MAX(lpa.engagement_rate) as best_engagement_rate')
      )
      .first();
    
    // Get best performing post
    const bestPost = await db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .andWhere('lpq.published_at', '>=', dateFilter)
      .orderBy('lpa.engagement_rate', 'desc')
      .select('lpq.post_text', 'lpq.linkedin_post_url', 'lpa.engagement_rate', 'lpa.impressions')
      .first();
    
    // Get posting frequency
    const postingFrequency = await this.getPostingFrequency(userId, dateFilter);
    
    return {
      period,
      summary: {
        totalPosts: parseInt(summary.total_posts) || 0,
        totalImpressions: parseInt(summary.total_impressions) || 0,
        totalEngagements: (parseInt(summary.total_likes) || 0) + 
                         (parseInt(summary.total_comments) || 0) + 
                         (parseInt(summary.total_shares) || 0),
        avgEngagementRate: parseFloat(summary.avg_engagement_rate) || 0,
        avgClickThroughRate: parseFloat(summary.avg_click_through_rate) || 0
      },
      bestPerformingPost: bestPost,
      postingFrequency
    };
  }

  /**
   * Get date filter for period
   * @param {string} period - Time period
   * @returns {Date} Start date
   */
  getDateFilterForPeriod(period) {
    const now = new Date();
    
    switch (period) {
      case 'day':
        return new Date(now - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
      case 'quarter':
        return new Date(now - 90 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0); // All time
    }
  }

  /**
   * Get posting frequency analysis
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @returns {object} Posting frequency data
   */
  async getPostingFrequency(userId, startDate) {
    const frequency = await db('linkedin_publishing_queue')
      .where({ user_id: userId, status: 'published' })
      .andWhere('published_at', '>=', startDate)
      .select(
        db.raw("DATE_PART('dow', published_at) as day_of_week"),
        db.raw("DATE_PART('hour', published_at) as hour_of_day"),
        db.raw('COUNT(*) as post_count')
      )
      .groupBy('day_of_week', 'hour_of_day');
    
    // Process frequency data
    const byDayOfWeek = {};
    const byHourOfDay = {};
    
    frequency.forEach(row => {
      const dow = parseInt(row.day_of_week);
      const hour = parseInt(row.hour_of_day);
      const count = parseInt(row.post_count);
      
      byDayOfWeek[dow] = (byDayOfWeek[dow] || 0) + count;
      byHourOfDay[hour] = (byHourOfDay[hour] || 0) + count;
    });
    
    return {
      byDayOfWeek,
      byHourOfDay,
      mostActiveDay: Object.keys(byDayOfWeek).reduce((a, b) => 
        byDayOfWeek[a] > byDayOfWeek[b] ? a : b, 0
      ),
      mostActiveHour: Object.keys(byHourOfDay).reduce((a, b) => 
        byHourOfDay[a] > byHourOfDay[b] ? a : b, 0
      )
    };
  }

  /**
   * Get content performance insights
   * @param {string} userId - User ID
   * @returns {object} Content insights
   */
  async getContentInsights(userId) {
    // Analyze performance by content type
    const byContentType = await db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .select(
        'lpq.post_type',
        db.raw('AVG(lpa.engagement_rate) as avg_engagement_rate'),
        db.raw('COUNT(*) as post_count')
      )
      .groupBy('lpq.post_type');
    
    // Analyze hashtag performance
    const hashtagPerformance = await this.analyzeHashtagPerformance(userId);
    
    // Analyze post length impact
    const lengthImpact = await this.analyzePostLengthImpact(userId);
    
    // Get best posting times
    const bestTimes = await this.getBestPostingTimes(userId);
    
    return {
      byContentType,
      hashtagPerformance,
      lengthImpact,
      bestTimes
    };
  }

  /**
   * Analyze hashtag performance
   * @param {string} userId - User ID
   * @returns {array} Hashtag performance data
   */
  async analyzeHashtagPerformance(userId) {
    const posts = await db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .select('lpq.post_text', 'lpa.engagement_rate');
    
    const hashtagStats = {};
    
    posts.forEach(post => {
      const hashtags = post.post_text.match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        if (!hashtagStats[tag]) {
          hashtagStats[tag] = { count: 0, totalEngagement: 0 };
        }
        hashtagStats[tag].count++;
        hashtagStats[tag].totalEngagement += post.engagement_rate;
      });
    });
    
    // Calculate average engagement per hashtag
    const hashtagPerformance = Object.entries(hashtagStats)
      .map(([hashtag, stats]) => ({
        hashtag,
        usageCount: stats.count,
        avgEngagement: (stats.totalEngagement / stats.count).toFixed(2)
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10); // Top 10 hashtags
    
    return hashtagPerformance;
  }

  /**
   * Analyze post length impact on engagement
   * @param {string} userId - User ID
   * @returns {object} Length impact analysis
   */
  async analyzePostLengthImpact(userId) {
    const posts = await db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .select(
        db.raw('LENGTH(lpq.post_text) as post_length'),
        'lpa.engagement_rate'
      );
    
    // Categorize by length
    const lengthCategories = {
      short: { min: 0, max: 200, posts: [] },
      medium: { min: 201, max: 600, posts: [] },
      long: { min: 601, max: 1200, posts: [] },
      veryLong: { min: 1201, max: 3000, posts: [] }
    };
    
    posts.forEach(post => {
      const length = post.post_length;
      
      if (length <= 200) lengthCategories.short.posts.push(post.engagement_rate);
      else if (length <= 600) lengthCategories.medium.posts.push(post.engagement_rate);
      else if (length <= 1200) lengthCategories.long.posts.push(post.engagement_rate);
      else lengthCategories.veryLong.posts.push(post.engagement_rate);
    });
    
    // Calculate average engagement per category
    const results = {};
    Object.entries(lengthCategories).forEach(([category, data]) => {
      if (data.posts.length > 0) {
        results[category] = {
          avgEngagement: (data.posts.reduce((a, b) => a + b, 0) / data.posts.length).toFixed(2),
          postCount: data.posts.length,
          lengthRange: `${data.min}-${data.max} chars`
        };
      }
    });
    
    return results;
  }

  /**
   * Get best posting times based on engagement
   * @param {string} userId - User ID
   * @returns {object} Best posting times
   */
  async getBestPostingTimes(userId) {
    const engagementByTime = await db('linkedin_post_analytics as lpa')
      .join('linkedin_publishing_queue as lpq', 'lpa.queue_id', 'lpq.id')
      .where('lpa.user_id', userId)
      .select(
        db.raw("TO_CHAR(lpq.published_at, 'Day') as day_name"),
        db.raw("DATE_PART('hour', lpq.published_at) as hour"),
        db.raw('AVG(lpa.engagement_rate) as avg_engagement')
      )
      .groupBy('day_name', 'hour')
      .orderBy('avg_engagement', 'desc')
      .limit(10);
    
    return engagementByTime.map(time => ({
      day: time.day_name.trim(),
      hour: `${time.hour}:00`,
      avgEngagement: parseFloat(time.avg_engagement).toFixed(2)
    }));
  }

  /**
   * Schedule analytics updates for all published posts
   * @returns {object} Update results
   */
  async scheduleAnalyticsUpdates() {
    // Get all published posts from the last 30 days
    const recentPosts = await db('linkedin_publishing_queue')
      .where({ status: 'published' })
      .andWhere('published_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .select('user_id', 'linkedin_post_id');
    
    const results = {
      total: recentPosts.length,
      updated: 0,
      failed: 0
    };
    
    // Update analytics for each post
    for (const post of recentPosts) {
      try {
        await this.fetchPostAnalytics(post.user_id, post.linkedin_post_id);
        results.updated++;
      } catch (error) {
        logger.error(`Failed to update analytics for post ${post.linkedin_post_id}:`, error);
        results.failed++;
      }
    }
    
    return results;
  }
}

module.exports = new LinkedInAnalyticsService();