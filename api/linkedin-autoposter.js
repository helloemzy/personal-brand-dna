import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import cron from 'node-cron';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// LinkedIn API configuration
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_OAUTH_BASE = 'https://www.linkedin.com/oauth/v2';

export default async function handler(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Route to appropriate handler
    if (pathname.endsWith('/connect-linkedin')) {
      return await handleConnectLinkedIn(req, res);
    } else if (pathname.endsWith('/disconnect-linkedin')) {
      return await handleDisconnectLinkedIn(req, res);
    } else if (pathname.endsWith('/post-now')) {
      return await handlePostNow(req, res);
    } else if (pathname.endsWith('/check-posting-jobs')) {
      return await handleCheckPostingJobs(req, res);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('LinkedIn autoposter error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Connect LinkedIn account
async function handleConnectLinkedIn(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, authCode } = req.body;

  try {
    // Exchange auth code for access token
    const tokenResponse = await axios.post(
      `${LINKEDIN_OAUTH_BASE}/accessToken`,
      {
        grant_type: 'authorization_code',
        code: authCode,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Get LinkedIn profile
    const profileResponse = await axios.get(
      `${LINKEDIN_API_BASE}/me`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    // Store LinkedIn credentials (encrypted in production)
    await supabase
      .from('linkedin_connections')
      .upsert({
        user_id: userId,
        linkedin_id: profileResponse.data.id,
        access_token: access_token, // Should be encrypted
        token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        profile_data: profileResponse.data,
        is_active: true
      }, {
        onConflict: 'user_id'
      });

    return res.status(200).json({
      message: 'LinkedIn connected successfully',
      profile: {
        name: `${profileResponse.data.firstName} ${profileResponse.data.lastName}`,
        id: profileResponse.data.id
      }
    });
  } catch (error) {
    console.error('LinkedIn connection error:', error);
    return res.status(500).json({ error: 'Failed to connect LinkedIn' });
  }
}

// Disconnect LinkedIn
async function handleDisconnectLinkedIn(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  try {
    await supabase
      .from('linkedin_connections')
      .update({ is_active: false })
      .eq('user_id', userId);

    return res.status(200).json({ message: 'LinkedIn disconnected' });
  } catch (error) {
    console.error('LinkedIn disconnect error:', error);
    return res.status(500).json({ error: 'Failed to disconnect LinkedIn' });
  }
}

// Post content immediately
async function handlePostNow(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, postId } = req.body;

  try {
    // Get post and LinkedIn connection
    const { data: post } = await supabase
      .from('generated_posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userId)
      .single();

    const { data: linkedin } = await supabase
      .from('linkedin_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!post || !linkedin) {
      return res.status(404).json({ error: 'Post or LinkedIn connection not found' });
    }

    // Post to LinkedIn
    const result = await postToLinkedIn(post, linkedin);

    // Update posting schedule
    await supabase
      .from('posting_schedule')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        platform_post_id: result.postId,
        post_url: result.postUrl
      })
      .eq('generated_post_id', postId);

    return res.status(200).json({
      message: 'Posted successfully',
      postUrl: result.postUrl
    });
  } catch (error) {
    console.error('Post now error:', error);
    return res.status(500).json({ error: 'Failed to post content' });
  }
}

// Check and execute scheduled posts
async function handleCheckPostingJobs(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await checkAndPostScheduledContent();
    return res.status(200).json({ message: 'Posting jobs checked' });
  } catch (error) {
    console.error('Check posting jobs error:', error);
    return res.status(500).json({ error: 'Failed to check posting jobs' });
  }
}

// Core posting function
async function postToLinkedIn(post, linkedinConnection) {
  try {
    // Check if token needs refresh
    if (new Date(linkedinConnection.token_expires_at) < new Date()) {
      // In production, implement token refresh
      throw new Error('LinkedIn token expired');
    }

    // Prepare LinkedIn post content
    const linkedinPost = {
      author: `urn:li:person:${linkedinConnection.linkedin_id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: `${post.headline}\n\n${post.body_content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // Add media if present
    if (post.media_urls && post.media_type === 'image') {
      // Handle image upload to LinkedIn
      const mediaAsset = await uploadMediaToLinkedIn(
        post.media_urls[0],
        linkedinConnection.access_token
      );
      
      linkedinPost.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        description: {
          text: post.headline
        },
        media: mediaAsset
      }];
      
      linkedinPost.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
    }

    // Post to LinkedIn
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/ugcPosts`,
      linkedinPost,
      {
        headers: {
          'Authorization': `Bearer ${linkedinConnection.access_token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    // Extract post ID from response
    const postId = response.headers['x-restli-id'] || response.data.id;
    const postUrl = `https://www.linkedin.com/feed/update/${postId}/`;

    // Track initial performance
    await supabase
      .from('post_performance')
      .insert({
        posting_schedule_id: post.id,
        user_id: post.user_id,
        metrics_1_hour: { timestamp: new Date().toISOString() }
      });

    return { postId, postUrl, success: true };
  } catch (error) {
    console.error('LinkedIn posting error:', error);
    
    // Log error for retry
    await supabase
      .from('posting_schedule')
      .update({
        status: 'failed',
        last_error: error.message,
        retry_count: linkedinConnection.retry_count + 1
      })
      .eq('generated_post_id', post.id);

    throw error;
  }
}

// Upload media to LinkedIn
async function uploadMediaToLinkedIn(mediaUrl, accessToken) {
  try {
    // Step 1: Register upload
    const registerResponse = await axios.post(
      `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: `urn:li:person:${linkedinConnection.linkedin_id}`,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { value: { asset, uploadMechanism } } = registerResponse.data;

    // Step 2: Upload image
    const imageResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    
    await axios.post(
      uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
      imageResponse.data,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'image/jpeg'
        }
      }
    );

    return asset;
  } catch (error) {
    console.error('Media upload error:', error);
    return null;
  }
}

// Scheduled job to check and post content
async function checkAndPostScheduledContent() {
  try {
    // Get posts scheduled for the next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    const { data: scheduledPosts } = await supabase
      .from('posting_schedule')
      .select(`
        *,
        generated_posts (*),
        users (
          id,
          posting_tier,
          timezone
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_time', fiveMinutesFromNow.toISOString())
      .order('scheduled_time');

    console.log(`Found ${scheduledPosts?.length || 0} posts to publish`);

    for (const scheduled of scheduledPosts || []) {
      try {
        // Get LinkedIn connection
        const { data: linkedin } = await supabase
          .from('linkedin_connections')
          .select('*')
          .eq('user_id', scheduled.user_id)
          .eq('is_active', true)
          .single();

        if (!linkedin) {
          console.log(`No LinkedIn connection for user ${scheduled.user_id}`);
          continue;
        }

        // Update status to posting
        await supabase
          .from('posting_schedule')
          .update({ status: 'posting' })
          .eq('id', scheduled.id);

        // Post to LinkedIn
        const result = await postToLinkedIn(scheduled.generated_posts, linkedin);

        // Update success
        await supabase
          .from('posting_schedule')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            platform_post_id: result.postId,
            post_url: result.postUrl
          })
          .eq('id', scheduled.id);

        console.log(`Successfully posted ${scheduled.id}`);

        // Schedule performance tracking
        schedulePerformanceTracking(scheduled.id, result.postId);

      } catch (error) {
        console.error(`Failed to post ${scheduled.id}:`, error);
        
        // Update failure
        await supabase
          .from('posting_schedule')
          .update({
            status: 'failed',
            last_error: error.message,
            retry_count: (scheduled.retry_count || 0) + 1
          })
          .eq('id', scheduled.id);

        // Retry logic based on tier
        if (scheduled.retry_count < 3 && scheduled.users.posting_tier !== 'passive') {
          // Reschedule for retry in 15 minutes
          const retryTime = new Date(Date.now() + 15 * 60 * 1000);
          await supabase
            .from('posting_schedule')
            .update({
              scheduled_time: retryTime.toISOString(),
              status: 'scheduled'
            })
            .eq('id', scheduled.id);
        }
      }
    }
  } catch (error) {
    console.error('Check scheduled content error:', error);
  }
}

// Schedule performance tracking jobs
function schedulePerformanceTracking(scheduleId, linkedinPostId) {
  // Track after 1 hour
  setTimeout(async () => {
    await trackPostPerformance(scheduleId, linkedinPostId, 'metrics_1_hour');
  }, 60 * 60 * 1000);

  // Track after 24 hours
  setTimeout(async () => {
    await trackPostPerformance(scheduleId, linkedinPostId, 'metrics_24_hours');
  }, 24 * 60 * 60 * 1000);

  // Track after 7 days
  setTimeout(async () => {
    await trackPostPerformance(scheduleId, linkedinPostId, 'metrics_7_days');
  }, 7 * 24 * 60 * 60 * 1000);
}

// Track post performance
async function trackPostPerformance(scheduleId, linkedinPostId, metricsField) {
  try {
    // Get LinkedIn connection
    const { data: schedule } = await supabase
      .from('posting_schedule')
      .select('user_id')
      .eq('id', scheduleId)
      .single();

    const { data: linkedin } = await supabase
      .from('linkedin_connections')
      .select('access_token')
      .eq('user_id', schedule.user_id)
      .single();

    // Get post analytics from LinkedIn
    const response = await axios.get(
      `${LINKEDIN_API_BASE}/socialActions/${linkedinPostId}`,
      {
        headers: {
          'Authorization': `Bearer ${linkedin.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    const metrics = {
      views: response.data.views || 0,
      likes: response.data.likes || 0,
      comments: response.data.comments || 0,
      shares: response.data.shares || 0,
      timestamp: new Date().toISOString()
    };

    // Calculate engagement rate
    const engagementRate = metrics.views > 0 
      ? ((metrics.likes + metrics.comments + metrics.shares) / metrics.views) * 100
      : 0;

    // Update performance metrics
    await supabase
      .from('post_performance')
      .update({
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        engagement_rate: engagementRate,
        [metricsField]: metrics,
        last_updated: new Date().toISOString()
      })
      .eq('posting_schedule_id', scheduleId);

  } catch (error) {
    console.error('Track performance error:', error);
  }
}

// Initialize cron jobs for posting
export function initializePostingCrons() {
  // Check every 5 minutes for scheduled posts
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled posting check...');
    await checkAndPostScheduledContent();
  });

  // Clean up old failed posts daily
  cron.schedule('0 0 * * *', async () => {
    console.log('Cleaning up old failed posts...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await supabase
      .from('posting_schedule')
      .delete()
      .eq('status', 'failed')
      .lt('scheduled_time', thirtyDaysAgo.toISOString());
  });

  // Update subscription usage daily
  cron.schedule('0 1 * * *', async () => {
    console.log('Updating subscription usage...');
    
    // Get all active subscriptions
    const { data: subscriptions } = await supabase
      .from('subscription_management')
      .select('*')
      .eq('status', 'active');

    for (const sub of subscriptions || []) {
      // Count posts in current period
      const { count } = await supabase
        .from('posting_schedule')
        .select('id', { count: 'exact' })
        .eq('user_id', sub.user_id)
        .eq('status', 'posted')
        .gte('posted_at', sub.current_period_start)
        .lte('posted_at', sub.current_period_end);

      // Count active RSS feeds
      const { count: feedCount } = await supabase
        .from('rss_feeds')
        .select('id', { count: 'exact' })
        .eq('user_id', sub.user_id)
        .eq('is_active', true);

      // Update usage
      await supabase
        .from('subscription_management')
        .update({
          posts_used_this_period: count,
          rss_feeds_count: feedCount
        })
        .eq('id', sub.id);
    }
  });
}

// LinkedIn OAuth URL generator (for frontend)
export function getLinkedInAuthUrl(userId, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    state: `${userId}:${state}`,
    scope: 'r_liteprofile r_emailaddress w_member_social'
  });

  return `${LINKEDIN_OAUTH_BASE}/authorization?${params.toString()}`;
}