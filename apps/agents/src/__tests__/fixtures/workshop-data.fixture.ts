export const mockWorkshopData = {
  userId: 'test-user-123',
  archetype: 'Innovative Leader',
  values: ['Innovation', 'Excellence', 'Integrity', 'Growth', 'Impact'],
  personalityTraits: {
    openness: 0.85,
    conscientiousness: 0.78,
    extraversion: 0.72,
    agreeableness: 0.65,
    neuroticism: 0.35
  },
  writingSamples: [
    {
      text: 'In my experience leading digital transformation initiatives, I\'ve learned that success comes from empowering teams to innovate while maintaining operational excellence.',
      pillar: 'expertise'
    },
    {
      text: 'The journey from individual contributor to tech leader taught me that vulnerability and authenticity are not weaknesses, but strengths that build trust.',
      pillar: 'experience'
    }
  ],
  mission: 'To empower technology leaders to drive meaningful digital transformation through innovative solutions and authentic leadership.',
  contentPillars: [
    {
      name: 'Digital Innovation',
      percentage: 40,
      topics: ['AI/ML', 'Cloud Architecture', 'DevOps', 'Agile Transformation']
    },
    {
      name: 'Leadership Excellence',
      percentage: 35,
      topics: ['Team Building', 'Strategic Planning', 'Change Management', 'Mentorship']
    },
    {
      name: 'Personal Growth',
      percentage: 25,
      topics: ['Continuous Learning', 'Work-Life Balance', 'Career Development', 'Mindfulness']
    }
  ],
  voiceProfile: {
    tone: 'Professional yet approachable',
    style: 'Thought-provoking and insightful',
    vocabulary: ['transform', 'innovate', 'empower', 'strategic', 'authentic'],
    sentenceStructure: 'Mix of short impactful statements and detailed explanations'
  }
};

export const mockNewsItem = {
  title: 'Major Tech Company Announces AI Breakthrough in Healthcare',
  description: 'Revolutionary AI model shows 95% accuracy in early disease detection, potentially saving millions of lives.',
  link: 'https://example.com/ai-healthcare-breakthrough',
  pubDate: new Date().toISOString(),
  source: 'TechNews Daily',
  relevanceScore: 0.92,
  categories: ['AI', 'Healthcare', 'Innovation']
};

export const mockContentRequest = {
  userId: 'test-user-123',
  sourceType: 'news' as const,
  sourceContent: mockNewsItem,
  angle: 'thought-leader' as const,
  pillar: 'Digital Innovation',
  requestedBy: 'test-agent'
};