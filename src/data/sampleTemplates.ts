import { ContentTemplate } from '../services/contentAPI';

// Sample content templates for development and testing
export const sampleTemplates: ContentTemplate[] = [
  {
    id: 'template-1',
    name: 'Career Milestone Achievement',
    description: 'Share professional achievements and career milestones with impact focus',
    contentType: 'post',
    useCase: 'professional_update',
    industryTags: ['technology', 'business', 'finance'],
    variables: {
      achievement: 'The specific achievement or milestone',
      impact: 'Business impact or results achieved',
      timeline: 'Time period or duration',
      team_recognition: 'Recognition of team or colleagues',
      lessons_learned: 'Key insights or lessons'
    },
    templateStructure: {
      sections: [
        'Opening hook with achievement announcement',
        'Context and background',
        'Specific results and impact',
        'Team recognition and gratitude',
        'Lessons learned and insights',
        'Call to action or question for engagement'
      ],
      tone: 'professional_proud',
      typical_length: 'medium'
    }
  },
  {
    id: 'template-2',
    name: 'Industry Trend Analysis',
    description: 'Share insights on industry trends and future predictions',
    contentType: 'post',
    useCase: 'industry_insight',
    industryTags: ['technology', 'marketing', 'business'],
    variables: {
      trend: 'The specific trend being discussed',
      evidence: 'Data or evidence supporting the trend',
      impact: 'How this affects the industry',
      prediction: 'Future implications or predictions',
      call_to_action: 'Question or discussion starter'
    },
    templateStructure: {
      sections: [
        'Compelling trend introduction',
        'Supporting data and evidence',
        'Industry impact analysis',
        'Future predictions and implications',
        'Personal perspective and insights',
        'Engagement question'
      ],
      tone: 'thought_leader',
      typical_length: 'long'
    }
  },
  {
    id: 'template-3',
    name: 'Personal Learning Story',
    description: 'Share personal experiences and lessons learned from challenges',
    contentType: 'post',
    useCase: 'personal_story',
    industryTags: ['general', 'leadership', 'career_development'],
    variables: {
      situation: 'The challenging situation faced',
      action_taken: 'What actions were taken',
      outcome: 'The result or outcome',
      lesson_learned: 'Key takeaway or insight',
      advice: 'Advice for others in similar situations'
    },
    templateStructure: {
      sections: [
        'Hook with relatable challenge',
        'Situation description',
        'Action taken and reasoning',
        'Outcome and results',
        'Lesson learned',
        'Advice for others'
      ],
      tone: 'personal_authentic',
      typical_length: 'medium'
    }
  },
  {
    id: 'template-4',
    name: 'Company News Announcement',
    description: 'Professional announcement of company updates, launches, or achievements',
    contentType: 'post',
    useCase: 'company_news',
    industryTags: ['startup', 'technology', 'business'],
    variables: {
      announcement: 'The main news or announcement',
      significance: 'Why this matters',
      team_role: 'Your role in the achievement',
      impact: 'Expected impact or benefits',
      gratitude: 'Recognition of team or partners'
    },
    templateStructure: {
      sections: [
        'Exciting announcement hook',
        'Context and significance',
        'Your role and contribution',
        'Expected impact and benefits',
        'Team and partner recognition',
        'Future outlook'
      ],
      tone: 'professional_excited',
      typical_length: 'medium'
    }
  },
  {
    id: 'template-5',
    name: 'Networking Connection Request',
    description: 'Professional networking posts to connect with industry peers',
    contentType: 'post',
    useCase: 'networking',
    industryTags: ['general', 'business', 'sales'],
    variables: {
      purpose: 'Reason for networking',
      value_offer: 'What value you can provide',
      common_interest: 'Shared interests or goals',
      specific_ask: 'Specific networking request',
      background: 'Relevant background information'
    },
    templateStructure: {
      sections: [
        'Introduction and purpose',
        'Your relevant background',
        'Value proposition',
        'Common interests or goals',
        'Specific networking ask',
        'Call to action'
      ],
      tone: 'friendly_professional',
      typical_length: 'short'
    }
  },
  {
    id: 'template-6',
    name: 'Thought Leadership Opinion',
    description: 'Share expert opinions and thought leadership content',
    contentType: 'post',
    useCase: 'thought_leadership',
    industryTags: ['leadership', 'business', 'strategy'],
    variables: {
      topic: 'The main topic or issue',
      stance: 'Your position or opinion',
      reasoning: 'Supporting arguments',
      implications: 'Broader implications',
      counterargument: 'Acknowledgment of other perspectives'
    },
    templateStructure: {
      sections: [
        'Strong opening statement',
        'Clear position statement',
        'Supporting arguments and evidence',
        'Broader implications',
        'Acknowledgment of other perspectives',
        'Call for discussion'
      ],
      tone: 'authoritative_balanced',
      typical_length: 'long'
    }
  },
  {
    id: 'template-7',
    name: 'Quick Professional Tip',
    description: 'Share bite-sized professional tips and advice',
    contentType: 'post',
    useCase: 'tip',
    industryTags: ['productivity', 'career_development', 'business'],
    variables: {
      tip: 'The specific tip or advice',
      context: 'When or why to use this tip',
      example: 'Concrete example of application',
      benefit: 'Expected benefit or outcome',
      variation: 'Alternative approaches'
    },
    templateStructure: {
      sections: [
        'Attention-grabbing tip introduction',
        'Context and applicability',
        'Step-by-step explanation',
        'Real-world example',
        'Expected benefits',
        'Engagement question'
      ],
      tone: 'helpful_practical',
      typical_length: 'short'
    }
  },
  {
    id: 'template-8',
    name: 'Achievement Celebration',
    description: 'Celebrate team or personal achievements with proper recognition',
    contentType: 'post',
    useCase: 'achievement',
    industryTags: ['leadership', 'team_management', 'general'],
    variables: {
      achievement: 'What was achieved',
      team_members: 'Key team members to recognize',
      challenges_overcome: 'Challenges that were overcome',
      impact: 'Significance of the achievement',
      future_goals: 'What comes next'
    },
    templateStructure: {
      sections: [
        'Exciting achievement announcement',
        'Context and challenge background',
        'Team recognition and contributions',
        'Impact and significance',
        'Lessons learned',
        'Future goals and outlook'
      ],
      tone: 'celebratory_grateful',
      typical_length: 'medium'
    }
  },
  {
    id: 'template-9',
    name: 'Learning and Development Update',
    description: 'Share professional learning experiences and skill development',
    contentType: 'post',
    useCase: 'learning',
    industryTags: ['education', 'career_development', 'technology'],
    variables: {
      learning_topic: 'What was learned',
      learning_method: 'How it was learned',
      application: 'How it applies to work',
      insight: 'Key insight or revelation',
      recommendation: 'Recommendation for others'
    },
    templateStructure: {
      sections: [
        'Learning announcement or discovery',
        'Learning method and process',
        'Key insights and revelations',
        'Practical application',
        'Recommendation for others',
        'Question for community input'
      ],
      tone: 'curious_educational',
      typical_length: 'medium'
    }
  },
  {
    id: 'template-10',
    name: 'Problem-Solution Case Study',
    description: 'Share how you solved a specific business problem',
    contentType: 'post',
    useCase: 'professional_update',
    industryTags: ['consulting', 'problem_solving', 'business'],
    variables: {
      problem: 'The specific problem faced',
      approach: 'Your approach to solving it',
      solution: 'The solution implemented',
      results: 'Measurable results achieved',
      learnings: 'What you learned from the experience'
    },
    templateStructure: {
      sections: [
        'Problem statement hook',
        'Context and stakes',
        'Solution approach and reasoning',
        'Implementation process',
        'Results and impact',
        'Key learnings and takeaways'
      ],
      tone: 'analytical_solution_focused',
      typical_length: 'long'
    }
  }
];

// Helper function to get templates by use case
export const getTemplatesByUseCase = () => {
  return sampleTemplates.reduce((acc, template) => {
    const useCase = template.useCase;
    if (!acc[useCase]) {
      acc[useCase] = [];
    }
    acc[useCase]!.push(template);
    return acc;
  }, {} as Record<string, ContentTemplate[]>);
};

// Helper function to get templates by content type
export const getTemplatesByContentType = (contentType: string) => {
  return sampleTemplates.filter(template => template.contentType === contentType);
};

// Helper function to get templates by industry
export const getTemplatesByIndustry = (industry: string) => {
  return sampleTemplates.filter(template => 
    template.industryTags.includes(industry.toLowerCase())
  );
};