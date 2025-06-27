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

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const result = await withTransaction(async (client) => {
      // Verify session belongs to user and is in progress
      const sessionCheck = await client.query(
        'SELECT id, status, completed_steps FROM workshop_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      if (sessionCheck.rows.length === 0) {
        throw new Error('Workshop session not found');
      }

      if (sessionCheck.rows[0].status !== 'in_progress') {
        throw new Error('Workshop session is not active');
      }

      const completedSteps = sessionCheck.rows[0].completed_steps || {};

      // Verify all steps are completed
      const requiredSteps = ['values', 'tonePreferences', 'audiencePersonas', 'writingSample', 'personalityQuiz'];
      const missingSteps = requiredSteps.filter(step => !completedSteps[step]);

      if (missingSteps.length > 0) {
        throw new Error(`Please complete all workshop steps. Missing: ${missingSteps.join(', ')}`);
      }

      // Generate brand profile from workshop data
      const brandProfileData = await generateBrandProfile(client, sessionId);

      // Create or update user's brand profile
      const brandProfileResult = await client.query(
        `INSERT INTO user_brand_profiles 
         (user_id, workshop_session_id, profile_data, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           workshop_session_id = $2,
           profile_data = $3,
           is_active = true,
           updated_at = NOW()
         RETURNING id`,
        [userId, sessionId, JSON.stringify(brandProfileData)]
      );

      // Mark session as completed
      await client.query(
        `UPDATE workshop_sessions 
         SET status = 'completed', 
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId]
      );

      return {
        sessionId,
        brandProfileId: brandProfileResult.rows[0].id,
        brandProfile: brandProfileData
      };
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Workshop completed successfully! Your brand profile has been created.'
    });
  } catch (error) {
    console.error('Error completing workshop session:', error);
    errorHandler(error, res);
  }
};

// Helper function to generate brand profile from workshop data
async function generateBrandProfile(client, sessionId) {
  // Fetch all workshop data
  const [values, tonePrefs, personas, writingSample, quizResponses] = await Promise.all([
    client.query('SELECT * FROM workshop_values WHERE session_id = $1', [sessionId]),
    client.query('SELECT * FROM workshop_tone_preferences WHERE session_id = $1', [sessionId]),
    client.query('SELECT * FROM workshop_audience_personas WHERE session_id = $1', [sessionId]),
    client.query('SELECT * FROM workshop_writing_samples WHERE session_id = $1', [sessionId]),
    client.query('SELECT * FROM workshop_personality_quiz WHERE session_id = $1', [sessionId])
  ]);

  // Process and structure the brand profile
  const brandProfile = {
    values: {
      core: values.rows.filter(v => v.ranking >= 4).map(v => ({
        name: v.value_name,
        category: v.value_category,
        ranking: v.ranking,
        isCustom: v.is_custom
      })),
      secondary: values.rows.filter(v => v.ranking < 4).map(v => ({
        name: v.value_name,
        category: v.value_category,
        ranking: v.ranking,
        isCustom: v.is_custom
      }))
    },
    toneProfile: tonePrefs.rows.length > 0 ? {
      formalCasual: tonePrefs.rows[0].formal_casual,
      conciseDetailed: tonePrefs.rows[0].concise_detailed,
      analyticalCreative: tonePrefs.rows[0].analytical_creative,
      seriousPlayful: tonePrefs.rows[0].serious_playful
    } : null,
    targetAudience: personas.rows.map(p => ({
      name: p.persona_name,
      jobTitle: p.job_title,
      industry: p.industry,
      painPoints: p.pain_points,
      goals: p.goals,
      communicationStyle: p.communication_style
    })),
    writingStyle: writingSample.rows.length > 0 ? {
      sampleProvided: true,
      wordCount: writingSample.rows[0].word_count,
      analysisResults: writingSample.rows[0].analysis_results
    } : null,
    personalityProfile: processPersonalityQuiz(quizResponses.rows),
    createdAt: new Date().toISOString()
  };

  return brandProfile;
}

// Helper function to process personality quiz responses
function processPersonalityQuiz(responses) {
  if (responses.length === 0) return null;

  // Calculate personality dimensions based on responses
  const dimensions = {
    leadership: 0,
    innovation: 0,
    analytical: 0,
    collaborative: 0,
    strategic: 0
  };

  // Simple scoring logic (can be enhanced)
  responses.forEach(response => {
    const answer = response.answer.toLowerCase();
    if (answer.includes('lead') || answer.includes('direct')) dimensions.leadership++;
    if (answer.includes('new') || answer.includes('creative')) dimensions.innovation++;
    if (answer.includes('data') || answer.includes('analyze')) dimensions.analytical++;
    if (answer.includes('team') || answer.includes('together')) dimensions.collaborative++;
    if (answer.includes('plan') || answer.includes('strategy')) dimensions.strategic++;
  });

  // Normalize scores
  const total = Object.values(dimensions).reduce((a, b) => a + b, 0);
  if (total > 0) {
    Object.keys(dimensions).forEach(key => {
      dimensions[key] = Math.round((dimensions[key] / total) * 100);
    });
  }

  return dimensions;
}