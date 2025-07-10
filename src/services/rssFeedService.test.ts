import { 
  generateFeedRecommendations,
  validateFeed,
  generateKeywordSuggestions,
  parseFeedItems,
  getFeedCategories,
  createDefaultFeeds
} from './rssFeedService';
import { WorkshopState } from '../store/slices/workshopSlice';

describe('rssFeedService', () => {
  // Mock workshop data for testing
  const mockWorkshopState: WorkshopState = {
    currentStep: 5,
    completedSteps: [1, 2, 3, 4, 5],
    isCompleted: true,
    assessmentScore: 85,
    workshopPath: 'direct',
    startedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    values: {
      selected: ['innovation', 'growth', 'impact', 'integrity', 'collaboration'],
      custom: [],
      rankings: {},
      primary: ['innovation', 'growth'],
      aspirational: ['leadership'],
      stories: {}
    },
    tonePreferences: {
      formal_casual: 30,
      concise_detailed: 10,
      analytical_creative: 20,
      serious_playful: -10
    },
    audiencePersonas: [
      {
        id: '1',
        title: 'Tech Entrepreneurs',
        name: 'Tech Entrepreneurs',
        role: 'Founder/CEO',
        industry: 'Technology',
        painPoints: ['Scaling', 'Funding', 'Product-market fit'],
        goals: ['Growth', 'Innovation', 'Market leadership'],
        communicationStyle: 'Direct and visionary',
        isPrimary: true
      }
    ],
    audienceBuilder: {
      personas: [
        {
          id: '1',
          name: 'Tech Entrepreneurs',
          demographics: {
            industry: 'Technology',
            role: 'Founder/CEO',
            experience: '5+ years'
          },
          painPoints: ['Scaling', 'Funding', 'Product-market fit'],
          goals: ['Growth', 'Innovation', 'Market leadership'],
          communicationStyle: 'Direct and visionary',
          isPrimary: true
        }
      ]
    },
    writingSample: {
      text: 'I help tech startups scale through innovative strategies.',
      wordCount: 10,
      uploadedAt: new Date().toISOString()
    },
    personalityQuiz: {
      responses: [
        {
          questionId: 'professional_role',
          answer: 'Product Strategy Consultant',
          answeredAt: new Date().toISOString()
        },
        {
          questionId: 'known_for',
          answer: 'Digital transformation, product innovation, startup scaling',
          answeredAt: new Date().toISOString()
        }
      ],
      currentQuestionIndex: 0
    },
    sessionId: 'test-session',
    isSaving: false,
    lastError: null
  };

  const mockContentPillars = [
    {
      name: 'Expertise',
      description: 'Product strategy and innovation',
      topics: ['product development', 'innovation strategy', 'market analysis', 'user research']
    },
    {
      name: 'Experience',
      description: 'Lessons from scaling startups',
      topics: ['startup growth', 'scaling challenges', 'founder stories', 'pivot strategies']
    },
    {
      name: 'Evolution',
      description: 'Future of product development',
      topics: ['AI in products', 'future of work', 'emerging technologies', 'industry trends']
    }
  ];

  describe('generateFeedRecommendations', () => {
    test('should return personalized feed recommendations', () => {
      const feeds = generateFeedRecommendations(mockWorkshopState, 'Innovative Leader', mockContentPillars);

      expect(feeds).toBeDefined();
      expect(Array.isArray(feeds)).toBe(true);
      expect(feeds.length).toBeLessThanOrEqual(10); // Should return top 10
      
      feeds.forEach(feed => {
        expect(feed).toHaveProperty('feedUrl');
        expect(feed).toHaveProperty('feedName');
        expect(feed).toHaveProperty('description');
        expect(feed).toHaveProperty('category');
        expect(feed).toHaveProperty('relevanceScore');
        expect(feed).toHaveProperty('matchReason');
      });
    });

    test('should prioritize technology feeds for tech entrepreneur audience', () => {
      const feeds = generateFeedRecommendations(mockWorkshopState, 'Innovative Leader', mockContentPillars);
      
      const techFeeds = feeds.filter(f => 
        f.category === 'technology' || 
        f.feedName.toLowerCase().includes('tech') ||
        f.description.toLowerCase().includes('tech')
      );

      expect(techFeeds.length).toBeGreaterThan(0);
    });

    test('should calculate relevance scores between 0 and 1', () => {
      const feeds = generateFeedRecommendations(mockWorkshopState, 'Strategic Visionary', mockContentPillars);
      
      feeds.forEach(feed => {
        expect(feed.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(feed.relevanceScore).toBeLessThanOrEqual(1);
      });
    });

    test('should handle missing content pillars gracefully', () => {
      const feeds = generateFeedRecommendations(mockWorkshopState, 'Empathetic Expert', []);
      
      expect(feeds).toBeDefined();
      expect(Array.isArray(feeds)).toBe(true);
      expect(feeds.length).toBeGreaterThan(0);
    });

    test('should return different recommendations for different archetypes', () => {
      const innovativeFeeds = generateFeedRecommendations(mockWorkshopState, 'Innovative Leader', mockContentPillars);
      const empatheticFeeds = generateFeedRecommendations(mockWorkshopState, 'Empathetic Expert', mockContentPillars);
      
      // Should have some different feeds
      const innovativeUrls = new Set(innovativeFeeds.map(f => f.feedUrl));
      const empatheticUrls = new Set(empatheticFeeds.map(f => f.feedUrl));
      
      const uniqueToInnovative = [...innovativeUrls].filter(url => !empatheticUrls.has(url));
      expect(uniqueToInnovative.length).toBeGreaterThan(0);
    });
  });

  describe('validateFeed', () => {
    test('should validate proper HTTP URLs', async () => {
      const result = await validateFeed('https://example.com/rss');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject non-HTTP URLs', async () => {
      const result = await validateFeed('ftp://example.com/rss');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('http://');
    });

    test('should reject invalid URLs', async () => {
      const result = await validateFeed('not-a-url');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle empty URL', async () => {
      const result = await validateFeed('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('generateKeywordSuggestions', () => {
    test('should suggest keywords based on workshop data', () => {
      const keywords = generateKeywordSuggestions(mockWorkshopState, mockContentPillars);
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    test('should include values in keyword suggestions', () => {
      const keywords = generateKeywordSuggestions(mockWorkshopState, mockContentPillars);
      
      const hasValueKeyword = keywords.some(kw => 
        mockWorkshopState.values.selected.some(value => 
          kw.toLowerCase().includes(value.toLowerCase())
        )
      );
      
      expect(hasValueKeyword).toBe(true);
    });

    test('should include content pillar topics in suggestions', () => {
      const keywords = generateKeywordSuggestions(mockWorkshopState, mockContentPillars);
      
      const hasTopicKeyword = keywords.some(kw => 
        mockContentPillars.some(pillar => 
          pillar.topics.some(topic => 
            kw.toLowerCase().includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(kw.toLowerCase())
          )
        )
      );
      
      expect(hasTopicKeyword).toBe(true);
    });

    test('should return unique keywords', () => {
      const keywords = generateKeywordSuggestions(mockWorkshopState, mockContentPillars);
      const uniqueKeywords = new Set(keywords);
      
      expect(uniqueKeywords.size).toBe(keywords.length);
    });
  });

  describe('getFeedCategories', () => {
    test('should return feed categories based on audience', () => {
      const categories = getFeedCategories(mockWorkshopState);
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('technology');
    });

    test('should return unique categories', () => {
      const categories = getFeedCategories(mockWorkshopState);
      const uniqueCategories = new Set(categories);
      
      expect(uniqueCategories.size).toBe(categories.length);
    });
  });

  describe('createDefaultFeeds', () => {
    test('should create default feeds for user', () => {
      const feeds = createDefaultFeeds(mockWorkshopState, 'Innovative Leader');
      
      expect(Array.isArray(feeds)).toBe(true);
      expect(feeds.length).toBeGreaterThan(0);
      
      feeds.forEach(feed => {
        expect(feed).toHaveProperty('id');
        expect(feed).toHaveProperty('feedUrl');
        expect(feed).toHaveProperty('feedName');
        expect(feed).toHaveProperty('feedType');
        expect(feed).toHaveProperty('category');
        expect(feed).toHaveProperty('isActive');
      });
    });

    test('should create feeds relevant to archetype', () => {
      const innovativeRecommendations = generateFeedRecommendations(mockWorkshopState, 'Innovative Leader');
      const empatheticRecommendations = generateFeedRecommendations(mockWorkshopState, 'Empathetic Expert');
      
      const innovativeFeeds = createDefaultFeeds(innovativeRecommendations);
      const empatheticFeeds = createDefaultFeeds(empatheticRecommendations);
      
      // Check that feeds are different for different archetypes
      const innovativeUrls = new Set(innovativeFeeds.map(f => f.feedUrl));
      const empatheticUrls = new Set(empatheticFeeds.map(f => f.feedUrl));
      
      // Some feeds should be unique to each archetype
      const uniqueToInnovative = [...innovativeUrls].filter(url => !empatheticUrls.has(url));
      expect(uniqueToInnovative.length).toBeGreaterThan(0);
    });
  });
});