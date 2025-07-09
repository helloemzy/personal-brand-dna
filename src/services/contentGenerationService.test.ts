import { ContentGenerationService } from './contentGenerationService';
import { WorkshopData } from '../types/workshop';

// Mock the content API
jest.mock('./contentAPI', () => ({
  generateContent: jest.fn()
}));

import { generateContent } from './contentAPI';

describe('ContentGenerationService', () => {
  const mockWorkshopData: WorkshopData = {
    archetypeResult: {
      primary: 'Innovative Leader',
      confidence: 0.85,
      traits: ['Visionary', 'Strategic', 'Bold']
    },
    values: {
      selectedValues: ['Innovation', 'Excellence', 'Integrity'],
      primaryValues: ['Innovation', 'Excellence']
    },
    personalityQuiz: {
      missionStatement: 'To transform industries through innovative solutions',
      responses: {}
    },
    contentPillars: {
      expertise: {
        topics: ['Digital Transformation', 'Innovation Strategy'],
        percentage: 40
      },
      experience: {
        topics: ['Leadership Journey', 'Success Stories'],
        percentage: 35
      },
      evolution: {
        topics: ['Future of Tech', 'Industry Trends'],
        percentage: 25
      }
    },
    audiencePersonas: [{
      name: 'Tech Leaders',
      painPoints: ['Scaling innovation', 'Digital transformation'],
      goals: ['Growth', 'Innovation']
    }],
    writingSample: {
      text: 'I believe in pushing boundaries and creating meaningful change...',
      analysis: {
        tone: 'Bold and visionary',
        vocabulary: ['transform', 'innovate', 'disrupt']
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSystemPrompt', () => {
    test('should generate comprehensive system prompt from workshop data', () => {
      const prompt = ContentGenerationService.generateSystemPrompt(mockWorkshopData);
      
      expect(prompt).toContain('Innovative Leader');
      expect(prompt).toContain('Innovation');
      expect(prompt).toContain('Excellence');
      expect(prompt).toContain('To transform industries through innovative solutions');
    });

    test('should handle missing workshop data gracefully', () => {
      const minimalData: WorkshopData = {};
      const prompt = ContentGenerationService.generateSystemPrompt(minimalData);
      
      expect(prompt).toContain('Strategic Visionary'); // Default archetype
      expect(prompt).not.toBeNull();
    });
  });

  describe('generateContentPrompt', () => {
    test('should create specific content prompt for post type', () => {
      const request = {
        topic: 'The Future of AI',
        contentType: 'post' as const,
        tone: 'thought-leader' as const,
        length: 'medium' as const
      };

      const prompt = ContentGenerationService.generateContentPrompt(request, mockWorkshopData);
      
      expect(prompt).toContain('The Future of AI');
      expect(prompt).toContain('thought leader');
      expect(prompt).toContain('LinkedIn post');
    });

    test('should include news context when provided', () => {
      const request = {
        topic: 'AI Innovation',
        contentType: 'post' as const,
        source: 'news' as const,
        newsContext: {
          articleUrl: 'https://example.com/ai-news',
          articleTitle: 'Major AI Breakthrough',
          articleSummary: 'Scientists achieve new milestone in AI research'
        }
      };

      const prompt = ContentGenerationService.generateContentPrompt(request, mockWorkshopData);
      
      expect(prompt).toContain('Major AI Breakthrough');
      expect(prompt).toContain('Scientists achieve new milestone');
    });

    test('should handle different content types', () => {
      const contentTypes = ['post', 'article', 'story', 'poll', 'carousel'] as const;
      
      contentTypes.forEach(type => {
        const request = {
          topic: 'Test Topic',
          contentType: type
        };
        
        const prompt = ContentGenerationService.generateContentPrompt(request, mockWorkshopData);
        expect(prompt).toContain(type);
      });
    });
  });

  describe('matchVoiceToWorkshop', () => {
    test('should match voice characteristics from workshop data', () => {
      const content = 'We need to transform our approach and innovate boldly.';
      const score = ContentGenerationService.matchVoiceToWorkshop(content, mockWorkshopData);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should give higher scores for content matching workshop vocabulary', () => {
      const matchingContent = 'Let\'s transform and innovate to disrupt the industry.';
      const nonMatchingContent = 'Here are some basic tips and tricks.';
      
      const matchingScore = ContentGenerationService.matchVoiceToWorkshop(matchingContent, mockWorkshopData);
      const nonMatchingScore = ContentGenerationService.matchVoiceToWorkshop(nonMatchingContent, mockWorkshopData);
      
      expect(matchingScore).toBeGreaterThan(nonMatchingScore);
    });
  });

  describe('generateContent', () => {
    test('should generate content with variations', async () => {
      const mockResponse = {
        content: 'Generated content about AI innovation...',
        variations: [
          'Variation 1: AI is transforming...',
          'Variation 2: The future of AI...'
        ],
        metadata: {
          voiceAccuracy: 0.87,
          contentPillar: 'expertise',
          archetype: 'Innovative Leader',
          generationTime: 1234
        }
      };

      (generateContent as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });

      const request = {
        topic: 'AI Innovation',
        contentType: 'post' as const
      };

      const result = await ContentGenerationService.generateContent(request, mockWorkshopData);
      
      expect(result).toEqual(mockResponse);
      expect(generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('Innovative Leader'),
          contentPrompt: expect.stringContaining('AI Innovation')
        })
      );
    });

    test('should handle API errors gracefully', async () => {
      (generateContent as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'API Error'
      });

      const request = {
        topic: 'Test Topic',
        contentType: 'post' as const
      };

      await expect(
        ContentGenerationService.generateContent(request, mockWorkshopData)
      ).rejects.toThrow('Failed to generate content');
    });
  });

  describe('generateFromIdea', () => {
    test('should generate content from workshop content idea', async () => {
      const mockResponse = {
        content: 'Content based on idea...',
        variations: [],
        metadata: {
          voiceAccuracy: 0.85,
          contentPillar: 'expertise',
          archetype: 'Innovative Leader',
          generationTime: 1000
        }
      };

      (generateContent as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });

      const result = await ContentGenerationService.generateFromIdea(
        'idea-123',
        'expertise',
        mockWorkshopData
      );
      
      expect(result).toEqual(mockResponse);
    });
  });

  describe('generateFromNews', () => {
    test('should generate content from news article', async () => {
      const mockResponse = {
        content: 'My take on this breakthrough...',
        variations: ['Professional angle...', 'Industry perspective...'],
        metadata: {
          voiceAccuracy: 0.88,
          contentPillar: 'evolution',
          archetype: 'Innovative Leader',
          generationTime: 1500
        }
      };

      (generateContent as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });

      const newsData = {
        url: 'https://example.com/news',
        title: 'Major Tech Breakthrough',
        summary: 'A new innovation in AI'
      };

      const result = await ContentGenerationService.generateFromNews(
        newsData,
        'professional' as const,
        mockWorkshopData
      );
      
      expect(result).toEqual(mockResponse);
      expect(generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contentPrompt: expect.stringContaining('Major Tech Breakthrough')
        })
      );
    });
  });

  describe('getContentPillarForTopic', () => {
    test('should identify correct content pillar for topic', () => {
      const expertiseTopic = 'Digital transformation strategies';
      const experienceTopic = 'My journey as a leader';
      const evolutionTopic = 'The future of technology';
      
      expect(
        ContentGenerationService.getContentPillarForTopic(expertiseTopic, mockWorkshopData)
      ).toBe('expertise');
      
      expect(
        ContentGenerationService.getContentPillarForTopic(experienceTopic, mockWorkshopData)
      ).toBe('experience');
      
      expect(
        ContentGenerationService.getContentPillarForTopic(evolutionTopic, mockWorkshopData)
      ).toBe('evolution');
    });

    test('should default to expertise pillar when no match', () => {
      const randomTopic = 'Random unrelated topic';
      
      expect(
        ContentGenerationService.getContentPillarForTopic(randomTopic, mockWorkshopData)
      ).toBe('expertise');
    });
  });

  describe('validateGeneratedContent', () => {
    test('should validate content meets quality standards', () => {
      const goodContent = 'This is a well-structured post about innovation that provides value to readers and includes a clear call to action. What are your thoughts?';
      const shortContent = 'Too short.';
      const noEngagementContent = 'Just stating facts without any engagement.';
      
      expect(
        ContentGenerationService.validateGeneratedContent(goodContent, 'post')
      ).toBe(true);
      
      expect(
        ContentGenerationService.validateGeneratedContent(shortContent, 'post')
      ).toBe(false);
      
      expect(
        ContentGenerationService.validateGeneratedContent(noEngagementContent, 'post')
      ).toBe(false);
    });

    test('should have different validation rules for articles', () => {
      const shortArticle = 'This is too short for an article.';
      const goodArticle = 'A'.repeat(500); // Long enough for article
      
      expect(
        ContentGenerationService.validateGeneratedContent(shortArticle, 'article')
      ).toBe(false);
      
      expect(
        ContentGenerationService.validateGeneratedContent(goodArticle, 'article')
      ).toBe(true);
    });
  });
});