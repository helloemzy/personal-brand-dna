const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requireSubscription } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const performanceDataSchema = Joi.object({
  contentId: Joi.string().uuid().required(),
  platform: Joi.string().valid('linkedin', 'twitter', 'facebook', 'instagram').default('linkedin'),
  views: Joi.number().integer().min(0).optional(),
  likes: Joi.number().integer().min(0).optional(),
  comments: Joi.number().integer().min(0).optional(),
  shares: Joi.number().integer().min(0).optional(),
  clicks: Joi.number().integer().min(0).optional(),
  businessOutcomes: Joi.object({
    leads: Joi.number().integer().min(0).optional(),
    meetingRequests: Joi.number().integer().min(0).optional(),
    jobInquiries: Joi.number().integer().min(0).optional(),
    speakingInvitations: Joi.number().integer().min(0).optional(),
    businessOpportunities: Joi.number().integer().min(0).optional(),
    other: Joi.string().max(500).optional()
  }).optional()
});

// Submit performance data for content
router.post('/performance', asyncHandler(async (req, res) => {
  const { error, value } = performanceDataSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const {
    contentId,
    platform,
    views,
    likes,
    comments,
    shares,
    clicks,
    businessOutcomes
  } = value;

  // Verify content ownership
  const contentResult = await query(
    'SELECT id FROM generated_content WHERE id = $1 AND user_id = $2',
    [contentId, req.user.id]
  );

  if (contentResult.rows.length === 0) {
    throw new AppError('Content not found', 404);
  }

  // Insert or update performance metrics
  const metricsResult = await query(
    `INSERT INTO performance_metrics 
     (content_id, platform, views, likes, comments, shares, clicks, business_outcomes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (content_id, platform) 
     DO UPDATE SET 
       views = EXCLUDED.views,
       likes = EXCLUDED.likes,
       comments = EXCLUDED.comments,
       shares = EXCLUDED.shares,
       clicks = EXCLUDED.clicks,
       business_outcomes = EXCLUDED.business_outcomes,
       updated_at = NOW()
     RETURNING *`,
    [contentId, platform, views, likes, comments, shares, clicks, JSON.stringify(businessOutcomes)]
  );

  logger.logBusinessEvent('performance_data_submitted', req.user.id, {
    contentId,
    platform,
    totalEngagement: (views || 0) + (likes || 0) + (comments || 0) + (shares || 0)
  });

  res.json({
    status: 'success',
    message: 'Performance data submitted successfully',
    data: {
      metrics: metricsResult.rows[0]
    }
  });
}));

// Get analytics dashboard data
router.get('/dashboard', requireSubscription('professional'), asyncHandler(async (req, res) => {
  const timeframe = parseInt(req.query.timeframe) || 30; // days
  const platform = req.query.platform || 'linkedin';

  // Content performance overview
  const overviewResult = await query(
    `SELECT 
      COUNT(DISTINCT gc.id) as total_content,
      COALESCE(SUM(pm.views), 0) as total_views,
      COALESCE(SUM(pm.likes), 0) as total_likes,
      COALESCE(SUM(pm.comments), 0) as total_comments,
      COALESCE(SUM(pm.shares), 0) as total_shares,
      COALESCE(SUM(pm.clicks), 0) as total_clicks,
      COUNT(CASE WHEN pm.id IS NOT NULL THEN 1 END) as content_with_metrics
     FROM generated_content gc
     LEFT JOIN performance_metrics pm ON gc.id = pm.content_id AND pm.platform = $2
     WHERE gc.user_id = $1 
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'`,
    [req.user.id, platform]
  );

  const overview = overviewResult.rows[0];

  // Top performing content
  const topContentResult = await query(
    `SELECT 
      gc.id, gc.content, gc.topic, gc.content_type, gc.created_at,
      pm.views, pm.likes, pm.comments, pm.shares, pm.clicks,
      (COALESCE(pm.likes, 0) + COALESCE(pm.comments, 0) * 2 + COALESCE(pm.shares, 0) * 3) as engagement_score
     FROM generated_content gc
     JOIN performance_metrics pm ON gc.id = pm.content_id
     WHERE gc.user_id = $1 
     AND pm.platform = $2
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'
     ORDER BY engagement_score DESC
     LIMIT 10`,
    [req.user.id, platform]
  );

  // Content type performance
  const contentTypeResult = await query(
    `SELECT 
      gc.content_type,
      COUNT(*) as content_count,
      AVG(COALESCE(pm.views, 0)) as avg_views,
      AVG(COALESCE(pm.likes, 0)) as avg_likes,
      AVG(COALESCE(pm.comments, 0)) as avg_comments,
      AVG(COALESCE(pm.shares, 0)) as avg_shares
     FROM generated_content gc
     LEFT JOIN performance_metrics pm ON gc.id = pm.content_id AND pm.platform = $2
     WHERE gc.user_id = $1 
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'
     GROUP BY gc.content_type
     ORDER BY avg_views DESC`,
    [req.user.id, platform]
  );

  // Performance trends (weekly data)
  const trendsResult = await query(
    `SELECT 
      DATE_TRUNC('week', gc.created_at) as week,
      COUNT(*) as content_count,
      AVG(COALESCE(pm.views, 0)) as avg_views,
      AVG(COALESCE(pm.likes, 0)) as avg_likes,
      AVG(COALESCE(pm.comments, 0)) as avg_comments,
      AVG(COALESCE(pm.shares, 0)) as avg_shares
     FROM generated_content gc
     LEFT JOIN performance_metrics pm ON gc.id = pm.content_id AND pm.platform = $2
     WHERE gc.user_id = $1 
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'
     GROUP BY DATE_TRUNC('week', gc.created_at)
     ORDER BY week DESC`,
    [req.user.id, platform]
  );

  res.json({
    status: 'success',
    data: {
      overview: {
        totalContent: parseInt(overview.total_content),
        totalViews: parseInt(overview.total_views),
        totalLikes: parseInt(overview.total_likes),
        totalComments: parseInt(overview.total_comments),
        totalShares: parseInt(overview.total_shares),
        totalClicks: parseInt(overview.total_clicks),
        contentWithMetrics: parseInt(overview.content_with_metrics),
        metricsCompleteness: overview.total_content > 0 ? 
          (parseInt(overview.content_with_metrics) / parseInt(overview.total_content) * 100).toFixed(1) : 0
      },
      topContent: topContentResult.rows,
      contentTypePerformance: contentTypeResult.rows,
      trends: trendsResult.rows,
      timeframe,
      platform
    }
  });
}));

// Get detailed content analytics
router.get('/content/:contentId', asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  // Verify ownership
  const contentResult = await query(
    `SELECT gc.*, 
      COUNT(uf.id) as feedback_count,
      AVG(uf.rating) as avg_rating
     FROM generated_content gc
     LEFT JOIN user_feedback uf ON gc.id = uf.content_id
     WHERE gc.id = $1 AND gc.user_id = $2
     GROUP BY gc.id`,
    [contentId, req.user.id]
  );

  if (contentResult.rows.length === 0) {
    throw new AppError('Content not found', 404);
  }

  const content = contentResult.rows[0];

  // Get performance metrics across all platforms
  const metricsResult = await query(
    'SELECT * FROM performance_metrics WHERE content_id = $1 ORDER BY recorded_at DESC',
    [contentId]
  );

  // Get user feedback
  const feedbackResult = await query(
    'SELECT feedback_type, rating, feedback_text, created_at FROM user_feedback WHERE content_id = $1 ORDER BY created_at DESC',
    [contentId]
  );

  res.json({
    status: 'success',
    data: {
      content,
      metrics: metricsResult.rows,
      feedback: feedbackResult.rows,
      analytics: {
        feedbackCount: parseInt(content.feedback_count),
        averageRating: content.avg_rating ? parseFloat(content.avg_rating).toFixed(1) : null
      }
    }
  });
}));

// Get business impact analytics
router.get('/business-impact', requireSubscription('executive'), asyncHandler(async (req, res) => {
  const timeframe = parseInt(req.query.timeframe) || 90; // days

  // Extract business outcomes from performance metrics
  const businessImpactResult = await query(
    `SELECT 
      COUNT(DISTINCT pm.content_id) as content_with_outcomes,
      SUM((pm.business_outcomes->>'leads')::int) as total_leads,
      SUM((pm.business_outcomes->>'meetingRequests')::int) as total_meetings,
      SUM((pm.business_outcomes->>'jobInquiries')::int) as total_job_inquiries,
      SUM((pm.business_outcomes->>'speakingInvitations')::int) as total_speaking_invitations,
      SUM((pm.business_outcomes->>'businessOpportunities')::int) as total_business_opportunities
     FROM performance_metrics pm
     JOIN generated_content gc ON pm.content_id = gc.id
     WHERE gc.user_id = $1 
     AND pm.business_outcomes IS NOT NULL
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'`,
    [req.user.id]
  );

  const impact = businessImpactResult.rows[0];

  // Get monthly business impact trends
  const trendsResult = await query(
    `SELECT 
      DATE_TRUNC('month', gc.created_at) as month,
      COUNT(DISTINCT pm.content_id) as content_count,
      SUM((pm.business_outcomes->>'leads')::int) as leads,
      SUM((pm.business_outcomes->>'meetingRequests')::int) as meetings,
      SUM((pm.business_outcomes->>'jobInquiries')::int) as job_inquiries,
      SUM((pm.business_outcomes->>'speakingInvitations')::int) as speaking_invitations
     FROM performance_metrics pm
     JOIN generated_content gc ON pm.content_id = gc.id
     WHERE gc.user_id = $1 
     AND pm.business_outcomes IS NOT NULL
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'
     GROUP BY DATE_TRUNC('month', gc.created_at)
     ORDER BY month DESC`,
    [req.user.id]
  );

  // Calculate ROI metrics
  const totalOutcomes = (parseInt(impact.total_leads) || 0) + 
                       (parseInt(impact.total_meetings) || 0) + 
                       (parseInt(impact.total_job_inquiries) || 0) + 
                       (parseInt(impact.total_speaking_invitations) || 0) + 
                       (parseInt(impact.total_business_opportunities) || 0);

  const contentWithOutcomes = parseInt(impact.content_with_outcomes) || 0;
  const outcomesPerContent = contentWithOutcomes > 0 ? (totalOutcomes / contentWithOutcomes).toFixed(2) : 0;

  res.json({
    status: 'success',
    data: {
      summary: {
        totalLeads: parseInt(impact.total_leads) || 0,
        totalMeetings: parseInt(impact.total_meetings) || 0,
        totalJobInquiries: parseInt(impact.total_job_inquiries) || 0,
        totalSpeakingInvitations: parseInt(impact.total_speaking_invitations) || 0,
        totalBusinessOpportunities: parseInt(impact.total_business_opportunities) || 0,
        contentWithOutcomes: contentWithOutcomes,
        totalOutcomes: totalOutcomes,
        outcomesPerContent: parseFloat(outcomesPerContent)
      },
      trends: trendsResult.rows,
      timeframe
    }
  });
}));

// Get voice profile analytics
router.get('/voice-profile/:profileId', asyncHandler(async (req, res) => {
  const { profileId } = req.params;

  // Verify ownership
  const profileResult = await query(
    'SELECT id, confidence_score, created_at FROM voice_profiles WHERE id = $1 AND user_id = $2',
    [profileId, req.user.id]
  );

  if (profileResult.rows.length === 0) {
    throw new AppError('Voice profile not found', 404);
  }

  const profile = profileResult.rows[0];

  // Get content generated with this voice profile
  const contentStatsResult = await query(
    `SELECT 
      COUNT(*) as total_content,
      COUNT(CASE WHEN status = 'used' THEN 1 END) as used_content,
      AVG(CASE WHEN user_edits IS NOT NULL THEN 1 ELSE 0 END) * 100 as edit_rate
     FROM generated_content 
     WHERE user_id = $1 
     AND generation_metadata->>'voiceProfileId' = $2`,
    [req.user.id, profileId]
  );

  const contentStats = contentStatsResult.rows[0];

  // Get feedback on content generated with this profile
  const feedbackResult = await query(
    `SELECT 
      AVG(CASE WHEN feedback_type = 'voice_accuracy' THEN rating END) as voice_accuracy_rating,
      AVG(CASE WHEN feedback_type = 'content_quality' THEN rating END) as content_quality_rating,
      COUNT(*) as total_feedback
     FROM user_feedback uf
     JOIN generated_content gc ON uf.content_id = gc.id
     WHERE gc.user_id = $1 
     AND gc.generation_metadata->>'voiceProfileId' = $2`,
    [req.user.id, profileId]
  );

  const feedback = feedbackResult.rows[0];

  res.json({
    status: 'success',
    data: {
      profile,
      contentStats: {
        totalContent: parseInt(contentStats.total_content),
        usedContent: parseInt(contentStats.used_content),
        editRate: parseFloat(contentStats.edit_rate) || 0,
        usageRate: contentStats.total_content > 0 ? 
          (parseInt(contentStats.used_content) / parseInt(contentStats.total_content) * 100).toFixed(1) : 0
      },
      feedback: {
        voiceAccuracyRating: feedback.voice_accuracy_rating ? parseFloat(feedback.voice_accuracy_rating).toFixed(1) : null,
        contentQualityRating: feedback.content_quality_rating ? parseFloat(feedback.content_quality_rating).toFixed(1) : null,
        totalFeedback: parseInt(feedback.total_feedback)
      }
    }
  });
}));

// Export analytics data
router.get('/export', requireSubscription('professional'), asyncHandler(async (req, res) => {
  const format = req.query.format || 'json';
  const timeframe = parseInt(req.query.timeframe) || 90;

  if (!['json', 'csv'].includes(format)) {
    throw new AppError('Invalid export format. Supported formats: json, csv', 400);
  }

  // Get comprehensive analytics data
  const analyticsResult = await query(
    `SELECT 
      gc.id, gc.content, gc.topic, gc.content_type, gc.status, gc.created_at,
      pm.platform, pm.views, pm.likes, pm.comments, pm.shares, pm.clicks,
      pm.business_outcomes,
      COALESCE(uf.rating, 0) as user_rating,
      uf.feedback_text
     FROM generated_content gc
     LEFT JOIN performance_metrics pm ON gc.id = pm.content_id
     LEFT JOIN user_feedback uf ON gc.id = uf.content_id
     WHERE gc.user_id = $1 
     AND gc.created_at >= NOW() - INTERVAL '${timeframe} days'
     ORDER BY gc.created_at DESC`,
    [req.user.id]
  );

  const data = analyticsResult.rows;

  if (format === 'csv') {
    // Convert to CSV format
    const csvHeaders = [
      'Content ID', 'Topic', 'Content Type', 'Status', 'Created At',
      'Platform', 'Views', 'Likes', 'Comments', 'Shares', 'Clicks',
      'User Rating', 'Content Preview'
    ];

    const csvRows = data.map(row => [
      row.id,
      row.topic,
      row.content_type,
      row.status,
      row.created_at,
      row.platform || '',
      row.views || 0,
      row.likes || 0,
      row.comments || 0,
      row.shares || 0,
      row.clicks || 0,
      row.user_rating || '',
      (row.content || '').substring(0, 100) + '...'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pbdna-analytics-${new Date().toISOString().split('T')[0]}.csv"`
    });

    res.send(csvContent);
  } else {
    res.json({
      status: 'success',
      data: {
        analytics: data,
        exportedAt: new Date().toISOString(),
        timeframe: timeframe,
        totalRecords: data.length
      }
    });
  }
}));

module.exports = router;