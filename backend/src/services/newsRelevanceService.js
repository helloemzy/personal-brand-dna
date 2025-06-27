const OpenAI = require('openai');
const { query, cache } = require('../config/database');
const logger = require('../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Calculate relevance score for an article based on user's brand profile
 * @param {Object} article - News article data
 * @param {Object} userProfile - User's brand profile and preferences
 * @returns {Object} Relevance scoring results
 */
async function calculateArticleRelevance(article, userProfile) {
  try {
    // Check cache first
    const cacheKey = `relevance:${userProfile.userId}:${article.id}`;
    const cachedScore = await cache.get(cacheKey);
    if (cachedScore) {
      return cachedScore;
    }

    // Get user's brand voice profile and preferences
    const { brandVoiceProfile, contentPillars, audiencePersonas, preferences } = userProfile;

    // Calculate different relevance dimensions
    const [
      topicRelevance,
      audienceRelevance,
      toneAlignment,
      contentPillarMatch
    ] = await Promise.all([
      calculateTopicRelevance(article, userProfile),
      calculateAudienceRelevance(article, audiencePersonas),
      calculateToneAlignment(article, brandVoiceProfile),
      matchContentPillars(article, contentPillars)
    ]);

    // Calculate weighted overall score
    const overallScore = calculateWeightedScore({
      topicRelevance: topicRelevance.score * 0.35,
      audienceRelevance: audienceRelevance.score * 0.25,
      toneAlignment: toneAlignment.score * 0.20,
      contentPillarMatch: contentPillarMatch.score * 0.20
    });

    // Determine if article should be featured
    const isFeatured = overallScore >= 0.85 && contentPillarMatch.matches.length >= 2;

    const result = {
      relevanceScore: overallScore,
      contentPillarMatches: contentPillarMatch.matches,
      audienceMatchScore: audienceRelevance.score,
      toneMatchScore: toneAlignment.score,
      topicSimilarityScore: topicRelevance.score,
      scoringMetadata: {
        topicRelevance,
        audienceRelevance,
        toneAlignment,
        contentPillarMatch,
        calculatedAt: new Date()
      },
      isFeatured
    };

    // Cache the result for 24 hours
    await cache.set(cacheKey, result, 86400);

    return result;
  } catch (error) {
    logger.error('Error calculating article relevance:', error);
    throw error;
  }
}

/**
 * Calculate topic relevance using AI embeddings
 */
async function calculateTopicRelevance(article, userProfile) {
  try {
    // Prepare article text for embedding
    const articleText = `${article.title} ${article.summary || ''} ${article.content || ''}`.substring(0, 2000);
    
    // Prepare user interests text
    const userInterests = [
      ...userProfile.contentPillars,
      ...userProfile.preferences.keywords || [],
      userProfile.brandVoiceProfile?.voiceSummary || ''
    ].join(' ');

    // Get embeddings for both
    const [articleEmbedding, userEmbedding] = await Promise.all([
      getEmbedding(articleText),
      getEmbedding(userInterests)
    ]);

    // Calculate cosine similarity
    const similarity = cosineSimilarity(articleEmbedding, userEmbedding);

    // Check for excluded keywords
    const hasExcludedKeywords = checkExcludedKeywords(
      articleText, 
      userProfile.preferences.excludedKeywords || []
    );

    return {
      score: hasExcludedKeywords ? similarity * 0.3 : similarity,
      similarity,
      hasExcludedKeywords,
      reasoning: hasExcludedKeywords 
        ? 'Article contains excluded keywords' 
        : similarity > 0.8 ? 'Highly relevant topic'
        : similarity > 0.6 ? 'Moderately relevant topic'
        : 'Low topic relevance'
    };
  } catch (error) {
    logger.error('Error calculating topic relevance:', error);
    return { score: 0.5, error: error.message };
  }
}

/**
 * Calculate audience relevance
 */
async function calculateAudienceRelevance(article, audiencePersonas) {
  try {
    if (!audiencePersonas || audiencePersonas.length === 0) {
      return { score: 0.5, reasoning: 'No audience personas defined' };
    }

    const prompt = `Analyze if this article would interest the following audience personas:

Article Title: ${article.title}
Article Summary: ${(article.summary || article.content || '').substring(0, 500)}

Audience Personas:
${audiencePersonas.map(persona => `
- ${persona.name} (${persona.role} in ${persona.industry})
  Pain Points: ${persona.painPoints.join(', ')}
  Goals: ${persona.goals.join(', ')}
`).join('\n')}

Rate the relevance from 0-1 and explain why this article would or wouldn't interest each persona.
Return JSON: { score: 0-1, reasoning: string, personaScores: { personaName: score } }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing content relevance for specific professional audiences."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 300
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    logger.error('Error calculating audience relevance:', error);
    return { score: 0.5, error: error.message };
  }
}

/**
 * Calculate tone alignment
 */
async function calculateToneAlignment(article, brandVoiceProfile) {
  try {
    if (!brandVoiceProfile || !brandVoiceProfile.toneAttributes) {
      return { score: 0.5, reasoning: 'No tone profile defined' };
    }

    const prompt = `Analyze the tone and style of this article:

Article: ${article.title}
${(article.content || article.summary || '').substring(0, 800)}

Compare with desired brand voice:
${JSON.stringify(brandVoiceProfile.toneAttributes, null, 2)}

Rate alignment from 0-1 and explain the match/mismatch.
Return JSON: { score: 0-1, reasoning: string, alignedAttributes: [], misalignedAttributes: [] }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing writing tone and communication style."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 300
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    logger.error('Error calculating tone alignment:', error);
    return { score: 0.5, error: error.message };
  }
}

/**
 * Match article against content pillars
 */
async function matchContentPillars(article, contentPillars) {
  try {
    if (!contentPillars || contentPillars.length === 0) {
      return { score: 0.5, matches: [], reasoning: 'No content pillars defined' };
    }

    const articleText = `${article.title} ${article.summary || ''} ${article.content || ''}`.toLowerCase();
    const matches = [];

    // Direct keyword matching
    for (const pillar of contentPillars) {
      const pillarLower = pillar.toLowerCase();
      const pillarWords = pillarLower.split(/\s+/);
      
      // Check if all words in pillar appear in article
      const allWordsPresent = pillarWords.every(word => articleText.includes(word));
      
      // Check if pillar phrase appears
      const phrasePresent = articleText.includes(pillarLower);
      
      if (phrasePresent || allWordsPresent) {
        matches.push(pillar);
      }
    }

    // Use AI for semantic matching if few direct matches
    if (matches.length < 2) {
      const semanticMatches = await findSemanticPillarMatches(article, contentPillars);
      matches.push(...semanticMatches.filter(m => !matches.includes(m)));
    }

    const score = Math.min(1, matches.length / Math.max(3, contentPillars.length));

    return {
      score,
      matches,
      reasoning: matches.length >= 2 
        ? 'Strong content pillar alignment'
        : matches.length === 1
        ? 'Moderate content pillar alignment'
        : 'Weak content pillar alignment'
    };
  } catch (error) {
    logger.error('Error matching content pillars:', error);
    return { score: 0.5, matches: [], error: error.message };
  }
}

/**
 * Generate content ideas from relevant articles
 */
async function generateContentIdeas(article, userProfile) {
  try {
    const prompt = `Based on this news article and user's brand profile, generate 3 content ideas:

Article: ${article.title}
Summary: ${(article.summary || article.content || '').substring(0, 800)}

User's Brand Voice: ${userProfile.brandVoiceProfile?.voiceSummary || 'Professional and engaging'}
Content Pillars: ${userProfile.contentPillars.join(', ')}
Target Audience: ${userProfile.audiencePersonas?.[0]?.name || 'Professional network'}

Generate 3 different content ideas:
1. A response/commentary post
2. A how-to or tips post inspired by the topic  
3. A personal story or case study angle

For each idea provide:
- type: response|perspective|analysis|story|tips
- headline: Engaging headline
- hook: Opening line to grab attention
- outline: Array of 3-4 main points
- keyPoints: Array of key takeaways
- targetAudience: Who this resonates with
- estimatedWordCount: Suggested length
- contentFormat: post|article|carousel|video_script`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert content strategist who creates engaging LinkedIn content ideas."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 1000
    });

    const ideas = JSON.parse(completion.choices[0].message.content);
    
    // Add metadata to each idea
    return ideas.ideas.map(idea => ({
      ...idea,
      articleId: article.id,
      userId: userProfile.userId,
      aiConfidenceScore: 0.75 + Math.random() * 0.2, // Placeholder - would be calculated
      status: 'suggested'
    }));
  } catch (error) {
    logger.error('Error generating content ideas:', error);
    throw error;
  }
}

// Helper functions

async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text.substring(0, 8000), // Token limit
    });
    
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error getting embedding:', error);
    throw error;
  }
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function checkExcludedKeywords(text, excludedKeywords) {
  if (!excludedKeywords || excludedKeywords.length === 0) return false;
  
  const textLower = text.toLowerCase();
  return excludedKeywords.some(keyword => 
    textLower.includes(keyword.toLowerCase())
  );
}

function calculateWeightedScore(scores) {
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  return Math.min(1, Math.max(0, total));
}

async function findSemanticPillarMatches(article, contentPillars) {
  try {
    const prompt = `Which of these content pillars are semantically related to this article?

Article: ${article.title}
${(article.summary || '').substring(0, 300)}

Content Pillars: ${contentPillars.join(', ')}

Return only the matching pillar names as a JSON array.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You match content themes accurately." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 100
    });

    const matches = JSON.parse(completion.choices[0].message.content);
    return Array.isArray(matches) ? matches : [];
  } catch (error) {
    logger.error('Error finding semantic matches:', error);
    return [];
  }
}

module.exports = {
  calculateArticleRelevance,
  generateContentIdeas,
  calculateTopicRelevance,
  calculateAudienceRelevance,
  calculateToneAlignment,
  matchContentPillars
};