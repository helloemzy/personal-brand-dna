// Content Generation Service with Workshop Integration
// This service provides AI-powered content generation using workshop data for personalization

import { WorkshopData } from '../types/workshop';
import { ContentPillar } from './contentPillarService';

interface ContentGenerationRequest {
  topic: string;
  contentType: 'post' | 'article' | 'story' | 'poll' | 'carousel';
  tone?: 'professional' | 'casual' | 'thought-leader' | 'conversational';
  targetAudience?: string;
  callToAction?: string;
  includePersonalExperience?: boolean;
  template?: string;
  length?: 'short' | 'medium' | 'long';
  source?: 'manual' | 'news' | 'idea';
  newsContext?: {
    articleUrl: string;
    articleTitle: string;
    articleSummary?: string;
  };
  ideaContext?: {
    ideaId: string;
    contentPillar: string;
  };
}

interface GeneratedContent {
  content: string;
  variations: string[];
  metadata: {
    voiceAccuracy: number;
    contentPillar: string;
    archetype: string;
    generationTime: number;
  };
}

export class ContentGenerationService {
  // Generate personalized prompts based on workshop data
  static generateSystemPrompt(workshopData: WorkshopData): string {
    const archetype = workshopData.archetypeResult?.primary || 'Strategic Visionary';
    const values = workshopData.values?.selectedValues || [];
    const mission = workshopData.personalityQuiz?.missionStatement || '';
    const contentPillars = workshopData.contentPillars || {};

    return `You are an AI content writer helping a ${archetype} create authentic LinkedIn content.

BRAND FRAMEWORK:
- Archetype: ${archetype}
- Core Values: ${values.join(', ')}
- Mission: ${mission}
- Industry: ${workshopData.audienceBuilder?.personas?.[0]?.industry || 'professional services'}

CONTENT PILLARS:
- Expertise (40%): Focus on sharing knowledge, frameworks, and insights
- Experience (35%): Share stories, lessons learned, and personal journey
- Evolution (25%): Discuss future trends, predictions, and vision

WRITING STYLE:
- Be authentic and conversational
- Use clear, concise language
- Include specific examples and data when relevant
- Match the ${archetype} communication style

TARGET AUDIENCE:
${workshopData.audienceBuilder?.personas?.map(p => `- ${p.role} in ${p.industry}`).join('\n') || '- Professional audience'}

Remember to:
- Sound human and authentic, not AI-generated
- Incorporate their values naturally
- Align with their mission
- Use their natural voice and tone`;
  }

  // Generate content ideas based on content pillars
  static generateContentIdeas(
    workshopData: WorkshopData,
    contentPillar: 'expertise' | 'experience' | 'evolution',
    count: number = 5
  ): string[] {
    const archetype = workshopData.archetypeResult?.primary || 'Strategic Visionary';
    const industry = workshopData.audienceBuilder?.personas?.[0]?.industry || 'your industry';
    const values = workshopData.values?.selectedValues || [];
    
    const ideas: Record<string, string[]> = {
      expertise: [
        `The 3-step framework I use for ${workshopData.writingSample?.topic || 'solving complex problems'}`,
        `Common mistakes in ${industry} (and how to avoid them)`,
        `Data-driven insights: What the numbers tell us about ${industry}`,
        `My proven method for ${workshopData.audienceBuilder?.personas?.[0]?.transformation || 'achieving results'}`,
        `Breaking down the science behind ${workshopData.personalityQuiz?.controversialOpinion || 'industry best practices'}`,
        `The tools and techniques that transformed my approach to ${workshopData.personalityQuiz?.currentRole || 'work'}`,
        `A complete guide to ${workshopData.personalityQuiz?.knownFor || 'professional excellence'}`
      ],
      experience: [
        `The day I realized ${values[0] || 'authenticity'} was my superpower`,
        `Lessons from my biggest failure in ${industry}`,
        `Behind the scenes: How we achieved ${workshopData.audienceBuilder?.personas?.[0]?.transformation || 'remarkable results'}`,
        `Client success story: From challenge to transformation`,
        `My journey from ${workshopData.personalityQuiz?.yearsExperience || '5'} years ago to today`,
        `The mentor who changed my perspective on ${values[1] || 'leadership'}`,
        `What ${workshopData.personalityQuiz?.yearsExperience || 'years'} in ${industry} taught me about resilience`
      ],
      evolution: [
        `The future of ${industry}: 3 trends you can't ignore`,
        `Why I believe ${workshopData.personalityQuiz?.controversialOpinion || 'the industry needs to change'}`,
        `My vision for the next decade in ${industry}`,
        `The shift that's coming to ${industry} (and how to prepare)`,
        `Building tomorrow's ${workshopData.audienceBuilder?.personas?.[0]?.aspirations || 'solutions'} today`,
        `The innovation that will transform how we think about ${industry}`,
        `My prediction: Where ${industry} will be in 2030`
      ]
    };

    return ideas[contentPillar].slice(0, count);
  }

  // Generate hook variations for content
  static generateHooks(topic: string, archetype: string): string[] {
    const archetypeHooks: Record<string, (topic: string) => string[]> = {
      'Innovative Leader': (t) => [
        `🚀 Here's what nobody tells you about ${t}...`,
        `The future of ${t} just changed. Here's why:`,
        `I've discovered a breakthrough approach to ${t}`,
        `Disrupting ${t}: The innovation you've been waiting for`
      ],
      'Empathetic Expert': (t) => [
        `Let's have an honest conversation about ${t}`,
        `The human side of ${t} that we need to discuss`,
        `I've been where you are with ${t}. Here's what helped:`,
        `Real talk about ${t} (from someone who's been there)`
      ],
      'Strategic Visionary': (t) => [
        `The strategic truth about ${t} most people miss`,
        `Here's the pattern I've noticed with ${t}`,
        `Connecting the dots on ${t}: What it really means`,
        `The hidden opportunity in ${t} nobody's talking about`
      ],
      'Authentic Changemaker': (t) => [
        `Time to challenge everything you know about ${t}`,
        `The uncomfortable truth about ${t}`,
        `Why the status quo on ${t} isn't working anymore`,
        `Let's get real about ${t} (unpopular opinion ahead)`
      ]
    };

    return archetypeHooks[archetype]?.(topic) || [
      `Let's talk about ${topic}`,
      `Here's my take on ${topic}`,
      `Thoughts on ${topic}:`,
      `My perspective on ${topic}`
    ];
  }

  // Create content from news article
  static createNewsContent(
    newsTitle: string,
    newsSummary: string,
    workshopData: WorkshopData
  ): ContentGenerationRequest {
    const archetype = workshopData.archetypeResult?.primary || 'Strategic Visionary';
    
    // Select appropriate tone based on archetype
    const toneMap: Record<string, any> = {
      'Innovative Leader': 'thought-leader',
      'Empathetic Expert': 'conversational',
      'Strategic Visionary': 'professional',
      'Authentic Changemaker': 'casual'
    };

    return {
      topic: `My perspective on: "${newsTitle}"`,
      contentType: 'post',
      tone: toneMap[archetype] || 'professional',
      includePersonalExperience: true,
      template: `Opening hook → Industry context → Your unique perspective → Practical implications → Call to action`,
      source: 'news',
      newsContext: {
        articleTitle: newsTitle,
        articleSummary: newsSummary,
        articleUrl: ''
      }
    };
  }

  // Create content variations
  static async generateVariations(
    baseContent: string,
    request: ContentGenerationRequest,
    workshopData: WorkshopData
  ): Promise<string[]> {
    const variations = [];
    
    // Variation 1: Different hook
    const hooks = this.generateHooks(request.topic, workshopData.archetypeResult?.primary || 'Strategic Visionary');
    variations.push(baseContent.replace(/^.*?\n/, hooks[1] + '\n'));
    
    // Variation 2: Different CTA
    const ctas = [
      "What's your take on this?",
      "I'd love to hear your thoughts.",
      "How are you approaching this?",
      "Let's discuss in the comments.",
      "Share your experience below."
    ];
    variations.push(baseContent.replace(/[^.!?]*\??\s*$/, '\n\n' + ctas[Math.floor(Math.random() * ctas.length)]));
    
    // Variation 3: Different structure (move personal story to beginning)
    if (request.includePersonalExperience) {
      const sentences = baseContent.split(/(?<=[.!?])\s+/);
      const reordered = [
        sentences[Math.floor(sentences.length / 2)],
        ...sentences.slice(0, Math.floor(sentences.length / 2)),
        ...sentences.slice(Math.floor(sentences.length / 2) + 1)
      ].join(' ');
      variations.push(reordered);
    }
    
    return variations;
  }

  // Score content for voice match
  static scoreVoiceMatch(
    content: string,
    workshopData: WorkshopData
  ): number {
    let score = 0.5; // Base score
    
    // Check for value alignment
    const values = workshopData.values?.selectedValues || [];
    values.forEach(value => {
      if (content.toLowerCase().includes(value.toLowerCase())) {
        score += 0.1;
      }
    });
    
    // Check for personality traits
    const traits = workshopData.personalityQuiz?.selectedTraits || [];
    const traitKeywords: Record<string, string[]> = {
      innovative: ['innovate', 'new', 'breakthrough', 'transform'],
      empathetic: ['understand', 'feel', 'support', 'together'],
      strategic: ['strategy', 'plan', 'analyze', 'optimize'],
      authentic: ['honest', 'real', 'genuine', 'truth']
    };
    
    traits.forEach(trait => {
      const keywords = traitKeywords[trait.name] || [];
      if (keywords.some(keyword => content.toLowerCase().includes(keyword))) {
        score += 0.05;
      }
    });
    
    // Cap at 0.95
    return Math.min(score, 0.95);
  }

  // Get content template for archetype
  static getArchetypeTemplate(
    archetype: string,
    contentType: string
  ): string {
    const templates: Record<string, Record<string, string>> = {
      'Innovative Leader': {
        post: '🚀 [Bold opening]\n\n[Innovation insight]\n\n3 ways this changes everything:\n1. [Impact]\n2. [Impact]\n3. [Impact]\n\n[Vision for future]\n\n[Engaging question]',
        article: '# [Transformative Title]\n\n## The Breakthrough\n[Opening story]\n\n## The Innovation\n[Deep dive]\n\n## The Impact\n[Analysis]\n\n## What\'s Next\n[Call to action]'
      },
      'Empathetic Expert': {
        post: '❤️ [Personal opening]\n\n[Relatable story]\n\nWhat I learned:\n• [Insight]\n• [Insight]\n• [Insight]\n\n[Encouragement]\n\n[Community question]',
        article: '# [Human-Centered Title]\n\n## The Story\n[Personal narrative]\n\n## The Lesson\n[Deep insights]\n\n## The Application\n[Practical steps]\n\n## Together Forward\n[Community building]'
      },
      'Strategic Visionary': {
        post: '📊 [Strategic observation]\n\nThe pattern:\n[Analysis]\n\nWhat this means:\n• For leaders: [Implication]\n• For teams: [Implication]\n• For growth: [Implication]\n\n[Strategic question]',
        article: '# [Strategic Title]\n\n## The Analysis\n[Market overview]\n\n## The Pattern\n[Deep dive]\n\n## The Strategy\n[Recommendations]\n\n## The Execution\n[Action plan]'
      },
      'Authentic Changemaker': {
        post: '💯 [Bold statement]\n\n[Truth bomb]\n\nWhy this matters:\n• [Reason]\n• [Reason]\n• [Reason]\n\n[Challenge to status quo]\n\n[Provocative question]',
        article: '# [Disruptive Title]\n\n## The Problem\n[Current state]\n\n## The Truth\n[Honest assessment]\n\n## The Solution\n[Alternative approach]\n\n## The Revolution\n[Call to action]'
      }
    };

    return templates[archetype]?.[contentType] || templates['Strategic Visionary'][contentType];
  }

  // Generate engaging CTAs based on archetype
  static generateCTAs(archetype: string): string[] {
    const ctaMap: Record<string, string[]> = {
      'Innovative Leader': [
        'Who else is ready to innovate?',
        'What breakthrough are you working on?',
        'Let\'s shape the future together.',
        'Share your innovation story below.'
      ],
      'Empathetic Expert': [
        'How has this shown up in your life?',
        'I\'d love to hear your story.',
        'What\'s been your experience?',
        'Let\'s support each other in this.'
      ],
      'Strategic Visionary': [
        'What patterns are you noticing?',
        'How does this align with your strategy?',
        'What\'s your strategic take?',
        'Share your analysis below.'
      ],
      'Authentic Changemaker': [
        'Who\'s ready to challenge the norm?',
        'What truth do you need to share?',
        'Let\'s start a real conversation.',
        'Time to make waves. You in?'
      ]
    };

    return ctaMap[archetype] || ['What are your thoughts?', 'Let\'s discuss.'];
  }
}

export default ContentGenerationService;