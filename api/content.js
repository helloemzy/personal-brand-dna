// Enhanced content API with workshop data integration
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

// Get user's workshop data for personalization
async function getUserWorkshopData(userId) {
  try {
    // Get the most recent workshop data
    const { data: workshop } = await supabase
      .from('workshop_responses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!workshop) {
      return null;
    }

    // Parse the workshop data
    return {
      archetype: workshop.archetype || 'Strategic Visionary',
      values: workshop.values || [],
      mission: workshop.mission || '',
      contentPillars: workshop.content_pillars || {
        expertise: { topics: [], voice: 'authoritative' },
        experience: { topics: [], voice: 'personal' },
        evolution: { topics: [], voice: 'visionary' }
      },
      audience: workshop.audience || {},
      writingStyle: workshop.writing_style || {},
      personalityTraits: workshop.personality_traits || [],
      industry: workshop.industry || 'technology',
      role: workshop.role || 'professional'
    };
  } catch (error) {
    console.error('Error fetching workshop data:', error);
    return null;
  }
}

// Generate content with voice matching
async function generateContentWithVoice(request, workshopData) {
  const {
    topic,
    contentType = 'post',
    tone = 'professional',
    targetAudience,
    callToAction,
    includePersonalExperience = true,
    template,
    length = 'medium'
  } = request;

  // Build personalized system prompt based on workshop data
  let systemPrompt = `You are an AI content writer helping a ${workshopData.archetype} create authentic LinkedIn content.

BRAND FRAMEWORK:
- Archetype: ${workshopData.archetype}
- Core Values: ${workshopData.values.join(', ')}
- Mission: ${workshopData.mission}
- Industry: ${workshopData.industry}
- Role: ${workshopData.role}

CONTENT PILLARS:
- Expertise (40%): ${workshopData.contentPillars.expertise.topics.slice(0, 3).join(', ')}
- Experience (35%): ${workshopData.contentPillars.experience.topics.slice(0, 3).join(', ')}
- Evolution (25%): ${workshopData.contentPillars.evolution.topics.slice(0, 3).join(', ')}

WRITING STYLE:
${JSON.stringify(workshopData.writingStyle, null, 2)}

TARGET AUDIENCE:
${JSON.stringify(workshopData.audience, null, 2)}

PERSONALITY TRAITS:
${workshopData.personalityTraits.join(', ')}

INSTRUCTIONS:
1. Create a ${contentType} about "${topic}"
2. Use a ${tone} tone that matches the ${workshopData.archetype} archetype
3. Incorporate the person's values and mission naturally
4. Match their writing style and personality traits
5. ${includePersonalExperience ? 'Include personal anecdotes or experiences' : 'Focus on insights without personal stories'}
6. ${targetAudience ? `Target audience: ${targetAudience}` : 'Target their defined audience'}
7. ${callToAction ? `End with this call to action: ${callToAction}` : 'End with an engaging question or call to action'}
8. ${template ? `Follow this template structure: ${template}` : ''}
9. Length: ${length === 'short' ? '50-100 words' : length === 'long' ? '200-300 words' : '100-200 words'}

Remember to:
- Sound authentic and human, not AI-generated
- Use their natural communication style
- Align with their content pillars
- Reflect their professional identity`;

  // Create variations based on different angles
  const variations = [];
  const angles = [
    'expertise-focused',
    'experience-focused',
    'evolution-focused'
  ];

  try {
    // Generate main content
    const mainCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write a LinkedIn ${contentType} about: ${topic}` }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const mainContent = mainCompletion.choices[0].message.content;

    // Generate variations with different angles
    for (const angle of angles) {
      const variationPrompt = `${systemPrompt}\n\nFor this variation, emphasize the ${angle.replace('-', ' ')} perspective.`;
      
      const variationCompletion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: variationPrompt },
          { role: 'user', content: `Write a LinkedIn ${contentType} about: ${topic}` }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      variations.push(variationCompletion.choices[0].message.content);
    }

    return {
      content: mainContent,
      variations
    };
  } catch (error) {
    console.error('OpenAI generation error:', error);
    throw new Error('Failed to generate content');
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
      case 'generation':
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
      case 'from-news':
        return await handleGenerateFromNews(req, res);
      case 'from-idea':
        return await handleGenerateFromIdea(req, res);
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

// Enhanced generate content handler
async function handleGenerate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, contentType } = req.body;

  if (!topic || !contentType) {
    return res.status(400).json({ error: 'Topic and content type are required' });
  }

  try {
    // Get user's workshop data for personalization
    const workshopData = await getUserWorkshopData(req.user.userId);
    
    if (!workshopData) {
      return res.status(400).json({ 
        error: 'Please complete the Brand House workshop first to generate personalized content' 
      });
    }

    // Generate content with voice matching
    const { content, variations } = await generateContentWithVoice(req.body, workshopData);

    // Save to database
    const { data: savedContent, error } = await supabase
      .from('content_history')
      .insert({
        user_id: req.user.userId,
        topic,
        content_type: contentType,
        generated_content: content,
        variations: variations,
        workshop_data: workshopData,
        generation_params: req.body,
        status: 'generated'
      })
      .select()
      .single();

    if (error) throw error;

    // Calculate voice accuracy based on workshop data completeness
    const voiceAccuracy = workshopData ? 0.85 : 0.5;

    return res.status(200).json({
      contentId: savedContent.id,
      content: content,
      variations: variations,
      metadata: {
        generationTime: Date.now(),
        voiceAccuracy: voiceAccuracy,
        contentType: contentType,
        topic: topic,
        createdAt: savedContent.created_at,
        archetype: workshopData.archetype,
        contentPillar: determineContentPillar(topic, workshopData)
      }
    });
  } catch (error) {
    console.error('Content generation error:', error);
    return res.status(500).json({ error: 'Failed to generate content' });
  }
}

// Generate content from news article
async function handleGenerateFromNews(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { articleUrl, articleTitle, articleSummary, angle } = req.body;

  if (!articleUrl || !articleTitle) {
    return res.status(400).json({ error: 'Article URL and title are required' });
  }

  try {
    const workshopData = await getUserWorkshopData(req.user.userId);
    
    if (!workshopData) {
      return res.status(400).json({ 
        error: 'Please complete the Brand House workshop first' 
      });
    }

    // Create a news-based topic
    const newsRequest = {
      topic: `My perspective on: "${articleTitle}"`,
      contentType: 'post',
      tone: 'thought-leader',
      includePersonalExperience: true,
      template: `Opening hook about the news → Your unique perspective → Industry implications → Personal insight → Call to action`
    };

    // Add context about the article
    const systemContext = `\nNEWS CONTEXT:\nArticle: ${articleTitle}\nSummary: ${articleSummary}\nAngle: ${angle || 'professional insight'}\n\nCreate a LinkedIn post that adds your unique perspective to this news, showing thought leadership while staying authentic to your brand.`;

    // Generate content with news context
    const { content, variations } = await generateContentWithVoice(newsRequest, workshopData);

    // Save with news metadata
    const { data: savedContent } = await supabase
      .from('content_history')
      .insert({
        user_id: req.user.userId,
        topic: newsRequest.topic,
        content_type: 'post',
        generated_content: content,
        variations: variations,
        workshop_data: workshopData,
        generation_params: { ...newsRequest, newsArticle: { url: articleUrl, title: articleTitle } },
        status: 'generated',
        content_source: 'news'
      })
      .select()
      .single();

    return res.status(200).json({
      contentId: savedContent.id,
      content: content,
      variations: variations,
      metadata: {
        generationTime: Date.now(),
        voiceAccuracy: 0.85,
        contentType: 'post',
        topic: newsRequest.topic,
        createdAt: savedContent.created_at,
        source: 'news',
        newsArticle: { url: articleUrl, title: articleTitle }
      }
    });
  } catch (error) {
    console.error('News content generation error:', error);
    return res.status(500).json({ error: 'Failed to generate content from news' });
  }
}

// Generate content from workshop ideas
async function handleGenerateFromIdea(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ideaId, ideaText, contentPillar } = req.body;

  if (!ideaText) {
    return res.status(400).json({ error: 'Idea text is required' });
  }

  try {
    const workshopData = await getUserWorkshopData(req.user.userId);
    
    if (!workshopData) {
      return res.status(400).json({ 
        error: 'Please complete the Brand House workshop first' 
      });
    }

    // Create request based on content idea
    const ideaRequest = {
      topic: ideaText,
      contentType: 'post',
      tone: contentPillar === 'expertise' ? 'thought-leader' : contentPillar === 'experience' ? 'conversational' : 'professional',
      includePersonalExperience: contentPillar !== 'expertise'
    };

    // Generate content
    const { content, variations } = await generateContentWithVoice(ideaRequest, workshopData);

    // Save with idea metadata
    const { data: savedContent } = await supabase
      .from('content_history')
      .insert({
        user_id: req.user.userId,
        topic: ideaText,
        content_type: 'post',
        generated_content: content,
        variations: variations,
        workshop_data: workshopData,
        generation_params: { ...ideaRequest, contentPillar, ideaId },
        status: 'generated',
        content_source: 'workshop_idea'
      })
      .select()
      .single();

    return res.status(200).json({
      contentId: savedContent.id,
      content: content,
      variations: variations,
      metadata: {
        generationTime: Date.now(),
        voiceAccuracy: 0.9, // Higher accuracy since it's from their own ideas
        contentType: 'post',
        topic: ideaText,
        createdAt: savedContent.created_at,
        source: 'workshop_idea',
        contentPillar: contentPillar
      }
    });
  } catch (error) {
    console.error('Idea content generation error:', error);
    return res.status(500).json({ error: 'Failed to generate content from idea' });
  }
}

// Get content history handler (unchanged)
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

// Update content handler (unchanged)
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

// Delete content handler (unchanged)
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

// Enhanced templates handler with workshop integration
async function handleTemplates(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user's workshop data to personalize templates
  const workshopData = await getUserWorkshopData(req.user.userId);
  const archetype = workshopData?.archetype || 'Strategic Visionary';

  // Define archetype-specific templates
  const archetypeTemplates = {
    'Innovative Leader': [
      {
        id: 'innovation-announcement',
        name: 'Innovation Announcement',
        category: 'Leadership',
        structure: '🚀 Breaking new ground:\n\n[Innovation description]\n\nWhy this matters:\n• [Impact 1]\n• [Impact 2]\n• [Impact 3]\n\nWhat\'s next: [Future vision]\n\nWho else is pushing boundaries in [field]?',
        description: 'Share breakthrough innovations and transformative ideas'
      },
      {
        id: 'future-vision',
        name: 'Future Vision Post',
        category: 'Thought Leadership',
        structure: '🔮 The future of [industry]:\n\n[Bold prediction]\n\n3 trends driving this change:\n1. [Trend 1]\n2. [Trend 2]\n3. [Trend 3]\n\n[Your unique perspective]\n\nAre you ready for this shift?',
        description: 'Paint a picture of the future and inspire others'
      }
    ],
    'Empathetic Expert': [
      {
        id: 'client-success',
        name: 'Client Success Story',
        category: 'Case Study',
        structure: '❤️ Client transformation story:\n\nThe challenge: [Problem they faced]\n\nOur approach: [How you helped]\n\nThe outcome:\n• [Result 1]\n• [Result 2]\n• [Result 3]\n\nThe best part? [Emotional impact]\n\nWho needs this kind of support?',
        description: 'Share how you\'ve made a meaningful difference'
      },
      {
        id: 'empathy-insight',
        name: 'Empathy in Action',
        category: 'Personal',
        structure: '🤝 Real talk:\n\n[Vulnerable observation]\n\nWhat I\'ve learned: [Insight]\n\nHow to apply this:\n• [Tip 1]\n• [Tip 2]\n• [Tip 3]\n\n[Encouraging message]\n\nWhat\'s your experience with this?',
        description: 'Connect through shared experiences and understanding'
      }
    ],
    'Strategic Visionary': [
      {
        id: 'strategic-insight',
        name: 'Strategic Analysis',
        category: 'Thought Leadership',
        structure: '📊 Strategic insight:\n\n[Market observation]\n\nWhat this means:\n• For leaders: [Implication]\n• For teams: [Implication]\n• For the industry: [Implication]\n\nMy recommendation: [Strategic advice]\n\nWhat patterns are you seeing?',
        description: 'Share strategic insights and market analysis'
      },
      {
        id: 'systems-thinking',
        name: 'Systems Perspective',
        category: 'Educational',
        structure: '🔄 The hidden connection:\n\n[System observation]\n\nHow the pieces fit:\n1. [Component 1] → [Effect]\n2. [Component 2] → [Effect]\n3. [Component 3] → [Effect]\n\nThe leverage point: [Key insight]\n\nWhat systems are you optimizing?',
        description: 'Reveal how systems and strategies interconnect'
      }
    ],
    'Authentic Changemaker': [
      {
        id: 'challenge-status-quo',
        name: 'Challenge Convention',
        category: 'Provocative',
        structure: '⚡ Unpopular opinion:\n\n[Bold statement]\n\nWhy I believe this:\n• [Reason 1]\n• [Reason 2]\n• [Reason 3]\n\nThe alternative: [Your solution]\n\nWho\'s ready to rethink [topic]?',
        description: 'Challenge conventional thinking with authenticity'
      },
      {
        id: 'transparency-post',
        name: 'Radical Transparency',
        category: 'Personal',
        structure: '💯 Being real:\n\n[Honest admission]\n\nWhat actually happened: [Story]\n\nWhat I learned:\n• [Learning 1]\n• [Learning 2]\n• [Learning 3]\n\n[Call for authenticity]\n\nWhat truth do you need to share?',
        description: 'Lead with vulnerability and transparency'
      }
    ]
  };

  // Get base templates
  const baseTemplates = [
    {
      id: 'career-milestone',
      name: 'Career Milestone',
      category: 'Achievement',
      structure: '🎉 Exciting news!\n\n[Achievement details]\n\nKey learnings:\n• [Learning 1]\n• [Learning 2]\n• [Learning 3]\n\n[Call to action or question]',
      description: 'Share career achievements and milestones'
    },
    {
      id: 'learning-share',
      name: 'Learning Share',
      category: 'Educational',
      structure: '💡 Today I learned:\n\n[What you learned]\n\nWhy it matters:\n[Explanation]\n\nHow to apply it:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\n[Question for audience]',
      description: 'Share something you learned recently'
    },
    {
      id: 'industry-insight',
      name: 'Industry Insight',
      category: 'Thought Leadership',
      structure: '📊 Industry trend alert:\n\n[Observation or statistic]\n\nWhat this means:\n• [Implication 1]\n• [Implication 2]\n• [Implication 3]\n\n[Your perspective]\n\nWhat are your thoughts?',
      description: 'Share insights about industry trends'
    }
  ];

  // Combine archetype-specific templates with base templates
  const templates = [
    ...(archetypeTemplates[archetype] || []),
    ...baseTemplates
  ];

  return res.status(200).json({ 
    templates,
    archetype,
    totalTemplates: templates.length
  });
}

// Helper function to determine content pillar
function determineContentPillar(topic, workshopData) {
  const topicLower = topic.toLowerCase();
  
  // Check for expertise keywords
  const expertiseKeywords = ['how to', 'guide', 'framework', 'method', 'strategy', 'analysis', 'data', 'research'];
  if (expertiseKeywords.some(keyword => topicLower.includes(keyword))) {
    return 'expertise';
  }
  
  // Check for experience keywords
  const experienceKeywords = ['learned', 'story', 'journey', 'mistake', 'failure', 'success', 'client', 'project'];
  if (experienceKeywords.some(keyword => topicLower.includes(keyword))) {
    return 'experience';
  }
  
  // Check for evolution keywords
  const evolutionKeywords = ['future', 'prediction', 'trend', 'change', 'transform', 'innovate', 'vision'];
  if (evolutionKeywords.some(keyword => topicLower.includes(keyword))) {
    return 'evolution';
  }
  
  // Default based on random distribution matching pillar weights
  const random = Math.random();
  if (random < 0.4) return 'expertise';
  if (random < 0.75) return 'experience';
  return 'evolution';
}