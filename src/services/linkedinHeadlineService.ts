import { WorkshopState } from '../store/slices/workshopSlice';
import { UVPAnalysis } from './uvpConstructorService';

// LinkedIn Headline Types
export interface LinkedInHeadline {
  id: string;
  type: 'authority' | 'outcome' | 'problem-solver' | 'transformation' | 'unique-method';
  text: string;
  characterCount: number;
  keywords: string[];
  archetype: string;
  confidence: number;
}

export interface ElevatorPitch {
  id: string;
  duration: '30-second' | '60-second' | 'networking-event';
  text: string;
  wordCount: number;
  keyPoints: string[];
  hook: string;
  close: string;
}

export interface ContentStarter {
  id: string;
  pillar: 'expertise' | 'experience' | 'evolution';
  headline: string;
  hook: string;
  angle: string;
  engagementType: 'educational' | 'inspirational' | 'controversial' | 'storytelling';
}

export interface ActionableContentPackage {
  headlines: LinkedInHeadline[];
  elevatorPitches: ElevatorPitch[];
  contentStarters: ContentStarter[];
  bestHeadline: LinkedInHeadline;
  primaryPitch: ElevatorPitch;
}

// Industry keyword mapping for SEO optimization
const industryKeywords: Record<string, string[]> = {
  'technology': ['Tech', 'Digital', 'Innovation', 'SaaS', 'AI', 'Data'],
  'healthcare': ['Healthcare', 'Health', 'Medical', 'Clinical', 'Patient', 'Wellness'],
  'finance': ['Finance', 'Financial', 'Investment', 'Banking', 'Fintech', 'Capital'],
  'education': ['Education', 'Learning', 'EdTech', 'Academic', 'Training', 'Development'],
  'consulting': ['Consulting', 'Advisory', 'Strategy', 'Management', 'Business'],
  'marketing': ['Marketing', 'Brand', 'Growth', 'Digital Marketing', 'Content', 'CMO'],
  'sales': ['Sales', 'Revenue', 'Business Development', 'B2B', 'Enterprise', 'Growth'],
  'leadership': ['Leadership', 'Executive', 'C-Suite', 'Management', 'Transformation'],
  'default': ['Professional', 'Expert', 'Specialist', 'Leader', 'Advisor']
};

// Archetype-specific headline templates
const archetypeHeadlineTemplates = {
  'Innovative Leader': {
    authority: (role: string, outcome: string) => 
      `${role} | Pioneering ${outcome} Through Innovation`,
    outcome: (audience: string, transformation: string) => 
      `Transforming How ${audience} ${transformation}`,
    problemSolver: (problem: string, solution: string) => 
      `Disrupting ${problem} with ${solution}`,
    transformation: (before: string, after: string) => 
      `From ${before} to ${after} | Innovation Catalyst`,
    uniqueMethod: (method: string, impact: string, role?: string) => 
      `${method} → ${impact} | Future-Forward ${role || 'Leader'}`
  },
  'Empathetic Expert': {
    authority: (role: string, specialty: string) => 
      `${role} | Human-Centered ${specialty}`,
    outcome: (audience: string, result: string) => 
      `Helping ${audience} ${result} with Empathy + Expertise`,
    problemSolver: (pain: string, approach: string) => 
      `Solving ${pain} Through ${approach}`,
    transformation: (journey: string, destination: string) => 
      `Guiding ${journey} → ${destination}`,
    uniqueMethod: (expertise: string, care: string) => 
      `${expertise} + ${care} = Transformation`
  },
  'Strategic Visionary': {
    authority: (role: string, focus: string) => 
      `${role} | Strategic ${focus} Architect`,
    outcome: (metric: string, audience: string) => 
      `Driving ${metric} for ${audience}`,
    problemSolver: (challenge: string, strategy: string) => 
      `Strategic Solutions to ${challenge} via ${strategy}`,
    transformation: (current: string, future: string) => 
      `Strategist: ${current} → ${future}`,
    uniqueMethod: (insight: string, result: string) => 
      `${insight} = ${result} | Visionary Strategist`
  },
  'Authentic Changemaker': {
    authority: (role: string, mission: string) => 
      `${role} | Authentic ${mission} Advocate`,
    outcome: (change: string, impact: string) => 
      `Creating ${change} That ${impact}`,
    problemSolver: (status_quo: string, revolution: string) => 
      `Challenging ${status_quo} with ${revolution}`,
    transformation: (old: string, newState: string) => 
      `${old} → ${newState} | Authentic Change Agent`,
    uniqueMethod: (truth: string, impact: string) => 
      `${truth} + Action = ${impact}`
  }
};

// Extract key elements from workshop data
const extractHeadlineElements = (workshopData: WorkshopState, uvpAnalysis: UVPAnalysis) => {
  const { uniqueFactors } = uvpAnalysis;
  
  // Get primary transformation
  const primaryPersona = workshopData.audiencePersonas.find(p => p.isPrimary) || 
                        workshopData.audiencePersonas[0];
  
  const transformation = primaryPersona?.transformation || {
    outcome: uniqueFactors.outcome,
    before: 'struggling',
    after: 'thriving'
  };
  
  // Get expertise areas
  const expertiseResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'known_for'
  );
  const expertiseAreas = expertiseResponse?.answer?.split(/[,;]/).map(e => e.trim()) || [];
  
  // Get mission elements
  const missionResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'change_in_world'
  );
  const mission = missionResponse?.answer || uniqueFactors.outcome;
  
  // Get industry from audience or role
  const industry = primaryPersona?.industry || 
                   uniqueFactors.role.toLowerCase() || 
                   'professional services';
  
  return {
    role: uniqueFactors.role,
    method: uniqueFactors.method,
    outcome: uniqueFactors.outcome,
    audience: uniqueFactors.audience,
    painPoint: uniqueFactors.painPoint,
    transformation,
    expertiseAreas,
    mission,
    industry,
    values: workshopData.values.primary
  };
};

// Generate LinkedIn headline variations
const generateHeadlineVariations = (
  elements: ReturnType<typeof extractHeadlineElements>,
  archetype: string
): LinkedInHeadline[] => {
  const headlines: LinkedInHeadline[] = [];
  const templates = archetypeHeadlineTemplates[archetype as keyof typeof archetypeHeadlineTemplates] || 
                   archetypeHeadlineTemplates['Strategic Visionary'];
  
  // Get industry keywords
  const keywords = industryKeywords[elements.industry.toLowerCase()] || industryKeywords.default;
  
  // Authority-based headline
  const authorityHeadline = templates.authority(
    elements.role,
    elements.expertiseAreas[0] || elements.outcome
  );
  headlines.push({
    id: 'authority',
    type: 'authority',
    text: authorityHeadline,
    characterCount: authorityHeadline.length,
    keywords: [elements.role, ...keywords.slice(0, 2)],
    archetype,
    confidence: 0.90
  });
  
  // Outcome-based headline
  const outcomeHeadline = templates.outcome(
    elements.audience,
    elements.transformation.outcome || elements.outcome
  );
  headlines.push({
    id: 'outcome',
    type: 'outcome',
    text: outcomeHeadline,
    characterCount: outcomeHeadline.length,
    keywords: [elements.audience.split(' ')[0], ...keywords.slice(0, 2)],
    archetype,
    confidence: 0.85
  });
  
  // Problem-solver headline
  const problemHeadline = templates.problemSolver(
    elements.painPoint,
    elements.method.split(' ').slice(0, 3).join(' ')
  );
  headlines.push({
    id: 'problem-solver',
    type: 'problem-solver',
    text: problemHeadline,
    characterCount: problemHeadline.length,
    keywords: keywords.slice(0, 3),
    archetype,
    confidence: 0.82
  });
  
  // Transformation headline
  const transformationHeadline = templates.transformation(
    elements.transformation.before || 'challenges',
    elements.transformation.after || 'success'
  );
  headlines.push({
    id: 'transformation',
    type: 'transformation',
    text: transformationHeadline,
    characterCount: transformationHeadline.length,
    keywords: ['Transformation', ...keywords.slice(0, 2)],
    archetype,
    confidence: 0.80
  });
  
  // Unique method headline
  const uniqueHeadline = templates.uniqueMethod(
    elements.method.split(' ').slice(0, 4).join(' '),
    elements.mission.split(' ').slice(0, 3).join(' '),
    elements.role
  );
  headlines.push({
    id: 'unique-method',
    type: 'unique-method',
    text: uniqueHeadline,
    characterCount: uniqueHeadline.length,
    keywords: keywords.slice(0, 3),
    archetype,
    confidence: 0.78
  });
  
  // Ensure all headlines are under 220 characters (LinkedIn limit)
  return headlines.map(headline => {
    if (headline.characterCount > 220) {
      // Truncate intelligently at word boundaries
      let truncated = headline.text.substring(0, 217);
      const lastSpace = truncated.lastIndexOf(' ');
      truncated = truncated.substring(0, lastSpace) + '...';
      
      return {
        ...headline,
        text: truncated,
        characterCount: truncated.length
      };
    }
    return headline;
  });
};

// Generate elevator pitches
const generateElevatorPitches = (
  elements: ReturnType<typeof extractHeadlineElements>,
  archetype: string,
  uvpAnalysis: UVPAnalysis
): ElevatorPitch[] => {
  const pitches: ElevatorPitch[] = [];
  const { primaryUVP } = uvpAnalysis;
  
  // 30-second pitch (~75-80 words)
  const hook30 = `You know how ${elements.audience} struggle with ${elements.painPoint}?`;
  const body30 = `I'm a ${elements.role} who ${elements.method}. What makes me different is that I focus on ${elements.outcome} rather than just addressing symptoms.`;
  const close30 = `I'd love to learn more about your ${elements.industry} challenges.`;
  
  pitches.push({
    id: '30-second',
    duration: '30-second',
    text: `${hook30} ${body30} ${close30}`,
    wordCount: (hook30 + body30 + close30).split(' ').length,
    keyPoints: [
      'Problem identification',
      'Unique solution',
      'Clear outcome',
      'Engagement question'
    ],
    hook: hook30,
    close: close30
  });
  
  // 60-second pitch (~150-160 words)
  const hook60 = `Have you ever noticed how ${elements.audience} often ${elements.painPoint}?`;
  const story60 = `I discovered this firsthand when ${elements.values[0]} became central to my work. As a ${elements.role}, I realized that traditional approaches were missing something crucial.`;
  const solution60 = `That's why I developed an approach that ${elements.method}. The result? ${elements.transformation.outcome || elements.outcome}.`;
  const proof60 = `My clients consistently tell me that what sets me apart is my ability to ${elements.expertiseAreas[0] || 'deliver results'} while maintaining ${elements.values[1] || 'integrity'}.`;
  const close60 = `I'm curious - what's been your experience with ${elements.industry} transformation?`;
  
  pitches.push({
    id: '60-second',
    duration: '60-second',
    text: `${hook60} ${story60} ${solution60} ${proof60} ${close60}`,
    wordCount: (hook60 + story60 + solution60 + proof60 + close60).split(' ').length,
    keyPoints: [
      'Relatable problem',
      'Personal connection',
      'Unique methodology',
      'Social proof',
      'Conversation starter'
    ],
    hook: hook60,
    close: close60
  });
  
  // Networking event pitch (~100 words)
  const eventHook = getArchetypeNetworkingHook(archetype, elements);
  const eventBody = `I work with ${elements.audience} to ${elements.outcome}. What I love most about my work is ${elements.mission.toLowerCase()}.`;
  const eventClose = `What brings you to this event?`;
  
  pitches.push({
    id: 'networking',
    duration: 'networking-event',
    text: `${eventHook} ${eventBody} ${eventClose}`,
    wordCount: (eventHook + eventBody + eventClose).split(' ').length,
    keyPoints: [
      'Memorable opening',
      'Clear value proposition',
      'Personal passion',
      'Reciprocal interest'
    ],
    hook: eventHook,
    close: eventClose
  });
  
  return pitches;
};

// Get archetype-specific networking hooks
const getArchetypeNetworkingHook = (archetype: string, elements: any): string => {
  const hooks: Record<string, string> = {
    'Innovative Leader': `I'm ${elements.role} who believes the future of ${elements.industry} looks nothing like today.`,
    'Empathetic Expert': `I'm ${elements.role} who combines deep ${elements.expertiseAreas[0] || 'expertise'} with genuine human connection.`,
    'Strategic Visionary': `I'm ${elements.role} who helps organizations see around corners in ${elements.industry}.`,
    'Authentic Changemaker': `I'm ${elements.role} on a mission to challenge how we think about ${elements.industry}.`
  };
  
  return hooks[archetype] || `I'm ${elements.role} passionate about transforming ${elements.industry}.`;
};

// Generate content starter pack
const generateContentStarters = (
  elements: ReturnType<typeof extractHeadlineElements>,
  archetype: string,
  contentPillars: any[]
): ContentStarter[] => {
  const starters: ContentStarter[] = [];
  
  // Expertise pillar starters (40%)
  const expertiseTopics = [
    {
      headline: `The ${elements.industry} Mistake That's Costing You ${elements.outcome}`,
      hook: `99% of ${elements.audience} make this mistake...`,
      angle: 'Common misconceptions in your field',
      engagementType: 'educational' as const
    },
    {
      headline: `My ${elements.expertiseAreas[0] || elements.method} Framework (Steal This)`,
      hook: `After ${elements.role.includes('years') ? elements.role : '10+ years'}, here's my proven system...`,
      angle: 'Share your methodology',
      engagementType: 'educational' as const
    },
    {
      headline: `Why ${elements.painPoint} Is Actually a Symptom, Not the Problem`,
      hook: `Controversial take: We've been solving the wrong problem...`,
      angle: 'Challenge industry assumptions',
      engagementType: 'controversial' as const
    },
    {
      headline: `The Hidden Cost of ${elements.painPoint} for ${elements.audience}`,
      hook: `Let's talk about what nobody mentions...`,
      angle: 'Reveal hidden impacts',
      engagementType: 'educational' as const
    }
  ];
  
  // Experience pillar starters (35%)
  const experienceTopics = [
    {
      headline: `How I Helped a ${elements.audience.split(' ')[0]} ${elements.transformation.outcome || elements.outcome}`,
      hook: `6 months ago, my client was ${elements.transformation.before || 'struggling'}...`,
      angle: 'Client success story',
      engagementType: 'storytelling' as const
    },
    {
      headline: `My Biggest ${elements.industry} Failure (And What It Taught Me)`,
      hook: `I lost a major client because I ignored ${elements.values[0]}...`,
      angle: 'Vulnerability and lessons learned',
      engagementType: 'storytelling' as const
    },
    {
      headline: `Behind the Scenes: Building ${elements.outcome} for ${elements.audience}`,
      hook: `Here's what really happens when we work together...`,
      angle: 'Process transparency',
      engagementType: 'storytelling' as const
    }
  ];
  
  // Evolution pillar starters (25%)
  const evolutionTopics = [
    {
      headline: `The Future of ${elements.industry}: ${elements.mission}`,
      hook: `In 5 years, ${elements.industry} will be unrecognizable. Here's why...`,
      angle: 'Industry predictions',
      engagementType: 'inspirational' as const
    },
    {
      headline: `Why I'm Betting Everything on ${elements.method.split(' ')[2] || elements.outcome}`,
      hook: `Call me crazy, but I see something others don't...`,
      angle: 'Bold vision statement',
      engagementType: 'controversial' as const
    },
    {
      headline: `${elements.audience}: The Change You've Been Waiting For`,
      hook: `It's time we talked about what's really possible...`,
      angle: 'Inspirational call to action',
      engagementType: 'inspirational' as const
    }
  ];
  
  // Add expertise starters
  expertiseTopics.forEach((topic, index) => {
    starters.push({
      id: `expertise-${index + 1}`,
      pillar: 'expertise',
      ...topic
    });
  });
  
  // Add experience starters
  experienceTopics.forEach((topic, index) => {
    starters.push({
      id: `experience-${index + 1}`,
      pillar: 'experience',
      ...topic
    });
  });
  
  // Add evolution starters
  evolutionTopics.forEach((topic, index) => {
    starters.push({
      id: `evolution-${index + 1}`,
      pillar: 'evolution',
      ...topic
    });
  });
  
  return starters;
};

// Main function to generate all actionable content
export const generateActionableContent = (
  workshopData: WorkshopState,
  archetype: string,
  uvpAnalysis: UVPAnalysis,
  contentPillars: any[]
): ActionableContentPackage => {
  // Extract key elements
  const elements = extractHeadlineElements(workshopData, uvpAnalysis);
  
  // Generate all content types
  const headlines = generateHeadlineVariations(elements, archetype);
  const elevatorPitches = generateElevatorPitches(elements, archetype, uvpAnalysis);
  const contentStarters = generateContentStarters(elements, archetype, contentPillars);
  
  // Select best headline based on character count and confidence
  const bestHeadline = headlines
    .filter(h => h.characterCount <= 180) // Prefer shorter headlines
    .sort((a, b) => b.confidence - a.confidence)[0] || headlines[0];
  
  // Select primary pitch (60-second is most versatile)
  const primaryPitch = elevatorPitches.find(p => p.duration === '60-second') || elevatorPitches[0];
  
  return {
    headlines,
    elevatorPitches,
    contentStarters,
    bestHeadline,
    primaryPitch
  };
};

// Validate headline quality
export const validateHeadline = (headline: LinkedInHeadline): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check character count
  if (headline.characterCount > 220) {
    issues.push('Headline exceeds LinkedIn\'s 220 character limit');
    suggestions.push('Shorten by removing adjectives or using abbreviations');
  }
  
  if (headline.characterCount < 50) {
    issues.push('Headline may be too short to be impactful');
    suggestions.push('Add your unique value proposition or key outcome');
  }
  
  // Check for generic terms
  const genericTerms = ['professional', 'expert', 'specialist', 'consultant', 'advisor'];
  const hasGeneric = genericTerms.some(term => 
    headline.text.toLowerCase().includes(term) && 
    headline.keywords.length < 2
  );
  
  if (hasGeneric) {
    issues.push('Headline uses generic terms without specificity');
    suggestions.push('Add industry-specific keywords or unique descriptors');
  }
  
  // Check for value clarity
  const hasOutcome = headline.text.includes('help') || 
                     headline.text.includes('drive') || 
                     headline.text.includes('deliver') ||
                     headline.text.includes('transform');
  
  if (!hasOutcome && headline.type !== 'authority') {
    issues.push('Headline doesn\'t clearly communicate value');
    suggestions.push('Include what outcome or transformation you deliver');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
};

// Generate pitch variations for different contexts
export const generatePitchVariations = (
  basePitch: ElevatorPitch,
  context: 'interview' | 'coffee-chat' | 'conference' | 'client-meeting'
): ElevatorPitch => {
  const contextualAdjustments: Record<typeof context, {
    hookAdjustment: string;
    closeAdjustment: string;
  }> = {
    'interview': {
      hookAdjustment: 'Throughout my career',
      closeAdjustment: 'I\'m excited about the opportunity to bring this approach to your team.'
    },
    'coffee-chat': {
      hookAdjustment: 'Thanks for meeting with me. I know you\'re interested in',
      closeAdjustment: 'I\'d love to hear about your experience with this.'
    },
    'conference': {
      hookAdjustment: 'Great session, wasn\'t it? It really relates to',
      closeAdjustment: 'Are you seeing similar challenges in your organization?'
    },
    'client-meeting': {
      hookAdjustment: 'I\'ve been thinking about your situation, and',
      closeAdjustment: 'I\'d like to explore how we might work together on this.'
    }
  };
  
  const adjustment = contextualAdjustments[context];
  
  return {
    ...basePitch,
    id: `${basePitch.id}-${context}`,
    hook: `${adjustment.hookAdjustment} ${basePitch.hook.toLowerCase()}`,
    close: adjustment.closeAdjustment,
    text: `${adjustment.hookAdjustment} ${basePitch.hook.toLowerCase()} ${basePitch.text.split('. ').slice(1, -1).join('. ')}. ${adjustment.closeAdjustment}`
  };
};