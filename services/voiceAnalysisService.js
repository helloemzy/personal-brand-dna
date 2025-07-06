import OpenAI from 'openai';
import natural from 'natural';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// NLP tools for additional analysis
const sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
const tokenizer = new natural.WordTokenizer();

export class VoiceAnalysisService {
  /**
   * Analyze complete voice conversation and extract brand insights
   */
  async analyzeConversation(voiceCall, conversations) {
    // Combine all responses for overall analysis
    const allResponses = conversations
      .map(c => c.user_response)
      .join(' ');

    // Perform multi-dimensional analysis
    const [
      communicationStyle,
      personalityTraits,
      brandArchetype,
      contentPillars,
      voiceMetrics,
      keyThemes
    ] = await Promise.all([
      this.analyzeCommunicationStyle(allResponses, conversations),
      this.extractPersonalityTraits(conversations),
      this.identifyBrandArchetype(conversations),
      this.generateContentPillars(conversations),
      this.calculateVoiceMetrics(allResponses),
      this.extractKeyThemes(conversations)
    ]);

    // Generate comprehensive brand framework
    const brandFramework = await this.generateBrandFramework({
      conversations,
      communicationStyle,
      personalityTraits,
      brandArchetype,
      keyThemes,
      voiceMetrics
    });

    return {
      communicationStyle,
      personalityTraits,
      brandArchetype,
      contentPillars,
      voiceMetrics,
      keyThemes,
      brandFramework
    };
  }

  /**
   * Analyze communication style dimensions
   */
  async analyzeCommunicationStyle(text, conversations) {
    const prompt = `Analyze this professional's communication style based on their responses:

${conversations.map(c => `Q: ${c.question_text}\nA: ${c.user_response}`).join('\n\n')}

Rate each dimension on a scale of 0 to 1:
1. Formality (0=very casual, 1=very formal)
2. Analytical vs Emotional (0=purely analytical, 1=purely emotional)
3. Concise vs Detailed (0=very concise, 1=very detailed)
4. Serious vs Playful (0=very serious, 1=very playful)

Also identify:
- Primary communication patterns
- Storytelling ability (rate 0-1)
- Metaphor/analogy usage (rate 0-1)
- Technical language preference (rate 0-1)

Format as JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert communication analyst.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Extract personality traits from conversation
   */
  async extractPersonalityTraits(conversations) {
    const prompt = `Based on this professional conversation, identify key personality traits:

${conversations.map(c => `Q: ${c.question_text}\nA: ${c.user_response}`).join('\n\n')}

Extract:
1. Top 5-7 personality traits (e.g., "Strategic Thinker", "Natural Educator", "Empathetic Leader")
2. Energy level (Low/Moderate/High)
3. Openness level (Guarded/Balanced/Transparent)
4. Confidence level (Developing/Solid/Commanding)
5. Warmth level (Professional/Friendly/Nurturing)
6. Primary motivators (Achievement/Connection/Impact/Growth)
7. Work style (Independent/Collaborative/Flexible)

Format as JSON with explanations.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert personality psychologist specializing in professional assessment.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Identify primary brand archetype
   */
  async identifyBrandArchetype(conversations) {
    const prompt = `Analyze this professional's responses to identify their primary brand archetype:

${conversations.map(c => `Q: ${c.question_text}\nA: ${c.user_response}`).join('\n\n')}

Consider these archetypes and their characteristics:
1. The Expert - Knowledge-focused, teaching-oriented, authority-driven
2. The Innovator - Future-focused, change-oriented, disruptive
3. The Mentor - People-focused, growth-oriented, supportive
4. The Visionary - Big-picture, possibility-oriented, inspiring
5. The Challenger - Status-quo questioning, bold, provocative
6. The Creator - Process-focused, craft-oriented, quality-driven
7. The Leader - Action-focused, results-oriented, decisive
8. The Connector - Relationship-focused, collaborative, networker

Determine:
- Primary archetype (with confidence score 0-1)
- Secondary archetype (if applicable)
- Key behaviors that indicate this archetype
- How this shows up in their communication
- Recommended messaging approach

Format as JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert in Jungian archetypes and brand psychology.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Generate content pillars based on expertise and passion
   */
  async generateContentPillars(conversations) {
    const prompt = `Based on this professional's expertise, passions, and communication style, generate 4 content pillars:

${conversations.map(c => `Q: ${c.question_text}\nA: ${c.user_response}`).join('\n\n')}

For each pillar provide:
1. Name (e.g., "Industry Insights", "Success Stories")
2. Description (what type of content)
3. Specific topics (5-7 per pillar)
4. Recommended percentage of content mix
5. Content formats that work best

Ensure pillars reflect their:
- Natural expertise areas
- Passion topics (where energy increased)
- Unique perspectives
- Target audience needs

Format as JSON array.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a content strategy expert specializing in personal branding.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Calculate voice metrics from speech patterns
   */
  calculateVoiceMetrics(text) {
    const words = tokenizer.tokenize(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Calculate various metrics
    const metrics = {
      averageWordsPerSentence: words.length / sentences.length,
      vocabularyComplexity: this.calculateVocabularyComplexity(words),
      sentimentScore: sentiment.getSentiment(words),
      
      // Speaking patterns
      fillerWordCount: this.countFillerWords(text),
      personalPronounUsage: this.calculatePronounUsage(words),
      
      // Energy indicators
      exclamationUsage: (text.match(/!/g) || []).length / sentences.length,
      questionUsage: (text.match(/\?/g) || []).length / sentences.length,
      
      // Linguistic patterns
      activeVoiceRatio: this.calculateActiveVoiceRatio(sentences),
      concreteVsAbstract: this.calculateConcreteLanguageRatio(words)
    };

    return metrics;
  }

  /**
   * Extract key themes and patterns
   */
  async extractKeyThemes(conversations) {
    const prompt = `Identify key themes, values, and patterns from this conversation:

${conversations.map(c => `Q: ${c.question_text}\nA: ${c.user_response}`).join('\n\n')}

Extract:
1. Core values expressed (with evidence)
2. Recurring themes across responses
3. Unique perspectives or contrarian views
4. Passion indicators (topics where energy increased)
5. Pain points they solve for others
6. Success patterns in their stories
7. Authentic phrases to incorporate in content
8. Metaphors or analogies they naturally use

Format as JSON with specific examples.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert in thematic analysis and pattern recognition.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Generate comprehensive brand framework
   */
  async generateBrandFramework(analysis) {
    const { 
      conversations, 
      communicationStyle, 
      personalityTraits, 
      brandArchetype,
      keyThemes,
      voiceMetrics 
    } = analysis;

    const prompt = `Create a comprehensive personal brand framework based on this analysis:

CONVERSATIONS:
${conversations.slice(0, 3).map(c => `Q: ${c.question_text}\nA: ${c.user_response}`).join('\n\n')}

ANALYSIS RESULTS:
- Primary Archetype: ${brandArchetype.primary}
- Communication Style: ${JSON.stringify(communicationStyle)}
- Key Personality Traits: ${personalityTraits.traits.join(', ')}
- Core Values: ${keyThemes.coreValues.join(', ')}

Generate:
1. Brand Positioning Statement: "I help [TARGET] achieve [OUTCOME] through [UNIQUE METHOD]"
2. Value Proposition (1-2 sentences)
3. Unique Differentiators (3-5 specific points)
4. Target Audience Profile (demographics, psychographics, pain points, desires)
5. Core Message (the ONE thing they should be known for)
6. Supporting Messages (3-5 proof points)
7. Voice Guidelines (tone, style, energy, dos and don'ts)
8. Recommended Brand Story Structure
9. Call-to-Action Phrases (3-5 that fit their style)
10. Confidence Score (0-1) based on clarity and consistency

Format as JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a master brand strategist who creates authentic, differentiated personal brands.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6
    });

    const framework = JSON.parse(response.choices[0].message.content);

    // Add additional calculated elements
    framework.voiceCharacteristics = {
      tone: this.determineTone(communicationStyle, personalityTraits),
      pace: this.determinePace(voiceMetrics),
      vocabulary: this.determineVocabularyStyle(voiceMetrics),
      energy: personalityTraits.energyLevel
    };

    framework.authenticPhrases = keyThemes.authenticPhrases || [];
    framework.contentStrategy = await this.generateContentStrategy(
      brandArchetype,
      keyThemes,
      framework.targetAudience
    );

    return framework;
  }

  // Helper methods
  calculateVocabularyComplexity(words) {
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    return Math.min(avgWordLength / 10, 1); // Normalize to 0-1
  }

  countFillerWords(text) {
    const fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'literally'];
    const lowerText = text.toLowerCase();
    return fillers.reduce((count, filler) => {
      const regex = new RegExp(`\\b${filler}\\b`, 'g');
      return count + (lowerText.match(regex) || []).length;
    }, 0);
  }

  calculatePronounUsage(words) {
    const personalPronouns = ['i', 'me', 'my', 'mine', 'we', 'us', 'our'];
    const pronounCount = words.filter(w => 
      personalPronouns.includes(w.toLowerCase())
    ).length;
    return pronounCount / words.length;
  }

  calculateActiveVoiceRatio(sentences) {
    // Simplified check for passive voice indicators
    const passiveIndicators = ['was', 'were', 'been', 'being', 'be', 'is', 'are'];
    const passiveSentences = sentences.filter(s => {
      const words = s.toLowerCase().split(' ');
      return words.some(w => passiveIndicators.includes(w));
    }).length;
    
    return 1 - (passiveSentences / sentences.length);
  }

  calculateConcreteLanguageRatio(words) {
    // Check for concrete vs abstract language
    const concreteIndicators = ['specific', 'example', 'instance', 'case', 'story', 'time when'];
    const abstractIndicators = ['concept', 'theory', 'principle', 'philosophy', 'belief', 'idea'];
    
    const concreteCount = words.filter(w => 
      concreteIndicators.some(indicator => w.toLowerCase().includes(indicator))
    ).length;
    
    const abstractCount = words.filter(w => 
      abstractIndicators.some(indicator => w.toLowerCase().includes(indicator))
    ).length;
    
    return concreteCount / (concreteCount + abstractCount + 1);
  }

  determineTone(communicationStyle, personalityTraits) {
    const warmth = personalityTraits.warmthLevel;
    const formality = communicationStyle.formality;
    
    if (warmth === 'Nurturing' && formality < 0.5) return 'Warm & Approachable';
    if (warmth === 'Professional' && formality > 0.7) return 'Professional & Authoritative';
    if (warmth === 'Friendly' && formality < 0.7) return 'Friendly & Conversational';
    return 'Balanced & Engaging';
  }

  determinePace(voiceMetrics) {
    const wordsPerSentence = voiceMetrics.averageWordsPerSentence;
    if (wordsPerSentence < 10) return 'Quick & Punchy';
    if (wordsPerSentence > 20) return 'Thoughtful & Detailed';
    return 'Moderate & Clear';
  }

  determineVocabularyStyle(voiceMetrics) {
    const complexity = voiceMetrics.vocabularyComplexity;
    if (complexity < 0.4) return 'Simple & Accessible';
    if (complexity > 0.7) return 'Sophisticated & Professional';
    return 'Clear & Professional';
  }

  async generateContentStrategy(archetype, themes, audience) {
    // Generate specific content strategy based on archetype
    const strategies = {
      'Expert': {
        approach: 'Educational content with deep insights',
        formats: ['How-to guides', 'Industry analysis', 'Best practices'],
        frequency: '3-4 times per week'
      },
      'Innovator': {
        approach: 'Forward-thinking content about trends and possibilities',
        formats: ['Trend predictions', 'Innovation spotlights', 'Future scenarios'],
        frequency: '2-3 times per week'
      },
      'Mentor': {
        approach: 'Supportive content focused on growth and development',
        formats: ['Success stories', 'Lessons learned', 'Coaching tips'],
        frequency: '2-3 times per week'
      },
      // Add more archetypes...
    };

    return strategies[archetype.primary] || strategies['Expert'];
  }
}

export default new VoiceAnalysisService();