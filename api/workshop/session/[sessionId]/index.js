const { query } = require('../../../_lib/database');
const { errorHandler } = require('../../../_lib/errorHandler');
const { authenticateToken } = require('../../../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
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

    // Get session data
    const result = await query(
      `SELECT 
        ws.id,
        ws.session_type,
        ws.status,
        ws.current_step,
        ws.completed_steps,
        ws.session_data,
        ws.started_at,
        ws.completed_at,
        ws.updated_at,
        COUNT(DISTINCT wv.id) as values_count,
        tp.id as tone_preferences_id,
        COUNT(DISTINCT ap.id) as personas_count,
        w.id as writing_sample_id,
        COUNT(DISTINCT pq.id) as quiz_responses_count
      FROM workshop_sessions ws
      LEFT JOIN workshop_values wv ON ws.id = wv.session_id
      LEFT JOIN workshop_tone_preferences tp ON ws.id = tp.session_id
      LEFT JOIN workshop_audience_personas ap ON ws.id = ap.session_id
      LEFT JOIN workshop_writing_samples w ON ws.id = w.session_id
      LEFT JOIN workshop_personality_quiz pq ON ws.id = pq.session_id
      WHERE ws.id = $1 AND ws.user_id = $2
      GROUP BY ws.id, tp.id, w.id`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workshop session not found' });
    }

    const session = result.rows[0];

    // Get detailed data for each step if needed
    const sessionData = {
      id: session.id,
      sessionType: session.session_type,
      status: session.status,
      currentStep: session.current_step,
      completedSteps: session.completed_steps,
      sessionData: session.session_data,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      updatedAt: session.updated_at,
      progress: {
        values: session.values_count > 0,
        tonePreferences: !!session.tone_preferences_id,
        audiencePersonas: session.personas_count > 0,
        writingSample: !!session.writing_sample_id,
        personalityQuiz: session.quiz_responses_count >= 10
      }
    };

    res.status(200).json({
      success: true,
      data: sessionData
    });
  } catch (error) {
    console.error('Error fetching workshop session:', error);
    errorHandler(error, res);
  }
};