const request = require('supertest');
const express = require('express');
const calendarRoutes = require('../../api/routes/calendar');
const calendarService = require('../../services/calendar');
const authMiddleware = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../services/calendar');
jest.mock('../../middleware/auth');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/calendar', calendarRoutes);

// Mock authentication
authMiddleware.verifyToken.mockImplementation((req, res, next) => {
  req.user = { id: 'test-user-123', email: 'test@example.com' };
  next();
});

describe('Calendar API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/calendar/events', () => {
    test('should create a new calendar event', async () => {
      const eventData = {
        title: 'LinkedIn Post: AI in Marketing',
        content: 'AI is transforming how we approach marketing...',
        scheduledFor: '2025-02-01T10:00:00Z',
        type: 'linkedin_post',
        tags: ['AI', 'Marketing'],
        contentPillars: ['Technology', 'Innovation']
      };

      const mockEvent = {
        id: 'event-123',
        ...eventData,
        userId: 'test-user-123',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      calendarService.createEvent.mockResolvedValue(mockEvent);

      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        event: mockEvent
      });
      expect(calendarService.createEvent).toHaveBeenCalledWith('test-user-123', eventData);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: 'Test Event'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields: content, scheduledFor'
      });
    });

    test('should validate scheduledFor date', async () => {
      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: 'Test Event',
          content: 'Test content',
          scheduledFor: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid date format for scheduledFor'
      });
    });

    test('should prevent scheduling in the past', async () => {
      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: 'Test Event',
          content: 'Test content',
          scheduledFor: '2020-01-01T10:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Cannot schedule events in the past'
      });
    });

    test('should validate event type', async () => {
      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: 'Test Event',
          content: 'Test content',
          scheduledFor: '2025-02-01T10:00:00Z',
          type: 'invalid_type'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid event type'
      });
    });
  });

  describe('GET /api/calendar/events', () => {
    test('should retrieve calendar events', async () => {
      const mockEvents = [
        {
          id: 'event-123',
          title: 'LinkedIn Post: AI in Marketing',
          scheduledFor: '2025-02-01T10:00:00Z',
          status: 'scheduled',
          type: 'linkedin_post'
        },
        {
          id: 'event-456',
          title: 'Article: Future of Work',
          scheduledFor: '2025-02-05T14:00:00Z',
          status: 'draft',
          type: 'article'
        }
      ];

      calendarService.getEvents.mockResolvedValue({
        events: mockEvents,
        total: 2
      });

      const response = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        events: mockEvents,
        total: 2
      });
      expect(calendarService.getEvents).toHaveBeenCalledWith('test-user-123', {});
    });

    test('should support date range filtering', async () => {
      calendarService.getEvents.mockResolvedValue({
        events: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/calendar/events?startDate=2025-02-01&endDate=2025-02-28')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(calendarService.getEvents).toHaveBeenCalledWith('test-user-123', {
        startDate: '2025-02-01',
        endDate: '2025-02-28'
      });
    });

    test('should support status filtering', async () => {
      calendarService.getEvents.mockResolvedValue({
        events: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/calendar/events?status=scheduled')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(calendarService.getEvents).toHaveBeenCalledWith('test-user-123', {
        status: 'scheduled'
      });
    });

    test('should support type filtering', async () => {
      calendarService.getEvents.mockResolvedValue({
        events: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/calendar/events?type=linkedin_post')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(calendarService.getEvents).toHaveBeenCalledWith('test-user-123', {
        type: 'linkedin_post'
      });
    });

    test('should support view modes', async () => {
      calendarService.getEvents.mockResolvedValue({
        events: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/calendar/events?view=month&date=2025-02-01')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(calendarService.getEvents).toHaveBeenCalledWith('test-user-123', {
        view: 'month',
        date: '2025-02-01'
      });
    });
  });

  describe('PUT /api/calendar/events/:eventId', () => {
    test('should update calendar event', async () => {
      const updateData = {
        title: 'Updated: LinkedIn Post on AI',
        content: 'Updated content...',
        scheduledFor: '2025-02-02T10:00:00Z',
        status: 'draft'
      };

      const mockUpdatedEvent = {
        id: 'event-123',
        ...updateData,
        updatedAt: new Date()
      };

      calendarService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const response = await request(app)
        .put('/api/calendar/events/event-123')
        .set('Authorization', 'Bearer test-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        event: mockUpdatedEvent
      });
      expect(calendarService.updateEvent).toHaveBeenCalledWith(
        'event-123',
        'test-user-123',
        updateData
      );
    });

    test('should handle event not found', async () => {
      calendarService.updateEvent.mockRejectedValue(new Error('Event not found'));

      const response = await request(app)
        .put('/api/calendar/events/invalid-event')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Event not found'
      });
    });

    test('should prevent updating published events', async () => {
      calendarService.updateEvent.mockRejectedValue(
        new Error('Cannot update published events')
      );

      const response = await request(app)
        .put('/api/calendar/events/event-123')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Cannot update published events'
      });
    });

    test('should validate update data', async () => {
      const response = await request(app)
        .put('/api/calendar/events/event-123')
        .set('Authorization', 'Bearer test-token')
        .send({ scheduledFor: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid date format for scheduledFor'
      });
    });
  });

  describe('DELETE /api/calendar/events/:eventId', () => {
    test('should delete calendar event', async () => {
      calendarService.deleteEvent.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/calendar/events/event-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Event deleted successfully'
      });
      expect(calendarService.deleteEvent).toHaveBeenCalledWith('event-123', 'test-user-123');
    });

    test('should handle event not found', async () => {
      calendarService.deleteEvent.mockRejectedValue(new Error('Event not found'));

      const response = await request(app)
        .delete('/api/calendar/events/invalid-event')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Event not found'
      });
    });

    test('should prevent deleting published events', async () => {
      calendarService.deleteEvent.mockRejectedValue(
        new Error('Cannot delete published events')
      );

      const response = await request(app)
        .delete('/api/calendar/events/event-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Cannot delete published events'
      });
    });
  });

  describe('POST /api/calendar/events/batch', () => {
    test('should create multiple events', async () => {
      const batchData = {
        events: [
          {
            title: 'Post 1',
            content: 'Content 1',
            scheduledFor: '2025-02-01T10:00:00Z',
            type: 'linkedin_post'
          },
          {
            title: 'Post 2',
            content: 'Content 2',
            scheduledFor: '2025-02-03T10:00:00Z',
            type: 'linkedin_post'
          },
          {
            title: 'Article 1',
            content: 'Long form content',
            scheduledFor: '2025-02-05T14:00:00Z',
            type: 'article'
          }
        ]
      };

      const mockCreatedEvents = batchData.events.map((event, index) => ({
        id: `event-${index + 1}`,
        ...event,
        userId: 'test-user-123',
        status: 'scheduled',
        createdAt: new Date()
      }));

      calendarService.createBatchEvents.mockResolvedValue({
        created: mockCreatedEvents,
        failed: []
      });

      const response = await request(app)
        .post('/api/calendar/events/batch')
        .set('Authorization', 'Bearer test-token')
        .send(batchData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        created: mockCreatedEvents,
        failed: []
      });
      expect(calendarService.createBatchEvents).toHaveBeenCalledWith(
        'test-user-123',
        batchData.events
      );
    });

    test('should handle partial failures', async () => {
      const batchData = {
        events: [
          {
            title: 'Valid Post',
            content: 'Content',
            scheduledFor: '2025-02-01T10:00:00Z'
          },
          {
            title: 'Invalid Post',
            // Missing required fields
          }
        ]
      };

      calendarService.createBatchEvents.mockResolvedValue({
        created: [{
          id: 'event-1',
          title: 'Valid Post',
          content: 'Content',
          scheduledFor: '2025-02-01T10:00:00Z'
        }],
        failed: [{
          index: 1,
          error: 'Missing required fields: content, scheduledFor'
        }]
      });

      const response = await request(app)
        .post('/api/calendar/events/batch')
        .set('Authorization', 'Bearer test-token')
        .send(batchData);

      expect(response.status).toBe(207); // Multi-status
      expect(response.body.success).toBe(true);
      expect(response.body.created).toHaveLength(1);
      expect(response.body.failed).toHaveLength(1);
    });

    test('should validate batch size', async () => {
      const batchData = {
        events: new Array(51).fill({
          title: 'Post',
          content: 'Content',
          scheduledFor: '2025-02-01T10:00:00Z'
        })
      };

      const response = await request(app)
        .post('/api/calendar/events/batch')
        .set('Authorization', 'Bearer test-token')
        .send(batchData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Batch size cannot exceed 50 events'
      });
    });
  });

  describe('POST /api/calendar/events/:eventId/publish', () => {
    test('should publish event to LinkedIn', async () => {
      const mockPublishedEvent = {
        id: 'event-123',
        status: 'published',
        publishedAt: new Date(),
        linkedinPostId: 'li-post-123'
      };

      calendarService.publishEvent.mockResolvedValue(mockPublishedEvent);

      const response = await request(app)
        .post('/api/calendar/events/event-123/publish')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        event: mockPublishedEvent
      });
      expect(calendarService.publishEvent).toHaveBeenCalledWith('event-123', 'test-user-123');
    });

    test('should handle LinkedIn not connected', async () => {
      calendarService.publishEvent.mockRejectedValue(
        new Error('LinkedIn account not connected')
      );

      const response = await request(app)
        .post('/api/calendar/events/event-123/publish')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'LinkedIn account not connected'
      });
    });

    test('should handle already published events', async () => {
      calendarService.publishEvent.mockRejectedValue(
        new Error('Event already published')
      );

      const response = await request(app)
        .post('/api/calendar/events/event-123/publish')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Event already published'
      });
    });

    test('should handle rate limiting', async () => {
      calendarService.publishEvent.mockRejectedValue(
        new Error('LinkedIn rate limit exceeded')
      );

      const response = await request(app)
        .post('/api/calendar/events/event-123/publish')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'LinkedIn rate limit exceeded'
      });
    });
  });

  describe('Recurring Events', () => {
    test('should create recurring events', async () => {
      const recurringData = {
        title: 'Weekly AI Update',
        content: 'Template content',
        scheduledFor: '2025-02-01T10:00:00Z',
        type: 'linkedin_post',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['monday', 'wednesday', 'friday'],
          endDate: '2025-03-01'
        }
      };

      const mockEvents = [
        { id: 'event-1', scheduledFor: '2025-02-03T10:00:00Z' },
        { id: 'event-2', scheduledFor: '2025-02-05T10:00:00Z' },
        { id: 'event-3', scheduledFor: '2025-02-07T10:00:00Z' }
      ];

      calendarService.createRecurringEvent.mockResolvedValue(mockEvents);

      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send(recurringData);

      expect(response.status).toBe(201);
      expect(response.body.events).toHaveLength(3);
    });

    test('should validate recurrence rules', async () => {
      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: 'Test',
          content: 'Content',
          scheduledFor: '2025-02-01T10:00:00Z',
          recurrence: {
            frequency: 'invalid',
            interval: 0
          }
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid recurrence configuration'
      });
    });
  });
});