const request = require('supertest');
const express = require('express');
const newsRoutes = require('../../api/routes/news');
const newsService = require('../../services/news');
const authMiddleware = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../services/news');
jest.mock('../../middleware/auth');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/news', newsRoutes);

// Mock authentication
authMiddleware.verifyToken.mockImplementation((req, res, next) => {
  req.user = { id: 'test-user-123', email: 'test@example.com' };
  next();
});

describe('News API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/news/feeds', () => {
    test('should add a new RSS/JSON feed', async () => {
      const feedData = {
        url: 'https://techcrunch.com/feed/',
        name: 'TechCrunch',
        type: 'rss',
        categories: ['technology', 'startups']
      };

      const mockFeed = {
        id: 'feed-123',
        ...feedData,
        userId: 'test-user-123',
        status: 'active',
        lastFetched: null,
        createdAt: new Date()
      };

      newsService.addFeed.mockResolvedValue(mockFeed);

      const response = await request(app)
        .post('/api/news/feeds')
        .set('Authorization', 'Bearer test-token')
        .send(feedData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        feed: mockFeed
      });
      expect(newsService.addFeed).toHaveBeenCalledWith('test-user-123', feedData);
    });

    test('should validate feed URL format', async () => {
      const response = await request(app)
        .post('/api/news/feeds')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'invalid-url',
          name: 'Test Feed',
          type: 'rss'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid feed URL'
      });
    });

    test('should validate feed type', async () => {
      const response = await request(app)
        .post('/api/news/feeds')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'https://example.com/feed',
          name: 'Test Feed',
          type: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid feed type. Must be "rss" or "json"'
      });
    });

    test('should handle duplicate feed URLs', async () => {
      newsService.addFeed.mockRejectedValue(new Error('Feed URL already exists'));

      const response = await request(app)
        .post('/api/news/feeds')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'https://example.com/feed',
          name: 'Test Feed',
          type: 'rss'
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        error: 'Feed URL already exists'
      });
    });
  });

  describe('GET /api/news/feeds', () => {
    test('should retrieve user feeds', async () => {
      const mockFeeds = [
        {
          id: 'feed-123',
          name: 'TechCrunch',
          url: 'https://techcrunch.com/feed/',
          type: 'rss',
          status: 'active',
          lastFetched: new Date('2025-01-01'),
          articleCount: 150
        },
        {
          id: 'feed-456',
          name: 'Product Hunt',
          url: 'https://api.producthunt.com/feed',
          type: 'json',
          status: 'active',
          lastFetched: new Date('2025-01-02'),
          articleCount: 75
        }
      ];

      newsService.getUserFeeds.mockResolvedValue(mockFeeds);

      const response = await request(app)
        .get('/api/news/feeds')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        feeds: mockFeeds
      });
      expect(newsService.getUserFeeds).toHaveBeenCalledWith('test-user-123');
    });

    test('should support filtering by status', async () => {
      newsService.getUserFeeds.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/news/feeds?status=inactive')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(newsService.getUserFeeds).toHaveBeenCalledWith('test-user-123', {
        status: 'inactive'
      });
    });
  });

  describe('DELETE /api/news/feeds/:feedId', () => {
    test('should delete a feed', async () => {
      newsService.deleteFeed.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/news/feeds/feed-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Feed deleted successfully'
      });
      expect(newsService.deleteFeed).toHaveBeenCalledWith('feed-123', 'test-user-123');
    });

    test('should handle feed not found', async () => {
      newsService.deleteFeed.mockRejectedValue(new Error('Feed not found'));

      const response = await request(app)
        .delete('/api/news/feeds/invalid-feed')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Feed not found'
      });
    });
  });

  describe('GET /api/news/articles', () => {
    test('should retrieve articles with relevance scores', async () => {
      const mockArticles = [
        {
          id: 'article-123',
          feedId: 'feed-123',
          title: 'AI Revolutionizes Content Creation',
          description: 'New AI tools are changing how content is created...',
          url: 'https://example.com/article1',
          publishedAt: new Date('2025-01-01'),
          relevanceScore: 0.92,
          matchedPillars: ['AI', 'Content Creation']
        },
        {
          id: 'article-456',
          feedId: 'feed-456',
          title: 'Startup Funding Reaches New Heights',
          description: 'VC funding hits record levels...',
          url: 'https://example.com/article2',
          publishedAt: new Date('2025-01-02'),
          relevanceScore: 0.75,
          matchedPillars: ['Entrepreneurship']
        }
      ];

      newsService.getArticles.mockResolvedValue({
        articles: mockArticles,
        total: 2,
        page: 1,
        limit: 20
      });

      const response = await request(app)
        .get('/api/news/articles')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.articles).toEqual(mockArticles);
      expect(newsService.getArticles).toHaveBeenCalledWith('test-user-123', {});
    });

    test('should support filtering by relevance threshold', async () => {
      newsService.getArticles.mockResolvedValue({
        articles: [],
        total: 0,
        page: 1,
        limit: 20
      });

      const response = await request(app)
        .get('/api/news/articles?minRelevance=0.8')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(newsService.getArticles).toHaveBeenCalledWith('test-user-123', {
        minRelevance: 0.8
      });
    });

    test('should support filtering by date range', async () => {
      newsService.getArticles.mockResolvedValue({
        articles: [],
        total: 0,
        page: 1,
        limit: 20
      });

      const response = await request(app)
        .get('/api/news/articles?startDate=2025-01-01&endDate=2025-01-31')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(newsService.getArticles).toHaveBeenCalledWith('test-user-123', {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      });
    });

    test('should support filtering by feed', async () => {
      newsService.getArticles.mockResolvedValue({
        articles: [],
        total: 0,
        page: 1,
        limit: 20
      });

      const response = await request(app)
        .get('/api/news/articles?feedId=feed-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(newsService.getArticles).toHaveBeenCalledWith('test-user-123', {
        feedId: 'feed-123'
      });
    });

    test('should support pagination', async () => {
      newsService.getArticles.mockResolvedValue({
        articles: [],
        total: 100,
        page: 2,
        limit: 20
      });

      const response = await request(app)
        .get('/api/news/articles?page=2&limit=20')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(newsService.getArticles).toHaveBeenCalledWith('test-user-123', {
        page: 2,
        limit: 20
      });
    });
  });

  describe('POST /api/news/articles/:articleId/relevance', () => {
    test('should update article relevance feedback', async () => {
      const feedbackData = {
        isRelevant: true,
        feedback: 'Very relevant to my AI content pillar'
      };

      newsService.updateRelevanceFeedback.mockResolvedValue({
        articleId: 'article-123',
        relevanceScore: 0.95,
        userFeedback: feedbackData
      });

      const response = await request(app)
        .post('/api/news/articles/article-123/relevance')
        .set('Authorization', 'Bearer test-token')
        .send(feedbackData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(newsService.updateRelevanceFeedback).toHaveBeenCalledWith(
        'article-123',
        'test-user-123',
        feedbackData
      );
    });

    test('should validate feedback data', async () => {
      const response = await request(app)
        .post('/api/news/articles/article-123/relevance')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'isRelevant field is required'
      });
    });
  });

  describe('POST /api/news/articles/:articleId/generate-ideas', () => {
    test('should generate content ideas from article', async () => {
      const mockIdeas = [
        {
          id: 'idea-123',
          type: 'thought_leadership',
          title: 'The Future of AI in Content Creation',
          hook: 'What if AI could understand your unique voice better than you do?',
          outline: [
            'Personal experience with AI tools',
            'Key insights from the article',
            'Implications for content creators',
            'Call to action'
          ],
          estimatedEngagement: 'high'
        },
        {
          id: 'idea-456',
          type: 'case_study',
          title: 'How We Increased Content Output 10x with AI',
          hook: 'Last month, we made a change that transformed our content strategy...',
          outline: [
            'The challenge we faced',
            'The AI solution we implemented',
            'Results and metrics',
            'Lessons learned'
          ],
          estimatedEngagement: 'medium'
        }
      ];

      newsService.generateContentIdeas.mockResolvedValue(mockIdeas);

      const response = await request(app)
        .post('/api/news/articles/article-123/generate-ideas')
        .set('Authorization', 'Bearer test-token')
        .send({ count: 2 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        ideas: mockIdeas
      });
      expect(newsService.generateContentIdeas).toHaveBeenCalledWith(
        'article-123',
        'test-user-123',
        { count: 2 }
      );
    });

    test('should validate idea count', async () => {
      const response = await request(app)
        .post('/api/news/articles/article-123/generate-ideas')
        .set('Authorization', 'Bearer test-token')
        .send({ count: 20 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Count must be between 1 and 10'
      });
    });

    test('should handle article not found', async () => {
      newsService.generateContentIdeas.mockRejectedValue(new Error('Article not found'));

      const response = await request(app)
        .post('/api/news/articles/invalid-article/generate-ideas')
        .set('Authorization', 'Bearer test-token')
        .send({ count: 3 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Article not found'
      });
    });

    test('should handle rate limiting for AI generation', async () => {
      newsService.generateContentIdeas.mockRejectedValue(
        new Error('Rate limit exceeded. Please try again in 60 seconds.')
      );

      const response = await request(app)
        .post('/api/news/articles/article-123/generate-ideas')
        .set('Authorization', 'Bearer test-token')
        .send({ count: 3 });

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'Rate limit exceeded. Please try again in 60 seconds.'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      newsService.getUserFeeds.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/news/feeds')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    test('should handle authentication errors', async () => {
      authMiddleware.verifyToken.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Invalid token' });
      });

      const response = await request(app)
        .get('/api/news/feeds');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });
  });
});