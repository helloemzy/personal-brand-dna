// Consolidated calendar API router
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET;

// Auth middleware
async function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Route handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req);
    req.user = user;

    const { action, id } = req.query;

    switch (req.method) {
      case 'GET':
        return await handleGetEvents(req, res);
      case 'POST':
        return await handleCreateEvent(req, res);
      case 'PUT':
        if (!id) {
          return res.status(400).json({ error: 'Event ID required for update' });
        }
        return await handleUpdateEvent(req, res, id);
      case 'DELETE':
        if (!id) {
          return res.status(400).json({ error: 'Event ID required for deletion' });
        }
        return await handleDeleteEvent(req, res, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Calendar API error:', error);
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get calendar events
async function handleGetEvents(req, res) {
  const { start, end, status } = req.query;

  try {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('scheduled_for', { ascending: true });

    if (start) {
      query = query.gte('scheduled_for', start);
    }

    if (end) {
      query = query.lte('scheduled_for', end);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: events, error } = await query;

    if (error) throw error;

    return res.status(200).json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    return res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
}

// Create calendar event
async function handleCreateEvent(req, res) {
  const { 
    title, 
    contentId, 
    scheduledFor, 
    type = 'post',
    notes,
    isRecurring,
    recurringPattern
  } = req.body;

  if (!title || !scheduledFor) {
    return res.status(400).json({ error: 'Title and scheduled time are required' });
  }

  try {
    const eventData = {
      user_id: req.user.userId,
      title,
      content_id: contentId,
      scheduled_for: scheduledFor,
      type,
      notes,
      status: 'scheduled',
      is_recurring: isRecurring || false
    };

    if (isRecurring && recurringPattern) {
      eventData.recurring_pattern = recurringPattern;
    }

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert(eventData)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: 'Failed to create calendar event' });
  }
}

// Update calendar event
async function handleUpdateEvent(req, res, eventId) {
  const { 
    title, 
    contentId, 
    scheduledFor, 
    type,
    notes,
    status,
    isRecurring,
    recurringPattern
  } = req.body;

  try {
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (contentId !== undefined) updateData.content_id = contentId;
    if (scheduledFor !== undefined) updateData.scheduled_for = scheduledFor;
    if (type !== undefined) updateData.type = type;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (isRecurring !== undefined) updateData.is_recurring = isRecurring;
    if (recurringPattern !== undefined) updateData.recurring_pattern = recurringPattern;

    updateData.updated_at = new Date().toISOString();

    const { data: event, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', eventId)
      .eq('user_id', req.user.userId)
      .select()
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.status(200).json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({ error: 'Failed to update calendar event' });
  }
}

// Delete calendar event
async function handleDeleteEvent(req, res, eventId) {
  try {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', req.user.userId);

    if (error) throw error;

    return res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ error: 'Failed to delete calendar event' });
  }
}