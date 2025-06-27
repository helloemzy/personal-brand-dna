const { withTransaction, query } = require('../_lib/database');
const { errorHandler } = require('../_lib/errorHandler');
const { authenticateToken } = require('../_lib/auth');

module.exports = async (req, res) => {
  try {
    // Authenticate user
    const authResult = await authenticateToken(req);
    if (!authResult.success) {
      return res.status(401).json({ error: authResult.message });
    }

    const userId = authResult.userId;

    if (req.method === 'GET') {
      // Get calendar events
      const { 
        startDate,
        endDate,
        status,
        contentType,
        limit = 100,
        offset = 0
      } = req.query;

      let queryText = `
        SELECT 
          ce.id,
          ce.content_id,
          ce.title,
          ce.description,
          ce.content_type,
          ce.status,
          ce.scheduled_date,
          ce.scheduled_time,
          ce.time_zone,
          ce.reminder_sent,
          ce.series_id,
          ce.created_at,
          ce.updated_at,
          gc.topic,
          gc.generated_text,
          cs.series_name,
          cs.total_parts
        FROM content_calendar_events ce
        LEFT JOIN generated_content gc ON ce.content_id = gc.id
        LEFT JOIN content_series cs ON ce.series_id = cs.id
        WHERE ce.user_id = $1
      `;

      const queryParams = [userId];

      // Apply filters
      if (startDate) {
        queryText += ` AND ce.scheduled_date >= $${queryParams.length + 1}`;
        queryParams.push(startDate);
      }

      if (endDate) {
        queryText += ` AND ce.scheduled_date <= $${queryParams.length + 1}`;
        queryParams.push(endDate);
      }

      if (status) {
        queryText += ` AND ce.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (contentType) {
        queryText += ` AND ce.content_type = $${queryParams.length + 1}`;
        queryParams.push(contentType);
      }

      queryText += ` ORDER BY ce.scheduled_date ASC, ce.scheduled_time ASC
                     LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      
      queryParams.push(limit, offset);

      const result = await query(queryText, queryParams);

      // Get stats for the period
      let statsQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(DISTINCT series_id) as series_count
        FROM content_calendar_events
        WHERE user_id = $1
      `;
      const statsParams = [userId];

      if (startDate) {
        statsQuery += ` AND scheduled_date >= $${statsParams.length + 1}`;
        statsParams.push(startDate);
      }

      if (endDate) {
        statsQuery += ` AND scheduled_date <= $${statsParams.length + 1}`;
        statsParams.push(endDate);
      }

      const statsResult = await query(statsQuery, statsParams);
      const stats = statsResult.rows[0];

      res.status(200).json({
        success: true,
        data: {
          events: result.rows,
          stats: {
            totalEvents: parseInt(stats.total_events),
            scheduledCount: parseInt(stats.scheduled_count),
            publishedCount: parseInt(stats.published_count),
            draftCount: parseInt(stats.draft_count),
            seriesCount: parseInt(stats.series_count)
          }
        }
      });

    } else if (req.method === 'POST') {
      // Create calendar event
      const { 
        contentId,
        title,
        description,
        contentType = 'post',
        scheduledDate,
        scheduledTime,
        timeZone = 'UTC',
        seriesId
      } = req.body;

      if (!title || !scheduledDate) {
        return res.status(400).json({ error: 'Title and scheduled date are required' });
      }

      const event = await withTransaction(async (client) => {
        // Check for conflicts
        const conflictCheck = await client.query(
          `SELECT id FROM content_calendar_events 
           WHERE user_id = $1 
           AND scheduled_date = $2 
           AND scheduled_time = $3
           AND status != 'cancelled'`,
          [userId, scheduledDate, scheduledTime || '12:00:00']
        );

        if (conflictCheck.rows.length > 0) {
          throw new Error('Another event is already scheduled at this time');
        }

        // Create event
        const result = await client.query(
          `INSERT INTO content_calendar_events 
           (user_id, content_id, title, description, content_type, status, 
            scheduled_date, scheduled_time, time_zone, series_id)
           VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9)
           RETURNING *`,
          [userId, contentId, title, description, contentType, 
           scheduledDate, scheduledTime || '12:00:00', timeZone, seriesId]
        );

        return result.rows[0];
      });

      res.status(201).json({
        success: true,
        data: event,
        message: 'Calendar event created successfully'
      });

    } else if (req.method === 'PUT') {
      // Update calendar event
      const { eventId } = req.query;
      const updates = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const updatedEvent = await withTransaction(async (client) => {
        // Verify ownership
        const ownership = await client.query(
          'SELECT id FROM content_calendar_events WHERE id = $1 AND user_id = $2',
          [eventId, userId]
        );

        if (ownership.rows.length === 0) {
          throw new Error('Calendar event not found');
        }

        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];
        let paramCount = 2;

        const allowedFields = ['title', 'description', 'content_type', 'status', 
                              'scheduled_date', 'scheduled_time', 'time_zone'];

        for (const field of allowedFields) {
          if (updates[field] !== undefined) {
            updateFields.push(`${field} = $${paramCount}`);
            updateValues.push(updates[field]);
            paramCount++;
          }
        }

        if (updateFields.length === 0) {
          throw new Error('No valid fields to update');
        }

        updateFields.push('updated_at = NOW()');

        const result = await client.query(
          `UPDATE content_calendar_events 
           SET ${updateFields.join(', ')}
           WHERE id = $1
           RETURNING *`,
          [eventId, ...updateValues]
        );

        return result.rows[0];
      });

      res.status(200).json({
        success: true,
        data: updatedEvent,
        message: 'Calendar event updated successfully'
      });

    } else if (req.method === 'DELETE') {
      // Delete calendar event
      const { eventId } = req.query;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      await query(
        'DELETE FROM content_calendar_events WHERE id = $1 AND user_id = $2',
        [eventId, userId]
      );

      res.status(200).json({
        success: true,
        message: 'Calendar event deleted successfully'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error managing calendar events:', error);
    errorHandler(error, res);
  }
};