// Consolidated LinkedIn API router
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET;

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;

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

  const { action } = req.query;

  try {
    // Public endpoints (no auth required)
    if (action === 'auth') {
      return await handleLinkedInAuth(req, res);
    } else if (action === 'callback') {
      return await handleLinkedInCallback(req, res);
    }

    // Protected endpoints
    const user = await authenticateToken(req);
    req.user = user;

    switch (action) {
      case 'status':
        return await handleGetStatus(req, res);
      case 'disconnect':
        return await handleDisconnect(req, res);
      case 'queue':
        return await handleQueuePost(req, res);
      case 'publish':
        return await handlePublishNow(req, res);
      case 'queue-list':
        return await handleGetQueue(req, res);
      case 'preferences':
        return await handlePreferences(req, res);
      case 'compliance':
        return await handleCompliance(req, res);
      case 'export':
        return await handleExportData(req, res);
      default:
        return res.status(404).json({ error: 'Invalid LinkedIn action' });
    }
  } catch (error) {
    console.error('LinkedIn API error:', error);
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// LinkedIn OAuth - Start authentication
async function handleLinkedInAuth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state in session/database for verification
  // In production, use proper session management
  
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${LINKEDIN_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&` +
    `state=${state}&` +
    `scope=${encodeURIComponent('r_liteprofile r_emailaddress w_member_social')}`;

  return res.status(200).json({ authUrl, state });
}

// LinkedIn OAuth - Handle callback
async function handleLinkedInCallback(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, userId } = req.body;

  if (!code || !state || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();

    // Get LinkedIn profile info
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch LinkedIn profile');
    }

    const profileData = await profileResponse.json();

    // Store LinkedIn connection in database
    const { error } = await supabase
      .from('linkedin_connections')
      .upsert({
        user_id: userId,
        linkedin_id: profileData.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        profile_data: profileData,
        is_active: true,
      });

    if (error) throw error;

    return res.status(200).json({
      message: 'LinkedIn account connected successfully',
      linkedinId: profileData.id,
    });
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return res.status(500).json({ error: 'Failed to connect LinkedIn account' });
  }
}

// Get LinkedIn connection status
async function handleGetStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: connection, error } = await supabase
      .from('linkedin_connections')
      .select('linkedin_id, is_active, expires_at, created_at')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (error || !connection) {
      return res.status(200).json({ connected: false });
    }

    // Check if token is expired
    const isExpired = new Date(connection.expires_at) < new Date();

    return res.status(200).json({
      connected: !isExpired,
      linkedinId: connection.linkedin_id,
      expiresAt: connection.expires_at,
      connectedAt: connection.created_at,
    });
  } catch (error) {
    console.error('Get status error:', error);
    return res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
}

// Disconnect LinkedIn account
async function handleDisconnect(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { error } = await supabase
      .from('linkedin_connections')
      .update({ is_active: false })
      .eq('user_id', req.user.userId);

    if (error) throw error;

    return res.status(200).json({ message: 'LinkedIn account disconnected' });
  } catch (error) {
    console.error('Disconnect error:', error);
    return res.status(500).json({ error: 'Failed to disconnect LinkedIn account' });
  }
}

// Queue post for publishing
async function handleQueuePost(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contentId, scheduledFor, autoPublish = false } = req.body;

  if (!contentId) {
    return res.status(400).json({ error: 'Content ID is required' });
  }

  try {
    // Verify LinkedIn connection
    const { data: connection } = await supabase
      .from('linkedin_connections')
      .select('id')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (!connection) {
      return res.status(400).json({ error: 'LinkedIn account not connected' });
    }

    // Create queue entry
    const { data: queueEntry, error } = await supabase
      .from('linkedin_queue')
      .insert({
        user_id: req.user.userId,
        content_id: contentId,
        scheduled_for: scheduledFor || new Date().toISOString(),
        status: 'pending',
        auto_publish: autoPublish,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      queueId: queueEntry.id,
      status: queueEntry.status,
      scheduledFor: queueEntry.scheduled_for,
    });
  } catch (error) {
    console.error('Queue post error:', error);
    return res.status(500).json({ error: 'Failed to queue post' });
  }
}

// Publish post immediately
async function handlePublishNow(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contentId } = req.body;

  if (!contentId) {
    return res.status(400).json({ error: 'Content ID is required' });
  }

  try {
    // Get content
    const { data: content, error: contentError } = await supabase
      .from('content_history')
      .select('*')
      .eq('id', contentId)
      .eq('user_id', req.user.userId)
      .single();

    if (contentError || !content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get LinkedIn connection
    const { data: connection, error: connError } = await supabase
      .from('linkedin_connections')
      .select('access_token')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return res.status(400).json({ error: 'LinkedIn account not connected' });
    }

    // Note: LinkedIn API v2 posting is complex and requires specific formatting
    // This is a simplified example - production code would need proper implementation
    const postResponse = await fetch('https://api.linkedin.com/v2/shares', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          contentEntities: [{
            entityLocation: content.edited_content || content.generated_content,
          }],
        },
        distribution: {
          linkedInDistributionTarget: {},
        },
      }),
    });

    if (!postResponse.ok) {
      throw new Error('Failed to publish to LinkedIn');
    }

    const postData = await postResponse.json();

    // Update content status
    await supabase
      .from('content_history')
      .update({ 
        status: 'published',
        published_at: new Date().toISOString(),
        linkedin_post_id: postData.id,
      })
      .eq('id', contentId);

    return res.status(200).json({
      message: 'Post published successfully',
      linkedinPostId: postData.id,
    });
  } catch (error) {
    console.error('Publish post error:', error);
    return res.status(500).json({ error: 'Failed to publish post' });
  }
}

// Get queued posts
async function handleGetQueue(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('linkedin_queue')
      .select('*, content_history(topic, content_type, generated_content)', { count: 'exact' })
      .eq('user_id', req.user.userId)
      .order('scheduled_for', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: queue, error, count } = await query;

    if (error) throw error;

    return res.status(200).json({
      queue,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get queue error:', error);
    return res.status(500).json({ error: 'Failed to fetch queue' });
  }
}

// Handle preferences
async function handlePreferences(req, res) {
  if (req.method === 'GET') {
    try {
      const { data: preferences, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', req.user.userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Return default preferences if none exist
      const defaultPreferences = {
        autoApprove: false,
        notifyOnPublish: true,
        notifyOnEngagement: true,
        defaultScheduleTime: '09:00',
        weekendPosting: false,
        maxPostsPerDay: 2,
        optimalPostingTimes: ['08:00', '12:00', '17:00', '19:00']
      };

      return res.status(200).json(preferences || defaultPreferences);
    } catch (error) {
      console.error('Get preferences error:', error);
      return res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: req.user.userId,
          ...req.body,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      return res.status(200).json({ message: 'Preferences updated successfully' });
    } catch (error) {
      console.error('Update preferences error:', error);
      return res.status(500).json({ error: 'Failed to update preferences' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Get compliance data
async function handleCompliance(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get publishing stats
    const { data: stats, error } = await supabase
      .from('linkedin_queue')
      .select('status')
      .eq('user_id', req.user.userId);

    if (error) throw error;

    const compliance = {
      totalActions: stats.length,
      postsPublished: stats.filter(s => s.status === 'published').length,
      postsRejected: stats.filter(s => s.status === 'failed').length,
      privacyActions: 0, // Track privacy-related actions
      lastActionAt: stats[0]?.created_at || null
    };

    return res.status(200).json(compliance);
  } catch (error) {
    console.error('Get compliance error:', error);
    return res.status(500).json({ error: 'Failed to fetch compliance data' });
  }
}

// Export user data
async function handleExportData(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all user's LinkedIn data
    const [connection, queue, content] = await Promise.all([
      supabase
        .from('linkedin_connections')
        .select('linkedin_id, created_at, is_active')
        .eq('user_id', req.user.userId)
        .single(),
      supabase
        .from('linkedin_queue')
        .select('*')
        .eq('user_id', req.user.userId),
      supabase
        .from('content_history')
        .select('*')
        .eq('user_id', req.user.userId)
        .eq('status', 'published')
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      userId: req.user.userId,
      linkedinConnection: connection.data,
      queueHistory: queue.data,
      publishedContent: content.data
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="linkedin-data-${new Date().toISOString().split('T')[0]}.json"`
    );

    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Export data error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
}