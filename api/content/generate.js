const { Configuration, OpenAIApi } = require('openai');
const { query } = require('../_lib/database');
const { AppError, asyncHandler } = require('../_lib/errorHandler');
const { authenticate } = require('../_lib/auth');
const { contentRateLimit } = require('../_lib/rateLimiter');

// Initialize OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CONTENT_TEMPLATES = {
  'career-milestone': {
    name: 'Career Milestone Achievement',
    structure: 'Hook → Achievement → Impact → Lesson → CTA',
    prompt: 'Create a LinkedIn post about a career milestone that shows professional growth and inspires others.'
  },
  'industry-trend': {
    name: 'Industry Trend Analysis',
    structure: 'Trend → Analysis → Personal Take → Future Implications → Engagement',
    prompt: 'Write a LinkedIn post analyzing an industry trend with your unique perspective and insights.'
  },
  'learning-story': {
    name: 'Personal Learning Story',
    structure: 'Challenge → Process → Learning → Application → Takeaway',
    prompt: 'Share a personal learning experience that provides value to your professional network.'
  },
  'company-news': {
    name: 'Company News Announcement',
    structure: 'News → Context → Impact → Personal Connection → CTA',
    prompt: 'Announce company news in a way that reflects your voice and engages your network.'
  },
  'networking': {
    name: 'Networking Connection',
    structure: 'Context → Value → Personal Touch → CTA → Gratitude',
    prompt: 'Create a networking post that builds meaningful professional relationships.'
  },
  'thought-leadership': {
    name: 'Thought Leadership Opinion',
    structure: 'Controversial Take → Evidence → Personal Experience → Nuanced View → Discussion',
    prompt: 'Share a thought-provoking opinion that establishes thought leadership in your field.'
  },
  'quick-tip': {
    name: 'Professional Quick Tips',
    structure: 'Problem → Solution → Steps → Example → CTA',
    prompt: 'Share a quick professional tip that provides immediate value to your audience.'
  },
  'achievement': {
    name: 'Achievement Celebration',
    structure: 'Achievement → Journey → Team Recognition → Gratitude → Future',
    prompt: 'Celebrate a professional achievement while staying humble and inspiring others.'
  },
  'learning-development': {
    name: 'Learning & Development',
    structure: 'Skill → Why Important → Learning Process → Application → Encouragement',
    prompt: 'Share insights about professional development and continuous learning.'
  },
  'problem-solution': {
    name: 'Problem-Solution Case Study',
    structure: 'Problem → Analysis → Solution → Results → Lessons',
    prompt: 'Present a professional challenge and how you solved it, providing value to others.'
  }
};

const generateContent = async (topic, contentType, template, voiceSignature, userInfo) => {
  try {
    const templateInfo = CONTENT_TEMPLATES[template] || CONTENT_TEMPLATES['career-milestone'];
    
    const prompt = `Create a LinkedIn post with the following specifications:

TOPIC: ${topic}
CONTENT TYPE: ${contentType}
TEMPLATE: ${templateInfo.name}
STRUCTURE: ${templateInfo.structure}

VOICE SIGNATURE:
${JSON.stringify(voiceSignature, null, 2)}

USER CONTEXT:
- Role: ${userInfo.role || 'Professional'}
- Industry: ${userInfo.industry || 'Business'}
- Company: ${userInfo.company || 'Current Organization'}

REQUIREMENTS:
1. Write in the user's authentic voice based on their voice signature
2. Follow the template structure: ${templateInfo.structure}
3. Make it appropriate for ${contentType} format
4. Keep it professional but authentic
5. Include relevant hashtags (3-5)
6. Aim for 150-300 words for optimal engagement
7. End with a question or call-to-action to encourage engagement

Create a post that sounds like it was genuinely written by this person, not generic AI content.`;

    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional LinkedIn content creator specializing in authentic, voice-matched content that drives engagement and career growth. Focus on creating content that sounds genuinely human and reflects the person\'s unique communication style.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Content generation error:', error);
    throw new AppError('Failed to generate content', 500, 'GENERATION_ERROR');
  }
};

module.exports = asyncHandler(async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  // Apply authentication
  await new Promise((resolve, reject) => {
    authenticate(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  // Apply rate limiting
  await contentRateLimit(req, res, () => {});

  const { topic, contentType = 'Post', template = 'career-milestone', variations = 1 } = req.body;

  // Validate required fields
  if (!topic) {
    return res.status(400).json({
      success: false,
      message: 'Topic is required',
      code: 'VALIDATION_ERROR'
    });
  }

  // Validate variations count
  if (variations < 1 || variations > 3) {
    return res.status(400).json({
      success: false,
      message: 'Variations must be between 1 and 3',
      code: 'VALIDATION_ERROR'
    });
  }

  // Get user's voice signature
  const voiceResult = await query(
    `SELECT vt.voice_signature, vt.characteristics, u.industry, u.role, u.company, u.first_name, u.last_name
     FROM voice_transcriptions vt
     JOIN users u ON vt.user_id = u.id
     WHERE vt.user_id = $1 
     ORDER BY vt.created_at DESC 
     LIMIT 1`,
    [req.user.id]
  );

  if (voiceResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Voice profile required. Please complete voice discovery first.',
      code: 'VOICE_PROFILE_REQUIRED'
    });
  }

  const voiceData = voiceResult.rows[0];
  const voiceSignature = voiceData.voice_signature;
  const userInfo = {
    role: voiceData.role,
    industry: voiceData.industry,
    company: voiceData.company,
    firstName: voiceData.first_name,
    lastName: voiceData.last_name
  };

  // Generate content variations
  const contentVariations = [];
  
  for (let i = 0; i < variations; i++) {
    const content = await generateContent(topic, contentType, template, voiceSignature, userInfo);
    contentVariations.push({
      id: i + 1,
      content,
      contentType,
      template,
      createdAt: new Date().toISOString()
    });
  }

  // Store generated content in database
  const contentPromises = contentVariations.map(async (variation) => {
    const result = await query(
      `INSERT INTO generated_content (
         user_id, topic, content_type, template_used, content, 
         voice_signature_used, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id, created_at`,
      [
        req.user.id, topic, contentType, template, variation.content,
        JSON.stringify(voiceSignature), 'generated'
      ]
    );
    
    return {
      ...variation,
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at
    };
  });

  const storedContent = await Promise.all(contentPromises);

  // Update user stats
  await query(
    'UPDATE user_profiles SET total_content_generated = total_content_generated + $1 WHERE user_id = $2',
    [variations, req.user.id]
  );

  // Log generation
  console.log(`Content generated for user ${req.user.id}: ${variations} variations for topic "${topic}"`);

  res.status(200).json({
    success: true,
    message: 'Content generated successfully',
    data: {
      topic,
      contentType,
      template,
      templateInfo: CONTENT_TEMPLATES[template],
      variations: storedContent,
      voiceProfile: {
        summary: voiceSignature.summary,
        lastAnalysis: voiceData.created_at
      }
    },
    code: 'GENERATION_SUCCESS'
  });
});