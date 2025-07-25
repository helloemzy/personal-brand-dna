import { VoiceProfile } from '@brandpillar/shared';
import { WorkshopData } from './workshop-data.service';
import OpenAI from 'openai';
import pino from 'pino';

const logger = pino({ name: 'voice-profile-generator' });

export class VoiceProfileGeneratorService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateVoiceProfile(workshopData: WorkshopData): Promise<VoiceProfile> {
    try {
      // If voice profile already exists, return it
      if (workshopData.voiceProfile) {
        return this.validateAndEnhanceProfile(workshopData.voiceProfile, workshopData);
      }

      // Generate new voice profile based on workshop data
      const linguisticPatterns = await this.extractLinguisticPatterns(workshopData);
      const rhythmPatterns = this.analyzeRhythmPatterns(workshopData);
      const personalityMarkers = this.derivePersonalityMarkers(workshopData);
      const vocabulary = await this.buildVocabulary(workshopData);
      const tone = this.calculateTone(workshopData);

      const voiceProfile: VoiceProfile = {
        userId: workshopData.userId,
        linguisticPatterns,
        rhythmPatterns,
        personalityMarkers,
        vocabulary,
        tone
      };

      logger.info({ userId: workshopData.userId }, 'Voice profile generated');
      return voiceProfile;
    } catch (error) {
      logger.error({ error, userId: workshopData.userId }, 'Failed to generate voice profile');
      
      // Return default profile on error
      return this.getDefaultVoiceProfile(workshopData);
    }
  }

  private async extractLinguisticPatterns(workshopData: WorkshopData): Promise<VoiceProfile['linguisticPatterns']> {
    if (!workshopData.writingSample || workshopData.writingSample.length < 100) {
      return this.getDefaultLinguisticPatterns(workshopData.archetype);
    }

    try {
      const prompt = `Analyze this writing sample and extract linguistic patterns:

Writing Sample: ${workshopData.writingSample}

Extract:
1. Common sentence starters (3-5 examples)
2. Transition phrases (3-5 examples)
3. Emphasis patterns (how they emphasize points)
4. Signature phrases (unique expressions they use)
5. Filler words or verbal tics

Format as JSON with arrays for each category.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a linguistic analysis expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      });

      const patterns = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        sentenceStarters: patterns.sentenceStarters || this.getArchetypeSentenceStarters(workshopData.archetype),
        transitions: patterns.transitions || this.getArchetypeTransitions(workshopData.archetype),
        emphasisPatterns: patterns.emphasisPatterns || ['really', 'absolutely', 'definitely'],
        signaturePhrases: patterns.signaturePhrases || this.getArchetypeSignatures(workshopData.archetype),
        fillerWords: patterns.fillerWords || []
      };
    } catch (error) {
      logger.error({ error }, 'Failed to extract linguistic patterns');
      return this.getDefaultLinguisticPatterns(workshopData.archetype);
    }
  }

  private analyzeRhythmPatterns(workshopData: WorkshopData): VoiceProfile['rhythmPatterns'] {
    // Analyze based on tone preferences and archetype
    const { tonePreferences } = workshopData;
    
    let sentenceVariation: string;
    let pacing: string;
    
    // Concise vs Detailed affects sentence variation
    if (tonePreferences.concise_detailed < -20) {
      sentenceVariation = 'short-short-medium';
      pacing = 'quick';
    } else if (tonePreferences.concise_detailed > 20) {
      sentenceVariation = 'medium-long-medium';
      pacing = 'thoughtful';
    } else {
      sentenceVariation = 'short-long-short';
      pacing = 'moderate';
    }
    
    // Archetype influences paragraph structure
    const paragraphStructures: Record<string, string> = {
      'Innovative Leader': 'single-multi-single',
      'Empathetic Expert': 'multi-multi-single',
      'Strategic Visionary': 'single-detailed-summary',
      'Authentic Changemaker': 'hook-story-impact'
    };
    
    return {
      sentenceVariation,
      paragraphStructure: paragraphStructures[workshopData.archetype] || 'single-multi-single',
      punctuationStyle: tonePreferences.serious_playful > 20 ? 'expressive' : 'balanced',
      pacing
    };
  }

  private derivePersonalityMarkers(workshopData: WorkshopData): VoiceProfile['personalityMarkers'] {
    const { archetype, tonePreferences, values } = workshopData;
    
    // Humor style based on archetype and tone
    let humorStyle: string;
    if (tonePreferences.serious_playful > 30) {
      humorStyle = 'playful';
    } else if (archetype === 'Empathetic Expert') {
      humorStyle = 'warm';
    } else if (archetype === 'Authentic Changemaker') {
      humorStyle = 'ironic';
    } else if (tonePreferences.serious_playful < -30) {
      humorStyle = 'minimal';
    } else {
      humorStyle = 'witty';
    }
    
    // Emotional range based on values and archetype
    let emotionalRange: string;
    if (values.includes('empathy') || values.includes('compassion')) {
      emotionalRange = 'expressive';
    } else if (values.includes('logic') || values.includes('precision')) {
      emotionalRange = 'controlled';
    } else {
      emotionalRange = 'balanced';
    }
    
    // Certainty level based on archetype
    const certaintyLevels: Record<string, string> = {
      'Innovative Leader': 'confident',
      'Empathetic Expert': 'nuanced',
      'Strategic Visionary': 'authoritative',
      'Authentic Changemaker': 'bold'
    };
    
    // Storytelling based on archetype and tone
    let storytelling: string;
    if (archetype === 'Empathetic Expert') {
      storytelling = 'personal';
    } else if (tonePreferences.analytical_creative > 20) {
      storytelling = 'metaphorical';
    } else {
      storytelling = 'anecdotal';
    }
    
    return {
      humorStyle,
      emotionalRange,
      certaintyLevel: certaintyLevels[archetype] || 'confident',
      storytelling
    };
  }

  private async buildVocabulary(workshopData: WorkshopData): Promise<VoiceProfile['vocabulary']> {
    const { archetype, values, contentPillars } = workshopData;
    
    // Common words based on values
    const commonWords: string[] = values.slice(0, 5).map(v => v.toLowerCase());
    
    // Add archetype-specific words
    const archetypeWords: Record<string, string[]> = {
      'Innovative Leader': ['transform', 'disrupt', 'pioneer', 'breakthrough', 'future'],
      'Empathetic Expert': ['understand', 'support', 'guide', 'nurture', 'connect'],
      'Strategic Visionary': ['optimize', 'analyze', 'strategic', 'metrics', 'execute'],
      'Authentic Changemaker': ['challenge', 'authentic', 'truth', 'impact', 'movement']
    };
    
    commonWords.push(...(archetypeWords[archetype] || []));
    
    // Industry terms from content pillars
    const industryTerms: string[] = [];
    contentPillars?.forEach(pillar => {
      industryTerms.push(...pillar.topics.map(t => t.toLowerCase()));
    });
    
    // Avoid words based on archetype
    const avoidWords: Record<string, string[]> = {
      'Innovative Leader': ['traditional', 'standard', 'usual'],
      'Empathetic Expert': ['aggressive', 'pushy', 'harsh'],
      'Strategic Visionary': ['random', 'chaotic', 'unplanned'],
      'Authentic Changemaker': ['fake', 'corporate', 'conventional']
    };
    
    return {
      commonWords: [...new Set(commonWords)].slice(0, 20),
      industryTerms: [...new Set(industryTerms)].slice(0, 15),
      avoidWords: avoidWords[archetype] || []
    };
  }

  private calculateTone(workshopData: WorkshopData): VoiceProfile['tone'] {
    const { tonePreferences, archetype } = workshopData;
    
    // Base tone from preferences (convert from -50 to 50 scale to 0 to 1)
    const formality = (tonePreferences.formal_casual + 50) / 100;
    const analytical = (tonePreferences.analytical_creative + 50) / 100;
    
    // Archetype adjustments
    const archetypeToneAdjustments: Record<string, Partial<VoiceProfile['tone']>> = {
      'Innovative Leader': { assertive: 0.8 },
      'Empathetic Expert': { empathetic: 0.9, assertive: 0.4 },
      'Strategic Visionary': { analytical: 0.8, assertive: 0.7 },
      'Authentic Changemaker': { empathetic: 0.6, assertive: 0.9 }
    };
    
    const adjustments = archetypeToneAdjustments[archetype] || {};
    
    return {
      formality: Math.max(0, Math.min(1, formality)),
      analytical: Math.max(0, Math.min(1, adjustments.analytical || analytical)),
      empathetic: adjustments.empathetic || 0.5,
      assertive: adjustments.assertive || 0.6
    };
  }

  private validateAndEnhanceProfile(existingProfile: any, workshopData: WorkshopData): VoiceProfile {
    // Ensure all required fields exist
    const enhanced: VoiceProfile = {
      userId: workshopData.userId,
      linguisticPatterns: existingProfile.linguisticPatterns || this.getDefaultLinguisticPatterns(workshopData.archetype),
      rhythmPatterns: existingProfile.rhythmPatterns || this.analyzeRhythmPatterns(workshopData),
      personalityMarkers: existingProfile.personalityMarkers || this.derivePersonalityMarkers(workshopData),
      vocabulary: existingProfile.vocabulary || {
        commonWords: [],
        industryTerms: [],
        avoidWords: []
      },
      tone: existingProfile.tone || this.calculateTone(workshopData)
    };
    
    // Enhance with workshop data if missing elements
    if (enhanced.vocabulary.commonWords.length === 0) {
      enhanced.vocabulary.commonWords = workshopData.values.slice(0, 5).map(v => v.toLowerCase());
    }
    
    return enhanced;
  }

  private getDefaultVoiceProfile(workshopData: WorkshopData): VoiceProfile {
    return {
      userId: workshopData.userId,
      linguisticPatterns: this.getDefaultLinguisticPatterns(workshopData.archetype),
      rhythmPatterns: this.analyzeRhythmPatterns(workshopData),
      personalityMarkers: this.derivePersonalityMarkers(workshopData),
      vocabulary: {
        commonWords: workshopData.values.slice(0, 5).map(v => v.toLowerCase()),
        industryTerms: [],
        avoidWords: []
      },
      tone: this.calculateTone(workshopData)
    };
  }

  private getDefaultLinguisticPatterns(archetype: string): VoiceProfile['linguisticPatterns'] {
    const patterns: Record<string, VoiceProfile['linguisticPatterns']> = {
      'Innovative Leader': {
        sentenceStarters: ['Here\'s what I\'m seeing', 'The future is', 'We need to rethink'],
        transitions: ['But here\'s the breakthrough', 'The game-changer is', 'What\'s next is'],
        emphasisPatterns: ['absolutely revolutionary', 'completely transform', 'radical shift'],
        signaturePhrases: ['the future of work', 'paradigm shift', 'breakthrough thinking'],
        fillerWords: []
      },
      'Empathetic Expert': {
        sentenceStarters: ['I understand that', 'Many of us struggle with', 'Let me help you'],
        transitions: ['The key insight is', 'What I\'ve learned is', 'Here\'s what works'],
        emphasisPatterns: ['truly understand', 'deeply matters', 'genuinely care'],
        signaturePhrases: ['from my experience', 'what really matters', 'at the heart of it'],
        fillerWords: ['honestly', 'actually']
      },
      'Strategic Visionary': {
        sentenceStarters: ['The data shows', 'Strategically speaking', 'When we analyze'],
        transitions: ['The implication is', 'This leads to', 'Therefore'],
        emphasisPatterns: ['critically important', 'strategically vital', 'data-driven'],
        signaturePhrases: ['ROI focused', 'strategic advantage', 'measurable results'],
        fillerWords: []
      },
      'Authentic Changemaker': {
        sentenceStarters: ['Let\'s be real', 'The truth is', 'Time to challenge'],
        transitions: ['But here\'s the thing', 'The real issue is', 'What nobody talks about'],
        emphasisPatterns: ['absolutely crucial', 'fundamentally broken', 'radically different'],
        signaturePhrases: ['status quo', 'real change', 'authentic impact'],
        fillerWords: ['honestly', 'literally']
      }
    };
    
    return patterns[archetype] || patterns['Strategic Visionary'];
  }

  private getArchetypeSentenceStarters(archetype: string): string[] {
    const starters: Record<string, string[]> = {
      'Innovative Leader': ['Here\'s what I\'m seeing', 'The future is', 'We need to rethink', 'Imagine if'],
      'Empathetic Expert': ['I understand that', 'Many of us', 'Let me share', 'In my experience'],
      'Strategic Visionary': ['The data shows', 'Analysis reveals', 'Strategy requires', 'Looking ahead'],
      'Authentic Changemaker': ['Let\'s be real', 'Truth is', 'Time to', 'We must']
    };
    
    return starters[archetype] || starters['Strategic Visionary'];
  }

  private getArchetypeTransitions(archetype: string): string[] {
    const transitions: Record<string, string[]> = {
      'Innovative Leader': ['But here\'s the breakthrough', 'The game-changer is', 'What\'s revolutionary'],
      'Empathetic Expert': ['The key insight is', 'What matters most', 'Here\'s what helps'],
      'Strategic Visionary': ['The data indicates', 'Analysis shows', 'This leads to'],
      'Authentic Changemaker': ['Here\'s the thing', 'The real issue', 'What we need']
    };
    
    return transitions[archetype] || transitions['Strategic Visionary'];
  }

  private getArchetypeSignatures(archetype: string): string[] {
    const signatures: Record<string, string[]> = {
      'Innovative Leader': ['paradigm shift', 'breakthrough thinking', 'transformative change'],
      'Empathetic Expert': ['from the heart', 'genuine connection', 'what really matters'],
      'Strategic Visionary': ['strategic advantage', 'data-driven decision', 'optimal outcome'],
      'Authentic Changemaker': ['real talk', 'status quo', 'authentic change']
    };
    
    return signatures[archetype] || signatures['Strategic Visionary'];
  }
}

// Singleton instance
export const voiceProfileGenerator = new VoiceProfileGeneratorService();