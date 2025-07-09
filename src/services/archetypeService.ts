import { WorkshopState } from '../store/slices/workshopSlice';

// Archetype definitions with scoring criteria
export interface Archetype {
  id: string;
  name: string;
  description: string;
  coreValues: string[];
  toneProfile: {
    formality: number; // 0-1 scale
    analytical: number;
    creative: number;
    assertive: number;
  };
  personalityTraits: string[];
  keywords: string[];
  contentStyle: string;
  missionTemplate: string;
}

export interface ArchetypeScore {
  archetype: Archetype;
  score: number;
  confidence: number;
  breakdown: {
    values: number;
    tone: number;
    personality: number;
    writing: number;
    audience: number;
  };
}

// Define the four brand archetypes
export const archetypes: Archetype[] = [
  {
    id: 'innovative-leader',
    name: 'Innovative Leader',
    description: 'You transform industries through breakthrough thinking and inspire others to embrace change.',
    coreValues: ['innovation', 'leadership', 'courage', 'adaptability', 'vision', 'growth', 'creativity'],
    toneProfile: {
      formality: 0.7,
      analytical: 0.6,
      creative: 0.8,
      assertive: 0.8
    },
    personalityTraits: ['challenger', 'visionary', 'pioneer', 'catalyst', 'risk-taker'],
    keywords: ['transform', 'disrupt', 'innovate', 'pioneer', 'future', 'breakthrough', 'revolutionary'],
    contentStyle: 'Bold, forward-thinking content that challenges conventions and presents new possibilities',
    missionTemplate: 'I lead transformation in [INDUSTRY] by pioneering [INNOVATION] that creates [IMPACT]'
  },
  {
    id: 'empathetic-expert',
    name: 'Empathetic Expert',
    description: 'You humanize complex problems with compassion and build trust through genuine connection.',
    coreValues: ['empathy', 'service', 'wisdom', 'authenticity', 'trust', 'compassion', 'understanding'],
    toneProfile: {
      formality: 0.5,
      analytical: 0.5,
      creative: 0.6,
      assertive: 0.4
    },
    personalityTraits: ['connector', 'guide', 'mentor', 'teacher', 'supporter'],
    keywords: ['understand', 'connect', 'support', 'guide', 'help', 'empower', 'nurture'],
    contentStyle: 'Warm, accessible content that simplifies complexity and builds genuine connections',
    missionTemplate: 'I help [AUDIENCE] overcome [CHALLENGE] through compassionate [EXPERTISE]'
  },
  {
    id: 'strategic-visionary',
    name: 'Strategic Visionary',
    description: 'You connect dots others miss and create value through long-term strategic thinking.',
    coreValues: ['vision', 'strategy', 'results', 'integrity', 'excellence', 'focus', 'precision'],
    toneProfile: {
      formality: 0.8,
      analytical: 0.9,
      creative: 0.5,
      assertive: 0.7
    },
    personalityTraits: ['strategist', 'analyzer', 'planner', 'optimizer', 'architect'],
    keywords: ['strategic', 'optimize', 'analyze', 'plan', 'execute', 'measure', 'achieve'],
    contentStyle: 'Data-driven, strategic content that provides frameworks and actionable insights',
    missionTemplate: 'I drive [OUTCOME] for [AUDIENCE] through strategic [APPROACH] that delivers [RESULTS]'
  },
  {
    id: 'authentic-changemaker',
    name: 'Authentic Changemaker',
    description: 'You challenge the status quo with transparency and lead change through authentic action.',
    coreValues: ['authenticity', 'courage', 'impact', 'community', 'transparency', 'justice', 'change'],
    toneProfile: {
      formality: 0.4,
      analytical: 0.4,
      creative: 0.7,
      assertive: 0.9
    },
    personalityTraits: ['advocate', 'rebel', 'truth-teller', 'activist', 'maverick'],
    keywords: ['change', 'challenge', 'truth', 'real', 'authentic', 'impact', 'movement'],
    contentStyle: 'Raw, honest content that challenges norms and inspires action',
    missionTemplate: 'I challenge [STATUS_QUO] to create [CHANGE] that benefits [COMMUNITY]'
  }
];

// Calculate value match score
function calculateValueMatch(selectedValues: string[], archetypeValues: string[]): number {
  if (!selectedValues.length) return 0;
  
  let matchScore = 0;
  const totalPossible = Math.min(selectedValues.length, 7); // Consider top 7 values
  
  // Higher weight for earlier selections (user's priority)
  selectedValues.slice(0, 7).forEach((value, index) => {
    const weight = 1 - (index * 0.1); // Decreasing weight by position
    if (archetypeValues.includes(value.toLowerCase())) {
      matchScore += weight;
    }
    // Partial matches for related values
    else if (archetypeValues.some(av => 
      value.toLowerCase().includes(av) || av.includes(value.toLowerCase())
    )) {
      matchScore += weight * 0.5;
    }
  });
  
  return matchScore / totalPossible;
}

// Calculate tone match score
function calculateToneMatch(userTone: any, archetypeTone: any): number {
  if (!userTone) return 0.5; // Default middle score if no tone data
  
  // Map user's tone sliders (0-100) to 0-1 scale
  const normalizedTone = {
    formality: userTone.formality / 100,
    analytical: userTone.analytical / 100,
    creative: userTone.creative / 100,
    assertive: userTone.assertive / 100
  };
  
  // Calculate distance between user tone and archetype tone
  let totalDistance = 0;
  let dimensions = 0;
  
  Object.keys(archetypeTone).forEach(key => {
    if (normalizedTone[key] !== undefined) {
      const distance = Math.abs(normalizedTone[key] - archetypeTone[key]);
      totalDistance += distance;
      dimensions++;
    }
  });
  
  // Convert distance to similarity score (closer = higher score)
  const avgDistance = totalDistance / dimensions;
  return 1 - avgDistance;
}

// Calculate personality match score
function calculatePersonalityMatch(
  personalityResponses: any[],
  archetypeTraits: string[]
): number {
  if (!personalityResponses || personalityResponses.length === 0) return 0.5;
  
  let matchScore = 0;
  let totalQuestions = 0;
  
  personalityResponses.forEach(response => {
    totalQuestions++;
    
    // Check if response indicates traits matching the archetype
    const responseText = response.answer.toLowerCase();
    const matchingTraits = archetypeTraits.filter(trait => 
      responseText.includes(trait) || 
      (response.selectedOption && response.selectedOption.toLowerCase().includes(trait))
    );
    
    if (matchingTraits.length > 0) {
      matchScore += 1;
    }
    // Partial credit for related concepts
    else if (archetypeTraits.some(trait => {
      const traitSynonyms = getTraitSynonyms(trait);
      return traitSynonyms.some(syn => responseText.includes(syn));
    })) {
      matchScore += 0.5;
    }
  });
  
  return totalQuestions > 0 ? matchScore / totalQuestions : 0.5;
}

// Get synonyms for personality traits
function getTraitSynonyms(trait: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'challenger': ['disruptor', 'questioner', 'rebel'],
    'visionary': ['dreamer', 'futurist', 'idealist'],
    'pioneer': ['trailblazer', 'innovator', 'first'],
    'catalyst': ['enabler', 'spark', 'driver'],
    'connector': ['networker', 'bridge', 'uniter'],
    'guide': ['advisor', 'counselor', 'coach'],
    'mentor': ['teacher', 'educator', 'trainer'],
    'strategist': ['planner', 'tactician', 'architect'],
    'analyzer': ['researcher', 'investigator', 'evaluator'],
    'advocate': ['champion', 'supporter', 'defender'],
    'rebel': ['maverick', 'nonconformist', 'revolutionary'],
    'activist': ['changemaker', 'reformer', 'campaigner']
  };
  
  return synonymMap[trait] || [];
}

// Analyze writing sample for archetype indicators
export async function analyzeWritingSample(
  writingSample: string,
  archetype: Archetype
): Promise<number> {
  if (!writingSample) return 0.5;
  
  const sampleLower = writingSample.toLowerCase();
  let score = 0;
  let factors = 0;
  
  // Check for archetype keywords
  const keywordMatches = archetype.keywords.filter(keyword => 
    sampleLower.includes(keyword)
  ).length;
  score += Math.min(keywordMatches / archetype.keywords.length, 1);
  factors++;
  
  // Analyze sentence structure and style
  const sentences = writingSample.split(/[.!?]+/).filter(s => s.trim());
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
  
  // Different archetypes prefer different sentence structures
  let styleScore = 0;
  switch(archetype.id) {
    case 'innovative-leader':
      styleScore = avgSentenceLength > 15 && sentences.some(s => s.includes('!')) ? 0.8 : 0.5;
      break;
    case 'empathetic-expert':
      styleScore = avgSentenceLength < 20 && sentences.some(s => s.includes('you')) ? 0.8 : 0.5;
      break;
    case 'strategic-visionary':
      styleScore = avgSentenceLength > 20 && /\d/.test(writingSample) ? 0.8 : 0.5;
      break;
    case 'authentic-changemaker':
      styleScore = sentences.some(s => s.includes('I ')) && avgSentenceLength < 18 ? 0.8 : 0.5;
      break;
  }
  score += styleScore;
  factors++;
  
  // Check for emotional vs analytical language
  const emotionalWords = ['feel', 'believe', 'hope', 'love', 'care', 'heart', 'soul'];
  const analyticalWords = ['analyze', 'data', 'metrics', 'research', 'study', 'evidence', 'results'];
  
  const emotionalCount = emotionalWords.filter(word => sampleLower.includes(word)).length;
  const analyticalCount = analyticalWords.filter(word => sampleLower.includes(word)).length;
  
  let languageScore = 0.5;
  if (archetype.id === 'empathetic-expert' && emotionalCount > analyticalCount) {
    languageScore = 0.8;
  } else if (archetype.id === 'strategic-visionary' && analyticalCount > emotionalCount) {
    languageScore = 0.8;
  } else if (archetype.id === 'innovative-leader' && (emotionalCount + analyticalCount) > 2) {
    languageScore = 0.7;
  } else if (archetype.id === 'authentic-changemaker' && emotionalCount > 0) {
    languageScore = 0.7;
  }
  
  score += languageScore;
  factors++;
  
  return score / factors;
}

// Calculate audience alignment score
function calculateAudienceMatch(
  audiencePersonas: any[],
  archetype: Archetype
): number {
  if (!audiencePersonas || audiencePersonas.length === 0) return 0.5;
  
  let score = 0;
  
  audiencePersonas.forEach(persona => {
    // Check if audience needs align with archetype strengths
    const needs = [
      ...(persona.painPoints || []),
      ...(persona.goals || [])
    ].join(' ').toLowerCase();
    
    const alignmentScore = archetype.keywords.filter(keyword => 
      needs.includes(keyword)
    ).length / archetype.keywords.length;
    
    score += alignmentScore;
  });
  
  return Math.min(score / audiencePersonas.length, 1);
}

// Main function to determine archetype
export async function determineArchetype(
  workshopData: WorkshopState
): Promise<{
  primary: ArchetypeScore;
  secondary?: ArchetypeScore;
  hybrid?: {
    name: string;
    description: string;
    ratio: number;
  };
}> {
  const scores: ArchetypeScore[] = [];
  
  // Calculate scores for each archetype
  for (const archetype of archetypes) {
    const valueScore = calculateValueMatch(
      workshopData.values.selected,
      archetype.coreValues
    );
    
    const toneScore = calculateToneMatch(
      workshopData.tonePreferences,
      archetype.toneProfile
    );
    
    const personalityScore = calculatePersonalityMatch(
      workshopData.personalityQuiz.responses,
      archetype.personalityTraits
    );
    
    const writingScore = await analyzeWritingSample(
      workshopData.writingSample?.text || '',
      archetype
    );
    
    const audienceScore = calculateAudienceMatch(
      workshopData.audiencePersonas,
      archetype
    );
    
    // Weighted calculation
    const weights = {
      values: 0.30,      // 30% - Core values are fundamental
      tone: 0.15,        // 15% - Communication style
      personality: 0.25, // 25% - Personality traits
      writing: 0.20,     // 20% - Actual writing style
      audience: 0.10     // 10% - Target audience alignment
    };
    
    const totalScore = 
      valueScore * weights.values +
      toneScore * weights.tone +
      personalityScore * weights.personality +
      writingScore * weights.writing +
      audienceScore * weights.audience;
    
    // Calculate confidence based on data completeness
    const dataPoints = [
      workshopData.values.selected.length > 0,
      workshopData.tonePreferences !== null,
      workshopData.personalityQuiz.responses.length > 0,
      workshopData.writingSample !== null,
      workshopData.audiencePersonas.length > 0
    ];
    const completeness = dataPoints.filter(Boolean).length / dataPoints.length;
    const confidence = totalScore * completeness;
    
    scores.push({
      archetype,
      score: totalScore,
      confidence,
      breakdown: {
        values: valueScore,
        tone: toneScore,
        personality: personalityScore,
        writing: writingScore,
        audience: audienceScore
      }
    });
  }
  
  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  
  const primary = scores[0];
  const secondary = scores[1];
  
  // Check for hybrid archetype (if scores are close)
  const scoreDifference = primary.score - secondary.score;
  const hybridThreshold = 0.15; // 15% difference threshold
  
  if (scoreDifference < hybridThreshold && primary.confidence > 0.6) {
    const ratio = primary.score / (primary.score + secondary.score);
    return {
      primary,
      secondary,
      hybrid: {
        name: `${primary.archetype.name}-${secondary.archetype.name} Hybrid`,
        description: `You blend the ${primary.archetype.name.toLowerCase()}'s ${getArchetypeStrength(primary.archetype)} with the ${secondary.archetype.name.toLowerCase()}'s ${getArchetypeStrength(secondary.archetype)}.`,
        ratio
      }
    };
  }
  
  return { primary, secondary };
}

// Get key strength of an archetype
function getArchetypeStrength(archetype: Archetype): string {
  const strengths: Record<string, string> = {
    'innovative-leader': 'breakthrough thinking',
    'empathetic-expert': 'compassionate wisdom',
    'strategic-visionary': 'strategic foresight',
    'authentic-changemaker': 'courageous authenticity'
  };
  
  return strengths[archetype.id] || 'unique perspective';
}

// Generate personalized mission statement
export function generateMissionStatement(
  archetype: Archetype,
  workshopData: WorkshopState
): string {
  const topValues = workshopData.values.selected.slice(0, 3);
  const primaryAudience = workshopData.audiencePersonas[0];
  
  // Use archetype's mission template
  let mission = archetype.missionTemplate;
  
  // Replace placeholders
  if (primaryAudience) {
    mission = mission.replace('[AUDIENCE]', primaryAudience.name || 'professionals');
    if (primaryAudience.painPoints?.length > 0) {
      mission = mission.replace('[CHALLENGE]', primaryAudience.painPoints[0]);
    }
  }
  
  // Fill in remaining placeholders based on archetype
  switch(archetype.id) {
    case 'innovative-leader':
      mission = mission
        .replace('[INDUSTRY]', workshopData.audiencePersonas[0]?.industry || 'my industry')
        .replace('[INNOVATION]', `${topValues[0]} and ${topValues[1]}`)
        .replace('[IMPACT]', 'lasting transformation');
      break;
      
    case 'empathetic-expert':
      mission = mission
        .replace('[EXPERTISE]', `expertise in ${topValues.join(' and ')}`)
        .replace('[CHALLENGE]', 'their biggest challenges');
      break;
      
    case 'strategic-visionary':
      mission = mission
        .replace('[OUTCOME]', 'exceptional results')
        .replace('[APPROACH]', topValues.join(', '))
        .replace('[RESULTS]', 'measurable impact');
      break;
      
    case 'authentic-changemaker':
      mission = mission
        .replace('[STATUS_QUO]', 'outdated thinking')
        .replace('[CHANGE]', `meaningful change through ${topValues[0]}`)
        .replace('[COMMUNITY]', primaryAudience?.title || 'everyone');
      break;
  }
  
  // Clean up any remaining placeholders
  mission = mission.replace(/\[.*?\]/g, '');
  
  return mission;
}