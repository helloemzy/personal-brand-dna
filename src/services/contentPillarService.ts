import { WorkshopState } from '../store/slices/workshopSlice';

// Content Pillar Types
export interface ContentPillar {
  id: string;
  name: string;
  description: string;
  percentage: number;
  topics: string[];
  voiceGuidelines: {
    tone: string;
    approach: string;
    examples: string[];
  };
}

export interface ContentPillarAnalysis {
  pillars: ContentPillar[];
  primaryFocus: string;
  contentStrategy: string;
  voiceAdaptations: Record<string, string>;
}

// Topic extraction helpers
const extractExpertiseTopics = (workshopData: WorkshopState): string[] => {
  const topics: string[] = [];
  
  // Extract from professional identity questions
  const professionalResponses = workshopData.personalityQuiz.responses.filter(r => 
    ['professional_role', 'known_for', 'expertise_area', 'controversial_opinion'].includes(r.questionId)
  );
  
  professionalResponses.forEach(response => {
    if (response.questionId === 'professional_role' && response.answer) {
      // Parse role and years of experience
      const roleMatch = response.answer.match(/(.+?)\s*(?:with|,)\s*(\d+)/);
      if (roleMatch) {
        topics.push(`${roleMatch[1]} best practices`);
        topics.push(`Leadership in ${roleMatch[1].toLowerCase()}`);
      }
    }
    
    if (response.questionId === 'known_for' && response.answer) {
      // Extract expertise areas
      const expertiseAreas = response.answer.split(/[,;]/).map(s => s.trim());
      expertiseAreas.forEach(area => {
        if (area) {
          topics.push(`${area} strategies`);
          topics.push(`How to master ${area.toLowerCase()}`);
        }
      });
    }
    
    if (response.questionId === 'controversial_opinion' && response.answer) {
      // Extract thought leadership topics
      topics.push('Industry myths and misconceptions');
      topics.push('Contrarian perspectives that work');
    }
  });
  
  // Extract from writing sample if available
  if (workshopData.writingSample?.text) {
    const writingText = workshopData.writingSample.text.toLowerCase();
    
    // Look for expertise indicators
    if (writingText.includes('strategy') || writingText.includes('strategic')) {
      topics.push('Strategic planning frameworks');
    }
    if (writingText.includes('data') || writingText.includes('analytics')) {
      topics.push('Data-driven decision making');
    }
    if (writingText.includes('team') || writingText.includes('leadership')) {
      topics.push('Team building and management');
    }
    if (writingText.includes('innovation') || writingText.includes('creative')) {
      topics.push('Innovation methodologies');
    }
  }
  
  // Add topics based on audience problems
  workshopData.audiencePersonas.forEach(persona => {
    persona.painPoints.forEach(painPoint => {
      topics.push(`Solutions for ${painPoint.toLowerCase()}`);
    });
  });
  
  return [...new Set(topics)].slice(0, 7); // Return unique topics, max 7
};

const extractExperienceTopics = (workshopData: WorkshopState): string[] => {
  const topics: string[] = [];
  
  // Extract from values stories
  Object.entries(workshopData.values.stories).forEach(([valueId, story]) => {
    if (story) {
      topics.push(`Lessons learned from real experiences`);
      topics.push(`Stories of ${valueId} in action`);
    }
  });
  
  // Extract from personality traits
  const personalityResponses = workshopData.personalityQuiz.responses.filter(r => 
    ['q1', 'q2', 'q3', 'q4', 'q5'].includes(r.questionId)
  );
  
  personalityResponses.forEach(response => {
    if (response.answer.includes('people')) {
      topics.push('Client success stories');
      topics.push('Building meaningful professional relationships');
    }
    if (response.answer.includes('creative') || response.answer.includes('innovative')) {
      topics.push('Creative problem-solving examples');
    }
    if (response.answer.includes('analytical') || response.answer.includes('data')) {
      topics.push('Case studies and results');
    }
  });
  
  // Add experience-based topics from primary values
  if (workshopData.values.primary.length > 0) {
    topics.push(`My journey with ${workshopData.values.primary[0]}`);
    topics.push('Failures that shaped my approach');
    topics.push('Behind-the-scenes of my work');
  }
  
  // Extract from transformation stories
  const primaryPersona = workshopData.audiencePersonas.find(p => p.isPrimary) || workshopData.audiencePersonas[0];
  if (primaryPersona?.transformation) {
    topics.push(`Transformation stories: ${primaryPersona.transformation.outcome}`);
    topics.push('Before and after client journeys');
  }
  
  return [...new Set(topics)].slice(0, 7);
};

const extractEvolutionTopics = (workshopData: WorkshopState): string[] => {
  const topics: string[] = [];
  
  // Extract from mission-related questions
  const missionResponses = workshopData.personalityQuiz.responses.filter(r => 
    ['change_want_to_see', 'legacy_impact', 'helping_others', 'better_future'].includes(r.questionId)
  );
  
  missionResponses.forEach(response => {
    if (response.questionId === 'change_want_to_see' && response.answer) {
      topics.push(`The future of ${response.answer.toLowerCase()}`);
      topics.push('Industry transformation predictions');
    }
    
    if (response.questionId === 'legacy_impact' && response.answer) {
      topics.push('Building lasting impact');
      topics.push(`Vision for ${response.answer.toLowerCase()}`);
    }
  });
  
  // Extract from aspirational values
  if (workshopData.values.aspirational.length > 0) {
    workshopData.values.aspirational.forEach(value => {
      topics.push(`Growing into ${value}`);
    });
  }
  
  // Industry evolution topics
  topics.push('Emerging trends and opportunities');
  topics.push('Preparing for what\'s next');
  topics.push('Skills for tomorrow\'s challenges');
  
  // Extract from controversial opinion for thought leadership
  const controversialOpinion = workshopData.personalityQuiz.responses.find(r => 
    r.questionId === 'controversial_opinion'
  );
  if (controversialOpinion?.answer) {
    topics.push('Challenging conventional wisdom');
    topics.push('New paradigms in the industry');
  }
  
  return [...new Set(topics)].slice(0, 7);
};

// Voice adaptation based on pillar
const getVoiceGuidelines = (
  pillarName: string, 
  workshopData: WorkshopState,
  archetype: string
): ContentPillar['voiceGuidelines'] => {
  const tone = workshopData.tonePreferences;
  
  switch (pillarName) {
    case 'Expertise':
      return {
        tone: tone.formal_casual > 0 ? 'Approachable Expert' : 'Professional Authority',
        approach: 'Educational and actionable',
        examples: [
          'Share frameworks and methodologies',
          'Provide step-by-step guides',
          'Offer data-backed insights',
          'Include practical tips'
        ]
      };
      
    case 'Experience':
      return {
        tone: 'Personal and Relatable',
        approach: 'Story-driven and authentic',
        examples: [
          'Share personal anecdotes',
          'Include client stories (anonymized)',
          'Discuss lessons learned',
          'Be vulnerable about challenges'
        ]
      };
      
    case 'Evolution':
      return {
        tone: archetype.includes('Visionary') ? 'Inspirational Visionary' : 'Thoughtful Futurist',
        approach: 'Forward-thinking and provocative',
        examples: [
          'Challenge status quo thinking',
          'Paint pictures of possibility',
          'Connect trends to opportunities',
          'Inspire action toward change'
        ]
      };
      
    default:
      return {
        tone: 'Balanced and Engaging',
        approach: 'Flexible based on topic',
        examples: []
      };
  }
};

// Main content pillar mapping function
export const mapContentPillars = (
  workshopData: WorkshopState,
  archetype: string
): ContentPillarAnalysis => {
  // Extract topics for each pillar
  const expertiseTopics = extractExpertiseTopics(workshopData);
  const experienceTopics = extractExperienceTopics(workshopData);
  const evolutionTopics = extractEvolutionTopics(workshopData);
  
  // Create pillar objects
  const pillars: ContentPillar[] = [
    {
      id: 'expertise',
      name: 'Expertise',
      description: 'Your professional knowledge, skills, and actionable insights',
      percentage: 40,
      topics: expertiseTopics,
      voiceGuidelines: getVoiceGuidelines('Expertise', workshopData, archetype)
    },
    {
      id: 'experience',
      name: 'Experience',
      description: 'Your journey, stories, and lessons learned along the way',
      percentage: 35,
      topics: experienceTopics,
      voiceGuidelines: getVoiceGuidelines('Experience', workshopData, archetype)
    },
    {
      id: 'evolution',
      name: 'Evolution',
      description: 'Your vision for the future and thought leadership',
      percentage: 25,
      topics: evolutionTopics,
      voiceGuidelines: getVoiceGuidelines('Evolution', workshopData, archetype)
    }
  ];
  
  // Determine primary focus based on archetype
  let primaryFocus = 'Expertise';
  let contentStrategy = '';
  
  switch (archetype) {
    case 'Innovative Leader':
      primaryFocus = 'Evolution';
      contentStrategy = 'Lead with vision and innovation, support with expertise, humanize with experience';
      break;
    case 'Empathetic Expert':
      primaryFocus = 'Experience';
      contentStrategy = 'Connect through stories, educate with expertise, inspire with vision';
      break;
    case 'Strategic Visionary':
      primaryFocus = 'Expertise';
      contentStrategy = 'Demonstrate strategic thinking, share transformative experiences, paint future possibilities';
      break;
    case 'Authentic Changemaker':
      primaryFocus = 'Evolution';
      contentStrategy = 'Challenge conventions, share authentic journey, back up with expertise';
      break;
    default:
      contentStrategy = 'Balance expertise with experience, look forward with evolution';
  }
  
  // Create voice adaptations for different content types
  const voiceAdaptations = {
    'How-to posts': workshopData.tonePreferences.concise_detailed > 0 
      ? 'Comprehensive guides with examples' 
      : 'Quick, actionable tips',
    'Story posts': 'Personal narrative with clear takeaways',
    'Opinion pieces': workshopData.tonePreferences.analytical_creative > 0 
      ? 'Creative perspectives backed by insights' 
      : 'Data-driven arguments with clear logic',
    'Industry insights': 'Balanced analysis with future implications',
    'Case studies': 'Detailed journey with measurable outcomes'
  };
  
  return {
    pillars,
    primaryFocus,
    contentStrategy,
    voiceAdaptations
  };
};

// Generate starter content ideas based on pillars
export const generateStarterContent = (
  pillarAnalysis: ContentPillarAnalysis,
  archetype: string,
  missionStatement: string
): string[] => {
  const contentIdeas: string[] = [];
  
  // Generate 3-4 ideas per pillar
  pillarAnalysis.pillars.forEach(pillar => {
    const pillarIdeas = pillar.topics.slice(0, 4).map(topic => {
      switch (pillar.name) {
        case 'Expertise':
          return `📚 ${topic} - A practical guide for ${archetype.toLowerCase()}s`;
        case 'Experience':
          return `📖 ${topic} - My personal journey and what I learned`;
        case 'Evolution':
          return `🚀 ${topic} - Why this matters for our future`;
        default:
          return `💡 ${topic}`;
      }
    });
    contentIdeas.push(...pillarIdeas);
  });
  
  // Add mission-aligned content ideas
  if (missionStatement) {
    contentIdeas.push(`🎯 My Mission: ${missionStatement} (Introduction post)`);
    contentIdeas.push('🌟 Why I do what I do - The story behind my mission');
  }
  
  // Add archetype-specific content ideas
  switch (archetype) {
    case 'Innovative Leader':
      contentIdeas.push('💡 3 innovations that will reshape our industry');
      break;
    case 'Empathetic Expert':
      contentIdeas.push('❤️ The human side of expertise - Why empathy matters');
      break;
    case 'Strategic Visionary':
      contentIdeas.push('🎯 Strategic moves for the next decade');
      break;
    case 'Authentic Changemaker':
      contentIdeas.push('🔥 Time to challenge the status quo - Here\'s why');
      break;
  }
  
  return contentIdeas.slice(0, 15); // Return top 15 content ideas
};