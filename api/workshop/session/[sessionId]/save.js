const { withTransaction } = require('../../../_lib/database');
const { errorHandler } = require('../../../_lib/errorHandler');
const { authenticateToken } = require('../../../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const authResult = await authenticateToken(req);
    if (!authResult.success) {
      return res.status(401).json({ error: authResult.message });
    }

    const userId = authResult.userId;
    const sessionId = req.query.sessionId;
    const { 
      currentStep, 
      values, 
      tonePreferences, 
      audiencePersonas, 
      writingSample, 
      personalityQuiz,
      sessionData = {}
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await withTransaction(async (client) => {
      // Verify session belongs to user
      const sessionCheck = await client.query(
        'SELECT id, status FROM workshop_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      if (sessionCheck.rows.length === 0) {
        throw new Error('Workshop session not found');
      }

      if (sessionCheck.rows[0].status !== 'in_progress') {
        throw new Error('Workshop session is not active');
      }

      // Update session data
      const completedSteps = {};
      if (values) completedSteps.values = true;
      if (tonePreferences) completedSteps.tonePreferences = true;
      if (audiencePersonas) completedSteps.audiencePersonas = true;
      if (writingSample) completedSteps.writingSample = true;
      if (personalityQuiz) completedSteps.personalityQuiz = true;

      await client.query(
        `UPDATE workshop_sessions 
         SET current_step = $1, 
             completed_steps = completed_steps || $2::jsonb, 
             session_data = session_data || $3::jsonb,
             updated_at = NOW()
         WHERE id = $4`,
        [currentStep || 1, JSON.stringify(completedSteps), JSON.stringify(sessionData), sessionId]
      );

      // Save values if provided
      if (values) {
        // Delete existing values
        await client.query('DELETE FROM workshop_values WHERE session_id = $1', [sessionId]);
        
        // Insert new values
        if (values.selected && values.selected.length > 0) {
          for (const value of values.selected) {
            await client.query(
              `INSERT INTO workshop_values (session_id, value_name, value_category, is_custom, ranking)
               VALUES ($1, $2, $3, false, $4)`,
              [sessionId, value, values.categories?.[value] || 'other', values.rankings?.[value] || 3]
            );
          }
        }

        // Insert custom values
        if (values.custom && values.custom.length > 0) {
          for (const custom of values.custom) {
            await client.query(
              `INSERT INTO workshop_values (session_id, value_name, value_category, is_custom, ranking)
               VALUES ($1, $2, $3, true, $4)`,
              [sessionId, custom.name, custom.category || 'custom', custom.ranking || 3]
            );
          }
        }
      }

      // Save tone preferences if provided
      if (tonePreferences) {
        await client.query(
          `INSERT INTO workshop_tone_preferences 
           (session_id, formal_casual, concise_detailed, analytical_creative, serious_playful)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id) 
           DO UPDATE SET 
             formal_casual = $2,
             concise_detailed = $3,
             analytical_creative = $4,
             serious_playful = $5,
             updated_at = NOW()`,
          [sessionId, 
           tonePreferences.formalCasual || 50,
           tonePreferences.conciseDetailed || 50,
           tonePreferences.analyticalCreative || 50,
           tonePreferences.seriousPlayful || 50
          ]
        );
      }

      // Save audience personas if provided
      if (audiencePersonas && audiencePersonas.length > 0) {
        // Delete existing personas
        await client.query('DELETE FROM workshop_audience_personas WHERE session_id = $1', [sessionId]);
        
        // Insert new personas
        for (const persona of audiencePersonas) {
          await client.query(
            `INSERT INTO workshop_audience_personas 
             (session_id, persona_name, job_title, industry, pain_points, goals, communication_style)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [sessionId, 
             persona.name,
             persona.jobTitle,
             persona.industry,
             JSON.stringify(persona.painPoints || []),
             JSON.stringify(persona.goals || []),
             persona.communicationStyle
            ]
          );
        }
      }

      // Save writing sample if provided
      if (writingSample) {
        await client.query(
          `INSERT INTO workshop_writing_samples 
           (session_id, sample_text, word_count, analysis_results)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (session_id) 
           DO UPDATE SET 
             sample_text = $2,
             word_count = $3,
             analysis_results = $4,
             updated_at = NOW()`,
          [sessionId, 
           writingSample.text,
           writingSample.wordCount || writingSample.text?.split(/\s+/).length || 0,
           JSON.stringify(writingSample.analysisResults || {})
          ]
        );
      }

      // Save personality quiz responses if provided
      if (personalityQuiz && personalityQuiz.length > 0) {
        // Delete existing responses
        await client.query('DELETE FROM workshop_personality_quiz WHERE session_id = $1', [sessionId]);
        
        // Insert new responses
        for (const response of personalityQuiz) {
          await client.query(
            `INSERT INTO workshop_personality_quiz 
             (session_id, question_id, answer)
             VALUES ($1, $2, $3)`,
            [sessionId, response.questionId, response.answer]
          );
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Workshop session saved successfully'
    });
  } catch (error) {
    console.error('Error saving workshop session:', error);
    errorHandler(error, res);
  }
};