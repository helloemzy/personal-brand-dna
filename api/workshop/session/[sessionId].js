import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow DELETE method
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  // Get user from authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the user's token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // First, check if the session exists and belongs to the user
    const { data: session, error: fetchError } = await supabase
      .from('workshop_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !session) {
      console.error('Session fetch error:', fetchError);
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    // Delete related data first (to maintain referential integrity)
    
    // Delete any workshop results associated with this session
    const { error: resultsDeleteError } = await supabase
      .from('workshop_results')
      .delete()
      .eq('session_id', sessionId);

    if (resultsDeleteError) {
      console.error('Error deleting workshop results:', resultsDeleteError);
      // Continue with session deletion even if results deletion fails
    }

    // Delete any workshop checkpoints associated with this session
    const { error: checkpointsDeleteError } = await supabase
      .from('workshop_checkpoints')
      .delete()
      .eq('session_id', sessionId);

    if (checkpointsDeleteError) {
      console.error('Error deleting workshop checkpoints:', checkpointsDeleteError);
      // Continue with session deletion even if checkpoints deletion fails
    }

    // Now delete the workshop session
    const { error: deleteError } = await supabase
      .from('workshop_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Session deletion error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete session' });
    }

    // Return success response
    return res.status(200).json({ 
      message: 'Session deleted successfully',
      sessionId: sessionId
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}