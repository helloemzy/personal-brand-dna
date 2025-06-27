const express = require('express');
const router = express.Router();
const { query, withTransaction, cache } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const logger = require('../utils/logger');
const { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

// Validation schemas
const calendarSchemas = {
  createEvent: {
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        contentType: { 
          type: 'string', 
          enum: ['post', 'article', 'carousel', 'video', 'story', 'poll'] 
        },
        contentBody: { type: 'string' },
        contentData: { type: 'object' },
        scheduledFor: { type: 'string', format: 'date-time' },
        timeZone: { type: 'string' },
        platforms: { type: 'object' },
        hashtags: { type: 'array', items: { type: 'string' } },
        mentions: { type: 'array', items: { type: 'string' } },
        color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        sourceType: { 
          type: 'string', 
          enum: ['manual', 'idea', 'template', 'recurring'] 
        },
        sourceId: { type: 'string', format: 'uuid' }
      },
      required: ['title', 'contentType']
    }
  },
  updateEvent: {
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        contentBody: { type: 'string' },
        contentData: { type: 'object' },
        scheduledFor: { type: 'string', format: 'date-time' },
        status: { 
          type: 'string', 
          enum: ['draft', 'scheduled', 'published', 'failed', 'cancelled'] 
        },
        platforms: { type: 'object' },
        hashtags: { type: 'array', items: { type: 'string' } },
        mentions: { type: 'array', items: { type: 'string' } },
        color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }
      }
    }
  },
  createSeries: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        seriesType: { 
          type: 'string', 
          enum: ['sequential', 'thematic', 'campaign'] 
        },
        totalParts: { type: 'integer', minimum: 2, maximum: 50 },
        partsIntervalDays: { type: 'integer', minimum: 1, maximum: 30 },
        preferredTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' },
        preferredDaysOfWeek: { 
          type: 'array', 
          items: { type: 'integer', minimum: 0, maximum: 6 } 
        }
      },
      required: ['name', 'seriesType', 'totalParts']
    }
  }
};

// Get calendar events
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      startDate, 
      endDate, 
      view = 'month',
      contentTypes,
      statuses,
      page = 1,
      limit = 100
    } = req.query;

    // Calculate date range based on view
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const now = new Date();
      switch (view) {
        case 'day':
          start = new Date(now.setHours(0, 0, 0, 0));
          end = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'week':
          start = startOfWeek(now);
          end = endOfWeek(now);
          break;
        case 'month':
        default:
          start = startOfMonth(now);
          end = endOfMonth(now);
          break;
      }
    }

    // Build query
    let queryText = `
      SELECT 
        ce.*,
        cs.name as series_name,
        cs.total_parts as series_total_parts,
        ces.part_number as series_part_number
      FROM calendar_events ce
      LEFT JOIN calendar_event_series ces ON ce.id = ces.event_id
      LEFT JOIN content_series cs ON ces.series_id = cs.id
      WHERE ce.user_id = $1
        AND (
          (ce.scheduled_for >= $2 AND ce.scheduled_for <= $3)
          OR (ce.status = 'draft' AND ce.scheduled_for IS NULL)
        )
    `;

    const params = [userId, start, end];
    let paramIndex = 4;

    if (contentTypes && contentTypes.length > 0) {
      queryText += ` AND ce.content_type = ANY($${paramIndex})`;
      params.push(contentTypes.split(','));
      paramIndex++;
    }

    if (statuses && statuses.length > 0) {
      queryText += ` AND ce.status = ANY($${paramIndex})`;
      params.push(statuses.split(','));
      paramIndex++;
    }

    queryText += ` ORDER BY ce.scheduled_for ASC NULLS LAST, ce.created_at DESC`;

    if (view === 'list') {
      const offset = (page - 1) * limit;
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
    }

    const result = await query(queryText, params);

    // Get analytics for the period
    const analyticsResult = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_count,
        COUNT(*) FILTER (WHERE status = 'published') as published_count,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count
       FROM calendar_events
       WHERE user_id = $1 
         AND scheduled_for >= $2 
         AND scheduled_for <= $3`,
      [userId, start, end]
    );

    res.json({
      success: true,
      events: result.rows,
      dateRange: { start, end },
      stats: analyticsResult.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
});

// Create calendar event
router.post('/events', authenticateToken, validateRequest(calendarSchemas.createEvent), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      contentType,
      contentBody,
      contentData = {},
      scheduledFor,
      timeZone = 'UTC',
      platforms = { linkedin: true },
      hashtags = [],
      mentions = [],
      color = '#3B82F6',
      sourceType = 'manual',
      sourceId
    } = req.body;

    const result = await query(
      `INSERT INTO calendar_events 
       (user_id, title, description, content_type, content_body, content_data,
        scheduled_for, time_zone, platforms, hashtags, mentions, color,
        source_type, source_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        userId,
        title,
        description,
        contentType,
        contentBody,
        contentData,
        scheduledFor,
        timeZone,
        platforms,
        hashtags,
        mentions,
        color,
        sourceType,
        sourceId,
        scheduledFor ? 'scheduled' : 'draft'
      ]
    );

    // Clear calendar cache
    await cache.del(`calendar:${userId}:*`);

    res.json({
      success: true,
      event: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating calendar event:', error);
    res.status(500).json({ success: false, error: 'Failed to create calendar event' });
  }
});

// Update calendar event
router.put('/events/:eventId', authenticateToken, validateRequest(calendarSchemas.updateEvent), async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;
    const updates = req.body;

    // Build update query
    const updateFields = [];
    const values = [eventId, userId];
    let paramIndex = 3;

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'userId') {
        updateFields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update' 
      });
    }

    const result = await query(
      `UPDATE calendar_events 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Calendar event not found' 
      });
    }

    // Clear calendar cache
    await cache.del(`calendar:${userId}:*`);

    res.json({
      success: true,
      event: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating calendar event:', error);
    res.status(500).json({ success: false, error: 'Failed to update calendar event' });
  }
});

// Delete calendar event
router.delete('/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;

    const result = await query(
      'DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING id',
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Calendar event not found' 
      });
    }

    // Clear calendar cache
    await cache.del(`calendar:${userId}:*`);

    res.json({
      success: true,
      message: 'Calendar event deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting calendar event:', error);
    res.status(500).json({ success: false, error: 'Failed to delete calendar event' });
  }
});

// Duplicate calendar event
router.post('/events/:eventId/duplicate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;
    const { scheduledFor } = req.body;

    // Get original event
    const originalResult = await query(
      'SELECT * FROM calendar_events WHERE id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Calendar event not found' 
      });
    }

    const original = originalResult.rows[0];

    // Create duplicate
    const result = await query(
      `INSERT INTO calendar_events 
       (user_id, title, description, content_type, content_body, content_data,
        scheduled_for, time_zone, platforms, hashtags, mentions, color,
        source_type, source_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        userId,
        `${original.title} (Copy)`,
        original.description,
        original.content_type,
        original.content_body,
        original.content_data,
        scheduledFor || null,
        original.time_zone,
        original.platforms,
        original.hashtags,
        original.mentions,
        original.color,
        'manual',
        null,
        scheduledFor ? 'scheduled' : 'draft'
      ]
    );

    res.json({
      success: true,
      event: result.rows[0]
    });
  } catch (error) {
    logger.error('Error duplicating calendar event:', error);
    res.status(500).json({ success: false, error: 'Failed to duplicate calendar event' });
  }
});

// Create content series
router.post('/series', authenticateToken, validateRequest(calendarSchemas.createSeries), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      seriesType,
      totalParts,
      partsIntervalDays = 1,
      preferredTime,
      preferredDaysOfWeek = [],
      hashtag
    } = req.body;

    const result = await query(
      `INSERT INTO content_series 
       (user_id, name, description, series_type, total_parts, 
        parts_interval_days, preferred_time, preferred_days_of_week, hashtag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        name,
        description,
        seriesType,
        totalParts,
        partsIntervalDays,
        preferredTime,
        preferredDaysOfWeek,
        hashtag || `#${name.replace(/\s+/g, '')}Series`
      ]
    );

    res.json({
      success: true,
      series: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating content series:', error);
    res.status(500).json({ success: false, error: 'Failed to create content series' });
  }
});

// Get content series
router.get('/series', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let queryText = `
      SELECT 
        cs.*,
        COUNT(ces.event_id) as scheduled_parts,
        MAX(ce.scheduled_for) as last_scheduled_date
      FROM content_series cs
      LEFT JOIN calendar_event_series ces ON cs.id = ces.series_id
      LEFT JOIN calendar_events ce ON ces.event_id = ce.id
      WHERE cs.user_id = $1
    `;

    const params = [userId];

    if (status) {
      queryText += ' AND cs.status = $2';
      params.push(status);
    }

    queryText += ' GROUP BY cs.id ORDER BY cs.created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      series: result.rows
    });
  } catch (error) {
    logger.error('Error fetching content series:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch content series' });
  }
});

// Get optimal posting slots
router.get('/slots', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's content slots
    const slotsResult = await query(
      `SELECT * FROM content_slots 
       WHERE user_id = $1 AND is_active = TRUE 
       ORDER BY day_of_week, time_slot`,
      [userId]
    );

    // If no custom slots, generate default optimal times
    if (slotsResult.rows.length === 0) {
      const defaultSlots = generateDefaultSlots();
      return res.json({
        success: true,
        slots: defaultSlots,
        isDefault: true
      });
    }

    res.json({
      success: true,
      slots: slotsResult.rows,
      isDefault: false
    });
  } catch (error) {
    logger.error('Error fetching content slots:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch content slots' });
  }
});

// Get calendar analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : startOfMonth(new Date());
    const end = endDate ? new Date(endDate) : endOfMonth(new Date());

    // Get aggregated analytics
    const analyticsResult = await query(
      `SELECT 
        DATE(scheduled_for) as date,
        COUNT(*) as total_posts,
        COUNT(*) FILTER (WHERE status = 'published') as published_posts,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_posts,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_posts,
        json_object_agg(content_type, type_count) as content_type_breakdown
       FROM (
         SELECT 
           scheduled_for,
           status,
           content_type,
           COUNT(*) OVER (PARTITION BY DATE(scheduled_for), content_type) as type_count
         FROM calendar_events
         WHERE user_id = $1 
           AND scheduled_for >= $2 
           AND scheduled_for <= $3
       ) as daily_data
       GROUP BY DATE(scheduled_for)
       ORDER BY date`,
      [userId, start, end]
    );

    // Get performance metrics
    const performanceResult = await query(
      `SELECT 
        AVG(engagement_score) as avg_engagement,
        MAX(engagement_score) as max_engagement,
        COUNT(DISTINCT DATE(published_at)) as active_days,
        COUNT(*) FILTER (WHERE engagement_score > 0.7) as high_performing_posts
       FROM calendar_events
       WHERE user_id = $1 
         AND published_at >= $2 
         AND published_at <= $3
         AND engagement_score IS NOT NULL`,
      [userId, start, end]
    );

    res.json({
      success: true,
      dateRange: { start, end },
      dailyMetrics: analyticsResult.rows,
      performance: performanceResult.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching calendar analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar analytics' });
  }
});

// Batch operations
router.post('/events/batch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { action, eventIds, updates } = req.body;

    if (!['update', 'delete', 'reschedule'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid batch action' 
      });
    }

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No event IDs provided' 
      });
    }

    await withTransaction(async (client) => {
      switch (action) {
        case 'delete':
          await client.query(
            'DELETE FROM calendar_events WHERE id = ANY($1) AND user_id = $2',
            [eventIds, userId]
          );
          break;
          
        case 'update':
          for (const eventId of eventIds) {
            await client.query(
              `UPDATE calendar_events 
               SET status = $1, updated_at = NOW() 
               WHERE id = $2 AND user_id = $3`,
              [updates.status, eventId, userId]
            );
          }
          break;
          
        case 'reschedule':
          const { offsetDays } = updates;
          await client.query(
            `UPDATE calendar_events 
             SET scheduled_for = scheduled_for + INTERVAL '1 day' * $1,
                 updated_at = NOW()
             WHERE id = ANY($2) AND user_id = $3`,
            [offsetDays, eventIds, userId]
          );
          break;
      }
    });

    // Clear calendar cache
    await cache.del(`calendar:${userId}:*`);

    res.json({
      success: true,
      message: `Batch ${action} completed for ${eventIds.length} events`
    });
  } catch (error) {
    logger.error('Error in batch operation:', error);
    res.status(500).json({ success: false, error: 'Failed to complete batch operation' });
  }
});

// Helper function to generate default optimal posting slots
function generateDefaultSlots() {
  const defaultTimes = [
    { time: '08:00', name: 'Morning commute' },
    { time: '12:00', name: 'Lunch break' },
    { time: '17:00', name: 'End of workday' }
  ];
  
  const slots = [];
  for (let day = 1; day <= 5; day++) { // Monday to Friday
    for (const timeSlot of defaultTimes) {
      slots.push({
        dayOfWeek: day,
        timeSlot: timeSlot.time,
        slotName: timeSlot.name,
        isActive: true,
        avgEngagementRate: null
      });
    }
  }
  
  return slots;
}

module.exports = router;