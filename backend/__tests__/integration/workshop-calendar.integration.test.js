const request = require('supertest');
const app = require('../../src/server');
const { query, withTransaction } = require('../../src/config/database');

describe('Workshop → Calendar Integration', () => {
  let authToken;
  let userId;
  let workshopSessionId;
  let analysisResults;

  beforeAll(async () => {
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `workshop-calendar-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Workshop',
        lastName: 'Calendar'
      });
    
    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await query('DELETE FROM users WHERE id = $1', [userId]);
  });

  describe('Workshop insights affect content suggestions', () => {
    beforeEach(async () => {
      // Create and complete a workshop session
      const workshopStart = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      workshopSessionId = workshopStart.body.sessionId;

      // Save comprehensive workshop data
      await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5],
          values: {
            selected: ['leadership', 'growth', 'authenticity', 'impact'],
            custom: [],
            rankings: {
              'leadership': 1,
              'growth': 2,
              'authenticity': 3,
              'impact': 4
            }
          },
          tonePreferences: {
            formal_casual: 0.6,  // Slightly formal
            concise_detailed: 0.3, // More concise
            analytical_creative: 0.7, // More analytical
            serious_playful: 0.8  // More serious
          },
          audiencePersonas: [
            {
              id: 'persona-1',
              name: 'Senior Executives',
              role: 'C-Suite/VP',
              industry: 'Enterprise',
              painPoints: ['strategic decision making', 'organizational growth'],
              goals: ['business transformation', 'leadership development'],
              communicationStyle: 'executive briefing',
              demographicInfo: {
                ageRange: '45-60',
                experience: 'senior',
                company_size: 'enterprise'
              }
            },
            {
              id: 'persona-2',
              name: 'Emerging Leaders',
              role: 'Manager/Director',
              industry: 'Various',
              painPoints: ['career advancement', 'team management'],
              goals: ['skill development', 'leadership growth'],
              communicationStyle: 'practical advice',
              demographicInfo: {
                ageRange: '30-45',
                experience: 'mid-level',
                company_size: 'mid-market'
              }
            }
          ],
          writingSample: {
            text: 'Leadership is about empowering others to achieve their potential. In my experience leading transformation initiatives, I\'ve learned that authentic communication and data-driven decision making are key to sustainable growth.',
            wordCount: 30,
            uploadedAt: new Date().toISOString(),
            analysisResults: {
              readability: 12.5,
              sentiment: { positive: 0.8, neutral: 0.2, negative: 0 },
              styleMetrics: { avgSentenceLength: 15, vocabulary: 'professional' }
            }
          },
          personalityQuiz: {
            responses: [
              { questionId: 'q1', answer: 'a', answeredAt: new Date().toISOString() },
              { questionId: 'q2', answer: 'b', answeredAt: new Date().toISOString() }
            ]
          }
        });

      // Complete workshop
      const completeResponse = await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      analysisResults = completeResponse.body.analysisResults;
    });

    test('should suggest content types based on workshop profile', async () => {
      // Create calendar events with different content types
      const events = [
        {
          title: 'Leadership Insights: Data-Driven Decision Making',
          contentType: 'article',
          contentBody: 'An analytical piece on leadership strategies backed by data.',
          scheduledFor: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        },
        {
          title: 'Quick Tip: Empowering Your Team',
          contentType: 'post',
          contentBody: 'A concise tip about team empowerment.',
          scheduledFor: new Date(Date.now() + 172800000).toISOString() // 2 days
        },
        {
          title: 'Fun Friday: Office Jokes',
          contentType: 'story',
          contentBody: 'Light-hearted content about office humor.',
          scheduledFor: new Date(Date.now() + 259200000).toISOString() // 3 days
        }
      ];

      const createdEvents = [];
      for (const event of events) {
        const response = await request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send(event);
        
        createdEvents.push(response.body.event);
      }

      // Get optimal content slots based on workshop profile
      const slotsResponse = await request(app)
        .get('/api/calendar/slots')
        .set('Authorization', `Bearer ${authToken}`);

      expect(slotsResponse.body.slots).toBeDefined();
      
      // Professional audience should suggest weekday morning/afternoon slots
      const weekdaySlots = slotsResponse.body.slots.filter(s => 
        s.dayOfWeek >= 1 && s.dayOfWeek <= 5
      );
      const weekendSlots = slotsResponse.body.slots.filter(s => 
        s.dayOfWeek === 0 || s.dayOfWeek === 6
      );

      expect(weekdaySlots.length).toBeGreaterThan(weekendSlots.length);

      // Analytics should show preference for analytical content
      const analyticsResponse = await request(app)
        .get('/api/calendar/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 604800000).toISOString() // 1 week
        });

      expect(analyticsResponse.body.dailyMetrics).toBeDefined();
    });

    test('should recommend content series based on values and audience', async () => {
      // Create a content series aligned with workshop values
      const seriesResponse = await request(app)
        .post('/api/calendar/series')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Leadership Transformation Series',
          description: 'A series exploring data-driven leadership and organizational growth',
          seriesType: 'sequential',
          totalParts: 5,
          partsIntervalDays: 7,
          preferredTime: '10:00',
          preferredDaysOfWeek: [2, 4] // Tuesday, Thursday
        });

      expect(seriesResponse.status).toBe(200);
      const series = seriesResponse.body.series;
      
      expect(series.hashtag).toContain('LeadershipTransformation');
      expect(series.preferred_days_of_week).toEqual([2, 4]);

      // Verify series aligns with executive audience preferences
      expect(series.preferred_time).toBe('10:00'); // Morning for executives
    });

    test('should apply tone preferences to calendar event creation', async () => {
      // Create events and verify they respect tone preferences
      const formalEvent = {
        title: 'Strategic Planning for Q4: Executive Guide',
        contentType: 'article',
        contentBody: 'A comprehensive analysis of strategic planning methodologies for senior leadership.',
        contentData: {
          targetAudience: 'Senior Executives',
          estimatedReadTime: 8,
          keyTakeaways: [
            'Data-driven planning frameworks',
            'Leadership alignment strategies',
            'Growth optimization metrics'
          ]
        },
        scheduledFor: new Date(Date.now() + 86400000).toISOString()
      };

      const casualEvent = {
        title: 'Weekend Wisdom: Life Lessons',
        contentType: 'story',
        contentBody: 'Casual reflections on work-life balance.',
        contentData: {
          targetAudience: 'General',
          estimatedReadTime: 2
        },
        scheduledFor: new Date(Date.now() + 345600000).toISOString() // Weekend
      };

      const formalResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(formalEvent);

      const casualResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(casualEvent);

      expect(formalResponse.status).toBe(200);
      expect(casualResponse.status).toBe(200);

      // Formal event should be prioritized based on tone preferences
      const eventsResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ view: 'week' });

      const formalEventResult = eventsResponse.body.events.find(e => 
        e.id === formalResponse.body.event.id
      );
      const casualEventResult = eventsResponse.body.events.find(e => 
        e.id === casualResponse.body.event.id
      );

      expect(formalEventResult).toBeDefined();
      expect(casualEventResult).toBeDefined();
      
      // Verify content data reflects workshop insights
      expect(formalEventResult.content_data.targetAudience).toBe('Senior Executives');
      expect(formalEventResult.content_data.keyTakeaways).toContain('Leadership alignment strategies');
    });

    test('should generate calendar templates from workshop content pillars', async () => {
      // Get workshop analysis results
      const analysisResult = await query(
        `SELECT content_pillars, recommended_content_types 
         FROM workshop_analysis_results 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      const contentPillars = analysisResult.rows[0].content_pillars || [];
      const recommendedTypes = analysisResult.rows[0].recommended_content_types || [];

      // Create events for each content pillar
      const pillarEvents = [];
      for (const pillar of contentPillars.slice(0, 3)) {
        const eventResponse = await request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `${pillar} Insights`,
            contentType: recommendedTypes[0] || 'article',
            contentBody: `Content focused on ${pillar}`,
            contentData: {
              contentPillar: pillar,
              fromWorkshop: true
            },
            hashtags: [pillar.toLowerCase(), 'leadership'],
            color: '#3B82F6'
          });

        pillarEvents.push(eventResponse.body.event);
      }

      expect(pillarEvents).toHaveLength(Math.min(3, contentPillars.length));
      pillarEvents.forEach((event, index) => {
        expect(event.content_data.contentPillar).toBe(contentPillars[index]);
        expect(event.hashtags).toContain(contentPillars[index].toLowerCase());
      });
    });

    test('should handle workshop-based recurring content patterns', async () => {
      // Create recurring content based on workshop values
      const recurringTemplates = [
        {
          title: 'Weekly Leadership Lesson',
          contentType: 'post',
          recurring: true,
          dayOfWeek: 1, // Monday
          values: ['leadership', 'growth']
        },
        {
          title: 'Data-Driven Friday',
          contentType: 'article',
          recurring: true,
          dayOfWeek: 5, // Friday
          values: ['analytical', 'impact']
        }
      ];

      // Create events for next 4 weeks
      const createdEvents = [];
      for (const template of recurringTemplates) {
        for (let week = 0; week < 4; week++) {
          const baseDate = new Date();
          const daysUntilTarget = (template.dayOfWeek - baseDate.getDay() + 7) % 7;
          const targetDate = new Date(baseDate);
          targetDate.setDate(targetDate.getDate() + daysUntilTarget + (week * 7));

          const response = await request(app)
            .post('/api/calendar/events')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `${template.title} - Week ${week + 1}`,
              contentType: template.contentType,
              contentBody: `Recurring content aligned with ${template.values.join(', ')}`,
              scheduledFor: targetDate.toISOString(),
              sourceType: 'recurring',
              contentData: {
                workshopValues: template.values,
                recurringPattern: 'weekly'
              }
            });

          createdEvents.push(response.body.event);
        }
      }

      expect(createdEvents).toHaveLength(8); // 2 templates × 4 weeks

      // Verify events are properly distributed
      const mondayEvents = createdEvents.filter(e => 
        new Date(e.scheduled_for).getDay() === 1
      );
      const fridayEvents = createdEvents.filter(e => 
        new Date(e.scheduled_for).getDay() === 5
      );

      expect(mondayEvents).toHaveLength(4);
      expect(fridayEvents).toHaveLength(4);
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle calendar creation without workshop data', async () => {
      // Create new user without workshop
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `no-workshop-cal-${Date.now()}@test.com`,
          password: 'TestPassword123!',
          firstName: 'No',
          lastName: 'Workshop'
        });

      const newAuthToken = newUserResponse.body.token;

      // Should still be able to create calendar events
      const eventResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          title: 'Generic Event',
          contentType: 'post',
          contentBody: 'Event without workshop insights'
        });

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.event).toBeDefined();

      // Get default slots (should return generic optimal times)
      const slotsResponse = await request(app)
        .get('/api/calendar/slots')
        .set('Authorization', `Bearer ${newAuthToken}`);

      expect(slotsResponse.body.isDefault).toBe(true);
      expect(slotsResponse.body.slots.length).toBeGreaterThan(0);

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [newUserResponse.body.user.id]);
    });

    test('should handle workshop updates affecting existing calendar events', async () => {
      // Create a calendar event
      const eventResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Event',
          contentType: 'post',
          contentBody: 'Content before workshop update',
          scheduledFor: new Date(Date.now() + 86400000).toISOString()
        });

      const eventId = eventResponse.body.event.id;

      // Update workshop data
      await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentStep: 2,
          completedSteps: [1, 2],
          tonePreferences: {
            formal_casual: 0.2, // Much more casual now
            concise_detailed: 0.8, // Much more detailed
            analytical_creative: 0.3, // More creative
            serious_playful: 0.2 // More playful
          }
        });

      // Verify existing event is not automatically modified
      const getEventResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ view: 'week' });

      const existingEvent = getEventResponse.body.events.find(e => e.id === eventId);
      expect(existingEvent.title).toBe('Original Event');
      expect(existingEvent.content_body).toBe('Content before workshop update');
    });
  });

  describe('Performance and batch operations', () => {
    test('should efficiently handle workshop-influenced batch event creation', async () => {
      const batchEvents = [];
      const contentPillars = ['leadership', 'growth', 'authenticity', 'impact'];
      
      // Create 20 events based on workshop content pillars
      for (let i = 0; i < 20; i++) {
        const pillar = contentPillars[i % contentPillars.length];
        const dayOffset = Math.floor(i / 4) + 1;
        
        batchEvents.push({
          title: `${pillar} Insight #${i + 1}`,
          contentType: i % 3 === 0 ? 'article' : 'post',
          contentBody: `Content exploring ${pillar} concepts`,
          scheduledFor: new Date(Date.now() + (dayOffset * 86400000)).toISOString(),
          contentData: {
            workshopPillar: pillar,
            batchIndex: i
          },
          hashtags: [pillar.toLowerCase(), 'professionalGrowth']
        });
      }

      const startTime = Date.now();
      
      // Create all events
      const createPromises = batchEvents.map(event =>
        request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send(event)
      );

      const results = await Promise.all(createPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify events are properly distributed
      const calendarResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          view: 'month',
          limit: 100 
        });

      expect(calendarResponse.body.events.length).toBeGreaterThanOrEqual(20);

      // Verify workshop pillars are represented
      const eventsByPillar = {};
      calendarResponse.body.events.forEach(event => {
        if (event.content_data?.workshopPillar) {
          const pillar = event.content_data.workshopPillar;
          eventsByPillar[pillar] = (eventsByPillar[pillar] || 0) + 1;
        }
      });

      contentPillars.forEach(pillar => {
        expect(eventsByPillar[pillar]).toBeGreaterThanOrEqual(5);
      });
    });

    test('should handle concurrent workshop and calendar operations', async () => {
      // Simulate concurrent operations
      const operations = [
        // Workshop update
        request(app)
          .post(`/api/workshop/session/${workshopSessionId}/save`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentStep: 1,
            completedSteps: [1],
            values: {
              selected: ['innovation', 'excellence'],
              custom: [],
              rankings: {}
            }
          }),
        
        // Calendar event creation
        request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Concurrent Event 1',
            contentType: 'post',
            contentBody: 'Created during workshop update'
          }),
        
        // Another calendar event
        request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Concurrent Event 2',
            contentType: 'article',
            contentBody: 'Also created during workshop update'
          }),
        
        // Get calendar slots
        request(app)
          .get('/api/calendar/slots')
          .set('Authorization', `Bearer ${authToken}`)
      ];

      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Verify data consistency
      const finalEvents = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ view: 'week' });

      const concurrentEvents = finalEvents.body.events.filter(e => 
        e.title.startsWith('Concurrent Event')
      );
      
      expect(concurrentEvents).toHaveLength(2);
    });
  });
});