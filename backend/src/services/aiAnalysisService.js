const OpenAI = require('openai');
const natural = require('natural');
const { cache } = require('../config/database');
const logger = require('../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize natural language processing tools
const tokenizer = new natural.WordTokenizer();
const sentenceTokenizer = new natural.SentenceTokenizer('English');
const TfIdf = natural.TfIdf;
const sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');

/**
 * Analyze writing sample for style, tone, and communication patterns
 * @param {string} text - The writing sample text
 * @param {Object} context - Additional context (values, tone preferences, etc.)
 * @returns {Object} Analysis results
 */
async function analyzeWritingSample(text, context = {}) {
  try {
    // Check cache first
    const cacheKey = `writing-analysis:${Buffer.from(text).toString('base64').substring(0, 50)}`;
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      logger.info('Returning cached writing analysis');
      return cachedResult;
    }

    // Basic text metrics
    const words = tokenizer.tokenize(text);
    const sentences = sentenceTokenizer.tokenize(text);
    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const avgWordsPerSentence = wordCount / sentenceCount;

    // Readability score (Flesch Reading Ease approximation)
    const syllableCount = words.reduce((count, word) => {
      return count + countSyllables(word);
    }, 0);
    const avgSyllablesPerWord = syllableCount / wordCount;
    const readabilityScore = Math.max(0, Math.min(100, 
      206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
    ));

    // Sentiment analysis
    const sentimentScore = sentiment.getSentiment(words);
    const sentimentResults = {
      positive: sentimentScore > 0 ? sentimentScore / 5 : 0,
      neutral: Math.abs(sentimentScore) < 0.5 ? 0.8 : 0.2,
      professional: 0.7 + (Math.random() * 0.2), // Placeholder - would use classifier
    };

    // Style metrics using OpenAI
    const styleAnalysis = await analyzeStyleWithAI(text, context);

    // Vocabulary complexity
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyDiversity = uniqueWords.size / wordCount;
    const complexWords = words.filter(word => word.length > 8).length;
    const complexityRatio = complexWords / wordCount;

    // Determine voice (active vs passive) - simplified
    const passiveIndicators = ['was', 'were', 'been', 'being', 'is', 'are', 'am'];
    const passiveCount = words.filter(word => 
      passiveIndicators.includes(word.toLowerCase())
    ).length;
    const voiceScore = 1 - (passiveCount / wordCount);
    
    const voice = voiceScore > 0.9 ? 'Active' : 
                  voiceScore > 0.7 ? 'Mixed' : 'Passive';

    // Compile results
    const analysisResults = {
      readability: Math.round(readabilityScore),
      sentiment: sentimentResults,
      styleMetrics: {
        avgSentenceLength: Math.round(avgWordsPerSentence),
        complexity: complexityRatio > 0.15 ? 'High' : 
                    complexityRatio > 0.08 ? 'Medium' : 'Low',
        voice: voice,
        formality: styleAnalysis.formality || 0.6,
        vocabularyDiversity: vocabularyDiversity,
        ...styleAnalysis
      },
      insights: {
        strengths: identifyStrengths(analysisResults),
        suggestions: generateSuggestions(analysisResults),
        contentPillars: extractContentPillars(text)
      }
    };

    // Cache the results
    await cache.set(cacheKey, analysisResults, 3600); // 1 hour cache

    return analysisResults;
  } catch (error) {
    logger.error('Error analyzing writing sample:', error);
    throw error;
  }
}

/**
 * Use OpenAI to analyze writing style
 */
async function analyzeStyleWithAI(text, context) {
  try {
    const prompt = `Analyze the following writing sample for professional communication style. 
    Consider formality, tone, and communication patterns.
    
    Writing Sample:
    "${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}"
    
    ${context.values ? `User's Professional Values: ${context.values.join(', ')}` : ''}
    
    Provide analysis in JSON format with these fields:
    - formality (0-1 scale)
    - clarity (0-1 scale)
    - persuasiveness (0-1 scale)
    - authoritative (0-1 scale)
    - empathy (0-1 scale)
    - innovation (0-1 scale)
    - keyThemes (array of 3-5 themes)
    - communicationStyle (brief description)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert in analyzing professional communication styles and personal branding."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });

    const analysis = JSON.parse(completion.choices[0].message.content);
    return analysis;
  } catch (error) {
    logger.error('OpenAI style analysis error:', error);
    // Return default values if AI analysis fails
    return {
      formality: 0.6,
      clarity: 0.7,
      persuasiveness: 0.6,
      authoritative: 0.7,
      empathy: 0.6,
      innovation: 0.5,
      keyThemes: ['professional', 'analytical', 'results-oriented'],
      communicationStyle: 'Professional and balanced'
    };
  }
}

/**
 * Generate brand voice profile from workshop data
 */
async function generateBrandVoiceProfile(workshopData) {
  try {
    const { values, tonePreferences, audiencePersonas, writingSample, quizResponses } = workshopData;

    // Analyze quiz responses for personality traits
    const personalityProfile = analyzePersonalityQuiz(quizResponses);

    // Analyze writing sample if available
    let writingAnalysis = null;
    if (writingSample?.text) {
      writingAnalysis = await analyzeWritingSample(writingSample.text, { values });
    }

    // Use OpenAI to synthesize all data into a comprehensive profile
    const prompt = `Create a comprehensive brand voice profile based on the following workshop data:

    Professional Values: ${values.map(v => v.value_name).join(', ')}
    
    Communication Tone Preferences:
    - Formality: ${tonePreferences.formal_casual < 0 ? 'Formal' : 'Casual'} (${Math.abs(tonePreferences.formal_casual)}/50)
    - Detail Level: ${tonePreferences.concise_detailed < 0 ? 'Concise' : 'Detailed'} (${Math.abs(tonePreferences.concise_detailed)}/50)
    - Thinking Style: ${tonePreferences.analytical_creative < 0 ? 'Analytical' : 'Creative'} (${Math.abs(tonePreferences.analytical_creative)}/50)
    - Energy: ${tonePreferences.serious_playful < 0 ? 'Serious' : 'Playful'} (${Math.abs(tonePreferences.serious_playful)}/50)
    
    Target Audience: ${audiencePersonas.map(p => `${p.name} (${p.role} in ${p.industry})`).join(', ')}
    
    Personality Traits: ${JSON.stringify(personalityProfile)}
    
    ${writingAnalysis ? `Writing Style Analysis: ${JSON.stringify(writingAnalysis.styleMetrics)}` : ''}
    
    Create a JSON response with:
    - voiceSummary: 2-3 sentence description of their unique voice
    - contentPillars: 5 main topics they should focus on
    - toneAttributes: key characteristics of their communication style
    - messagingFramework: core messages aligned with their values
    - contentFormats: recommended content types based on their style
    - uniqueAngle: what makes their perspective distinctive
    - doList: 5 things to always do in their content
    - dontList: 5 things to avoid in their content`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert personal branding strategist who creates authentic, distinctive brand voices for professionals."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000
    });

    const brandProfile = JSON.parse(completion.choices[0].message.content);

    return {
      ...brandProfile,
      personalityProfile,
      writingAnalysis,
      confidenceScore: calculateConfidenceScore(workshopData),
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Error generating brand voice profile:', error);
    throw error;
  }
}

// Helper functions

function countSyllables(word) {
  word = word.toLowerCase();
  let count = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const isVowel = /[aeiouy]/.test(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }
  
  // Adjust for silent e
  if (word.endsWith('e')) {
    count--;
  }
  
  // Ensure at least one syllable
  return Math.max(1, count);
}

function identifyStrengths(analysis) {
  const strengths = [];
  
  if (analysis.readability >= 60) {
    strengths.push('Clear and accessible writing style');
  }
  if (analysis.styleMetrics.voice === 'Active') {
    strengths.push('Strong active voice usage');
  }
  if (analysis.styleMetrics.vocabularyDiversity > 0.5) {
    strengths.push('Rich vocabulary');
  }
  if (analysis.sentiment.professional > 0.6) {
    strengths.push('Professional tone');
  }
  
  return strengths;
}

function generateSuggestions(analysis) {
  const suggestions = [];
  
  if (analysis.readability < 50) {
    suggestions.push('Consider using shorter sentences for better readability');
  }
  if (analysis.styleMetrics.complexity === 'High') {
    suggestions.push('Balance complex ideas with simpler explanations');
  }
  if (analysis.styleMetrics.voice === 'Passive') {
    suggestions.push('Use more active voice for stronger impact');
  }
  
  return suggestions;
}

function extractContentPillars(text) {
  // Use TF-IDF to extract key themes
  const tfidf = new TfIdf();
  tfidf.addDocument(text);
  
  const terms = [];
  tfidf.listTerms(0).forEach((item) => {
    if (item.term.length > 4 && item.tfidf > 2) {
      terms.push(item.term);
    }
  });
  
  return terms.slice(0, 5);
}

function analyzePersonalityQuiz(quizResponses) {
  const dimensions = {};
  
  quizResponses.forEach(response => {
    dimensions[response.dimension] = (dimensions[response.dimension] || 0) + 1;
  });
  
  // Normalize to percentages
  const total = quizResponses.length;
  Object.keys(dimensions).forEach(key => {
    dimensions[key] = Math.round((dimensions[key] / total) * 100);
  });
  
  return dimensions;
}

function calculateConfidenceScore(workshopData) {
  let score = 0;
  let factors = 0;
  
  // Check data completeness
  if (workshopData.values?.length >= 5) { score += 0.2; factors++; }
  if (workshopData.tonePreferences) { score += 0.2; factors++; }
  if (workshopData.audiencePersonas?.length >= 1) { score += 0.2; factors++; }
  if (workshopData.writingSample?.text?.length >= 150) { score += 0.2; factors++; }
  if (workshopData.quizResponses?.length >= 10) { score += 0.2; factors++; }
  
  return factors > 0 ? score / factors : 0.5;
}

module.exports = {
  analyzeWritingSample,
  generateBrandVoiceProfile,
  analyzeStyleWithAI
};