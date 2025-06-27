const { withTransaction } = require('../_lib/database');
const { errorHandler } = require('../_lib/errorHandler');
const { authenticateToken } = require('../_lib/auth');

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
    const { sessionType = 'brand_workshop' } = req.body;

    // Start a new workshop session
    const session = await withTransaction(async (client) => {
      // End any active sessions for this user
      await client.query(
        `UPDATE workshop_sessions 
         SET status = 'abandoned', updated_at = NOW() 
         WHERE user_id = $1 AND status = 'in_progress'`,
        [userId]
      );

      // Create new session
      const result = await client.query(
        `INSERT INTO workshop_sessions 
         (user_id, session_type, status, current_step, completed_steps, session_data, started_at) 
         VALUES ($1, $2, 'in_progress', 1, '{}', '{}', NOW()) 
         RETURNING id, session_type, status, current_step, started_at`,
        [userId, sessionType]
      );

      return result.rows[0];
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        sessionType: session.session_type,
        status: session.status,
        currentStep: session.current_step,
        startedAt: session.started_at
      }
    });
  } catch (error) {
    console.error('Error starting workshop session:', error);
    errorHandler(error, res);
  }
};