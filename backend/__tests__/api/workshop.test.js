const request = require('supertest');
const express = require('express');
const workshopRoutes = require('../../api/routes/workshop');
const workshopService = require('../../services/workshop');
const authMiddleware = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../services/workshop');
jest.mock('../../middleware/auth');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/workshop', workshopRoutes);

// Mock authentication
authMiddleware.verifyToken.mockImplementation((req, res, next) => {
  req.user = { id: 'test-user-123', email: 'test@example.com' };
  next();
});

describe('Workshop API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/workshop/start', () => {
    test('should start a new workshop session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'test-user-123',
        status: 'in_progress',
        currentStep: 'values_audit',
        data: {},
        createdAt: new Date()
      };

      workshopService.startWorkshop.mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        session: mockSession
      });
      expect(workshopService.startWorkshop).toHaveBeenCalledWith('test-user-123');
    });

    test('should handle service errors', async () => {
      workshopService.startWorkshop.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to start workshop session'
      });
    });

    test('should require authentication', async () => {
      authMiddleware.verifyToken.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/workshop/start')
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/workshop/session/:sessionId', () => {
    test('should retrieve workshop session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'test-user-123',
        status: 'in_progress',
        currentStep: 'tone_preferences',
        data: {
          values: ['Innovation', 'Leadership', 'Growth']
        }
      };

      workshopService.getSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/workshop/session/session-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        session: mockSession
      });
      expect(workshopService.getSession).toHaveBeenCalledWith('session-123', 'test-user-123');
    });

    test('should handle session not found', async () => {
      workshopService.getSession.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/workshop/session/invalid-session')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Session not found'
      });
    });

    test('should validate sessionId format', async () => {
      const response = await request(app)
        .get('/api/workshop/session/123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid session ID format'
      });
    });
  });

  describe('POST /api/workshop/session/:sessionId/save', () => {
    test('should save workshop progress', async () => {
      const updateData = {
        currentStep: 'audience_builder',
        data: {
          values: ['Innovation', 'Leadership', 'Growth'],
          tonePreferences: {
            professional: 80,
            casual: 20,
            authoritative: 60,
            friendly: 40
          }
        }
      };

      workshopService.saveProgress.mockResolvedValue({
        id: 'session-123',
        ...updateData,
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/api/workshop/session/session-123/save')
        .set('Authorization', 'Bearer test-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(workshopService.saveProgress).toHaveBeenCalledWith(
        'session-123',
        'test-user-123',
        updateData
      );
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/workshop/session/session-123/save')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields: currentStep or data'
      });
    });

    test('should validate step values', async () => {
      const response = await request(app)
        .post('/api/workshop/session/session-123/save')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 'invalid_step',
          data: {}
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid workshop step'
      });
    });
  });

  describe('POST /api/workshop/session/:sessionId/complete', () => {
    test('should complete workshop session', async () => {
      const completedSession = {
        id: 'session-123',
        status: 'completed',
        voiceProfile: {
          values: ['Innovation', 'Leadership', 'Growth'],
          tonePreferences: { professional: 80, casual: 20 },
          audiencePersonas: [{ name: 'Tech Leaders', industry: 'Technology' }],
          writingStyle: { clarity: 90, technical: 70 },
          personality: { type: 'ENTJ', traits: ['Strategic', 'Decisive'] }
        }
      };

      workshopService.completeWorkshop.mockResolvedValue(completedSession);

      const response = await request(app)
        .post('/api/workshop/session/session-123/complete')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        session: completedSession,
        voiceProfile: completedSession.voiceProfile
      });
      expect(workshopService.completeWorkshop).toHaveBeenCalledWith('session-123', 'test-user-123');
    });

    test('should handle incomplete session', async () => {
      workshopService.completeWorkshop.mockRejectedValue(
        new Error('Session incomplete: Missing required steps')
      );

      const response = await request(app)
        .post('/api/workshop/session/session-123/complete')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Session incomplete: Missing required steps'
      });
    });
  });

  describe('GET /api/workshop/sessions', () => {
    test('should list all user workshop sessions', async () => {
      const mockSessions = [
        {
          id: 'session-123',
          status: 'completed',
          createdAt: new Date('2025-01-01'),
          completedAt: new Date('2025-01-01')
        },
        {
          id: 'session-456',
          status: 'in_progress',
          createdAt: new Date('2025-01-02'),
          currentStep: 'tone_preferences'
        }
      ];

      workshopService.getUserSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/workshop/sessions')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        sessions: mockSessions
      });
      expect(workshopService.getUserSessions).toHaveBeenCalledWith('test-user-123');
    });

    test('should support pagination', async () => {
      workshopService.getUserSessions.mockResolvedValue({
        sessions: [],
        total: 20,
        page: 2,
        limit: 10
      });

      const response = await request(app)
        .get('/api/workshop/sessions?page=2&limit=10')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(workshopService.getUserSessions).toHaveBeenCalledWith('test-user-123', {
        page: 2,
        limit: 10
      });
    });

    test('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/workshop/sessions?page=-1&limit=1000')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid pagination parameters'
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // Mock rate limiter
      const rateLimiter = require('../../middleware/rateLimiter');
      jest.mock('../../middleware/rateLimiter');
      
      rateLimiter.workshopLimiter = jest.fn((req, res) => {
        res.status(429).json({ error: 'Too many requests' });
      });

      const response = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(429);
      expect(response.body).toEqual({ error: 'Too many requests' });
    });
  });
});