import { BaseAgent } from '../framework/base-agent';
import { Task, AgentType, GeneratedContent, VoiceProfile, NewsOpportunity, ContentVariation } from '@brandpillar/shared';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { workshopDataService, WorkshopData } from '../services/workshop-data.service';
import { voiceProfileGenerator } from '../services/voice-profile-generator.service';

interface ContentGenerationRequest {
  userId: string;
  opportunityId?: string;
  contentType: 'post' | 'article' | 'comment';
  topic?: string;
  angle?: string;
  voiceProfile: VoiceProfile;
  brandArchetype?: string;
  contentPillars?: string[];
  targetAudience?: any;
}

export class ContentGeneratorAgent extends BaseAgent {
  private openai: OpenAI;
  private voiceProfiles: Map<string, VoiceProfile> = new Map();
  private workshopDataCache: Map<string, WorkshopData> = new Map();

  constructor() {
    super({
      type: AgentType.CONTENT_GENERATOR,
      name: 'Content Generator Agent',
      messageBusUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      maxConcurrentTasks: 5, // Limited by OpenAI rate limits
      healthCheckInterval: 60000
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Content Generator Agent');
    
    // Load existing voice profiles from database/cache
    await this.loadVoiceProfiles();
  }

  async processTask(task: Task): Promise<any> {
    this.logger.info({ taskType: task.taskType }, 'Processing content generation task');
    
    switch (task.taskType) {
      case 'GENERATE_POST':
        return this.generatePost(task.payload);
        
      case 'GENERATE_ARTICLE':
        return this.generateArticle(task.payload);
        
      case 'GENERATE_VARIATIONS':
        return this.generateVariations(task.payload);
        
      case 'GENERATE_FROM_NEWS':
        return this.generateFromNews(task.payload);
        
      case 'UPDATE_VOICE_PROFILE':
        return this.updateVoiceProfile(task.userId, task.payload);
        
      case 'REVISE_CONTENT':
        return this.reviseContent(task.payload);
        
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }
  }

  async validateTask(task: Task): Promise<boolean> {
    switch (task.taskType) {
      case 'GENERATE_POST':
      case 'GENERATE_ARTICLE':
      case 'GENERATE_FROM_NEWS':
        return !!(task.userId && task.payload);
        
      case 'UPDATE_VOICE_PROFILE':
        return !!(task.userId && task.payload.voiceProfile);
        
      case 'REVISE_CONTENT':
        return !!(task.payload.originalContent && task.payload.issues);
        
      default:
        return false;
    }
  }

  private async generatePost(request: ContentGenerationRequest): Promise<GeneratedContent> {
    const { userId, topic, angle, contentType } = request;
    
    // Get user's voice profile and workshop data
    const voiceProfile = await this.getVoiceProfile(userId);
    const workshopData = await this.getWorkshopData(userId);
    
    if (!voiceProfile || !workshopData) {
      throw new Error('User profile not found');
    }
    
    // Generate content with voice matching
    const content = await this.generateVoiceMatchedContent({
      voiceProfile,
      workshopData,
      topic: topic || this.selectRandomTopic(workshopData),
      angle: angle || this.selectContentAngle(workshopData),
      contentType,
      format: 'linkedin_post'
    });
    
    // Calculate quality scores
    const scores = await this.calculateContentScores(content, voiceProfile, workshopData);
    
    // Create variations
    const variations = await this.createContentVariations(content, voiceProfile, workshopData);
    
    const generatedContent: GeneratedContent = {
      id: uuidv4(),
      userId,
      content: content.primary,
      contentType,
      angle: content.angle,
      voiceMatchScore: scores.voiceMatch,
      qualityScore: scores.quality,
      riskScore: scores.risk,
      status: 'draft',
      variations,
      metadata: {
        topic: content.topic,
        pillar: content.pillar,
        hook: content.hook,
        cta: content.cta,
        keywords: content.keywords,
        estimatedReadTime: this.calculateReadTime(content.primary),
        characterCount: content.primary.length,
        hashtagSuggestions: this.generateHashtags(content, workshopData)
      },
      createdAt: new Date()
    };
    
    return generatedContent;
  }

  private async generateVoiceMatchedContent(params: {
    voiceProfile: VoiceProfile;
    workshopData: WorkshopData;
    topic: string;
    angle: string;
    contentType: string;
    format: string;
  }): Promise<any> {
    const { voiceProfile, workshopData, topic, angle, contentType, format } = params;
    
    // Build comprehensive prompt with voice characteristics
    const systemPrompt = this.buildSystemPrompt(voiceProfile, workshopData);
    const userPrompt = this.buildContentPrompt({
      topic,
      angle,
      format,
      archetype: workshopData.archetype,
      values: workshopData.values,
      audience: workshopData.audiencePersonas[0] // Primary audience
    });
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const generatedText = response.choices[0].message.content || '';
    
    // Apply humanization layer
    const humanizedContent = await this.humanizeContent(generatedText, voiceProfile);
    
    return {
      primary: humanizedContent,
      topic,
      angle,
      pillar: this.identifyContentPillar(topic, workshopData),
      hook: this.extractHook(humanizedContent),
      cta: this.extractCTA(humanizedContent),
      keywords: this.extractKeywords(humanizedContent)
    };
  }

  private buildSystemPrompt(voiceProfile: VoiceProfile, workshopData: WorkshopData): string {
    const { linguisticPatterns, rhythmPatterns, personalityMarkers, tone } = voiceProfile;
    
    return `You are a content creation expert who perfectly mimics personal writing styles.

VOICE PROFILE:
- Sentence starters: ${linguisticPatterns.sentenceStarters.join(', ')}
- Transitions: ${linguisticPatterns.transitions.join(', ')}
- Signature phrases: ${linguisticPatterns.signaturePhrases.join(', ')}
- Tone: ${this.describeTone(tone)}
- Rhythm: ${rhythmPatterns.sentenceVariation}, ${rhythmPatterns.pacing}
- Style: ${personalityMarkers.humorStyle}, ${personalityMarkers.storytelling}

BRAND ARCHETYPE: ${workshopData.archetype}
- Transform through ${this.getArchetypeMethod(workshopData.archetype)}
- Core values: ${workshopData.values.slice(0, 3).join(', ')}
- Mission: ${workshopData.missionStatement || 'Help professionals succeed'}

WRITING RULES:
1. Use their exact sentence starters and transitions naturally
2. Include 1-2 signature phrases per post
3. Match their rhythm pattern (${rhythmPatterns.sentenceVariation})
4. Apply their humor style appropriately (${personalityMarkers.humorStyle})
5. Maintain their formality level (${tone.formality})
6. Use their preferred vocabulary
7. Include personal quirks and speech patterns

Generate content that sounds exactly like them, not like generic AI.`;
  }

  private buildContentPrompt(params: any): string {
    const { topic, angle, format, archetype, values, audience } = params;
    
    return `Create a ${format} about: ${topic}

ANGLE: ${angle}
TARGET AUDIENCE: ${audience?.name || 'Professionals'} - ${audience?.role || 'Leaders'}
Their main challenge: ${audience?.painPoints?.[0] || 'Growing professionally'}

CONTENT REQUIREMENTS:
- Start with a compelling hook that grabs attention
- Share a specific insight, story, or perspective
- Provide value through ${this.getValueType(archetype)}
- End with a clear but soft CTA
- Length: 150-200 words for LinkedIn post
- Include 1-2 questions to drive engagement

Make it sound natural, conversational, and authentic to their voice.
Focus on ${values[0]} as the underlying theme.`;
  }

  private async humanizeContent(content: string, voiceProfile: VoiceProfile): Promise<string> {
    let humanized = content;
    
    // Apply linguistic patterns
    const { linguisticPatterns, personalityMarkers } = voiceProfile;
    
    // Add natural imperfections
    if (linguisticPatterns.fillerWords.length > 0 && Math.random() > 0.7) {
      // Occasionally add a filler word
      const filler = linguisticPatterns.fillerWords[Math.floor(Math.random() * linguisticPatterns.fillerWords.length)];
      humanized = this.insertFillerWord(humanized, filler);
    }
    
    // Apply personality markers
    if (personalityMarkers.humorStyle === 'self-deprecating' && Math.random() > 0.8) {
      humanized = this.addSelfDeprecatingTouch(humanized);
    }
    
    // Ensure signature phrases are used
    const hasSignaturePhrase = linguisticPatterns.signaturePhrases.some(phrase => 
      humanized.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (!hasSignaturePhrase && linguisticPatterns.signaturePhrases.length > 0) {
      const phrase = linguisticPatterns.signaturePhrases[0];
      humanized = this.insertSignaturePhrase(humanized, phrase);
    }
    
    // Apply rhythm patterns
    humanized = this.applyRhythmPattern(humanized, voiceProfile.rhythmPatterns);
    
    return humanized;
  }

  private async createContentVariations(
    content: any,
    voiceProfile: VoiceProfile,
    workshopData: WorkshopData
  ): Promise<ContentVariation[]> {
    const variations: ContentVariation[] = [];
    
    // Professional variation
    variations.push({
      id: uuidv4(),
      content: await this.adjustContentStyle(content.primary, 'professional', voiceProfile),
      style: 'professional',
      score: 0.85
    });
    
    // Casual variation
    variations.push({
      id: uuidv4(),
      content: await this.adjustContentStyle(content.primary, 'casual', voiceProfile),
      style: 'casual',
      score: 0.82
    });
    
    // Storytelling variation
    if (workshopData.writingSample && workshopData.writingSample.length > 100) {
      variations.push({
        id: uuidv4(),
        content: await this.createStorytellingVariation(content, voiceProfile, workshopData),
        style: 'storytelling',
        score: 0.88
      });
    }
    
    return variations;
  }

  private async generateFromNews(params: {
    userId: string;
    opportunity: NewsOpportunity;
    angle: string;
  }): Promise<GeneratedContent> {
    const { userId, opportunity, angle } = params;
    
    // Get user profiles
    const voiceProfile = await this.getVoiceProfile(userId);
    const workshopData = await this.getWorkshopData(userId);
    
    if (!voiceProfile || !workshopData) {
      throw new Error('User profile not found');
    }
    
    // Create news-based content
    const newsPrompt = `Transform this news into a LinkedIn post:

NEWS: ${opportunity.title}
SUMMARY: ${opportunity.summary}
ANGLE: ${angle}

Create a post that:
1. References the news naturally
2. Adds unique perspective based on ${workshopData.archetype} archetype
3. Connects to ${workshopData.values[0]} value
4. Provides actionable insight
5. Maintains authentic voice`;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: this.buildSystemPrompt(voiceProfile, workshopData) },
        { role: 'user', content: newsPrompt }
      ],
      temperature: 0.7
    });
    
    const content = response.choices[0].message.content || '';
    const humanized = await this.humanizeContent(content, voiceProfile);
    
    return {
      id: uuidv4(),
      userId,
      opportunityId: opportunity.id,
      content: humanized,
      contentType: 'post',
      angle,
      voiceMatchScore: 0.87,
      qualityScore: 0.85,
      riskScore: 0.15,
      status: 'draft',
      metadata: {
        newsSource: opportunity.sourceUrl,
        newsTitle: opportunity.title,
        timeliness: this.calculateTimeliness(opportunity.publishedAt),
        keywords: opportunity.keywords
      },
      createdAt: new Date()
    };
  }

  private async calculateContentScores(
    content: any,
    voiceProfile: VoiceProfile,
    workshopData: WorkshopData
  ): Promise<{ voiceMatch: number; quality: number; risk: number }> {
    // Voice match score
    const voiceMatch = await this.calculateVoiceMatchScore(content.primary, voiceProfile);
    
    // Quality score based on multiple factors
    const quality = this.calculateQualityScore({
      content: content.primary,
      hasHook: !!content.hook,
      hasCTA: !!content.cta,
      readability: this.calculateReadability(content.primary),
      valueAlignment: this.checkValueAlignment(content.primary, workshopData.values)
    });
    
    // Risk score (controversial content, etc.)
    const risk = await this.calculateRiskScore(content.primary);
    
    return { voiceMatch, quality, risk };
  }

  private async calculateVoiceMatchScore(content: string, voiceProfile: VoiceProfile): Promise<number> {
    let score = 0.5; // Base score
    
    // Check for linguistic patterns
    const { linguisticPatterns } = voiceProfile;
    
    // Sentence starters (20%)
    const hasStarters = linguisticPatterns.sentenceStarters.some(starter =>
      content.toLowerCase().includes(starter.toLowerCase())
    );
    if (hasStarters) score += 0.2;
    
    // Transitions (15%)
    const hasTransitions = linguisticPatterns.transitions.some(transition =>
      content.toLowerCase().includes(transition.toLowerCase())
    );
    if (hasTransitions) score += 0.15;
    
    // Signature phrases (15%)
    const hasSignatures = linguisticPatterns.signaturePhrases.some(phrase =>
      content.toLowerCase().includes(phrase.toLowerCase())
    );
    if (hasSignatures) score += 0.15;
    
    // Rhythm analysis (25%)
    const rhythmScore = this.analyzeRhythm(content, voiceProfile.rhythmPatterns);
    score += rhythmScore * 0.25;
    
    // Tone match (25%)
    const toneScore = await this.analyzeToneMatch(content, voiceProfile.tone);
    score += toneScore * 0.25;
    
    return Math.min(score, 1);
  }

  private calculateQualityScore(factors: {
    content: string;
    hasHook: boolean;
    hasCTA: boolean;
    readability: number;
    valueAlignment: number;
  }): number {
    let score = 0;
    
    // Content length (optimal: 150-250 words)
    const wordCount = factors.content.split(/\s+/).length;
    if (wordCount >= 150 && wordCount <= 250) score += 0.2;
    else if (wordCount >= 100 && wordCount <= 300) score += 0.1;
    
    // Structure elements
    if (factors.hasHook) score += 0.2;
    if (factors.hasCTA) score += 0.15;
    
    // Readability
    score += factors.readability * 0.25;
    
    // Value alignment
    score += factors.valueAlignment * 0.2;
    
    return Math.min(score, 1);
  }

  private async calculateRiskScore(content: string): Promise<number> {
    // Simple risk detection - in production, use more sophisticated methods
    let risk = 0;
    
    // Check for controversial keywords
    const controversialTerms = ['political', 'religious', 'controversial', 'hate', 'discriminate'];
    const hasControversial = controversialTerms.some(term => 
      content.toLowerCase().includes(term)
    );
    if (hasControversial) risk += 0.3;
    
    // Check for absolute statements
    const absoluteTerms = ['always', 'never', 'everyone', 'no one', 'all', 'none'];
    const absoluteCount = absoluteTerms.filter(term => 
      content.toLowerCase().includes(term)
    ).length;
    risk += Math.min(absoluteCount * 0.1, 0.3);
    
    // Check for sensitive topics
    const sensitiveTopics = ['salary', 'fired', 'lawsuit', 'confidential'];
    const hasSensitive = sensitiveTopics.some(topic => 
      content.toLowerCase().includes(topic)
    );
    if (hasSensitive) risk += 0.2;
    
    return Math.min(risk, 1);
  }

  // Helper methods
  private async getVoiceProfile(userId: string): Promise<VoiceProfile | null> {
    // Check cache first
    if (this.voiceProfiles.has(userId)) {
      return this.voiceProfiles.get(userId)!;
    }
    
    try {
      // Get workshop data first
      const workshopData = await workshopDataService.getWorkshopData(userId);
      if (!workshopData) {
        this.logger.warn({ userId }, 'No workshop data found for user');
        return null;
      }
      
      // Generate voice profile from workshop data
      const voiceProfile = await voiceProfileGenerator.generateVoiceProfile(workshopData);
      
      // Cache it
      this.voiceProfiles.set(userId, voiceProfile);
      
      // Save to database for future use
      await workshopDataService.saveVoiceProfile(userId, voiceProfile);
      
      return voiceProfile;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get voice profile');
      return null;
    }
  }

  private async getWorkshopData(userId: string): Promise<WorkshopData | null> {
    // Check cache
    if (this.workshopDataCache.has(userId)) {
      return this.workshopDataCache.get(userId)!;
    }
    
    try {
      // Fetch from database via service
      const workshopData = await workshopDataService.getWorkshopData(userId);
      
      if (workshopData) {
        // Cache it
        this.workshopDataCache.set(userId, workshopData);
      }
      
      return workshopData;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get workshop data');
      return null;
    }
  }

  private selectRandomTopic(workshopData: WorkshopData): string {
    const allTopics = workshopData.contentPillars?.flatMap(p => p.topics) || [];
    return allTopics[Math.floor(Math.random() * allTopics.length)] || 'Professional growth';
  }

  private selectContentAngle(workshopData: WorkshopData): string {
    const angles = [
      'personal experience',
      'industry insight',
      'contrarian view',
      'practical tips',
      'future prediction'
    ];
    
    // Weight angles based on archetype
    if (workshopData.archetype.includes('Innovative')) {
      return 'future prediction';
    } else if (workshopData.archetype.includes('Expert')) {
      return 'industry insight';
    }
    
    return angles[Math.floor(Math.random() * angles.length)];
  }

  private identifyContentPillar(topic: string, workshopData: WorkshopData): string {
    for (const pillar of workshopData.contentPillars || []) {
      if (pillar.topics.some(t => topic.toLowerCase().includes(t.toLowerCase()))) {
        return pillar.name;
      }
    }
    return workshopData.contentPillars?.[0]?.name || 'General';
  }

  private extractHook(content: string): string {
    const sentences = content.split(/[.!?]+/);
    return sentences[0]?.trim() || '';
  }

  private extractCTA(content: string): string {
    const sentences = content.split(/[.!?]+/);
    const lastTwo = sentences.slice(-2).join('. ');
    
    // Look for question or action-oriented ending
    if (lastTwo.includes('?')) {
      return sentences.find(s => s.includes('?'))?.trim() || '';
    }
    
    return sentences[sentences.length - 1]?.trim() || '';
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production use NLP
    const words = content.toLowerCase().split(/\W+/);
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been'];
    
    const keywords = words
      .filter(word => word.length > 4 && !stopWords.includes(word))
      .reduce((acc: { [key: string]: number }, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
    
    return Object.entries(keywords)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  private generateHashtags(content: any, workshopData: WorkshopData): string[] {
    const hashtags: string[] = [];
    
    // Archetype-based hashtag
    const archetypeTag = workshopData.archetype.replace(/\s+/g, '');
    hashtags.push(`#${archetypeTag}`);
    
    // Topic-based hashtags
    if (content.keywords.length > 0) {
      hashtags.push(`#${content.keywords[0]}`);
      hashtags.push(`#${content.keywords[1]}`);
    }
    
    // Standard professional hashtags
    hashtags.push('#LinkedInThoughts');
    hashtags.push('#ProfessionalGrowth');
    
    return hashtags.slice(0, 5); // LinkedIn recommends 3-5 hashtags
  }

  private describeTone(tone: VoiceProfile['tone']): string {
    const descriptions: string[] = [];
    
    if (tone.formality > 0.7) descriptions.push('formal');
    else if (tone.formality < 0.3) descriptions.push('casual');
    else descriptions.push('conversational');
    
    if (tone.analytical > 0.7) descriptions.push('analytical');
    if (tone.empathetic > 0.7) descriptions.push('empathetic');
    if (tone.assertive > 0.7) descriptions.push('assertive');
    
    return descriptions.join(', ');
  }

  private getArchetypeMethod(archetype: string): string {
    const methods: { [key: string]: string } = {
      'Innovative Leader': 'breakthrough thinking and bold vision',
      'Empathetic Expert': 'deep understanding and genuine connection',
      'Strategic Visionary': 'long-term thinking and systematic approach',
      'Authentic Changemaker': 'radical transparency and courageous action'
    };
    
    return methods[archetype] || 'expertise and experience';
  }

  private getValueType(archetype: string): string {
    const valueTypes: { [key: string]: string } = {
      'Innovative Leader': 'new perspectives and future possibilities',
      'Empathetic Expert': 'practical guidance and emotional support',
      'Strategic Visionary': 'frameworks and actionable strategies',
      'Authentic Changemaker': 'truth-telling and inspiration'
    };
    
    return valueTypes[archetype] || 'insights and expertise';
  }

  private insertFillerWord(content: string, filler: string): string {
    const sentences = content.split('. ');
    if (sentences.length > 2) {
      // Insert in middle sentence
      const midIndex = Math.floor(sentences.length / 2);
      sentences[midIndex] = sentences[midIndex].replace(
        /^(\w+\s+\w+\s+)/,
        `$1${filler}, `
      );
    }
    return sentences.join('. ');
  }

  private addSelfDeprecatingTouch(content: string): string {
    const touches = [
      'Now, I\'m no expert, but',
      'This might just be me, but',
      'Call me crazy, but'
    ];
    
    const touch = touches[Math.floor(Math.random() * touches.length)];
    
    // Add to second sentence if possible
    const sentences = content.split('. ');
    if (sentences.length > 1) {
      sentences[1] = `${touch} ${sentences[1].toLowerCase()}`;
    }
    
    return sentences.join('. ');
  }

  private insertSignaturePhrase(content: string, phrase: string): string {
    const sentences = content.split('. ');
    
    // Try to insert before last sentence
    if (sentences.length > 2) {
      sentences.splice(-1, 0, phrase);
    }
    
    return sentences.join('. ');
  }

  private applyRhythmPattern(content: string, rhythmPatterns: VoiceProfile['rhythmPatterns']): string {
    // This is simplified - in production, use more sophisticated rhythm analysis
    if (rhythmPatterns.sentenceVariation === 'short-long-short') {
      // Ensure variation in sentence length
      const sentences = content.split('. ');
      // Logic to reorganize sentences by length would go here
    }
    
    return content;
  }

  private analyzeRhythm(content: string, targetRhythm: VoiceProfile['rhythmPatterns']): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    // Analyze sentence length variation
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    
    // Check if rhythm matches target pattern
    let score = 0.5; // Base score
    
    if (targetRhythm.sentenceVariation === 'short-long-short') {
      // Check for alternating pattern
      let alternating = true;
      for (let i = 1; i < lengths.length - 1; i++) {
        if (i % 2 === 1 && lengths[i] <= lengths[i-1]) alternating = false;
        if (i % 2 === 0 && lengths[i] >= lengths[i-1]) alternating = false;
      }
      if (alternating) score += 0.5;
    }
    
    return score;
  }

  private async analyzeToneMatch(content: string, targetTone: VoiceProfile['tone']): Promise<number> {
    // In production, use sentiment analysis and tone detection
    // For now, use simple heuristics
    
    let score = 0.5; // Base score
    
    // Formality check
    const formalWords = ['therefore', 'furthermore', 'consequently', 'pursuant'];
    const casualWords = ['gonna', 'wanna', 'stuff', 'things', 'yeah'];
    
    const hasFormal = formalWords.some(w => content.toLowerCase().includes(w));
    const hasCasual = casualWords.some(w => content.toLowerCase().includes(w));
    
    if (targetTone.formality > 0.7 && hasFormal) score += 0.25;
    if (targetTone.formality < 0.3 && hasCasual) score += 0.25;
    
    // Analytical check
    const analyticalIndicators = ['data', 'analysis', 'research', 'study', 'findings'];
    const hasAnalytical = analyticalIndicators.some(w => content.toLowerCase().includes(w));
    
    if (targetTone.analytical > 0.7 && hasAnalytical) score += 0.25;
    
    return Math.min(score, 1);
  }

  private checkValueAlignment(content: string, values: string[]): number {
    let alignmentScore = 0;
    const contentLower = content.toLowerCase();
    
    values.forEach((value, index) => {
      const weight = 1 - (index * 0.1); // Higher weight for primary values
      if (contentLower.includes(value.toLowerCase())) {
        alignmentScore += weight;
      }
    });
    
    return Math.min(alignmentScore / values.length, 1);
  }

  private calculateTimeliness(publishedDate: Date): number {
    const hoursSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSincePublished < 2) return 1; // Very fresh
    if (hoursSincePublished < 6) return 0.9;
    if (hoursSincePublished < 12) return 0.8;
    if (hoursSincePublished < 24) return 0.7;
    if (hoursSincePublished < 48) return 0.5;
    
    return 0.3; // Older news
  }

  private async adjustContentStyle(
    content: string, 
    style: 'professional' | 'casual' | 'storytelling' | 'educational',
    voiceProfile: VoiceProfile
  ): Promise<string> {
    const adjustmentPrompts = {
      professional: 'Make this more formal and authoritative while keeping the core message:',
      casual: 'Make this more conversational and relaxed while keeping the core message:',
      storytelling: 'Transform this into a story format with a clear narrative:',
      educational: 'Make this more educational with clear takeaways:'
    };
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert at adjusting writing styles while maintaining voice consistency.' },
        { role: 'user', content: `${adjustmentPrompts[style]}\n\n${content}` }
      ],
      temperature: 0.6,
      max_tokens: 500
    });
    
    return response.choices[0].message.content || content;
  }

  private async createStorytellingVariation(
    content: any,
    voiceProfile: VoiceProfile,
    workshopData: WorkshopData
  ): Promise<string> {
    const storyPrompt = `Transform this into a story format:

Topic: ${content.topic}
Key Message: ${content.primary}

Create a brief story that:
1. Opens with a specific moment or scenario
2. Includes a challenge or realization
3. Shows transformation or insight
4. Ends with the key takeaway

Keep it under 200 words and maintain the user's voice patterns.`;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: this.buildSystemPrompt(voiceProfile, workshopData) },
        { role: 'user', content: storyPrompt }
      ],
      temperature: 0.8
    });
    
    return response.choices[0].message.content || content.primary;
  }

  private async loadVoiceProfiles(): Promise<void> {
    // In production, load from database
    this.logger.info('Voice profiles loaded');
  }

  private async updateVoiceProfile(userId: string, voiceProfile: VoiceProfile): Promise<void> {
    this.voiceProfiles.set(userId, voiceProfile);
    
    // In production, save to database
    await this.saveVoiceProfile(userId, voiceProfile);
    
    this.logger.info({ userId }, 'Voice profile updated');
  }

  private async saveVoiceProfile(userId: string, voiceProfile: VoiceProfile): Promise<void> {
    // In production, save to database
    // For now, just log
    this.logger.debug({ userId }, 'Voice profile saved');
  }

  private async generateArticle(request: ContentGenerationRequest): Promise<GeneratedContent> {
    // Similar to generatePost but longer format
    // Implementation would be similar with adjusted prompts and length
    throw new Error('Article generation not yet implemented');
  }

  private async generateVariations(params: {
    contentId: string;
    count: number;
    styles: string[];
  }): Promise<ContentVariation[]> {
    // Generate multiple variations of existing content
    throw new Error('Variation generation not yet implemented');
  }

  private async reviseContent(params: {
    originalContent: string;
    contentId: string;
    userId: string;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      suggestion?: string;
    }>;
    suggestions: string[];
    scores: {
      quality: number;
      risk: number;
      brand: number;
      factCheck: number;
    };
  }): Promise<GeneratedContent> {
    const { originalContent, userId, issues, suggestions, scores } = params;
    
    // Get user's voice profile and workshop data
    const voiceProfile = await this.getVoiceProfile(userId);
    const workshopData = await this.getWorkshopData(userId);
    
    if (!voiceProfile || !workshopData) {
      throw new Error('User profile not found');
    }

    // Build revision prompt based on issues
    const revisionPrompt = this.buildRevisionPrompt(originalContent, issues, suggestions, scores);
    
    // Generate revised content
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: this.buildSystemPrompt(voiceProfile, workshopData) },
        { role: 'user', content: revisionPrompt }
      ],
      temperature: 0.7, // Lower temperature for more controlled revision
      max_tokens: 1000
    });
    
    const revisedContent = response.choices[0].message.content || originalContent;
    
    // Apply humanization layer to maintain voice
    const humanizedContent = await this.humanizeContent(revisedContent, voiceProfile);
    
    // Calculate new scores
    const metadata = await this.generateContentMetadata(humanizedContent, workshopData, voiceProfile);
    
    return {
      id: this.generateId(),
      userId,
      content: humanizedContent,
      contentType: 'post',
      status: 'revised',
      metadata: {
        ...metadata,
        revisionReason: issues.map(i => i.description).join('; '),
        originalScores: scores
      },
      createdAt: new Date()
    };
  }

  private buildRevisionPrompt(
    originalContent: string,
    issues: any[],
    suggestions: string[],
    scores: any
  ): string {
    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    
    return `Please revise the following content to address quality issues while maintaining the author's unique voice and style.

ORIGINAL CONTENT:
${originalContent}

QUALITY SCORES:
- Quality: ${(scores.quality * 100).toFixed(0)}%
- Risk: ${(scores.risk * 100).toFixed(0)}%
- Brand Alignment: ${(scores.brand * 100).toFixed(0)}%
- Fact Check: ${(scores.factCheck * 100).toFixed(0)}%

CRITICAL ISSUES TO FIX:
${criticalIssues.map(i => `- ${i.description}${i.suggestion ? ` (Suggestion: ${i.suggestion})` : ''}`).join('\n')}

OTHER ISSUES:
${mediumIssues.map(i => `- ${i.description}`).join('\n')}

IMPROVEMENT SUGGESTIONS:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

REVISION REQUIREMENTS:
1. Address all critical issues without changing the core message
2. Maintain the author's unique voice, tone, and style
3. Keep the same general structure and length
4. Preserve any personal anecdotes or unique perspectives
5. Ensure all facts are verifiable or clearly marked as opinions
6. Remove or rephrase any controversial or risky statements
7. Enhance clarity without losing personality

Generate the revised content:`;
  }
}