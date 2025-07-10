import { WorkshopState } from '../store/slices/workshopSlice';
import { Archetype } from './archetypeService';

// Defer API key lookup to runtime for better testability
const getOpenAIKey = () => process.env.REACT_APP_OPENAI_API_KEY;

interface WritingAnalysis {
  communicationStyle: {
    formality: number;
    analyticalVsEmotional: number;
    assertiveness: number;
    creativity: number;
  };
  expertise: string[];
  keyThemes: string[];
  voiceCharacteristics: string[];
  archetypeIndicators: Record<string, number>;
}

interface PersonalityAnalysis {
  coreTraits: string[];
  leadershipStyle: string;
  values: string[];
  motivations: string[];
  archetypeAlignment: Record<string, number>;
}

// Analyze writing sample with AI
export async function analyzeWritingWithAI(
  writingSample: string,
  archetypes: Archetype[]
): Promise<WritingAnalysis> {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY || !writingSample) {
    // Return default analysis if no API key or sample
    return {
      communicationStyle: {
        formality: 0.5,
        analyticalVsEmotional: 0.5,
        assertiveness: 0.5,
        creativity: 0.5
      },
      expertise: [],
      keyThemes: [],
      voiceCharacteristics: [],
      archetypeIndicators: {}
    };
  }

  try {
    const prompt = `Analyze this professional writing sample and extract the following:

Writing Sample:
"${writingSample}"

Please analyze and return a JSON object with:
1. communicationStyle: Rate these on 0-1 scale:
   - formality (0=very casual, 1=very formal)
   - analyticalVsEmotional (0=purely emotional, 1=purely analytical)
   - assertiveness (0=passive, 1=very assertive)
   - creativity (0=conventional, 1=highly creative)

2. expertise: List 3-5 areas of expertise evident in the writing

3. keyThemes: List 3-5 recurring themes or topics

4. voiceCharacteristics: List 3-5 unique characteristics of their writing voice

5. archetypeIndicators: For each archetype, rate how well the writing aligns (0-1):
   - innovative-leader: Signs of innovation, disruption, future-thinking
   - empathetic-expert: Signs of empathy, connection, teaching
   - strategic-visionary: Signs of strategy, analysis, long-term thinking
   - authentic-changemaker: Signs of authenticity, challenging norms, activism

Return only the JSON object, no additional text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in analyzing professional communication styles and personal branding. Provide precise, insightful analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);

    return analysis;
  } catch (error) {
    console.error('AI writing analysis error:', error);
    // Fallback to basic analysis
    return analyzeWritingBasic(writingSample, archetypes);
  }
}

// Basic writing analysis fallback
function analyzeWritingBasic(
  writingSample: string,
  archetypes: Archetype[]
): WritingAnalysis {
  const sampleLower = writingSample.toLowerCase();
  const sentences = writingSample.split(/[.!?]+/).filter(s => s.trim());
  const words = writingSample.split(/\s+/);
  const avgSentenceLength = words.length / sentences.length;

  // Analyze formality
  const informalIndicators = ['i\'m', 'you\'re', 'it\'s', 'let\'s', 'gonna', 'wanna'];
  const formalIndicators = ['therefore', 'furthermore', 'consequently', 'moreover', 'pursuant'];
  const informalCount = informalIndicators.filter(ind => sampleLower.includes(ind)).length;
  const formalCount = formalIndicators.filter(ind => sampleLower.includes(ind)).length;
  const formality = 0.5 + (formalCount * 0.1) - (informalCount * 0.1);

  // Analyze analytical vs emotional
  const emotionalWords = ['feel', 'believe', 'love', 'hope', 'fear', 'happy', 'sad', 'excited'];
  const analyticalWords = ['analyze', 'data', 'metrics', 'evidence', 'research', 'study', 'results'];
  const emotionalScore = emotionalWords.filter(w => sampleLower.includes(w)).length;
  const analyticalScore = analyticalWords.filter(w => sampleLower.includes(w)).length;
  const analyticalVsEmotional = analyticalScore / (analyticalScore + emotionalScore + 1);

  // Analyze assertiveness
  const assertiveIndicators = ['must', 'should', 'will', 'definitely', 'clearly', 'obviously'];
  const passiveIndicators = ['might', 'maybe', 'perhaps', 'could', 'possibly', 'somewhat'];
  const assertiveCount = assertiveIndicators.filter(ind => sampleLower.includes(ind)).length;
  const passiveCount = passiveIndicators.filter(ind => sampleLower.includes(ind)).length;
  const assertiveness = 0.5 + (assertiveCount * 0.1) - (passiveCount * 0.1);

  // Extract themes and expertise
  const expertise: string[] = [];
  const keyThemes: string[] = [];
  
  // Simple keyword extraction for themes
  const themeKeywords = {
    'leadership': ['lead', 'leader', 'leadership', 'team', 'manage'],
    'innovation': ['innovate', 'innovation', 'creative', 'new', 'transform'],
    'strategy': ['strategy', 'strategic', 'plan', 'goal', 'objective'],
    'growth': ['grow', 'growth', 'scale', 'expand', 'develop'],
    'technology': ['tech', 'technology', 'digital', 'software', 'data']
  };

  Object.entries(themeKeywords).forEach(([theme, keywords]) => {
    if (keywords.some(kw => sampleLower.includes(kw))) {
      keyThemes.push(theme);
    }
  });

  // Calculate archetype indicators
  const archetypeIndicators: Record<string, number> = {};
  archetypes.forEach(archetype => {
    const keywordMatches = archetype.keywords.filter(kw => 
      sampleLower.includes(kw)
    ).length;
    archetypeIndicators[archetype.id] = Math.min(keywordMatches / archetype.keywords.length, 1);
  });

  return {
    communicationStyle: {
      formality: Math.max(0, Math.min(1, formality)),
      analyticalVsEmotional: Math.max(0, Math.min(1, analyticalVsEmotional)),
      assertiveness: Math.max(0, Math.min(1, assertiveness)),
      creativity: avgSentenceLength < 15 ? 0.7 : 0.5
    },
    expertise,
    keyThemes,
    voiceCharacteristics: [
      avgSentenceLength > 20 ? 'detailed' : 'concise',
      assertiveness > 0.6 ? 'confident' : 'collaborative',
      formality > 0.6 ? 'professional' : 'conversational'
    ],
    archetypeIndicators
  };
}

// Analyze personality quiz responses with AI
export async function analyzePersonalityWithAI(
  responses: any[],
  archetypes: Archetype[]
): Promise<PersonalityAnalysis> {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY || responses.length === 0) {
    return {
      coreTraits: [],
      leadershipStyle: 'collaborative',
      values: [],
      motivations: [],
      archetypeAlignment: {}
    };
  }

  try {
    const responseSummary = responses.map((r, i) => 
      `Q${i + 1}: ${r.question}\nA: ${r.answer}`
    ).join('\n\n');

    const prompt = `Analyze these personality quiz responses to understand the person's professional identity:

${responseSummary}

Based on these responses, provide a JSON object with:
1. coreTraits: List 4-6 core personality traits
2. leadershipStyle: Describe their leadership approach in 2-3 words
3. values: List 3-5 core values evident from their responses
4. motivations: List 3-4 key motivations
5. archetypeAlignment: Rate alignment with each archetype (0-1):
   - innovative-leader: Innovation and disruption focus
   - empathetic-expert: Empathy and connection focus
   - strategic-visionary: Strategy and planning focus
   - authentic-changemaker: Authenticity and change focus

Return only the JSON object.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in personality analysis and professional identity. Provide insightful analysis based on quiz responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 600
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);

    return analysis;
  } catch (error) {
    console.error('AI personality analysis error:', error);
    // Fallback to basic analysis
    return analyzePersonalityBasic(responses, archetypes);
  }
}

// Basic personality analysis fallback
function analyzePersonalityBasic(
  responses: any[],
  archetypes: Archetype[]
): PersonalityAnalysis {
  const coreTraits: string[] = [];
  const values: string[] = [];
  
  // Extract traits from responses
  responses.forEach(response => {
    const answerLower = response.answer.toLowerCase();
    
    // Look for trait indicators
    if (answerLower.includes('lead') || answerLower.includes('guide')) {
      coreTraits.push('leadership-oriented');
    }
    if (answerLower.includes('help') || answerLower.includes('support')) {
      coreTraits.push('service-focused');
    }
    if (answerLower.includes('create') || answerLower.includes('innovate')) {
      coreTraits.push('creative');
    }
    if (answerLower.includes('analyze') || answerLower.includes('data')) {
      coreTraits.push('analytical');
    }
  });

  // Calculate archetype alignment based on response content
  const archetypeAlignment: Record<string, number> = {};
  archetypes.forEach(archetype => {
    let alignmentScore = 0;
    responses.forEach(response => {
      const answerLower = response.answer.toLowerCase();
      const matchingKeywords = archetype.keywords.filter(kw => 
        answerLower.includes(kw)
      ).length;
      alignmentScore += matchingKeywords > 0 ? 0.2 : 0;
    });
    archetypeAlignment[archetype.id] = Math.min(alignmentScore, 1);
  });

  return {
    coreTraits: [...new Set(coreTraits)].slice(0, 6),
    leadershipStyle: 'collaborative',
    values: [...new Set(values)].slice(0, 5),
    motivations: ['making an impact', 'continuous growth'],
    archetypeAlignment
  };
}

// Generate enhanced mission statement with AI
export async function generateEnhancedMission(
  archetype: Archetype,
  workshopData: WorkshopState,
  writingAnalysis: WritingAnalysis,
  personalityAnalysis: PersonalityAnalysis
): Promise<string[]> {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) {
    // Return simple mission if no API key
    return [generateBasicMission(archetype, workshopData)];
  }

  try {
    const context = {
      archetype: archetype.name,
      values: workshopData.values.selected.slice(0, 5),
      audience: workshopData.audiencePersonas[0]?.title || 'professionals',
      expertise: writingAnalysis.expertise,
      traits: personalityAnalysis.coreTraits,
      themes: writingAnalysis.keyThemes
    };

    const prompt = `Create 3 unique mission statements for a ${context.archetype} with these characteristics:
- Core values: ${context.values.join(', ')}
- Target audience: ${context.audience}
- Expertise areas: ${context.expertise.join(', ')}
- Key traits: ${context.traits.join(', ')}
- Focus themes: ${context.themes.join(', ')}

Each mission statement should:
1. Be 1-2 sentences long
2. Clearly state WHO they help, WHAT transformation they enable, and HOW they do it uniquely
3. Reflect the ${archetype.name} archetype style
4. Use active, powerful language

Return a JSON array with 3 mission statements.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in personal branding and mission statement creation. Create compelling, unique mission statements.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const missions = JSON.parse(data.choices[0].message.content);

    return Array.isArray(missions) ? missions : [missions];
  } catch (error) {
    console.error('AI mission generation error:', error);
    return [generateBasicMission(archetype, workshopData)];
  }
}

// Basic mission generation fallback
function generateBasicMission(
  archetype: Archetype,
  workshopData: WorkshopState
): string {
  const values = workshopData.values.selected.slice(0, 3).join(' and ');
  const audience = workshopData.audiencePersonas[0]?.title || 'professionals';
  
  return `I help ${audience} achieve excellence through ${values}, using my unique ${archetype.name.toLowerCase()} approach to create lasting impact.`;
}