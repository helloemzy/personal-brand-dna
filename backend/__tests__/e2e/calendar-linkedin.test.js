const request = require('supertest');
const app = require('../../src/server');

describe('Content Calendar and LinkedIn Integration End-to-End Tests', () => {
  let authToken;
  let userId;
  let contentId;
  let scheduledPostId;

  beforeAll(async () => {
    // Create a test user and login
    const testUser = global.testUtils.generateTestUser();
    testUser.email = `calendar-test-${Date.now()}@example.com`;
    
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    userId = registerResponse.body.user.id;
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    authToken = loginResponse.body.token;

    // Generate some content to schedule
    const contentResponse = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        topic: 'The future of remote work',
        contentType: 'linkedin_post'
      });

    contentId = contentResponse.body.content.id;
  });

  describe('Content Calendar Management', () => {
    test('should create a scheduled post', async () => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 3); // 3 days from now
      scheduledDate.setHours(10, 0, 0, 0); // 10 AM

      const response = await request(app)
        .post('/api/calendar/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: contentId,
          scheduledFor: scheduledDate.toISOString(),
          platforms: ['linkedin'],
          timezone: 'America/New_York',
          publishSettings: {
            autoPublish: false,
            notifyBeforePublish: true,
            notificationMinutes: 30
          }
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        scheduledPost: {
          id: expect.any(String),
          contentId: contentId,
          scheduledFor: expect.any(String),
          status: 'scheduled',
          platforms: ['linkedin'],
          timezone: 'America/New_York'
        }
      });

      scheduledPostId = response.body.scheduledPost.id;
    });

    test('should get calendar view with scheduled posts', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // Next month

      const response = await request(app)
        .get('/api/calendar/view')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          view: 'month'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        calendar: {
          posts: expect.arrayContaining([
            expect.objectContaining({
              id: scheduledPostId,
              contentId: contentId
            })
          ]),
          summary: {
            totalPosts: expect.any(Number),
            byStatus: expect.any(Object),
            byPlatform: expect.any(Object)
          }
        }
      });
    });

    test('should reschedule a post', async () => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 5); // 5 days from now
      newDate.setHours(14, 30, 0, 0); // 2:30 PM

      const response = await request(app)
        .patch(`/api/calendar/schedule/${scheduledPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor: newDate.toISOString(),
          reason: 'Conflict with company announcement'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        scheduledPost: {
          id: scheduledPostId,
          scheduledFor: newDate.toISOString(),
          rescheduledCount: 1,
          history: expect.arrayContaining([
            expect.objectContaining({
              action: 'rescheduled',
              reason: 'Conflict with company announcement'
            })
          ])
        }
      });
    });

    test('should bulk schedule multiple posts', async () => {
      // First, generate more content
      const contentPromises = Array(5).fill(null).map((_, i) => 
        request(app)
          .post('/api/content/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            topic: `Leadership tip ${i + 1}`,
            contentType: 'linkedin_post'
          })
      );

      const contentResponses = await Promise.all(contentPromises);
      const contentIds = contentResponses.map(res => res.body.content.id);

      // Bulk schedule
      const response = await request(app)
        .post('/api/calendar/bulk-schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentIds: contentIds,
          schedulePattern: {
            startDate: new Date().toISOString(),
            frequency: 'weekdays',
            time: '09:00',
            timezone: 'America/New_York'
          },
          platforms: ['linkedin']
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        scheduledPosts: expect.any(Array),
        summary: {
          scheduled: 5,
          failed: 0
        }
      });

      expect(response.body.scheduledPosts).toHaveLength(5);
    });

    test('should detect and warn about scheduling conflicts', async () => {
      const conflictDate = new Date();
      conflictDate.setDate(conflictDate.getDate() + 5);
      conflictDate.setHours(14, 30, 0, 0);

      const response = await request(app)
        .post('/api/calendar/check-conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          proposedDate: conflictDate.toISOString(),
          platform: 'linkedin'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        hasConflicts: true,
        conflicts: expect.arrayContaining([
          expect.objectContaining({
            scheduledPostId: expect.any(String),
            scheduledFor: expect.any(String),
            type: 'same_time'
          })
        ]),
        suggestions: expect.any(Array)
      });
    });

    test('should get optimal posting times based on analytics', async () => {
      const response = await request(app)
        .get('/api/calendar/optimal-times')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          platform: 'linkedin',
          timezone: 'America/New_York'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        optimalTimes: {
          weekdays: expect.any(Array),
          weekends: expect.any(Array),
          bestDays: expect.any(Array),
          avoidTimes: expect.any(Array)
        },
        basedOn: {
          dataPoints: expect.any(Number),
          timeframe: expect.any(String)
        }
      });
    });
  });

  describe('Content Series and Campaigns', () => {
    test('should create a content series', async () => {
      const response = await request(app)
        .post('/api/calendar/series')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '30 Days of Leadership Lessons',
          description: 'Daily leadership insights for a month',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          frequency: 'daily',
          contentTemplate: {
            format: 'Day {number}: {topic}',
            hashtags: ['#30DaysOfLeadership', '#LeadershipLessons'],
            contentType: 'linkedin_post'
          },
          topics: Array(30).fill(null).map((_, i) => ({
            number: i + 1,
            topic: `Leadership lesson ${i + 1}`,
            notes: `Focus on ${['communication', 'delegation', 'vision', 'empathy'][i % 4]}`
          }))
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        series: {
          id: expect.any(String),
          name: '30 Days of Leadership Lessons',
          totalPosts: 30,
          status: 'draft'
        }
      });
    });

    test('should preview series schedule before activation', async () => {
      const seriesResponse = await request(app)
        .get('/api/calendar/series')
        .set('Authorization', `Bearer ${authToken}`);

      const seriesId = seriesResponse.body.series[0].id;

      const response = await request(app)
        .get(`/api/calendar/series/${seriesId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        preview: {
          posts: expect.any(Array),
          timeline: expect.any(Object),
          conflicts: expect.any(Array)
        }
      });

      expect(response.body.preview.posts).toHaveLength(30);
    });
  });

  describe('LinkedIn OAuth and Connection', () => {
    test('should initiate LinkedIn OAuth flow', async () => {
      const response = await request(app)
        .post('/api/linkedin/oauth/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          redirectUri: 'http://localhost:3000/linkedin/callback'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        authUrl: expect.stringContaining('linkedin.com/oauth'),
        state: expect.any(String)
      });
    });

    test('should handle LinkedIn OAuth callback', async () => {
      // Mock OAuth callback
      const response = await request(app)
        .post('/api/linkedin/oauth/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'mock-auth-code',
          state: 'mock-state'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        linkedinProfile: {
          connected: true,
          profileUrl: expect.any(String),
          name: expect.any(String)
        }
      });
    });

    test('should get LinkedIn connection status', async () => {
      const response = await request(app)
        .get('/api/linkedin/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        linkedin: {
          connected: expect.any(Boolean),
          profile: expect.any(Object),
          permissions: expect.any(Array)
        }
      });
    });
  });

  describe('LinkedIn Publishing Workflow', () => {
    test('should preview post before publishing', async () => {
      const response = await request(app)
        .post('/api/linkedin/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: contentId,
          publishOptions: {
            visibility: 'public',
            shareCommentary: 'Excited to share my thoughts on remote work!',
            includeHashtags: true
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        preview: {
          text: expect.any(String),
          estimatedReach: expect.any(Number),
          hashtags: expect.any(Array),
          characterCount: expect.any(Number),
          warnings: expect.any(Array)
        }
      });
    });

    test('should queue post for manual approval', async () => {
      const response = await request(app)
        .post('/api/linkedin/queue')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledPostId: scheduledPostId,
          requireApproval: true,
          approvalNotes: 'Please review for tone and messaging'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queuedPost: {
          id: expect.any(String),
          status: 'pending_approval',
          scheduledPostId: scheduledPostId
        }
      });
    });

    test('should approve and publish post', async () => {
      // Get queued post
      const queueResponse = await request(app)
        .get('/api/linkedin/queue')
        .set('Authorization', `Bearer ${authToken}`);

      const queuedPostId = queueResponse.body.queue[0].id;

      const response = await request(app)
        .post(`/api/linkedin/queue/${queuedPostId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          publishImmediately: false,
          edits: {
            text: 'Updated text after review'
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        post: {
          id: queuedPostId,
          status: 'approved',
          editHistory: expect.any(Array)
        }
      });
    });

    test('should handle publishing errors gracefully', async () => {
      const response = await request(app)
        .post('/api/linkedin/publish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: 'invalid-content-id'
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Content not found')
      });
    });
  });

  describe('Analytics and Performance Tracking', () => {
    test('should sync LinkedIn post analytics', async () => {
      const response = await request(app)
        .post('/api/linkedin/analytics/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postIds: ['mock-linkedin-post-1', 'mock-linkedin-post-2']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        synced: expect.any(Number),
        analytics: expect.any(Array)
      });
    });

    test('should get calendar performance overview', async () => {
      const response = await request(app)
        .get('/api/calendar/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: '30d'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        analytics: {
          publishedPosts: expect.any(Number),
          scheduledPosts: expect.any(Number),
          completionRate: expect.any(Number),
          bestPerformingDays: expect.any(Array),
          bestPerformingTimes: expect.any(Array),
          contentTypePerformance: expect.any(Object)
        }
      });
    });

    test('should get content series performance', async () => {
      const seriesResponse = await request(app)
        .get('/api/calendar/series')
        .set('Authorization', `Bearer ${authToken}`);

      if (seriesResponse.body.series.length > 0) {
        const seriesId = seriesResponse.body.series[0].id;

        const response = await request(app)
          .get(`/api/calendar/series/${seriesId}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          analytics: {
            seriesId: seriesId,
            completedPosts: expect.any(Number),
            totalEngagement: expect.any(Number),
            averageEngagementPerPost: expect.any(Number),
            topPerformingPosts: expect.any(Array),
            audienceGrowth: expect.any(Number)
          }
        });
      }
    });
  });

  describe('Calendar Export and Integration', () => {
    test('should export calendar to iCal format', async () => {
      const response = await request(app)
        .get('/api/calendar/export/ical')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/calendar');
      expect(response.text).toContain('BEGIN:VCALENDAR');
      expect(response.text).toContain('BEGIN:VEVENT');
    });

    test('should provide Google Calendar integration URL', async () => {
      const response = await request(app)
        .post('/api/calendar/integrate/google')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          calendarId: 'primary',
          syncDirection: 'one-way'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        integrationUrl: expect.stringContaining('google.com/calendar'),
        instructions: expect.any(Array)
      });
    });
  });

  describe('Content Calendar Templates', () => {
    test('should get available calendar templates', async () => {
      const response = await request(app)
        .get('/api/calendar/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        templates: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            frequency: expect.any(String),
            contentMix: expect.any(Object)
          })
        ])
      });
    });

    test('should apply calendar template', async () => {
      const templatesResponse = await request(app)
        .get('/api/calendar/templates')
        .set('Authorization', `Bearer ${authToken}`);

      const templateId = templatesResponse.body.templates[0].id;

      const response = await request(app)
        .post('/api/calendar/apply-template')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateId: templateId,
          startDate: new Date().toISOString(),
          duration: '30d',
          customizations: {
            postingTimes: ['09:00', '14:00'],
            skipWeekends: false
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        applied: {
          templateId: templateId,
          postsCreated: expect.any(Number),
          schedule: expect.any(Array)
        }
      });
    });
  });

  describe('Cleanup and Disconnection', () => {
    test('should disconnect LinkedIn account', async () => {
      const response = await request(app)
        .post('/api/linkedin/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Testing disconnection',
          deletePostHistory: false
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'LinkedIn account disconnected',
        dataRetained: true
      });
    });

    test('should clear calendar for date range', async () => {
      const response = await request(app)
        .delete('/api/calendar/clear')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: ['scheduled', 'draft']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        cleared: {
          posts: expect.any(Number),
          series: expect.any(Number)
        }
      });
    });
  });
});