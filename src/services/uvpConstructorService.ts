import { WorkshopState } from '../store/slices/workshopSlice';

// UVP Types
export interface UVPVariation {
  id: string;
  type: 'standard' | 'results-focused' | 'pain-focused';
  fullStatement: string;
  linkedinHeadline: string;
  confidence: number;
  differentiators: string[];
}

export interface UVPAnalysis {
  variations: UVPVariation[];
  primaryUVP: UVPVariation;
  uniqueFactors: {
    role: string;
    method: string;
    outcome: string;
    audience: string;
    painPoint: string;
  };
  industryContext: {
    field: string;
    terminology: string[];
    competitiveLandscape: string;
  };
}

// Extract role and positioning from workshop data
const extractRole = (workshopData: WorkshopState): string => {
  // Look for professional role in personality quiz
  const roleResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'professional_role'
  );
  
  if (roleResponse?.answer) {
    // Extract just the role part (before "with X years")
    const roleMatch = roleResponse.answer.match(/^([^,]+?)(?:\s+with|\s*,|$)/);
    if (roleMatch) {
      return roleMatch[1].trim();
    }
  }
  
  // Fallback to expertise areas
  const expertiseResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'known_for'
  );
  
  if (expertiseResponse?.answer) {
    const expertiseAreas = expertiseResponse.answer.split(/[,;]/)[0].trim();
    return `${expertiseAreas} expert`;
  }
  
  // Final fallback based on archetype
  return 'strategic professional';
};

// Extract unique methodology from workshop data
const extractMethod = (workshopData: WorkshopState): string => {
  // Look for unique approach in responses
  const methodIndicators: string[] = [];
  
  // Extract from controversial opinion (often reveals unique approach)
  const controversialResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'controversial_opinion'
  );
  
  if (controversialResponse?.answer) {
    methodIndicators.push(`challenges conventional ${controversialResponse.answer.toLowerCase()}`);
  }
  
  // Extract from values and approach
  const primaryValues = workshopData.values.primary.slice(0, 2);
  if (primaryValues.length > 0) {
    methodIndicators.push(`combines ${primaryValues.join(' and ')} in my approach`);
  }
  
  // Extract from personality traits for working style
  const personalityResponses = workshopData.personalityQuiz.responses.filter(
    r => ['q1', 'q2', 'q3'].includes(r.questionId)
  );
  
  personalityResponses.forEach(response => {
    if (response.answer.includes('analytical') || response.answer.includes('data')) {
      methodIndicators.push('uses data-driven strategies');
    }
    if (response.answer.includes('creative') || response.answer.includes('innovative')) {
      methodIndicators.push('applies creative problem-solving');
    }
    if (response.answer.includes('people') || response.answer.includes('relationship')) {
      methodIndicators.push('builds trust through authentic connection');
    }
  });
  
  // Return the most distinctive method
  return methodIndicators[0] || 'delivers transformative solutions';
};

// Extract unique outcomes from workshop data
const extractOutcome = (workshopData: WorkshopState): string => {
  // First, check for transformation data in audience personas
  const primaryPersona = workshopData.audiencePersonas.find(p => p.isPrimary) || 
                        workshopData.audiencePersonas[0];
  
  if (primaryPersona?.transformation?.outcome) {
    return primaryPersona.transformation.outcome;
  }
  
  // Look for impact/legacy responses
  const legacyResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'legacy_impact'
  );
  
  if (legacyResponse?.answer) {
    return legacyResponse.answer;
  }
  
  // Extract from goals of target audience
  if (primaryPersona?.goals && primaryPersona.goals.length > 0) {
    return primaryPersona.goals[0];
  }
  
  // Fallback to value-based outcomes
  const topValue = workshopData.values.primary[0] || workshopData.values.selected[0];
  return `sustainable ${topValue}`;
};

// Extract target audience from workshop data
const extractAudience = (workshopData: WorkshopState): string => {
  const primaryPersona = workshopData.audiencePersonas.find(p => p.isPrimary) || 
                        workshopData.audiencePersonas[0];
  
  if (primaryPersona) {
    // Combine title and industry for specificity
    const industry = primaryPersona.industry ? ` in ${primaryPersona.industry}` : '';
    return `${primaryPersona.title}${industry}`;
  }
  
  // Fallback to helping others response
  const helpingResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'helping_others'
  );
  
  if (helpingResponse?.answer) {
    return helpingResponse.answer.replace(/help(ing)?/gi, '').trim();
  }
  
  return 'ambitious professionals';
};

// Extract pain points to differentiate from
const extractPainPoint = (workshopData: WorkshopState): string => {
  const primaryPersona = workshopData.audiencePersonas.find(p => p.isPrimary) || 
                        workshopData.audiencePersonas[0];
  
  // Look for specific pain points
  if (primaryPersona?.painPoints && primaryPersona.painPoints.length > 0) {
    const mainPain = primaryPersona.painPoints[0];
    // Convert to "without" format
    return mainPain.toLowerCase().replace(/^(the\s+)?/, '');
  }
  
  // Extract from controversial opinion (what others do wrong)
  const controversialResponse = workshopData.personalityQuiz.responses.find(
    r => r.questionId === 'controversial_opinion'
  );
  
  if (controversialResponse?.answer) {
    return 'falling into conventional thinking';
  }
  
  // Fallback pain points based on archetype
  return 'the usual complexity and confusion';
};

// Get industry-specific terminology
const getIndustryTerminology = (field: string): string[] => {
  const industryTerms: Record<string, string[]> = {
    'technology': ['digital transformation', 'scalable solutions', 'innovation', 'disruption', 'agile'],
    'healthcare': ['patient outcomes', 'clinical excellence', 'care delivery', 'health equity', 'evidence-based'],
    'finance': ['ROI', 'strategic growth', 'risk management', 'portfolio optimization', 'value creation'],
    'education': ['student success', 'learning outcomes', 'curriculum innovation', 'pedagogical excellence'],
    'consulting': ['strategic advisory', 'transformation', 'operational excellence', 'change management'],
    'marketing': ['brand strategy', 'customer acquisition', 'growth marketing', 'conversion optimization'],
    'sales': ['revenue growth', 'pipeline acceleration', 'relationship building', 'solution selling'],
    'leadership': ['executive presence', 'organizational transformation', 'cultural change', 'strategic vision'],
    'default': ['transformative solutions', 'sustainable growth', 'strategic advantage', 'measurable impact']
  };
  
  const normalizedField = field.toLowerCase();
  
  // Find matching industry
  for (const [industry, terms] of Object.entries(industryTerms)) {
    if (normalizedField.includes(industry)) {
      return terms;
    }
  }
  
  return industryTerms.default;
};

// Generate UVP variations
const generateUVPVariations = (
  uniqueFactors: UVPAnalysis['uniqueFactors'],
  industryTerms: string[]
): UVPVariation[] => {
  const variations: UVPVariation[] = [];
  
  // Standard format - comprehensive positioning
  const standardUVP = `I'm the only ${uniqueFactors.role} who ${uniqueFactors.method} to deliver ${uniqueFactors.outcome} for ${uniqueFactors.audience}, without ${uniqueFactors.painPoint}.`;
  
  const standardHeadline = `${uniqueFactors.role} | ${uniqueFactors.outcome} for ${uniqueFactors.audience}`;
  
  variations.push({
    id: 'standard',
    type: 'standard',
    fullStatement: standardUVP,
    linkedinHeadline: standardHeadline,
    confidence: 0.85,
    differentiators: [
      uniqueFactors.role,
      uniqueFactors.method,
      uniqueFactors.outcome
    ]
  });
  
  // Results-focused format - emphasize outcomes
  const resultsTerm = industryTerms[0] || 'transformation';
  const resultsUVP = `I help ${uniqueFactors.audience} achieve ${uniqueFactors.outcome} through ${resultsTerm} that ${uniqueFactors.method}.`;
  
  const resultsHeadline = `Helping ${uniqueFactors.audience} → ${uniqueFactors.outcome}`;
  
  variations.push({
    id: 'results-focused',
    type: 'results-focused',
    fullStatement: resultsUVP,
    linkedinHeadline: resultsHeadline,
    confidence: 0.82,
    differentiators: [
      uniqueFactors.outcome,
      uniqueFactors.audience,
      resultsTerm
    ]
  });
  
  // Pain-point focused format - address frustrations
  const painUVP = `Unlike others who create ${uniqueFactors.painPoint}, I ${uniqueFactors.method} to help ${uniqueFactors.audience} finally achieve ${uniqueFactors.outcome}.`;
  
  const painHeadline = `${uniqueFactors.role} | Solving ${uniqueFactors.painPoint} for ${uniqueFactors.audience}`;
  
  variations.push({
    id: 'pain-focused',
    type: 'pain-focused',
    fullStatement: painUVP,
    linkedinHeadline: painHeadline,
    confidence: 0.80,
    differentiators: [
      `solving ${uniqueFactors.painPoint}`,
      uniqueFactors.method,
      uniqueFactors.audience
    ]
  });
  
  return variations;
};

// Calculate confidence based on data completeness
const calculateConfidence = (
  uniqueFactors: UVPAnalysis['uniqueFactors'],
  workshopData: WorkshopState
): number => {
  let confidence = 0;
  let factors = 0;
  
  // Check each factor for specificity
  if (uniqueFactors.role && !uniqueFactors.role.includes('professional')) {
    confidence += 0.2;
  }
  factors += 0.2;
  
  if (uniqueFactors.method && uniqueFactors.method.length > 20) {
    confidence += 0.2;
  }
  factors += 0.2;
  
  if (uniqueFactors.outcome && !uniqueFactors.outcome.includes('sustainable')) {
    confidence += 0.2;
  }
  factors += 0.2;
  
  if (uniqueFactors.audience && uniqueFactors.audience.includes(' in ')) {
    confidence += 0.2;
  }
  factors += 0.2;
  
  if (uniqueFactors.painPoint && uniqueFactors.painPoint.length > 15) {
    confidence += 0.2;
  }
  factors += 0.2;
  
  return confidence;
};

// Main UVP constructor function
export const constructUVP = (
  workshopData: WorkshopState,
  archetype: string
): UVPAnalysis => {
  // Extract unique factors from workshop data
  const uniqueFactors = {
    role: extractRole(workshopData),
    method: extractMethod(workshopData),
    outcome: extractOutcome(workshopData),
    audience: extractAudience(workshopData),
    painPoint: extractPainPoint(workshopData)
  };
  
  // Determine industry field
  const primaryPersona = workshopData.audiencePersonas.find(p => p.isPrimary) || 
                        workshopData.audiencePersonas[0];
  const field = primaryPersona?.industry || extractRole(workshopData);
  
  // Get industry-specific terminology
  const terminology = getIndustryTerminology(field);
  
  // Generate UVP variations
  const variations = generateUVPVariations(uniqueFactors, terminology);
  
  // Adjust confidence based on data completeness
  const overallConfidence = calculateConfidence(uniqueFactors, workshopData);
  variations.forEach(v => {
    v.confidence = v.confidence * overallConfidence;
  });
  
  // Determine competitive landscape based on archetype
  let competitiveLandscape = '';
  switch (archetype) {
    case 'Innovative Leader':
      competitiveLandscape = 'Stand out as a forward-thinking pioneer who challenges industry norms';
      break;
    case 'Empathetic Expert':
      competitiveLandscape = 'Differentiate through human-centered expertise and genuine connection';
      break;
    case 'Strategic Visionary':
      competitiveLandscape = 'Position as the strategic mind who sees opportunities others miss';
      break;
    case 'Authentic Changemaker':
      competitiveLandscape = 'Lead with authenticity in an industry full of conventional thinking';
      break;
    default:
      competitiveLandscape = 'Create a unique position in your industry';
  }
  
  return {
    variations,
    primaryUVP: variations[0], // Standard format as primary
    uniqueFactors,
    industryContext: {
      field,
      terminology,
      competitiveLandscape
    }
  };
};

// Generate UVP-based content hooks
export const generateUVPContentHooks = (uvpAnalysis: UVPAnalysis): string[] => {
  const hooks: string[] = [];
  const { uniqueFactors, primaryUVP } = uvpAnalysis;
  
  // Hook templates based on UVP elements
  hooks.push(
    `Why I'm the only ${uniqueFactors.role} who ${uniqueFactors.method}`,
    `The truth about ${uniqueFactors.painPoint} (and what to do instead)`,
    `How ${uniqueFactors.audience} can achieve ${uniqueFactors.outcome}`,
    `My unconventional approach to ${uniqueFactors.outcome}`,
    `What makes my ${uniqueFactors.role} approach different`,
    `The hidden cost of ${uniqueFactors.painPoint} for ${uniqueFactors.audience}`,
    `3 ways ${uniqueFactors.audience} can ${uniqueFactors.outcome}`,
    `Why traditional approaches to ${uniqueFactors.painPoint} don't work`
  );
  
  return hooks;
};

// Validate UVP factors
export const validateUVPFactors = (uniqueFactors: UVPAnalysis['uniqueFactors']): {
  isValid: boolean;
  missingFactors: string[];
  recommendations: string[];
} => {
  const missingFactors: string[] = [];
  const recommendations: string[] = [];
  
  // Check each factor
  if (!uniqueFactors.role || uniqueFactors.role.includes('professional')) {
    missingFactors.push('Specific role or title');
    recommendations.push('Add your specific job title or professional identity');
  }
  
  if (!uniqueFactors.method || uniqueFactors.method.length < 20) {
    missingFactors.push('Unique methodology');
    recommendations.push('Describe what makes your approach different');
  }
  
  if (!uniqueFactors.outcome || uniqueFactors.outcome.includes('sustainable')) {
    missingFactors.push('Specific outcome');
    recommendations.push('Define the concrete results you deliver');
  }
  
  if (!uniqueFactors.audience || !uniqueFactors.audience.includes(' in ')) {
    missingFactors.push('Specific audience');
    recommendations.push('Narrow down your target audience with industry or context');
  }
  
  if (!uniqueFactors.painPoint || uniqueFactors.painPoint.length < 15) {
    missingFactors.push('Clear pain point');
    recommendations.push('Identify what frustration or problem you solve');
  }
  
  return {
    isValid: missingFactors.length === 0,
    missingFactors,
    recommendations
  };
};