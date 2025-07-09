import { WorkshopState } from '../store/slices/workshopSlice';

// RSS Feed Types
export interface RSSFeed {
  id: string;
  feedUrl: string;
  feedName: string;
  feedType: 'rss' | 'atom' | 'google_alerts' | 'custom';
  keywords: string[];
  category: string;
  isActive: boolean;
  lastFetched?: Date;
  errorCount?: number;
  favicon?: string;
}

export interface FeedItem {
  id: string;
  feedId: string;
  title: string;
  description: string;
  link: string;
  pubDate: Date;
  author?: string;
  categories?: string[];
  imageUrl?: string;
  relevanceScore?: number;
  contentPillarMatch?: string;
}

export interface FeedRecommendation {
  feedUrl: string;
  feedName: string;
  description: string;
  category: string;
  icon: string;
  relevanceScore: number;
  matchReason: string;
}

export interface FeedValidationResult {
  isValid: boolean;
  feedType?: 'rss' | 'atom';
  title?: string;
  description?: string;
  itemCount?: number;
  error?: string;
}

// Industry-specific feed mappings
const industryFeeds: Record<string, FeedRecommendation[]> = {
  technology: [
    {
      feedUrl: 'https://techcrunch.com/feed/',
      feedName: 'TechCrunch',
      description: 'Leading technology media property, dedicated to obsessively profiling startups',
      category: 'technology',
      icon: '💻',
      relevanceScore: 0.9,
      matchReason: 'Latest tech news and startup insights'
    },
    {
      feedUrl: 'https://www.theverge.com/rss/index.xml',
      feedName: 'The Verge',
      description: 'Technology, science, art, and culture news',
      category: 'technology',
      icon: '🔬',
      relevanceScore: 0.85,
      matchReason: 'Comprehensive tech coverage with cultural context'
    },
    {
      feedUrl: 'https://news.ycombinator.com/rss',
      feedName: 'Hacker News',
      description: 'Social news website focusing on computer science and entrepreneurship',
      category: 'technology',
      icon: '🚀',
      relevanceScore: 0.8,
      matchReason: 'Developer and startup community insights'
    },
    {
      feedUrl: 'https://www.wired.com/feed/rss',
      feedName: 'WIRED',
      description: 'In-depth coverage of current and future trends in technology',
      category: 'technology',
      icon: '🔌',
      relevanceScore: 0.75,
      matchReason: 'Future-focused technology journalism'
    }
  ],
  business: [
    {
      feedUrl: 'https://hbr.org/feed',
      feedName: 'Harvard Business Review',
      description: 'Management tips, insights, and best practices',
      category: 'business',
      icon: '📊',
      relevanceScore: 0.95,
      matchReason: 'Evidence-based business strategy and leadership'
    },
    {
      feedUrl: 'https://www.forbes.com/real-time/feed2/',
      feedName: 'Forbes',
      description: 'Business, investing, technology, entrepreneurship, leadership',
      category: 'business',
      icon: '💼',
      relevanceScore: 0.85,
      matchReason: 'Business success stories and market insights'
    },
    {
      feedUrl: 'https://feeds.bloomberg.com/markets/news.rss',
      feedName: 'Bloomberg Markets',
      description: 'Global business, finance, and market news',
      category: 'business',
      icon: '📈',
      relevanceScore: 0.8,
      matchReason: 'Real-time market analysis and business trends'
    },
    {
      feedUrl: 'https://www.businessinsider.com/rss',
      feedName: 'Business Insider',
      description: 'Business, celebrity, and technology news',
      category: 'business',
      icon: '📰',
      relevanceScore: 0.75,
      matchReason: 'Accessible business news and analysis'
    }
  ],
  marketing: [
    {
      feedUrl: 'https://contentmarketinginstitute.com/feed/',
      feedName: 'Content Marketing Institute',
      description: 'Content marketing strategy, tips, and best practices',
      category: 'marketing',
      icon: '📝',
      relevanceScore: 0.9,
      matchReason: 'Content strategy aligned with your brand pillars'
    },
    {
      feedUrl: 'https://blog.hubspot.com/marketing/rss.xml',
      feedName: 'HubSpot Marketing Blog',
      description: 'Inbound marketing, sales, and customer service insights',
      category: 'marketing',
      icon: '🎯',
      relevanceScore: 0.85,
      matchReason: 'Data-driven marketing strategies'
    },
    {
      feedUrl: 'https://neilpatel.com/blog/feed/',
      feedName: 'Neil Patel Blog',
      description: 'Digital marketing, SEO, and growth strategies',
      category: 'marketing',
      icon: '📊',
      relevanceScore: 0.8,
      matchReason: 'Actionable digital marketing tactics'
    },
    {
      feedUrl: 'https://www.socialmediaexaminer.com/feed/',
      feedName: 'Social Media Examiner',
      description: 'Social media marketing tips and strategies',
      category: 'marketing',
      icon: '📱',
      relevanceScore: 0.75,
      matchReason: 'Social media expertise for LinkedIn growth'
    }
  ],
  leadership: [
    {
      feedUrl: 'https://www.leadershipnow.com/leadingblog/atom.xml',
      feedName: 'Leadership Now',
      description: 'Leadership development insights and resources',
      category: 'leadership',
      icon: '👔',
      relevanceScore: 0.9,
      matchReason: 'Leadership insights for your archetype'
    },
    {
      feedUrl: 'https://www.strategy-business.com/rss',
      feedName: 'strategy+business',
      description: 'Management strategy and leadership insights from PwC',
      category: 'leadership',
      icon: '🎯',
      relevanceScore: 0.85,
      matchReason: 'Strategic leadership perspectives'
    },
    {
      feedUrl: 'https://sloanreview.mit.edu/feed',
      feedName: 'MIT Sloan Management Review',
      description: 'Research-based insights on management and leadership',
      category: 'leadership',
      icon: '🎓',
      relevanceScore: 0.8,
      matchReason: 'Academic leadership research and insights'
    }
  ],
  innovation: [
    {
      feedUrl: 'https://www.fastcompany.com/rss',
      feedName: 'Fast Company',
      description: 'Innovation in technology, leadership, and design',
      category: 'innovation',
      icon: '💡',
      relevanceScore: 0.9,
      matchReason: 'Innovation stories matching your forward-thinking approach'
    },
    {
      feedUrl: 'https://singularityhub.com/feed/',
      feedName: 'Singularity Hub',
      description: 'Science and technology breakthroughs shaping the future',
      category: 'innovation',
      icon: '🔮',
      relevanceScore: 0.85,
      matchReason: 'Future-focused innovation insights'
    },
    {
      feedUrl: 'https://www.innovationexcellence.com/blog/feed/',
      feedName: 'Innovation Excellence',
      description: 'Innovation best practices and thought leadership',
      category: 'innovation',
      icon: '🚀',
      relevanceScore: 0.8,
      matchReason: 'Innovation methodology and case studies'
    }
  ],
  finance: [
    {
      feedUrl: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
      feedName: 'Wall Street Journal',
      description: 'Business and financial news',
      category: 'finance',
      icon: '💰',
      relevanceScore: 0.9,
      matchReason: 'Premium financial news and analysis'
    },
    {
      feedUrl: 'https://www.ft.com/?format=rss',
      feedName: 'Financial Times',
      description: 'Global business, economic and political news',
      category: 'finance',
      icon: '📊',
      relevanceScore: 0.88,
      matchReason: 'Global financial perspective'
    },
    {
      feedUrl: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
      feedName: 'CNBC',
      description: 'Stock market news, business news, financial and investing news',
      category: 'finance',
      icon: '📈',
      relevanceScore: 0.8,
      matchReason: 'Real-time market updates'
    }
  ]
};

// Generate personalized feed recommendations based on workshop data
export const generateFeedRecommendations = (
  workshopState: WorkshopState,
  archetype: string,
  contentPillars: any[]
): FeedRecommendation[] => {
  const recommendations: FeedRecommendation[] = [];
  
  // Extract user's industry and interests
  const professionalRole = workshopState.personalityQuiz.responses.find(
    r => r.questionId === 'professional_role'
  )?.answer || '';
  
  const expertise = workshopState.personalityQuiz.responses.find(
    r => r.questionId === 'expertise_area'
  )?.answer || '';
  
  const audienceIndustry = workshopState.audienceBuilder.personas[0]?.demographics.industry || '';
  
  // Determine relevant categories based on archetype
  const archetypeCategories: Record<string, string[]> = {
    'Innovative Leader': ['technology', 'innovation', 'leadership', 'business'],
    'Empathetic Expert': ['leadership', 'business', 'marketing'],
    'Strategic Visionary': ['business', 'innovation', 'finance', 'leadership'],
    'Authentic Changemaker': ['innovation', 'leadership', 'marketing']
  };
  
  const relevantCategories = archetypeCategories[archetype] || ['business', 'technology'];
  
  // Add feeds from relevant categories
  relevantCategories.forEach(category => {
    if (industryFeeds[category]) {
      industryFeeds[category].forEach(feed => {
        recommendations.push({
          ...feed,
          relevanceScore: calculateRelevanceScore(feed, workshopState, archetype, contentPillars)
        });
      });
    }
  });
  
  // Add industry-specific recommendations
  const industryKeywords = extractIndustryKeywords(professionalRole, expertise, audienceIndustry);
  recommendations.forEach(rec => {
    if (industryKeywords.some(keyword => 
      rec.feedName.toLowerCase().includes(keyword.toLowerCase()) ||
      rec.description.toLowerCase().includes(keyword.toLowerCase())
    )) {
      rec.relevanceScore += 0.1;
    }
  });
  
  // Sort by relevance score
  recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Return top 10 recommendations
  return recommendations.slice(0, 10);
};

// Calculate relevance score for a feed
const calculateRelevanceScore = (
  feed: FeedRecommendation,
  workshopState: WorkshopState,
  archetype: string,
  contentPillars: any[]
): number => {
  let score = feed.relevanceScore;
  
  // Boost score based on content pillar alignment
  contentPillars.forEach(pillar => {
    pillar.topics.forEach((topic: string) => {
      if (feed.description.toLowerCase().includes(topic.toLowerCase())) {
        score += 0.05;
      }
    });
  });
  
  // Boost score based on values alignment
  workshopState.values.selected.forEach(value => {
    if (feed.description.toLowerCase().includes(value.toLowerCase())) {
      score += 0.03;
    }
  });
  
  // Cap at 1.0
  return Math.min(score, 1.0);
};

// Extract industry keywords from user data
const extractIndustryKeywords = (
  role: string,
  expertise: string,
  audienceIndustry: string
): string[] => {
  const keywords: string[] = [];
  
  // Extract from role
  const roleWords = role.toLowerCase().split(' ');
  keywords.push(...roleWords.filter(word => word.length > 4));
  
  // Extract from expertise
  const expertiseWords = expertise.toLowerCase().split(' ');
  keywords.push(...expertiseWords.filter(word => word.length > 4));
  
  // Extract from audience industry
  if (audienceIndustry) {
    keywords.push(audienceIndustry.toLowerCase());
  }
  
  // Common industry mappings
  const industryMappings: Record<string, string[]> = {
    'software': ['tech', 'saas', 'developer', 'engineering'],
    'marketing': ['digital', 'growth', 'brand', 'content'],
    'finance': ['fintech', 'investment', 'banking', 'crypto'],
    'healthcare': ['health', 'medical', 'biotech', 'pharma'],
    'education': ['edtech', 'learning', 'training', 'academic']
  };
  
  Object.entries(industryMappings).forEach(([key, values]) => {
    if (keywords.some(kw => kw.includes(key))) {
      keywords.push(...values);
    }
  });
  
  return [...new Set(keywords)];
};

// Validate RSS feed URL
export const validateFeed = async (feedUrl: string): Promise<FeedValidationResult> => {
  try {
    // In production, this would make an API call to validate the feed
    // For now, we'll do basic URL validation
    const url = new URL(feedUrl);
    
    if (!url.protocol.startsWith('http')) {
      return {
        isValid: false,
        error: 'Feed URL must start with http:// or https://'
      };
    }
    
    // Simulate API call to validate feed
    // In production: const response = await fetch(`/api/rss/validate?url=${encodeURIComponent(feedUrl)}`);
    
    return {
      isValid: true,
      feedType: 'rss',
      title: 'Valid RSS Feed',
      description: 'This feed is valid and can be added',
      itemCount: 10
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid feed URL format'
    };
  }
};

// Parse feed items for relevance
export const parseFeedItems = (
  items: FeedItem[],
  contentPillars: any[],
  keywords: string[]
): FeedItem[] => {
  return items.map(item => {
    // Calculate relevance score
    let relevanceScore = 0;
    let matchedPillar = '';
    
    // Check content pillar match
    contentPillars.forEach(pillar => {
      const pillarKeywords = pillar.topics.join(' ').toLowerCase();
      const itemText = `${item.title} ${item.description}`.toLowerCase();
      
      const matches = pillar.topics.filter((topic: string) => 
        itemText.includes(topic.toLowerCase())
      ).length;
      
      if (matches > 0) {
        const score = matches / pillar.topics.length;
        if (score > relevanceScore) {
          relevanceScore = score;
          matchedPillar = pillar.name;
        }
      }
    });
    
    // Check keyword matches
    if (keywords.length > 0) {
      const itemText = `${item.title} ${item.description}`.toLowerCase();
      const keywordMatches = keywords.filter(kw => 
        itemText.includes(kw.toLowerCase())
      ).length;
      
      relevanceScore += (keywordMatches / keywords.length) * 0.3;
    }
    
    // Boost recent items
    const daysSincePublished = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 1) {
      relevanceScore += 0.2;
    } else if (daysSincePublished < 3) {
      relevanceScore += 0.1;
    } else if (daysSincePublished < 7) {
      relevanceScore += 0.05;
    }
    
    return {
      ...item,
      relevanceScore: Math.min(relevanceScore, 1.0),
      contentPillarMatch: matchedPillar
    };
  });
};

// Get feed category suggestions based on user profile
export const getFeedCategories = (
  workshopState: WorkshopState,
  archetype: string
): string[] => {
  const categories = new Set<string>();
  
  // Add archetype-specific categories
  const archetypeMap: Record<string, string[]> = {
    'Innovative Leader': ['technology', 'innovation', 'leadership', 'startups'],
    'Empathetic Expert': ['leadership', 'psychology', 'wellness', 'culture'],
    'Strategic Visionary': ['strategy', 'business', 'future', 'trends'],
    'Authentic Changemaker': ['social-impact', 'sustainability', 'activism', 'culture']
  };
  
  if (archetypeMap[archetype]) {
    archetypeMap[archetype].forEach(cat => categories.add(cat));
  }
  
  // Add industry-specific categories
  const industry = workshopState.audienceBuilder.personas[0]?.demographics.industry;
  if (industry) {
    categories.add(industry.toLowerCase());
  }
  
  // Add expertise-based categories
  const expertise = workshopState.personalityQuiz.responses.find(
    r => r.questionId === 'expertise_area'
  )?.answer;
  
  if (expertise) {
    if (expertise.toLowerCase().includes('tech')) categories.add('technology');
    if (expertise.toLowerCase().includes('market')) categories.add('marketing');
    if (expertise.toLowerCase().includes('financ')) categories.add('finance');
    if (expertise.toLowerCase().includes('health')) categories.add('healthcare');
    if (expertise.toLowerCase().includes('educat')) categories.add('education');
  }
  
  // Always include general business
  categories.add('business');
  categories.add('general');
  
  return Array.from(categories);
};

// Generate smart keyword suggestions
export const generateKeywordSuggestions = (
  workshopState: WorkshopState,
  contentPillars: any[]
): string[] => {
  const keywords = new Set<string>();
  
  // Extract from values
  workshopState.values.selected.slice(0, 3).forEach(value => {
    keywords.add(value.toLowerCase());
  });
  
  // Extract from content pillars
  contentPillars.forEach(pillar => {
    // Add top 2 topics from each pillar
    pillar.topics.slice(0, 2).forEach((topic: string) => {
      keywords.add(topic.toLowerCase());
    });
  });
  
  // Extract from audience pain points
  workshopState.audienceBuilder.personas.forEach(persona => {
    if (persona.psychographics.painPoints) {
      const painWords = persona.psychographics.painPoints
        .split(' ')
        .filter(word => word.length > 5)
        .slice(0, 2);
      painWords.forEach(word => keywords.add(word.toLowerCase()));
    }
  });
  
  // Add transformation keywords
  const transformation = workshopState.audienceBuilder.transformation;
  if (transformation?.primary) {
    const transWords = transformation.primary
      .split(' ')
      .filter(word => word.length > 4)
      .slice(0, 2);
    transWords.forEach(word => keywords.add(word.toLowerCase()));
  }
  
  return Array.from(keywords).slice(0, 10);
};

// Create default feeds for new users
export const createDefaultFeeds = (
  recommendations: FeedRecommendation[]
): RSSFeed[] => {
  // Take top 3 recommendations as default feeds
  return recommendations.slice(0, 3).map((rec, index) => ({
    id: `default-${index + 1}`,
    feedUrl: rec.feedUrl,
    feedName: rec.feedName,
    feedType: 'rss' as const,
    keywords: [],
    category: rec.category,
    isActive: true,
    lastFetched: new Date(),
    errorCount: 0
  }));
};

// Monitor feed health
export interface FeedHealth {
  feedId: string;
  status: 'healthy' | 'warning' | 'error';
  lastSuccessfulFetch?: Date;
  errorMessage?: string;
  itemsFound: number;
  averageRelevance: number;
}

export const checkFeedHealth = (
  feed: RSSFeed,
  recentItems: FeedItem[]
): FeedHealth => {
  const now = new Date();
  const hoursSinceLastFetch = feed.lastFetched 
    ? (now.getTime() - feed.lastFetched.getTime()) / (1000 * 60 * 60)
    : 999;
  
  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  let errorMessage: string | undefined;
  
  if (feed.errorCount && feed.errorCount > 5) {
    status = 'error';
    errorMessage = 'Feed has failed multiple times';
  } else if (feed.errorCount && feed.errorCount > 2) {
    status = 'warning';
    errorMessage = 'Feed is experiencing intermittent issues';
  } else if (hoursSinceLastFetch > 24) {
    status = 'warning';
    errorMessage = 'Feed hasn\'t been updated in over 24 hours';
  }
  
  const averageRelevance = recentItems.length > 0
    ? recentItems.reduce((sum, item) => sum + (item.relevanceScore || 0), 0) / recentItems.length
    : 0;
  
  return {
    feedId: feed.id,
    status,
    lastSuccessfulFetch: feed.lastFetched,
    errorMessage,
    itemsFound: recentItems.length,
    averageRelevance
  };
};