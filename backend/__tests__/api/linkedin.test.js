const request = require('supertest');
const express = require('express');
const linkedinRoutes = require('../../api/routes/linkedin');
const linkedinService = require('../../services/linkedin');
const authMiddleware = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../services/linkedin');
jest.mock('../../middleware/auth');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/linkedin', linkedinRoutes);

// Mock authentication
authMiddleware.verifyToken.mockImplementation((req, res, next) => {
  req.user = { id: 'test-user-123', email: 'test@example.com' };
  next();
});

describe('LinkedIn API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/linkedin/auth', () => {
    test('should generate LinkedIn OAuth authorization URL', async () => {
      const mockAuthUrl = 'https://www.linkedin.com/oauth/v2/authorization?client_id=test&redirect_uri=http://localhost:3000/api/linkedin/callback&response_type=code&scope=r_liteprofile%20w_member_social&state=test-state-123';

      linkedinService.generateAuthUrl.mockResolvedValue({
        url: mockAuthUrl,
        state: 'test-state-123'
      });

      const response = await request(app)
        .get('/api/linkedin/auth')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        authUrl: mockAuthUrl,
        state: 'test-state-123'
      });
      expect(linkedinService.generateAuthUrl).toHaveBeenCalledWith('test-user-123');
    });

    test('should handle missing LinkedIn configuration', async () => {
      linkedinService.generateAuthUrl.mockRejectedValue(
        new Error('LinkedIn OAuth not configured')
      );

      const response = await request(app)
        .get('/api/linkedin/auth')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'LinkedIn OAuth not configured'
      });
    });
  });

  describe('GET /api/linkedin/callback', () => {
    test('should handle OAuth callback and connect account', async () => {
      const mockProfile = {
        id: 'li-user-123',
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer',
        profilePicture: 'https://example.com/pic.jpg'
      };

      linkedinService.handleCallback.mockResolvedValue({
        success: true,
        profile: mockProfile,
        connected: true
      });

      const response = await request(app)
        .get('/api/linkedin/callback?code=auth-code-123&state=test-state-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        profile: mockProfile,
        message: 'LinkedIn account connected successfully'
      });
      expect(linkedinService.handleCallback).toHaveBeenCalledWith(
        'test-user-123',
        'auth-code-123',
        'test-state-123'
      );
    });

    test('should validate required parameters', async () => {
      const response = await request(app)
        .get('/api/linkedin/callback')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Missing required parameters: code and state'
      });
    });

    test('should handle invalid state parameter', async () => {
      linkedinService.handleCallback.mockRejectedValue(
        new Error('Invalid state parameter')
      );

      const response = await request(app)
        .get('/api/linkedin/callback?code=auth-code-123&state=invalid-state')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid state parameter'
      });
    });

    test('should handle OAuth errors', async () => {
      const response = await request(app)
        .get('/api/linkedin/callback?error=access_denied&error_description=User+cancelled+authorization')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'LinkedIn authorization failed: User cancelled authorization'
      });
    });
  });

  describe('POST /api/linkedin/disconnect', () => {
    test('should disconnect LinkedIn account', async () => {
      linkedinService.disconnectAccount.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/linkedin/disconnect')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'LinkedIn account disconnected successfully'
      });
      expect(linkedinService.disconnectAccount).toHaveBeenCalledWith('test-user-123');
    });

    test('should handle account not connected', async () => {
      linkedinService.disconnectAccount.mockRejectedValue(
        new Error('No LinkedIn account connected')
      );

      const response = await request(app)
        .post('/api/linkedin/disconnect')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'No LinkedIn account connected'
      });
    });
  });

  describe('GET /api/linkedin/status', () => {
    test('should return connection status', async () => {
      const mockStatus = {
        connected: true,
        profile: {
          id: 'li-user-123',
          firstName: 'John',
          lastName: 'Doe',
          headline: 'Software Engineer'
        },
        permissions: ['r_liteprofile', 'w_member_social'],
        lastSync: new Date('2025-01-01T10:00:00Z'),
        tokenExpiry: new Date('2025-03-01T10:00:00Z')
      };

      linkedinService.getConnectionStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/linkedin/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: mockStatus
      });
      expect(linkedinService.getConnectionStatus).toHaveBeenCalledWith('test-user-123');
    });

    test('should handle not connected status', async () => {
      linkedinService.getConnectionStatus.mockResolvedValue({
        connected: false,
        profile: null,
        permissions: [],
        lastSync: null,
        tokenExpiry: null
      });

      const response = await request(app)
        .get('/api/linkedin/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.status.connected).toBe(false);
    });
  });

  describe('POST /api/linkedin/queue', () => {
    test('should add post to publishing queue', async () => {
      const postData = {
        content: 'Check out this amazing AI breakthrough! 🚀',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            description: 'AI visualization'
          }
        ],
        visibility: 'PUBLIC'
      };

      const mockQueueItem = {
        id: 'queue-123',
        ...postData,
        userId: 'test-user-123',
        status: 'pending',
        scheduledFor: null,
        createdAt: new Date()
      };

      linkedinService.addToQueue.mockResolvedValue(mockQueueItem);

      const response = await request(app)
        .post('/api/linkedin/queue')
        .set('Authorization', 'Bearer test-token')
        .send(postData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        queueItem: mockQueueItem
      });
      expect(linkedinService.addToQueue).toHaveBeenCalledWith('test-user-123', postData);
    });

    test('should validate content length', async () => {
      const response = await request(app)
        .post('/api/linkedin/queue')
        .set('Authorization', 'Bearer test-token')
        .send({
          content: 'a'.repeat(3001) // Exceeds LinkedIn's 3000 character limit
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Content exceeds LinkedIn\'s 3000 character limit'
      });
    });

    test('should validate media format', async () => {
      const response = await request(app)
        .post('/api/linkedin/queue')
        .set('Authorization', 'Bearer test-token')
        .send({
          content: 'Test post',
          media: [
            {
              type: 'invalid',
              url: 'https://example.com/file.pdf'
            }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid media type. Supported types: image, video, article'
      });
    });

    test('should support scheduled posting', async () => {
      const postData = {
        content: 'Scheduled post for next week',
        scheduledFor: '2025-02-01T10:00:00Z'
      };

      linkedinService.addToQueue.mockResolvedValue({
        id: 'queue-123',
        ...postData,
        status: 'scheduled'
      });

      const response = await request(app)
        .post('/api/linkedin/queue')
        .set('Authorization', 'Bearer test-token')
        .send(postData);

      expect(response.status).toBe(201);
      expect(response.body.queueItem.status).toBe('scheduled');
    });
  });

  describe('GET /api/linkedin/queue', () => {
    test('should retrieve publishing queue', async () => {
      const mockQueue = [
        {
          id: 'queue-123',
          content: 'Post 1',
          status: 'pending',
          createdAt: new Date('2025-01-01')
        },
        {
          id: 'queue-456',
          content: 'Post 2',
          status: 'approved',
          scheduledFor: new Date('2025-02-01'),
          createdAt: new Date('2025-01-02')
        }
      ];

      linkedinService.getQueue.mockResolvedValue({
        items: mockQueue,
        total: 2
      });

      const response = await request(app)
        .get('/api/linkedin/queue')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        queue: mockQueue,
        total: 2
      });
      expect(linkedinService.getQueue).toHaveBeenCalledWith('test-user-123', {});
    });

    test('should support filtering by status', async () => {
      linkedinService.getQueue.mockResolvedValue({
        items: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/linkedin/queue?status=pending')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(linkedinService.getQueue).toHaveBeenCalledWith('test-user-123', {
        status: 'pending'
      });
    });

    test('should support pagination', async () => {
      linkedinService.getQueue.mockResolvedValue({
        items: [],
        total: 50,
        page: 2,
        limit: 20
      });

      const response = await request(app)
        .get('/api/linkedin/queue?page=2&limit=20')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(linkedinService.getQueue).toHaveBeenCalledWith('test-user-123', {
        page: 2,
        limit: 20
      });
    });
  });

  describe('PUT /api/linkedin/queue/:id/approve', () => {
    test('should approve queued post', async () => {
      const mockApprovedItem = {
        id: 'queue-123',
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: 'test-user-123'
      };

      linkedinService.approveQueueItem.mockResolvedValue(mockApprovedItem);

      const response = await request(app)
        .put('/api/linkedin/queue/queue-123/approve')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        queueItem: mockApprovedItem
      });
      expect(linkedinService.approveQueueItem).toHaveBeenCalledWith(
        'queue-123',
        'test-user-123'
      );
    });

    test('should handle item not found', async () => {
      linkedinService.approveQueueItem.mockRejectedValue(new Error('Queue item not found'));

      const response = await request(app)
        .put('/api/linkedin/queue/invalid-id/approve')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Queue item not found'
      });
    });

    test('should handle already processed items', async () => {
      linkedinService.approveQueueItem.mockRejectedValue(
        new Error('Item already published')
      );

      const response = await request(app)
        .put('/api/linkedin/queue/queue-123/approve')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Item already published'
      });
    });
  });

  describe('PUT /api/linkedin/queue/:id/reject', () => {
    test('should reject queued post', async () => {
      const rejectData = {
        reason: 'Content needs revision - tone is too promotional'
      };

      const mockRejectedItem = {
        id: 'queue-123',
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: 'test-user-123',
        rejectionReason: rejectData.reason
      };

      linkedinService.rejectQueueItem.mockResolvedValue(mockRejectedItem);

      const response = await request(app)
        .put('/api/linkedin/queue/queue-123/reject')
        .set('Authorization', 'Bearer test-token')
        .send(rejectData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        queueItem: mockRejectedItem
      });
      expect(linkedinService.rejectQueueItem).toHaveBeenCalledWith(
        'queue-123',
        'test-user-123',
        rejectData.reason
      );
    });

    test('should require rejection reason', async () => {
      const response = await request(app)
        .put('/api/linkedin/queue/queue-123/reject')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Rejection reason is required'
      });
    });
  });

  describe('POST /api/linkedin/publish/:id', () => {
    test('should publish approved post to LinkedIn', async () => {
      const mockPublishedPost = {
        id: 'queue-123',
        status: 'published',
        publishedAt: new Date(),
        linkedinPostId: 'urn:li:share:123456',
        linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:share:123456'
      };

      linkedinService.publishPost.mockResolvedValue(mockPublishedPost);

      const response = await request(app)
        .post('/api/linkedin/publish/queue-123')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        post: mockPublishedPost
      });
      expect(linkedinService.publishPost).toHaveBeenCalledWith('queue-123', 'test-user-123');
    });

    test('should handle unapproved posts', async () => {
      linkedinService.publishPost.mockRejectedValue(
        new Error('Post must be approved before publishing')
      );

      const response = await request(app)
        .post('/api/linkedin/publish/queue-123')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Post must be approved before publishing'
      });
    });

    test('should handle LinkedIn API errors', async () => {
      linkedinService.publishPost.mockRejectedValue(
        new Error('LinkedIn API error: Invalid access token')
      );

      const response = await request(app)
        .post('/api/linkedin/publish/queue-123')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'LinkedIn API error: Invalid access token'
      });
    });

    test('should handle rate limiting', async () => {
      linkedinService.publishPost.mockRejectedValue(
        new Error('LinkedIn rate limit exceeded. Try again in 3600 seconds.')
      );

      const response = await request(app)
        .post('/api/linkedin/publish/queue-123')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'LinkedIn rate limit exceeded. Try again in 3600 seconds.',
        retryAfter: 3600
      });
    });
  });

  describe('GET /api/linkedin/analytics', () => {
    test('should retrieve post analytics', async () => {
      const mockAnalytics = {
        posts: [
          {
            id: 'queue-123',
            linkedinPostId: 'urn:li:share:123456',
            publishedAt: new Date('2025-01-01'),
            metrics: {
              impressions: 1500,
              clicks: 45,
              likes: 23,
              comments: 5,
              shares: 3,
              engagementRate: 0.035
            }
          }
        ],
        summary: {
          totalPosts: 10,
          totalImpressions: 15000,
          totalEngagement: 500,
          avgEngagementRate: 0.033
        }
      };

      linkedinService.getAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/linkedin/analytics')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        analytics: mockAnalytics
      });
      expect(linkedinService.getAnalytics).toHaveBeenCalledWith('test-user-123', {});
    });

    test('should support date range filtering', async () => {
      linkedinService.getAnalytics.mockResolvedValue({
        posts: [],
        summary: {}
      });

      const response = await request(app)
        .get('/api/linkedin/analytics?startDate=2025-01-01&endDate=2025-01-31')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(linkedinService.getAnalytics).toHaveBeenCalledWith('test-user-123', {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      });
    });

    test('should support post-specific analytics', async () => {
      linkedinService.getAnalytics.mockResolvedValue({
        posts: [],
        summary: {}
      });

      const response = await request(app)
        .get('/api/linkedin/analytics?postId=queue-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(linkedinService.getAnalytics).toHaveBeenCalledWith('test-user-123', {
        postId: 'queue-123'
      });
    });
  });

  describe('GET /api/linkedin/limits', () => {
    test('should retrieve rate limit status', async () => {
      const mockLimits = {
        daily: {
          posts: { used: 5, limit: 10, remaining: 5 },
          connections: { used: 20, limit: 100, remaining: 80 }
        },
        hourly: {
          posts: { used: 2, limit: 5, remaining: 3 },
          api: { used: 45, limit: 100, remaining: 55 }
        },
        resetTimes: {
          daily: new Date('2025-01-02T00:00:00Z'),
          hourly: new Date('2025-01-01T15:00:00Z')
        }
      };

      linkedinService.getRateLimits.mockResolvedValue(mockLimits);

      const response = await request(app)
        .get('/api/linkedin/limits')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        limits: mockLimits
      });
      expect(linkedinService.getRateLimits).toHaveBeenCalledWith('test-user-123');
    });

    test('should indicate when limits are exceeded', async () => {
      const mockLimits = {
        daily: {
          posts: { used: 10, limit: 10, remaining: 0 }
        },
        canPost: false,
        nextPostTime: new Date('2025-01-02T00:00:00Z')
      };

      linkedinService.getRateLimits.mockResolvedValue(mockLimits);

      const response = await request(app)
        .get('/api/linkedin/limits')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.limits.canPost).toBe(false);
    });
  });

  describe('Security & Error Handling', () => {
    test('should require authentication for all endpoints', async () => {
      authMiddleware.verifyToken.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/linkedin/status');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    test('should handle service unavailability', async () => {
      linkedinService.getConnectionStatus.mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      const response = await request(app)
        .get('/api/linkedin/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: 'Service temporarily unavailable'
      });
    });

    test('should sanitize error messages', async () => {
      linkedinService.publishPost.mockRejectedValue(
        new Error('Database connection failed: Connection string contains password')
      );

      const response = await request(app)
        .post('/api/linkedin/publish/queue-123')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });
  });
});