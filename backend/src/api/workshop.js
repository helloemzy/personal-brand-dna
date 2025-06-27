const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction, cache } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { analyzeWritingSample, generateBrandVoiceProfile } = require('../services/aiAnalysisService');
const logger = require('../utils/logger');

// Validation schemas
const workshopSchemas = {
  startWorkshop: {
    body: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  updateStep: {
    body: {
      type: 'object',
      properties: {
        step: { type: 'integer', minimum: 1, maximum: 5 },
        data: { type: 'object' }
      },
      required: ['step', 'data']
    }
  },
  saveProgress: {
    body: {
      type: 'object',
      properties: {
        currentStep: { type: 'integer', minimum: 1, maximum: 5 },
        completedSteps: { type: 'array', items: { type: 'integer' } },
        values: { type: 'object' },
        tonePreferences: { type: 'object' },
        audiencePersonas: { type: 'array' },
        writingSample: { type: 'object' },
        personalityQuiz: { type: 'object' }
      },
      required: ['currentStep']
    }
  }
};

// Start a new workshop session
router.post('/start', authenticateToken, validateRequest(workshopSchemas.startWorkshop), async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = `workshop_${Date.now()}_${uuidv4().substring(0, 8)}`;

    // Check for existing incomplete session
    const existingSession = await query(
      'SELECT id, session_id FROM workshop_sessions WHERE user_id = $1 AND is_completed = FALSE ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (existingSession.rows.length > 0) {
      // Return existing session
      return res.json({
        success: true,
        sessionId: existingSession.rows[0].session_id,
        isExisting: true,
        message: 'Continuing existing workshop session'
      });
    }

    // Create new session
    const result = await query(
      `INSERT INTO workshop_sessions (user_id, session_id, started_at) 
       VALUES ($1, $2, NOW()) 
       RETURNING id, session_id, started_at`,
      [userId, sessionId]
    );

    res.json({
      success: true,
      sessionId: result.rows[0].session_id,
      isExisting: false,
      startedAt: result.rows[0].started_at
    });
  } catch (error) {
    logger.error('Error starting workshop:', error);
    res.status(500).json({ success: false, error: 'Failed to start workshop session' });
  }
});

// Get workshop session status
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Get session with all related data
    const sessionResult = await query(
      'SELECT * FROM workshop_sessions WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workshop session not found' });
    }

    const session = sessionResult.rows[0];

    // Get all workshop data
    const [values, tonePrefs, personas, writingSample, quizResponses] = await Promise.all([
      query('SELECT * FROM workshop_values WHERE session_id = $1', [session.id]),
      query('SELECT * FROM workshop_tone_preferences WHERE session_id = $1', [session.id]),
      query('SELECT * FROM workshop_audience_personas WHERE session_id = $1', [session.id]),
      query('SELECT * FROM workshop_writing_samples WHERE session_id = $1', [session.id]),
      query('SELECT * FROM workshop_quiz_responses WHERE session_id = $1 ORDER BY answered_at', [session.id])
    ]);

    res.json({
      success: true,
      session: {
        ...session,
        values: values.rows,
        tonePreferences: tonePrefs.rows[0] || null,
        audiencePersonas: personas.rows,
        writingSample: writingSample.rows[0] || null,
        quizResponses: quizResponses.rows
      }
    });
  } catch (error) {
    logger.error('Error getting workshop session:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve workshop session' });
  }
});

// Save workshop progress
router.post('/session/:sessionId/save', authenticateToken, validateRequest(workshopSchemas.saveProgress), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { currentStep, completedSteps, values, tonePreferences, audiencePersonas, writingSample, personalityQuiz } = req.body;

    await withTransaction(async (client) => {
      // Verify session ownership
      const sessionResult = await client.query(
        'SELECT id FROM workshop_sessions WHERE session_id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Workshop session not found');
      }

      const sessionDbId = sessionResult.rows[0].id;

      // Update session
      await client.query(
        `UPDATE workshop_sessions 
         SET current_step = $1, completed_steps = $2, last_saved_at = NOW() 
         WHERE id = $3`,
        [currentStep, completedSteps || [], sessionDbId]
      );

      // Save values if provided
      if (values && completedSteps.includes(1)) {
        // Clear existing values
        await client.query('DELETE FROM workshop_values WHERE session_id = $1', [sessionDbId]);
        
        // Insert new values
        for (const valueId of values.selected) {
          const customValue = values.custom.find(v => v.id === valueId);
          const ranking = values.rankings[valueId] || null;
          
          await client.query(
            `INSERT INTO workshop_values 
             (session_id, value_id, value_name, value_category, value_description, is_custom, ranking)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              sessionDbId,
              valueId,
              customValue?.name || valueId,
              customValue?.category || 'standard',
              customValue?.description || '',
              !!customValue,
              ranking
            ]
          );
        }
      }

      // Save tone preferences if provided
      if (tonePreferences && completedSteps.includes(2)) {
        await client.query(
          'DELETE FROM workshop_tone_preferences WHERE session_id = $1',
          [sessionDbId]
        );
        
        await client.query(
          `INSERT INTO workshop_tone_preferences 
           (session_id, formal_casual, concise_detailed, analytical_creative, serious_playful)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sessionDbId,
            tonePreferences.formal_casual,
            tonePreferences.concise_detailed,
            tonePreferences.analytical_creative,
            tonePreferences.serious_playful
          ]
        );
      }

      // Save audience personas if provided
      if (audiencePersonas && completedSteps.includes(3)) {
        await client.query('DELETE FROM workshop_audience_personas WHERE session_id = $1', [sessionDbId]);
        
        for (const persona of audiencePersonas) {
          await client.query(
            `INSERT INTO workshop_audience_personas 
             (session_id, persona_id, name, role, industry, pain_points, goals, 
              communication_style, age_range, experience_level, company_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              sessionDbId,
              persona.id,
              persona.name,
              persona.role,
              persona.industry,
              persona.painPoints,
              persona.goals,
              persona.communicationStyle,
              persona.demographicInfo?.ageRange,
              persona.demographicInfo?.experience,
              persona.demographicInfo?.company_size
            ]
          );
        }
      }

      // Save writing sample if provided
      if (writingSample && completedSteps.includes(4)) {
        await client.query('DELETE FROM workshop_writing_samples WHERE session_id = $1', [sessionDbId]);
        
        await client.query(
          `INSERT INTO workshop_writing_samples 
           (session_id, sample_text, word_count, uploaded_at, readability_score, 
            sentiment_scores, style_metrics, analysis_completed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            sessionDbId,
            writingSample.text,
            writingSample.wordCount,
            writingSample.uploadedAt,
            writingSample.analysisResults?.readability,
            writingSample.analysisResults?.sentiment,
            writingSample.analysisResults?.styleMetrics,
            !!writingSample.analysisResults
          ]
        );
      }

      // Save quiz responses if provided
      if (personalityQuiz && completedSteps.includes(5)) {
        await client.query('DELETE FROM workshop_quiz_responses WHERE session_id = $1', [sessionDbId]);
        
        for (const response of personalityQuiz.responses) {
          // Find the dimension from the question
          const question = getQuizQuestion(response.questionId);
          const selectedOption = question?.options.find(opt => opt.value === response.answer);
          
          await client.query(
            `INSERT INTO workshop_quiz_responses 
             (session_id, question_id, answer, dimension, answered_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              sessionDbId,
              response.questionId,
              response.answer,
              selectedOption?.dimension || 'unknown',
              response.answeredAt
            ]
          );
        }
      }
    });

    // Clear cache for this session
    await cache.del(`workshop:${sessionId}`);

    res.json({
      success: true,
      message: 'Workshop progress saved successfully',
      lastSaved: new Date()
    });
  } catch (error) {
    logger.error('Error saving workshop progress:', error);
    res.status(500).json({ success: false, error: 'Failed to save workshop progress' });
  }
});

// Complete workshop and generate analysis
router.post('/session/:sessionId/complete', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const result = await withTransaction(async (client) => {
      // Verify session and get all data
      const sessionResult = await client.query(
        'SELECT * FROM workshop_sessions WHERE session_id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Workshop session not found');
      }

      const session = sessionResult.rows[0];

      // Check if all steps are completed
      if (!session.completed_steps.includes(1) || !session.completed_steps.includes(2) ||
          !session.completed_steps.includes(3) || !session.completed_steps.includes(4) ||
          !session.completed_steps.includes(5)) {
        throw new Error('All workshop steps must be completed');
      }

      // Get all workshop data for analysis
      const [values, tonePrefs, personas, writingSample, quizResponses] = await Promise.all([
        client.query('SELECT * FROM workshop_values WHERE session_id = $1', [session.id]),
        client.query('SELECT * FROM workshop_tone_preferences WHERE session_id = $1', [session.id]),
        client.query('SELECT * FROM workshop_audience_personas WHERE session_id = $1', [session.id]),
        client.query('SELECT * FROM workshop_writing_samples WHERE session_id = $1', [session.id]),
        client.query('SELECT * FROM workshop_quiz_responses WHERE session_id = $1', [session.id])
      ]);

      // Generate brand voice profile using AI service
      const brandVoiceProfile = await generateBrandVoiceProfile({
        values: values.rows,
        tonePreferences: tonePrefs.rows[0],
        personas: personas.rows,
        writingSample: writingSample.rows[0],
        quizResponses: quizResponses.rows
      });

      // Save analysis results
      const analysisResult = await client.query(
        `INSERT INTO workshop_analysis_results 
         (session_id, user_id, brand_voice_profile, content_pillars, 
          communication_style, personality_traits, recommended_content_types, confidence_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          session.id,
          userId,
          brandVoiceProfile,
          brandVoiceProfile.contentPillars,
          brandVoiceProfile.communicationStyle,
          brandVoiceProfile.personalityTraits,
          brandVoiceProfile.recommendedContentTypes,
          brandVoiceProfile.confidenceScore
        ]
      );

      // Mark session as completed
      await client.query(
        'UPDATE workshop_sessions SET is_completed = TRUE, completed_at = NOW() WHERE id = $1',
        [session.id]
      );

      return analysisResult.rows[0];
    });

    res.json({
      success: true,
      message: 'Workshop completed successfully',
      analysisResults: result
    });
  } catch (error) {
    logger.error('Error completing workshop:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to complete workshop' });
  }
});

// Get all user's workshop sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT 
        ws.*,
        war.confidence_score,
        war.created_at as analysis_created_at
       FROM workshop_sessions ws
       LEFT JOIN workshop_analysis_results war ON ws.id = war.session_id
       WHERE ws.user_id = $1
       ORDER BY ws.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      sessions: result.rows
    });
  } catch (error) {
    logger.error('Error getting workshop sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve workshop sessions' });
  }
});

// Analyze writing sample
router.post('/analyze-writing', authenticateToken, async (req, res) => {
  try {
    const { text, sessionId } = req.body;
    
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'Text must be at least 50 characters long' 
      });
    }

    // Get additional context if sessionId provided
    let context = {};
    if (sessionId) {
      const sessionResult = await query(
        'SELECT id FROM workshop_sessions WHERE session_id = $1 AND user_id = $2',
        [sessionId, req.user.id]
      );
      
      if (sessionResult.rows.length > 0) {
        const valuesResult = await query(
          'SELECT value_name FROM workshop_values WHERE session_id = $1',
          [sessionResult.rows[0].id]
        );
        context.values = valuesResult.rows.map(v => v.value_name);
      }
    }

    // Analyze the writing sample
    const analysis = await analyzeWritingSample(text, context);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error analyzing writing:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze writing sample' 
    });
  }
});


// Helper to get quiz question data (simplified)
function getQuizQuestion(questionId) {
  // This would normally be imported from a constants file
  const questions = {
    q1: { options: [
      { value: 'a', dimension: 'analytical' },
      { value: 'b', dimension: 'creative' },
      { value: 'c', dimension: 'concise' },
      { value: 'd', dimension: 'detailed' }
    ]}
    // ... other questions
  };
  return questions[questionId];
}

module.exports = router;