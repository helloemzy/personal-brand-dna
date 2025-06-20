const express = require('express');
const Joi = require('joi');
const axios = require('axios');
const { query, withTransaction } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requireSubscription, requireActiveSubscription } = require('../middleware/auth');
const { contentRateLimit } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const generateContentSchema = Joi.object({
  topic: Joi.string().max(500).required(),
  contentType: Joi.string().valid('post', 'article', 'story', 'poll', 'carousel').default('post'),
  templateId: Joi.string().uuid().optional(),
  voiceProfileId: Joi.string().uuid().optional(),
  urgency: Joi.string().valid('low', 'medium', 'high').default('medium'),
  targetAudience: Joi.string().max(200).optional(),
  callToAction: Joi.string().max(100).optional(),
  includePersonalExperience: Joi.boolean().default(true),
  tone: Joi.string().valid('professional', 'casual', 'thought-leader', 'conversational').optional()
});

const updateContentSchema = Joi.object({
  content: Joi.string().required(),
  status: Joi.string().valid('generated', 'edited', 'used', 'archived').optional()
});

const feedbackSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  feedback_text: Joi.string().max(1000).optional(),
  feedback_type: Joi.string().valid('content_quality', 'voice_accuracy', 'overall').default('content_quality')
});

// Get available content templates
router.get('/templates', asyncHandler(async (req, res) => {
  const { industry, contentType, useCase } = req.query;

  let whereClause = '1=1';
  const queryParams = [];
  let paramCount = 0;

  if (industry) {
    paramCount++;
    whereClause += ` AND $${paramCount} = ANY(industry_tags)`;
    queryParams.push(industry);
  }

  if (contentType) {
    paramCount++;
    whereClause += ` AND content_type = $${paramCount}`;
    queryParams.push(contentType);
  }

  if (useCase) {
    paramCount++;
    whereClause += ` AND use_case = $${paramCount}`;
    queryParams.push(useCase);
  }

  const templatesResult = await query(
    `SELECT 
      id, name, description, content_type, use_case, 
      industry_tags, variables, template_structure
     FROM content_templates 
     WHERE ${whereClause}
     ORDER BY name`,
    queryParams
  );

  // Group templates by use case
  const templatesByUseCase = templatesResult.rows.reduce((acc, template) => {
    const useCase = template.use_case || 'general';
    if (!acc[useCase]) {
      acc[useCase] = [];
    }
    acc[useCase].push(template);
    return acc;
  }, {});

  res.json({
    status: 'success',
    data: {
      templates: templatesResult.rows,
      templatesByUseCase,
      totalTemplates: templatesResult.rows.length
    }
  });
}));

// Generate content
router.post('/generate', 
  contentRateLimit,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const { error, value } = generateContentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message
      });
    }

    const {
      topic,
      contentType,
      templateId,
      voiceProfileId,
      urgency,
      targetAudience,
      callToAction,
      includePersonalExperience,
      tone
    } = value;

    // Get user's voice profile
    let voiceProfile = null;
    if (voiceProfileId) {
      const voiceResult = await query(
        'SELECT voice_signature, confidence_score FROM voice_profiles WHERE id = $1 AND user_id = $2',
        [voiceProfileId, req.user.id]
      );
      
      if (voiceResult.rows.length === 0) {
        throw new AppError('Voice profile not found', 404);
      }
      voiceProfile = voiceResult.rows[0];
    } else {
      // Get the latest voice profile
      const latestVoiceResult = await query(
        'SELECT voice_signature, confidence_score FROM voice_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      
      if (latestVoiceResult.rows.length > 0) {
        voiceProfile = latestVoiceResult.rows[0];
      }
    }

    if (!voiceProfile) {
      return res.status(400).json({
        status: 'error',
        message: 'No voice profile found. Please complete voice discovery first.'
      });
    }

    // Get template if specified
    let template = null;
    if (templateId) {
      const templateResult = await query(
        'SELECT * FROM content_templates WHERE id = $1',
        [templateId]
      );
      
      if (templateResult.rows.length > 0) {
        template = templateResult.rows[0];
      }
    } else {
      // Auto-select best template based on content type and industry
      const autoTemplateResult = await query(
        `SELECT * FROM content_templates 
         WHERE content_type = $1 
         AND ($2 = ANY(industry_tags) OR industry_tags IS NULL)
         ORDER BY 
           CASE WHEN $2 = ANY(industry_tags) THEN 1 ELSE 2 END,
           created_at DESC
         LIMIT 1`,
        [contentType, req.user.industry || 'business']
      );
      
      if (autoTemplateResult.rows.length > 0) {
        template = autoTemplateResult.rows[0];
      }
    }

    try {
      // Call AI pipeline for content generation
      const generationRequest = {
        userId: req.user.id,
        topic,
        contentType,
        template: template ? {
          structure: template.template_structure,
          variables: template.variables
        } : null,
        voiceSignature: voiceProfile.voice_signature,
        userProfile: {
          industry: req.user.industry,
          role: req.user.role,
          company: req.user.company,
          subscriptionTier: req.user.subscription_tier
        },
        preferences: {
          urgency,
          targetAudience,
          callToAction,
          includePersonalExperience,
          tone: tone || 'professional'
        }
      };

      const aiResponse = await axios.post(
        `${process.env.AI_PIPELINE_URL || 'http://localhost:8000'}/generate-content`,
        generationRequest,
        {
          timeout: 60000 // 1 minute timeout
        }
      );

      const { content, variations, metadata } = aiResponse.data;

      // Save generated content to database
      const contentResult = await query(
        `INSERT INTO generated_content 
         (user_id, template_id, content, topic, content_type, generation_metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          req.user.id,
          templateId,
          content,
          topic,
          contentType,
          JSON.stringify({
            voiceProfileId,
            urgency,
            targetAudience,
            callToAction,
            includePersonalExperience,
            tone,
            aiMetadata: metadata
          })
        ]
      );

      const contentId = contentResult.rows[0].id;

      logger.logBusinessEvent('content_generated', req.user.id, {
        contentId,
        contentType,
        topic,
        templateId,
        voiceProfileId,
        generationTime: metadata.generationTime
      });

      res.json({
        status: 'success',
        message: 'Content generated successfully',
        data: {
          contentId,
          content,
          variations: variations || [],
          metadata: {
            generationTime: metadata.generationTime,
            voiceAccuracy: voiceProfile.confidence_score,
            contentType,
            topic,
            createdAt: contentResult.rows[0].created_at
          }
        }
      });

    } catch (error) {
      logger.error('Content generation failed:', error);
      
      if (error.response?.status === 429) {
        throw new AppError('AI service is busy. Please try again in a moment.', 429);
      } else if (error.response?.status === 402) {
        throw new AppError('AI service quota exceeded. Please upgrade your plan.', 402);
      } else {
        throw new AppError('Content generation failed. Please try again.', 500);
      }
    }
  })
);

// Get user's generated content
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const contentType = req.query.contentType;
  const search = req.query.search;

  let whereClause = 'user_id = $1';
  const queryParams = [req.user.id];
  let paramCount = 1;

  if (status) {
    paramCount++;
    whereClause += ` AND status = $${paramCount}`;
    queryParams.push(status);
  }

  if (contentType) {
    paramCount++;
    whereClause += ` AND content_type = $${paramCount}`;
    queryParams.push(contentType);
  }

  if (search) {
    paramCount++;
    whereClause += ` AND (content ILIKE $${paramCount} OR topic ILIKE $${paramCount})`;
    queryParams.push(`%${search}%`);
  }

  // Add pagination parameters
  queryParams.push(limit, offset);

  const contentResult = await query(
    `SELECT 
      id, content, topic, content_type, status, generation_metadata, 
      user_edits, created_at, updated_at
     FROM generated_content 
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    queryParams
  );

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM generated_content WHERE ${whereClause}`,
    queryParams.slice(0, paramCount) // Remove limit and offset
  );

  const totalItems = parseInt(countResult.rows[0].total);
  const totalPages = Math.ceil(totalItems / limit);

  res.json({
    status: 'success',
    data: {
      content: contentResult.rows,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// Get specific content item
router.get('/:contentId', asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const contentResult = await query(
    `SELECT 
      gc.*, 
      ct.name as template_name,
      ct.description as template_description
     FROM generated_content gc
     LEFT JOIN content_templates ct ON gc.template_id = ct.id
     WHERE gc.id = $1 AND gc.user_id = $2`,
    [contentId, req.user.id]
  );

  if (contentResult.rows.length === 0) {
    throw new AppError('Content not found', 404);
  }

  const content = contentResult.rows[0];

  // Get performance metrics if available
  const metricsResult = await query(
    'SELECT * FROM performance_metrics WHERE content_id = $1 ORDER BY recorded_at DESC LIMIT 1',
    [contentId]
  );

  let performance = null;
  if (metricsResult.rows.length > 0) {
    performance = metricsResult.rows[0];
  }

  res.json({
    status: 'success',
    data: {
      content,
      performance
    }
  });
}));

// Update content
router.put('/:contentId', asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { error, value } = updateContentSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { content, status } = value;

  // Verify ownership
  const existingContentResult = await query(
    'SELECT content as original_content FROM generated_content WHERE id = $1 AND user_id = $2',
    [contentId, req.user.id]
  );

  if (existingContentResult.rows.length === 0) {
    throw new AppError('Content not found', 404);
  }

  const originalContent = existingContentResult.rows[0].original_content;

  // Update content
  const updateResult = await query(
    `UPDATE generated_content 
     SET content = $1, status = COALESCE($2, status), user_edits = $3, updated_at = NOW()
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [content, status, content !== originalContent ? content : null, contentId, req.user.id]
  );

  logger.logBusinessEvent('content_updated', req.user.id, {
    contentId,
    status,
    wasEdited: content !== originalContent
  });

  res.json({
    status: 'success',
    message: 'Content updated successfully',
    data: {
      content: updateResult.rows[0]
    }
  });
}));

// Delete content
router.delete('/:contentId', asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const deleteResult = await query(
    'DELETE FROM generated_content WHERE id = $1 AND user_id = $2 RETURNING id',
    [contentId, req.user.id]
  );

  if (deleteResult.rows.length === 0) {
    throw new AppError('Content not found', 404);
  }

  logger.logBusinessEvent('content_deleted', req.user.id, {
    contentId
  });

  res.json({
    status: 'success',
    message: 'Content deleted successfully'
  });
}));

// Submit feedback on generated content
router.post('/:contentId/feedback', asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { error, value } = feedbackSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { rating, feedback_text, feedback_type } = value;

  // Verify content ownership
  const contentResult = await query(
    'SELECT id FROM generated_content WHERE id = $1 AND user_id = $2',
    [contentId, req.user.id]
  );

  if (contentResult.rows.length === 0) {
    throw new AppError('Content not found', 404);
  }

  // Save feedback
  await query(
    `INSERT INTO user_feedback 
     (user_id, content_id, feedback_type, rating, feedback_text)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.user.id, contentId, feedback_type, rating, feedback_text]
  );

  logger.logBusinessEvent('content_feedback_submitted', req.user.id, {
    contentId,
    feedback_type,
    rating
  });

  res.json({
    status: 'success',
    message: 'Feedback submitted successfully'
  });
}));

// Get content statistics
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const timeframe = req.query.timeframe || '30'; // days

  const statsResult = await query(
    `SELECT 
      COUNT(*) as total_content,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '${parseInt(timeframe)} days' THEN 1 END) as recent_content,
      COUNT(CASE WHEN status = 'used' THEN 1 END) as used_content,
      COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_content,
      COUNT(DISTINCT content_type) as content_types_used,
      AVG(CASE WHEN user_edits IS NOT NULL THEN 1 ELSE 0 END) * 100 as edit_rate
     FROM generated_content 
     WHERE user_id = $1`,
    [req.user.id]
  );

  const stats = statsResult.rows[0];

  // Get content type breakdown
  const typeBreakdownResult = await query(
    `SELECT 
      content_type, 
      COUNT(*) as count,
      COUNT(CASE WHEN status = 'used' THEN 1 END) as used_count
     FROM generated_content 
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${parseInt(timeframe)} days'
     GROUP BY content_type
     ORDER BY count DESC`,
    [req.user.id]
  );

  res.json({
    status: 'success',
    data: {
      overview: {
        totalContent: parseInt(stats.total_content),
        recentContent: parseInt(stats.recent_content),
        usedContent: parseInt(stats.used_content),
        archivedContent: parseInt(stats.archived_content),
        contentTypesUsed: parseInt(stats.content_types_used),
        editRate: parseFloat(stats.edit_rate) || 0
      },
      contentTypeBreakdown: typeBreakdownResult.rows,
      timeframe: parseInt(timeframe)
    }
  });
}));

module.exports = router;