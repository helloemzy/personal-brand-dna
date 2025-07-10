const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const Joi = require('joi');
const axios = require('axios');
const { query, withTransaction } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requireVerifiedEmail } = require('../middleware/auth');
const { voiceRateLimit } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

// Configure multer for audio file uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    key: function (req, file, cb) {
      const userId = req.user.id;
      const timestamp = Date.now();
      const filename = `voice-recordings/${userId}/${timestamp}-${file.originalname}`;
      cb(null, filename);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, {
        userId: req.user.id,
        uploadedAt: new Date().toISOString()
      });
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: function (req, file, cb) {
    // Allow only audio files
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/aac',
      'audio/ogg',
      'audio/webm',
      'audio/mp4',
      'audio/x-m4a'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only audio files are allowed', 400), false);
    }
  }
});

// Validation schemas
const conversationResponseSchema = Joi.object({
  questionId: Joi.string().required(),
  response: Joi.string().required(),
  isComplete: Joi.boolean().default(false)
});

const voiceAnalysisRequestSchema = Joi.object({
  conversationId: Joi.string().uuid().required()
});

// Start voice discovery conversation
router.post('/conversation/start', voiceRateLimit, asyncHandler(async (req, res) => {
  // Check if user already has active conversations
  const activeConversationResult = await query(
    `SELECT id FROM voice_profiles 
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC 
     LIMIT 1`,
    [req.user.id]
  );

  // Check subscription limits based on user tier
  const subscriptionLimits = {
    free: 1,
    professional: 3,
    executive: 10,
    enterprise: -1 // unlimited
  };

  const userLimit = subscriptionLimits[req.user.subscription_tier] || subscriptionLimits.free;
  
  if (userLimit !== -1) {
    const existingProfilesResult = await query(
      'SELECT COUNT(*) as count FROM voice_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    const existingCount = parseInt(existingProfilesResult.rows[0].count);
    if (existingCount >= userLimit) {
      return res.status(403).json({
        status: 'error',
        message: `Your ${req.user.subscription_tier} plan allows up to ${userLimit} voice profile${userLimit === 1 ? '' : 's'}. Upgrade to create more.`
      });
    }
  }

  // Create new conversation session
  const conversationId = require('uuid').v4();

  // Get first question from conversation flow
  const firstQuestion = {
    id: 'intro',
    type: 'introduction',
    question: "Hi! I'm here to help discover your unique professional voice. Let's start with something simple - can you tell me about your current role and what you're passionate about in your work?",
    followUpPrompts: [
      "What does a typical day look like for you?",
      "What aspects of your work energize you the most?"
    ],
    expectedDuration: 60 // seconds
  };

  logger.logBusinessEvent('voice_conversation_started', req.user.id, {
    conversationId,
    subscriptionTier: req.user.subscription_tier
  });

  res.json({
    status: 'success',
    data: {
      conversationId,
      currentQuestion: firstQuestion,
      totalQuestions: 5,
      currentQuestionNumber: 1,
      estimatedTimeRemaining: '4-5 minutes'
    }
  });
}));

// Upload audio response
router.post('/conversation/:conversationId/audio', 
  voiceRateLimit,
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;

    if (!req.file) {
      throw new AppError('Audio file is required', 400);
    }

    const audioUrl = req.file.location;
    const questionId = req.body.questionId;

    if (!questionId) {
      throw new AppError('Question ID is required', 400);
    }

    // Send audio to AI pipeline for transcription
    try {
      const aiPipelineResponse = await axios.post(
        `${process.env.AI_PIPELINE_URL || 'http://localhost:8000'}/transcribe`,
        {
          audioUrl,
          userId: req.user.id,
          conversationId,
          questionId
        },
        {
          timeout: 60000 // 1 minute timeout
        }
      );

      const transcription = aiPipelineResponse.data.transcription;

      // Get next question based on response
      const nextQuestion = await getNextQuestion(questionId, transcription);

      logger.logBusinessEvent('audio_transcribed', req.user.id, {
        conversationId,
        questionId,
        audioUrl,
        transcriptionLength: transcription.length
      });

      res.json({
        status: 'success',
        data: {
          transcription,
          nextQuestion,
          conversationComplete: !nextQuestion
        }
      });

    } catch (error) {
      logger.error('Audio transcription failed:', error);
      
      // Clean up uploaded file if transcription fails
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: req.file.key
        }).promise();
      } catch (deleteError) {
        logger.error('Failed to clean up audio file:', deleteError);
      }

      throw new AppError('Audio processing failed. Please try again.', 500);
    }
  })
);

// Submit text response (fallback for audio issues)
router.post('/conversation/:conversationId/text', 
  voiceRateLimit,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { error, value } = conversationResponseSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message
      });
    }

    const { questionId, response, isComplete } = value;

    // Store response
    const responseData = {
      conversationId,
      questionId,
      response,
      responseType: 'text',
      timestamp: new Date().toISOString()
    };

    // Get next question or complete conversation
    let nextQuestion = null;
    if (!isComplete) {
      nextQuestion = await getNextQuestion(questionId, response);
    }

    logger.logBusinessEvent('text_response_submitted', req.user.id, {
      conversationId,
      questionId,
      responseLength: response.length,
      isComplete
    });

    res.json({
      status: 'success',
      data: {
        responseRecorded: true,
        nextQuestion,
        conversationComplete: isComplete || !nextQuestion
      }
    });
  })
);

// Complete conversation and trigger voice analysis
router.post('/conversation/:conversationId/complete', 
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;

    try {
      // Trigger voice analysis in AI pipeline
      const analysisResponse = await axios.post(
        `${process.env.AI_PIPELINE_URL || 'http://localhost:8000'}/analyze-voice`,
        {
          userId: req.user.id,
          conversationId
        },
        {
          timeout: 120000 // 2 minute timeout for analysis
        }
      );

      const { voiceSignature, confidenceScore, metadata } = analysisResponse.data;

      // Save voice profile to database
      const voiceProfileResult = await query(
        `INSERT INTO voice_profiles 
         (user_id, voice_signature, confidence_score, analysis_metadata) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [req.user.id, JSON.stringify(voiceSignature), confidenceScore, JSON.stringify(metadata)]
      );

      const voiceProfileId = voiceProfileResult.rows[0].id;

      logger.logBusinessEvent('voice_profile_created', req.user.id, {
        conversationId,
        voiceProfileId,
        confidenceScore,
        analysisMetadata: metadata
      });

      res.json({
        status: 'success',
        message: 'Voice analysis complete! Your unique voice profile has been created.',
        data: {
          voiceProfileId,
          confidenceScore,
          voiceSignature,
          metadata: {
            totalQuestions: metadata.totalQuestions,
            analysisTime: metadata.analysisTime,
            voiceDimensions: metadata.voiceDimensions
          }
        }
      });

    } catch (error) {
      logger.error('Voice analysis failed:', error);
      throw new AppError('Voice analysis failed. Please try again or contact support.', 500);
    }
  })
);

// Get user's voice profiles
router.get('/profiles', asyncHandler(async (req, res) => {
  const profilesResult = await query(
    `SELECT 
      id, voice_signature, confidence_score, analysis_metadata, 
      created_at, updated_at
     FROM voice_profiles 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  const profiles = profilesResult.rows.map(profile => ({
    id: profile.id,
    confidenceScore: profile.confidence_score,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    metadata: profile.analysis_metadata,
    // Don't expose full voice signature for security
    voiceDimensions: Object.keys(profile.voice_signature || {}).length
  }));

  res.json({
    status: 'success',
    data: {
      profiles,
      totalProfiles: profiles.length
    }
  });
}));

// Get specific voice profile
router.get('/profiles/:profileId', asyncHandler(async (req, res) => {
  const { profileId } = req.params;

  const profileResult = await query(
    `SELECT 
      id, voice_signature, confidence_score, analysis_metadata, 
      created_at, updated_at
     FROM voice_profiles 
     WHERE id = $1 AND user_id = $2`,
    [profileId, req.user.id]
  );

  if (profileResult.rows.length === 0) {
    throw new AppError('Voice profile not found', 404);
  }

  const profile = profileResult.rows[0];

  res.json({
    status: 'success',
    data: {
      profile: {
        id: profile.id,
        voiceSignature: profile.voice_signature,
        confidenceScore: profile.confidence_score,
        metadata: profile.analysis_metadata,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    }
  });
}));

// Delete voice profile
router.delete('/profiles/:profileId', asyncHandler(async (req, res) => {
  const { profileId } = req.params;

  const deleteResult = await query(
    'DELETE FROM voice_profiles WHERE id = $1 AND user_id = $2 RETURNING id',
    [profileId, req.user.id]
  );

  if (deleteResult.rows.length === 0) {
    throw new AppError('Voice profile not found', 404);
  }

  logger.logBusinessEvent('voice_profile_deleted', req.user.id, {
    voiceProfileId: profileId
  });

  res.json({
    status: 'success',
    message: 'Voice profile deleted successfully'
  });
}));

// Helper function to get next question in conversation flow
async function getNextQuestion(currentQuestionId, response) {
  const questionFlow = {
    'intro': {
      id: 'communication_style',
      type: 'style_analysis',
      question: "Great! Now, when you're explaining complex ideas to colleagues, how do you typically approach it? Walk me through your thought process.",
      followUpPrompts: [
        "Do you prefer to start with the big picture or dive into details?",
        "How do you handle it when someone doesn't understand?"
      ],
      expectedDuration: 60
    },
    'communication_style': {
      id: 'challenge_response',
      type: 'problem_solving',
      question: "Tell me about a recent challenge you faced at work and how you approached solving it. What was your thought process?",
      followUpPrompts: [
        "How did you communicate the solution to others?",
        "What did you learn from that experience?"
      ],
      expectedDuration: 90
    },
    'challenge_response': {
      id: 'leadership_style',
      type: 'leadership_assessment',
      question: "When you need to influence or persuade others - whether it's your team, peers, or leadership - what's your approach?",
      followUpPrompts: [
        "Can you give me a specific example?",
        "What tone do you typically use?"
      ],
      expectedDuration: 75
    },
    'leadership_style': {
      id: 'personal_values',
      type: 'values_assessment',
      question: "What professional values or principles are most important to you, and how do they show up in how you communicate and work?",
      followUpPrompts: [
        "How do these values influence your decisions?",
        "How do you communicate these values to others?"
      ],
      expectedDuration: 60
    },
    'personal_values': null // End of conversation
  };

  return questionFlow[currentQuestionId] || null;
}

module.exports = router;