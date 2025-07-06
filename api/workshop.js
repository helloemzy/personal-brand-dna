// Consolidated workshop API router
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// For demo purposes, use fallback values if env vars are not set
const supabaseUrl = process.env.SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-key';
const supabase = supabaseUrl && supabaseKey && supabaseUrl !== 'https://demo.supabase.co' 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Use a default JWT secret for demo purposes if not configured
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-for-personal-brand-dna-2024';

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

  // Check if Supabase is properly configured
  if (!supabase) {
    console.error('Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    return res.status(503).json({ 
      error: 'Database service unavailable',
      message: 'The workshop feature is currently in demo mode. Database connection not configured.'
    });
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req);
    req.user = user;

    const { action, sessionId } = req.query;

    switch (action) {
      case 'start':
        return await handleStart(req, res);
      case 'sessions':
        return await handleGetSessions(req, res);
      case 'session':
        if (!sessionId) {
          return res.status(400).json({ error: 'Session ID required' });
        }
        if (req.method === 'GET') {
          return await handleGetSession(req, res, sessionId);
        } else if (req.method === 'POST') {
          return await handleSaveSession(req, res, sessionId);
        } else if (req.method === 'PUT') {
          return await handleCompleteSession(req, res, sessionId);
        }
        break;
      default:
        return res.status(404).json({ error: 'Invalid workshop action' });
    }
  } catch (error) {
    console.error('Workshop API error:', error);
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Start new workshop session
async function handleStart(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: session, error } = await supabase
      .from('workshop_sessions')
      .insert({
        user_id: req.user.userId,
        status: 'in_progress',
        current_step: 1,
        data: {
          steps: {
            values: null,
            tone: null,
            audience: null,
            writing_sample: null,
            personality: null
          }
        }
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      sessionId: session.id,
      status: session.status,
      currentStep: session.current_step,
      createdAt: session.created_at
    });
  } catch (error) {
    console.error('Start workshop error:', error);
    return res.status(500).json({ error: 'Failed to start workshop session' });
  }
}

// Get all user's workshop sessions
async function handleGetSessions(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: sessions, error } = await supabase
      .from('workshop_sessions')
      .select('id, status, current_step, created_at, updated_at')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({ error: 'Failed to fetch workshop sessions' });
  }
}

// Get specific workshop session
async function handleGetSession(req, res, sessionId) {
  try {
    const { data: session, error } = await supabase
      .from('workshop_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', req.user.userId)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json(session);
  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({ error: 'Failed to fetch workshop session' });
  }
}

// Save workshop session progress
async function handleSaveSession(req, res, sessionId) {
  const { currentStep, stepData } = req.body;

  if (!currentStep || !stepData) {
    return res.status(400).json({ error: 'Current step and step data are required' });
  }

  try {
    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from('workshop_sessions')
      .select('data')
      .eq('id', sessionId)
      .eq('user_id', req.user.userId)
      .single();

    if (fetchError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update session data
    const updatedData = {
      ...session.data,
      steps: {
        ...session.data.steps,
        ...stepData
      }
    };

    const { data: updated, error: updateError } = await supabase
      .from('workshop_sessions')
      .update({
        current_step: currentStep,
        data: updatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', req.user.userId)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      sessionId: updated.id,
      currentStep: updated.current_step,
      data: updated.data
    });
  } catch (error) {
    console.error('Save session error:', error);
    return res.status(500).json({ error: 'Failed to save workshop progress' });
  }
}

// Complete workshop session
async function handleCompleteSession(req, res, sessionId) {
  try {
    // Get session data
    const { data: session, error: fetchError } = await supabase
      .from('workshop_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', req.user.userId)
      .single();

    if (fetchError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate voice profile from workshop data
    const voiceProfile = generateVoiceProfile(session.data.steps);

    // Save voice profile
    const { data: profile, error: profileError } = await supabase
      .from('voice_profiles')
      .insert({
        user_id: req.user.userId,
        name: `Workshop Profile - ${new Date().toLocaleDateString()}`,
        characteristics: voiceProfile,
        is_active: true
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // Update session status
    const { error: updateError } = await supabase
      .from('workshop_sessions')
      .update({
        status: 'completed',
        voice_profile_id: profile.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', req.user.userId);

    if (updateError) throw updateError;

    return res.status(200).json({
      sessionId,
      status: 'completed',
      voiceProfileId: profile.id,
      voiceProfile: profile
    });
  } catch (error) {
    console.error('Complete session error:', error);
    return res.status(500).json({ error: 'Failed to complete workshop session' });
  }
}

// Generate voice profile from workshop data
function generateVoiceProfile(steps) {
  const { values, tone, audience, writing_sample, personality } = steps;

  return {
    values: values || [],
    tone: {
      professional: tone?.professional || 50,
      friendly: tone?.friendly || 50,
      authoritative: tone?.authoritative || 50,
      empathetic: tone?.empathetic || 50,
      inspirational: tone?.inspirational || 50
    },
    audience: audience || {},
    writing_style: analyzeWritingStyle(writing_sample),
    personality: personality || {},
    generated_at: new Date().toISOString()
  };
}

// Analyze writing style (simplified version)
function analyzeWritingStyle(writingSample) {
  if (!writingSample) {
    return {
      sentence_length: 'medium',
      vocabulary: 'professional',
      structure: 'balanced'
    };
  }

  // Simple analysis - in production, use NLP
  const words = writingSample.split(' ').length;
  const sentences = writingSample.split(/[.!?]+/).length;
  const avgWordsPerSentence = words / sentences;

  return {
    sentence_length: avgWordsPerSentence < 15 ? 'short' : avgWordsPerSentence > 25 ? 'long' : 'medium',
    vocabulary: 'professional',
    structure: 'balanced',
    sample_word_count: words
  };
}