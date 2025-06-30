// Consolidated content API router
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    // Authenticate user for all content endpoints
    const user = await authenticateToken(req);
    req.user = user;

    const { action } = req.query;

    switch (action) {
      case 'generate':
        return await handleGenerate(req, res);
      case 'history':
        return await handleHistory(req, res);
      case 'update':
        return await handleUpdate(req, res);
      case 'delete':
        return await handleDelete(req, res);
      case 'templates':
        return await handleTemplates(req, res);
      default:
        return res.status(404).json({ error: 'Invalid content action' });
    }
  } catch (error) {
    console.error('Content API error:', error);
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate content handler
async function handleGenerate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, contentType, voiceProfileId, template, tone, length } = req.body;

  if (!topic || !contentType) {
    return res.status(400).json({ error: 'Topic and content type are required' });
  }

  try {
    // Get user's voice profile if specified
    let voiceProfile = null;
    if (voiceProfileId) {
      const { data: profile } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('id', voiceProfileId)
        .eq('user_id', req.user.userId)
        .single();
      
      voiceProfile = profile;
    }

    // Generate content using OpenAI
    const systemPrompt = `You are a professional content writer specializing in LinkedIn posts. 
    ${voiceProfile ? `Use this voice profile: ${JSON.stringify(voiceProfile.characteristics)}` : ''}
    Create a ${contentType} about ${topic}.
    ${template ? `Follow this template structure: ${template}` : ''}
    ${tone ? `Use a ${tone} tone.` : ''}
    ${length ? `Target length: ${length} words.` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write a LinkedIn ${contentType} about: ${topic}` }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const generatedContent = completion.choices[0].message.content;

    // Save to database
    const { data: savedContent, error } = await supabase
      .from('content_history')
      .insert({
        user_id: req.user.userId,
        topic,
        content_type: contentType,
        generated_content: generatedContent,
        voice_profile_id: voiceProfileId,
        template_used: template,
        tone,
        length,
        status: 'generated'
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      id: savedContent.id,
      content: generatedContent,
      metadata: {
        topic,
        contentType,
        voiceProfileId,
        template,
        tone,
        length,
        createdAt: savedContent.created_at
      }
    });
  } catch (error) {
    console.error('Content generation error:', error);
    return res.status(500).json({ error: 'Failed to generate content' });
  }
}

// Get content history handler
async function handleHistory(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { page = 1, limit = 10, contentType, status, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('content_history')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`topic.ilike.%${search}%,generated_content.ilike.%${search}%`);
    }

    const { data: content, error, count } = await query;

    if (error) throw error;

    return res.status(200).json({
      content,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: 'Failed to fetch content history' });
  }
}

// Update content handler
async function handleUpdate(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { content, status } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Content ID is required' });
  }

  try {
    const updateData = {};
    if (content !== undefined) updateData.edited_content = content;
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('content_history')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ error: 'Content not found' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Update content error:', error);
    return res.status(500).json({ error: 'Failed to update content' });
  }
}

// Delete content handler
async function handleDelete(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Content ID is required' });
  }

  try {
    const { error } = await supabase
      .from('content_history')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.userId);

    if (error) throw error;

    return res.status(200).json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Delete content error:', error);
    return res.status(500).json({ error: 'Failed to delete content' });
  }
}

// Get templates handler
async function handleTemplates(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return predefined templates
  const templates = [
    {
      id: 'career-milestone',
      name: 'Career Milestone',
      category: 'Achievement',
      structure: '🎉 Exciting news!\n\n[Achievement details]\n\nKey learnings:\n• [Learning 1]\n• [Learning 2]\n• [Learning 3]\n\n[Call to action or question]',
      description: 'Share career achievements and milestones'
    },
    {
      id: 'industry-insight',
      name: 'Industry Insight',
      category: 'Thought Leadership',
      structure: '📊 Industry trend alert:\n\n[Observation or statistic]\n\nWhat this means:\n• [Implication 1]\n• [Implication 2]\n• [Implication 3]\n\n[Your perspective]\n\nWhat are your thoughts?',
      description: 'Share insights about industry trends'
    },
    {
      id: 'learning-share',
      name: 'Learning Share',
      category: 'Educational',
      structure: '💡 Today I learned:\n\n[What you learned]\n\nWhy it matters:\n[Explanation]\n\nHow to apply it:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\n[Question for audience]',
      description: 'Share something you learned recently'
    },
    {
      id: 'problem-solution',
      name: 'Problem-Solution',
      category: 'Case Study',
      structure: '🔧 Challenge → Solution\n\nThe problem:\n[Problem description]\n\nOur approach:\n[Solution overview]\n\nResults:\n• [Result 1]\n• [Result 2]\n• [Result 3]\n\n[Key takeaway]',
      description: 'Present a problem and how you solved it'
    },
    {
      id: 'networking',
      name: 'Networking Post',
      category: 'Engagement',
      structure: '🤝 Building connections!\n\n[Context or event]\n\nKey takeaways:\n• [Takeaway 1]\n• [Takeaway 2]\n• [Takeaway 3]\n\nWho else is interested in [topic]? Let\'s connect!',
      description: 'Engage with your network'
    }
  ];

  return res.status(200).json({ templates });
}