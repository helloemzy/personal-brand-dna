import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import jwt from 'jsonwebtoken';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Route to appropriate handler
    if (pathname.endsWith('/generate-content')) {
      return await handleGenerateContent(req, res, userId);
    } else if (pathname.endsWith('/approve-content')) {
      return await handleApproveContent(req, res, userId);
    } else if (pathname.endsWith('/schedule-posts')) {
      return await handleSchedulePosts(req, res, userId);
    } else if (pathname.endsWith('/content-calendar')) {
      return await handleContentCalendar(req, res, userId);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Content automation error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate content from news articles
async function handleGenerateContent(req, res, userId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { articleId, contentType = 'auto' } = req.body;

  try {
    // Get user data
    const { data: user } = await supabase
      .from('users')
      .select('posting_tier, timezone, preferred_posting_times')
      .eq('id', userId)
      .single();

    // Get tier configuration
    const { data: tierConfig } = await supabase
      .from('posting_tiers')
      .select('*')
      .eq('tier_name', user.posting_tier)
      .single();

    // Get article
    const { data: article } = await supabase
      .from('news_articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (!article || article.user_id !== userId) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Get user's brand framework
    const { data: brandFramework } = await supabase
      .from('personal_brand_frameworks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Generate content variations
    const variations = await generateContentVariations(
      article,
      brandFramework,
      tierConfig,
      contentType
    );

    // Save generated posts
    const savedPosts = [];
    for (const variation of variations) {
      const { data: post, error } = await supabase
        .from('generated_posts')
        .insert({
          user_id: userId,
          news_article_id: articleId,
          content_type: variation.contentType,
          content_angle: variation.contentAngle,
          headline: variation.headline,
          body_content: variation.bodyContent,
          hashtags: variation.hashtags,
          timing_strategy: variation.timingStrategy,
          optimal_post_time: variation.optimalPostTime,
          expiry_time: variation.expiryTime,
          predicted_engagement_rate: variation.predictedEngagement,
          content_quality_score: variation.qualityScore,
          approval_status: tierConfig.approval_window_hours === 0 ? 'auto_approved' : 'pending'
        })
        .select()
        .single();

      if (!error) savedPosts.push(post);
    }

    // Auto-schedule if tier allows
    if (tierConfig.approval_window_hours === 0 && savedPosts.length > 0) {
      await schedulePost(savedPosts[0].id, userId);
    }

    return res.status(201).json({
      message: 'Content generated successfully',
      posts: savedPosts,
      requiresApproval: tierConfig.approval_window_hours > 0
    });
  } catch (error) {
    console.error('Generate content error:', error);
    return res.status(500).json({ error: 'Failed to generate content' });
  }
}

// Approve or reject generated content
async function handleApproveContent(req, res, userId) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postId, action, rejectionReason } = req.body;

  try {
    // Verify post ownership
    const { data: post } = await supabase
      .from('generated_posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userId)
      .single();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (action === 'approve') {
      // Update post status
      await supabase
        .from('generated_posts')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: userId
        })
        .eq('id', postId);

      // Schedule the post
      await schedulePost(postId, userId);

      return res.status(200).json({ 
        message: 'Post approved and scheduled',
        scheduledTime: post.optimal_post_time
      });
    } else if (action === 'reject') {
      await supabase
        .from('generated_posts')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason
        })
        .eq('id', postId);

      return res.status(200).json({ message: 'Post rejected' });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Approve content error:', error);
    return res.status(500).json({ error: 'Failed to process approval' });
  }
}

// Get scheduled posts calendar
async function handleContentCalendar(req, res, userId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startDate, endDate } = req.query;

  try {
    // Get scheduled posts
    const { data: scheduledPosts } = await supabase
      .from('posting_schedule')
      .select(`
        *,
        generated_posts (
          headline,
          body_content,
          content_type,
          content_angle,
          hashtags
        )
      `)
      .eq('user_id', userId)
      .gte('scheduled_time', startDate || new Date().toISOString())
      .lte('scheduled_time', endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('scheduled_time');

    // Get posting stats
    const { data: stats } = await supabase
      .from('posting_schedule')
      .select('status')
      .eq('user_id', userId)
      .gte('scheduled_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const weeklyStats = {
      scheduled: stats.filter(s => s.status === 'scheduled').length,
      posted: stats.filter(s => s.status === 'posted').length,
      failed: stats.filter(s => s.status === 'failed').length
    };

    return res.status(200).json({
      calendar: scheduledPosts,
      weeklyStats,
      nextPost: scheduledPosts.find(p => p.status === 'scheduled')
    });
  } catch (error) {
    console.error('Content calendar error:', error);
    return res.status(500).json({ error: 'Failed to get calendar' });
  }
}

// Core content generation function
async function generateContentVariations(article, brandFramework, tierConfig, contentType) {
  const contentAngles = getContentAngles(tierConfig.tier_name);
  const variations = [];

  for (let i = 0; i < tierConfig.content_variations_per_news; i++) {
    const angle = contentAngles[i % contentAngles.length];
    const variation = await generateSingleVariation(
      article,
      brandFramework,
      angle,
      contentType
    );
    variations.push(variation);
  }

  return variations;
}

// Generate a single content variation
async function generateSingleVariation(article, brandFramework, angle, contentType) {
  const timingStrategy = determineTimingStrategy(article);
  
  const prompt = `Create a LinkedIn post about this news article using the specified angle and brand voice:

NEWS ARTICLE:
Title: ${article.title}
Summary: ${article.summary}
Published: ${article.published_at}
Key Points: ${article.content?.substring(0, 500)}

BRAND FRAMEWORK:
- Archetype: ${brandFramework.brand_archetype}
- Voice Characteristics: ${JSON.stringify(brandFramework.voice_characteristics)}
- Target Audience: ${JSON.stringify(brandFramework.target_audience)}
- Core Message: ${brandFramework.core_message}
- Authentic Phrases: ${brandFramework.authentic_phrases?.join(', ')}

CONTENT REQUIREMENTS:
- Angle: ${angle.name} - ${angle.description}
- Timing Strategy: ${timingStrategy}
- Content Type: ${contentType === 'auto' ? 'Choose best format' : contentType}

Generate:
1. Attention-grabbing headline (under 200 chars)
2. Body content (250-1300 chars based on optimal engagement)
3. Call-to-action that fits the angle
4. 3-5 relevant hashtags
5. Predicted engagement rate (0-10%)
6. Content quality score (0-1)

Rules:
- Use the user's authentic voice and phrases
- ${angle.approach}
- Include a pattern interrupt in first 2 lines
- End with clear CTA or question
- Make it feel natural, not AI-generated

Format as JSON with: headline, bodyContent, cta, hashtags[], predictedEngagement, qualityScore`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { 
        role: 'system', 
        content: 'You are a personal branding expert who creates authentic, engaging LinkedIn content that sounds natural and human.' 
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  });

  const generated = JSON.parse(response.choices[0].message.content);

  // Calculate optimal posting time
  const optimalPostTime = calculateOptimalPostTime(article, timingStrategy);
  const expiryTime = calculateExpiryTime(article, timingStrategy);

  return {
    contentType: contentType === 'auto' ? determineContentType(generated.bodyContent) : contentType,
    contentAngle: angle.name,
    headline: generated.headline,
    bodyContent: `${generated.bodyContent}\n\n${generated.cta}`,
    hashtags: generated.hashtags,
    timingStrategy,
    optimalPostTime,
    expiryTime,
    predictedEngagement: generated.predictedEngagement,
    qualityScore: generated.qualityScore
  };
}

// Get content angles based on tier
function getContentAngles(tier) {
  const angles = {
    passive: [
      {
        name: 'industry_impact',
        description: 'How this affects your industry',
        approach: 'Focus on practical implications for professionals in the field'
      },
      {
        name: 'lessons_learned',
        description: 'Key takeaways and insights',
        approach: 'Extract wisdom and actionable lessons'
      },
      {
        name: 'thought_leadership',
        description: 'Your expert perspective',
        approach: 'Share unique insights based on experience'
      }
    ],
    regular: [
      {
        name: 'contrarian',
        description: 'Challenge the conventional wisdom',
        approach: 'Respectfully disagree or offer alternative perspective'
      },
      {
        name: 'personal_story',
        description: 'Connect to personal experience',
        approach: 'Share relevant story that relates to the news'
      },
      {
        name: 'future_prediction',
        description: 'What this means for the future',
        approach: 'Make bold but reasoned predictions'
      },
      {
        name: 'actionable_advice',
        description: 'What readers should do now',
        approach: 'Provide specific, actionable steps'
      },
      {
        name: 'industry_impact',
        description: 'Deep dive on industry implications',
        approach: 'Analyze second-order effects'
      }
    ],
    aggressive: [
      // All regular angles plus:
      {
        name: 'instant_react',
        description: 'First hot take on breaking news',
        approach: 'Be first with strong opinion, can refine later'
      },
      {
        name: 'debate_starter',
        description: 'Provocative question to drive engagement',
        approach: 'Ask controversial question that divides opinion'
      },
      {
        name: 'myth_buster',
        description: 'Debunk common misconceptions',
        approach: 'Challenge what everyone thinks they know'
      },
      {
        name: 'insider_perspective',
        description: 'Behind-the-scenes insights',
        approach: 'Share what others don\'t know or won\'t say'
      },
      {
        name: 'trend_analysis',
        description: 'Connect to larger patterns',
        approach: 'Show how this fits bigger picture'
      }
    ]
  };

  return angles[tier] || angles.passive;
}

// Determine timing strategy based on article age
function determineTimingStrategy(article) {
  const ageHours = (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60);
  
  if (ageHours < 2) return 'instant_react';
  if (ageHours < 24) return 'deep_dive';
  return 'lessons_learned';
}

// Calculate optimal posting time
function calculateOptimalPostTime(article, timingStrategy) {
  const now = new Date();
  const articleDate = new Date(article.published_at);
  
  switch (timingStrategy) {
    case 'instant_react':
      // Post ASAP, next available slot
      return getNextPostingSlot(now, 0);
    
    case 'deep_dive':
      // Post within 4-24 hours
      return getNextPostingSlot(now, 4);
    
    case 'lessons_learned':
      // Post 1-3 days later
      const delayHours = 24 + Math.random() * 48;
      return getNextPostingSlot(new Date(now.getTime() + delayHours * 60 * 60 * 1000), 0);
    
    default:
      return getNextPostingSlot(now, 2);
  }
}

// Get next available posting slot
function getNextPostingSlot(afterTime, minHoursDelay) {
  const targetTime = new Date(afterTime.getTime() + minHoursDelay * 60 * 60 * 1000);
  const optimalHours = [7, 8, 12, 17, 18]; // Peak engagement hours
  
  // Find next optimal hour
  let nextSlot = new Date(targetTime);
  nextSlot.setMinutes(0);
  nextSlot.setSeconds(0);
  
  while (!optimalHours.includes(nextSlot.getHours()) || nextSlot < targetTime) {
    nextSlot.setHours(nextSlot.getHours() + 1);
  }
  
  // Skip weekends for passive tier
  if (nextSlot.getDay() === 0 || nextSlot.getDay() === 6) {
    nextSlot.setDate(nextSlot.getDate() + (nextSlot.getDay() === 0 ? 1 : 2));
    nextSlot.setHours(optimalHours[0]);
  }
  
  return nextSlot.toISOString();
}

// Calculate when content becomes stale
function calculateExpiryTime(article, timingStrategy) {
  const publishDate = new Date(article.published_at);
  
  switch (timingStrategy) {
    case 'instant_react':
      // Expires after 24 hours
      return new Date(publishDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
    
    case 'deep_dive':
      // Expires after 3 days
      return new Date(publishDate.getTime() + 72 * 60 * 60 * 1000).toISOString();
    
    case 'lessons_learned':
      // Expires after 7 days
      return new Date(publishDate.getTime() + 168 * 60 * 60 * 1000).toISOString();
    
    default:
      return new Date(publishDate.getTime() + 72 * 60 * 60 * 1000).toISOString();
  }
}

// Determine content type based on length and structure
function determineContentType(content) {
  const wordCount = content.split(' ').length;
  const hasListItems = /\d\.|•|-\s/.test(content);
  const hasQuestions = (content.match(/\?/g) || []).length > 2;
  
  if (hasQuestions) return 'poll';
  if (hasListItems && wordCount > 100) return 'carousel';
  if (wordCount < 50) return 'short';
  if (wordCount > 200) return 'article';
  return 'post';
}

// Schedule a post
async function schedulePost(postId, userId) {
  try {
    // Get post details
    const { data: post } = await supabase
      .from('generated_posts')
      .select('*')
      .eq('id', postId)
      .single();

    // Check if already scheduled
    const { data: existing } = await supabase
      .from('posting_schedule')
      .select('id')
      .eq('generated_post_id', postId)
      .single();

    if (existing) {
      return existing.id;
    }

    // Get user's timezone
    const { data: user } = await supabase
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    // Create schedule entry
    const { data: scheduled, error } = await supabase
      .from('posting_schedule')
      .insert({
        user_id: userId,
        generated_post_id: postId,
        scheduled_time: post.optimal_post_time,
        posting_slot: determinePostingSlot(new Date(post.optimal_post_time)),
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;

    return scheduled.id;
  } catch (error) {
    console.error('Schedule post error:', error);
    throw error;
  }
}

// Determine posting slot name
function determinePostingSlot(time) {
  const hour = time.getHours();
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'custom';
}

// Batch scheduling handler
async function handleSchedulePosts(req, res, userId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postIds } = req.body;

  try {
    const scheduled = [];
    for (const postId of postIds) {
      try {
        const scheduleId = await schedulePost(postId, userId);
        scheduled.push({ postId, scheduleId, status: 'success' });
      } catch (error) {
        scheduled.push({ postId, status: 'failed', error: error.message });
      }
    }

    return res.status(200).json({ 
      message: 'Batch scheduling completed',
      results: scheduled 
    });
  } catch (error) {
    console.error('Batch schedule error:', error);
    return res.status(500).json({ error: 'Failed to schedule posts' });
  }
}