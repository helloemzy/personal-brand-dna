const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const linkedinOAuthService = require('../services/linkedinOAuthService');
const linkedinPublishingService = require('../services/linkedinPublishingService');
const linkedinAnalyticsService = require('../services/linkedinAnalyticsService');
const logger = require('../utils/logger');

// OAuth Routes

/**
 * GET /api/linkedin/auth
 * Initiate LinkedIn OAuth flow
 */
router.get('/auth', requireAuth, async (req, res) => {
  try {
    const { url, state } = linkedinOAuthService.getAuthorizationUrl(req.user.id);
    
    // Store state in session for verification
    req.session.linkedinState = state;
    
    res.json({
      success: true,
      authUrl: url,
      message: 'Redirect user to the auth URL to connect their LinkedIn account'
    });
  } catch (error) {
    logger.error('LinkedIn auth initiation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate LinkedIn authentication'
    });
  }
});

/**
 * GET /api/linkedin/callback
 * Handle LinkedIn OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    
    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/linkedin?error=${oauthError}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/linkedin?error=missing_params`);
    }
    
    // Exchange code for token
    const result = await linkedinOAuthService.exchangeCodeForToken(code, state);
    
    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/settings/linkedin?connected=true`);
  } catch (error) {
    logger.error('LinkedIn callback failed:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings/linkedin?error=connection_failed`);
  }
});

/**
 * POST /api/linkedin/disconnect
 * Revoke LinkedIn access
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await linkedinOAuthService.revokeAccess(req.user.id);
    
    res.json({
      success: true,
      message: 'LinkedIn account disconnected successfully'
    });
  } catch (error) {
    logger.error('LinkedIn disconnect failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect LinkedIn account'
    });
  }
});

/**
 * GET /api/linkedin/status
 * Check LinkedIn connection status
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const isConnected = await linkedinOAuthService.isConnected(req.user.id);
    const tokenData = isConnected ? await linkedinOAuthService.getActiveToken(req.user.id) : null;
    
    res.json({
      success: true,
      connected: isConnected,
      linkedinUserName: tokenData?.linkedinUserName,
      expiresAt: tokenData?.expiresAt
    });
  } catch (error) {
    logger.error('LinkedIn status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check LinkedIn status'
    });
  }
});

// Publishing Queue Routes

/**
 * POST /api/linkedin/queue
 * Add content to publishing queue
 */
router.post('/queue', requireAuth, async (req, res) => {
  try {
    const { contentId, postText, postType, mediaUrls, scheduledFor } = req.body;
    
    // Validate required fields
    if (!postText) {
      return res.status(400).json({
        success: false,
        error: 'Post text is required'
      });
    }
    
    // Add to queue
    const queueEntry = await linkedinPublishingService.addToQueue({
      userId: req.user.id,
      contentId,
      postText,
      postType,
      mediaUrls,
      scheduledFor
    });
    
    res.json({
      success: true,
      queueEntry,
      message: 'Content added to publishing queue for review'
    });
  } catch (error) {
    logger.error('Failed to add to queue:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/linkedin/queue
 * Get user's publishing queue
 */
router.get('/queue', requireAuth, async (req, res) => {
  try {
    const { status, approvalStatus, limit, offset } = req.query;
    
    const queue = await linkedinPublishingService.getUserQueue(req.user.id, {
      status,
      approvalStatus,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    
    res.json({
      success: true,
      queue,
      total: queue.length
    });
  } catch (error) {
    logger.error('Failed to fetch queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch publishing queue'
    });
  }
});

/**
 * PUT /api/linkedin/queue/:id/approve
 * Approve content for publishing
 */
router.put('/queue/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // In production, might check if user has approval permissions
    const updated = await linkedinPublishingService.approveContent(id, req.user.id);
    
    res.json({
      success: true,
      queueEntry: updated,
      message: 'Content approved for publishing'
    });
  } catch (error) {
    logger.error('Failed to approve content:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/linkedin/queue/:id/reject
 * Reject content with reason
 */
router.put('/queue/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }
    
    const updated = await linkedinPublishingService.rejectContent(id, req.user.id, reason);
    
    res.json({
      success: true,
      queueEntry: updated,
      message: 'Content rejected'
    });
  } catch (error) {
    logger.error('Failed to reject content:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/linkedin/queue/:id
 * Remove content from queue
 */
router.delete('/queue/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const queueEntry = await linkedinPublishingService.getQueueEntry(id);
    if (!queueEntry || queueEntry.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Queue entry not found'
      });
    }
    
    // Only allow deletion of pending/rejected content
    if (!['pending', 'rejected', 'failed'].includes(queueEntry.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete content with this status'
      });
    }
    
    await linkedinPublishingService.deleteQueueEntry(id);
    
    res.json({
      success: true,
      message: 'Content removed from queue'
    });
  } catch (error) {
    logger.error('Failed to delete queue entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove content from queue'
    });
  }
});

// Publishing Routes

/**
 * POST /api/linkedin/publish/:id
 * Manually publish approved content
 */
router.post('/publish/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership and approval
    const queueEntry = await linkedinPublishingService.getQueueEntry(id);
    if (!queueEntry || queueEntry.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Queue entry not found'
      });
    }
    
    // Publish content
    const result = await linkedinPublishingService.publishContent(id);
    
    res.json({
      success: true,
      result,
      message: 'Content published successfully to LinkedIn'
    });
  } catch (error) {
    logger.error('Failed to publish content:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/linkedin/posts
 * Get published posts
 */
router.get('/posts', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, limit, offset } = req.query;
    
    const posts = await linkedinPublishingService.getPublishedPosts(req.user.id, {
      startDate,
      endDate,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    
    res.json({
      success: true,
      posts,
      total: posts.length
    });
  } catch (error) {
    logger.error('Failed to fetch posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch published posts'
    });
  }
});

// Analytics Routes

/**
 * GET /api/linkedin/analytics/:id
 * Get analytics for a specific post
 */
router.get('/analytics/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const analytics = await linkedinAnalyticsService.fetchPostAnalytics(req.user.id, id);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Failed to fetch analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post analytics'
    });
  }
});

/**
 * GET /api/linkedin/analytics
 * Get all analytics for user
 */
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, sortBy, sortOrder, limit, offset } = req.query;
    
    const analytics = await linkedinAnalyticsService.getUserAnalytics(req.user.id, {
      startDate,
      endDate,
      sortBy,
      sortOrder,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    
    res.json({
      success: true,
      analytics,
      total: analytics.length
    });
  } catch (error) {
    logger.error('Failed to fetch user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

/**
 * GET /api/linkedin/analytics/summary
 * Get analytics summary
 */
router.get('/analytics/summary', requireAuth, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const summary = await linkedinAnalyticsService.getAnalyticsSummary(req.user.id, period);
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Failed to fetch analytics summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics summary'
    });
  }
});

/**
 * GET /api/linkedin/analytics/insights
 * Get content performance insights
 */
router.get('/analytics/insights', requireAuth, async (req, res) => {
  try {
    const insights = await linkedinAnalyticsService.getContentInsights(req.user.id);
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    logger.error('Failed to fetch insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content insights'
    });
  }
});

// Rate Limiting and Compliance Routes

/**
 * GET /api/linkedin/limits
 * Get current rate limit status
 */
router.get('/limits', requireAuth, async (req, res) => {
  try {
    const limits = await linkedinPublishingService.getRateLimitStatus(req.user.id);
    
    res.json({
      success: true,
      limits
    });
  } catch (error) {
    logger.error('Failed to fetch rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limit status'
    });
  }
});

/**
 * GET /api/linkedin/compliance
 * Get compliance report
 */
router.get('/compliance', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const compliance = await linkedinPublishingService.getComplianceReport(req.user.id, {
      startDate,
      endDate
    });
    
    res.json({
      success: true,
      compliance
    });
  } catch (error) {
    logger.error('Failed to fetch compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance report'
    });
  }
});

/**
 * POST /api/linkedin/analytics/refresh
 * Manually refresh analytics for all posts
 */
router.post('/analytics/refresh', requireAuth, async (req, res) => {
  try {
    // In production, might limit this to admin users or rate limit
    const results = await linkedinAnalyticsService.scheduleAnalyticsUpdates();
    
    res.json({
      success: true,
      results,
      message: 'Analytics refresh initiated'
    });
  } catch (error) {
    logger.error('Failed to refresh analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh analytics'
    });
  }
});

module.exports = router;