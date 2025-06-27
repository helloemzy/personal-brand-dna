const { query } = require('../_lib/database');
const { errorHandler } = require('../_lib/errorHandler');
const { authenticateToken } = require('../_lib/auth');

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
    const { status, limit = 10, offset = 0 } = req.query;

    // Build query
    let queryText = `
      SELECT 
        ws.id,
        ws.session_type,
        ws.status,
        ws.current_step,
        ws.completed_steps,
        ws.started_at,
        ws.completed_at,
        ws.updated_at,
        COUNT(DISTINCT wv.id) as values_count,
        COUNT(DISTINCT ap.id) as personas_count,
        CASE WHEN tp.id IS NOT NULL THEN true ELSE false END as has_tone_preferences,
        CASE WHEN w.id IS NOT NULL THEN true ELSE false END as has_writing_sample,
        COUNT(DISTINCT pq.id) as quiz_responses_count
      FROM workshop_sessions ws
      LEFT JOIN workshop_values wv ON ws.id = wv.session_id
      LEFT JOIN workshop_tone_preferences tp ON ws.id = tp.session_id
      LEFT JOIN workshop_audience_personas ap ON ws.id = ap.session_id
      LEFT JOIN workshop_writing_samples w ON ws.id = w.session_id
      LEFT JOIN workshop_personality_quiz pq ON ws.id = pq.session_id
      WHERE ws.user_id = $1
    `;

    const queryParams = [userId];
    
    if (status) {
      queryText += ` AND ws.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    queryText += `
      GROUP BY ws.id, tp.id, w.id
      ORDER BY ws.updated_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    // Get sessions
    const result = await query(queryText, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM workshop_sessions WHERE user_id = $1';
    const countParams = [userId];
    
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const countResult = await query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Format sessions
    const sessions = result.rows.map(session => ({
      id: session.id,
      sessionType: session.session_type,
      status: session.status,
      currentStep: session.current_step,
      completedSteps: session.completed_steps,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      updatedAt: session.updated_at,
      progress: {
        values: session.values_count > 0,
        tonePreferences: session.has_tone_preferences,
        audiencePersonas: session.personas_count > 0,
        writingSample: session.has_writing_sample,
        personalityQuiz: session.quiz_responses_count >= 10,
        completionPercentage: calculateCompletionPercentage({
          values: session.values_count > 0,
          tonePreferences: session.has_tone_preferences,
          audiencePersonas: session.personas_count > 0,
          writingSample: session.has_writing_sample,
          personalityQuiz: session.quiz_responses_count >= 10
        })
      }
    }));

    res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < totalCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching workshop sessions:', error);
    errorHandler(error, res);
  }
};

function calculateCompletionPercentage(progress) {
  const steps = ['values', 'tonePreferences', 'audiencePersonas', 'writingSample', 'personalityQuiz'];
  const completed = steps.filter(step => progress[step]).length;
  return Math.round((completed / steps.length) * 100);
}