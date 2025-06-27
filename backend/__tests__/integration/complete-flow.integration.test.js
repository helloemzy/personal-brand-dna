const request = require('supertest');
const app = require('../../src/server');
const { query, withTransaction } = require('../../src/config/database');

describe('Complete BrandHack Flow Integration', () => {
  let authToken;
  let userId;
  let workshopSessionId;
  let newsSourceId;
  let contentSeries;

  beforeAll(async () => {
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `complete-flow-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Complete',
        lastName: 'Flow'
      });
    
    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;

    // Simulate LinkedIn connection for full flow
    await query(
      `INSERT INTO linkedin_oauth_tokens 
       (user_id, access_token, refresh_token, expires_at, linkedin_user_id, linkedin_user_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'test-access-token',
        'test-refresh-token',
        new Date(Date.now() + 3600000),
        'test-linkedin-id',
        'Complete Flow User'
      ]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await query('DELETE FROM users WHERE id = $1', [userId]);
  });

  describe('Full journey: Workshop → News → Calendar → LinkedIn', () => {
    test('should complete entire content creation and publishing flow', async () => {
      // Step 1: Complete Workshop
      console.log('Step 1: Starting workshop...');
      
      const workshopStart = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      workshopSessionId = workshopStart.body.sessionId;
      expect(workshopStart.status).toBe(200);

      // Save comprehensive workshop data
      const workshopSave = await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5],
          values: {
            selected: ['innovation', 'leadership', 'authenticity', 'growth'],
            custom: [],
            rankings: {
              'innovation': 1,
              'leadership': 2,
              'authenticity': 3,
              'growth': 4
            }
          },
          tonePreferences: {
            formal_casual: 0.7,
            concise_detailed: 0.4,
            analytical_creative: 0.8,
            serious_playful: 0.7
          },
          audiencePersonas: [
            {
              id: 'tech-executives',
              name: 'Technology Executives',
              role: 'CTO/VP Engineering',
              industry: 'Technology',
              painPoints: ['digital transformation', 'talent retention', 'innovation speed'],
              goals: ['market leadership', 'operational excellence', 'team growth'],
              communicationStyle: 'data-driven insights',
              demographicInfo: {
                ageRange: '40-55',
                experience: 'senior',
                company_size: 'enterprise'
              }
            },
            {
              id: 'startup-founders',
              name: 'Startup Founders',
              role: 'CEO/Founder',
              industry: 'Startup',
              painPoints: ['scaling challenges', 'funding', 'product-market fit'],
              goals: ['rapid growth', 'market validation', 'team building'],
              communicationStyle: 'practical advice',
              demographicInfo: {
                ageRange: '28-40',
                experience: 'mid-level',
                company_size: 'startup'
              }
            }
          ],
          writingSample: {
            text: 'Innovation in technology leadership requires balancing bold vision with practical execution. Through my experience leading digital transformations, I\'ve learned that authentic leadership and data-driven decision making are the foundations of sustainable growth. The key is empowering teams while maintaining strategic focus.',
            wordCount: 42,
            uploadedAt: new Date().toISOString(),
            analysisResults: {
              readability: 14.2,
              sentiment: { positive: 0.85, neutral: 0.15, negative: 0 },
              styleMetrics: { 
                avgSentenceLength: 14, 
                vocabulary: 'professional',
                tone: 'authoritative'
              }
            }
          },
          personalityQuiz: {
            responses: [
              { questionId: 'q1', answer: 'a', answeredAt: new Date().toISOString() },
              { questionId: 'q2', answer: 'c', answeredAt: new Date().toISOString() },
              { questionId: 'q3', answer: 'b', answeredAt: new Date().toISOString() }
            ]
          }
        });

      expect(workshopSave.status).toBe(200);

      // Complete workshop to generate brand profile
      const workshopComplete = await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(workshopComplete.status).toBe(200);
      const brandProfile = workshopComplete.body.analysisResults;
      expect(brandProfile.brand_voice_profile).toBeDefined();
      expect(brandProfile.content_pillars).toBeDefined();
      expect(brandProfile.content_pillars.length).toBeGreaterThan(0);

      console.log('Workshop completed. Content pillars:', brandProfile.content_pillars);

      // Step 2: Set up News Sources
      console.log('\nStep 2: Setting up news sources...');

      const newsSource = await request(app)
        .post('/api/news/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'TechCrunch Innovation',
          feedUrl: 'https://techcrunch.com/category/innovation/feed/',
          feedType: 'rss',
          category: 'technology'
        });

      newsSourceId = newsSource.body.source.id;
      expect(newsSource.status).toBe(200);

      // Configure news preferences based on workshop
      const newsPrefs = await request(app)
        .put('/api/news/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keywords: brandProfile.content_pillars.concat(['digital transformation', 'tech leadership']),
          excludedKeywords: ['gossip', 'entertainment', 'sports'],
          minimumRelevanceScore: 0.65,
          ideaGenerationEnabled: true,
          autoSaveHighRelevance: true,
          relevanceThresholdForAutoSave: 0.85,
          notificationFrequency: 'daily'
        });

      expect(newsPrefs.status).toBe(200);

      // Step 3: Process News Articles
      console.log('\nStep 3: Processing news articles...');

      // Simulate relevant articles
      const articles = [
        {
          id: 'flow-article-1',
          title: 'AI Innovation Transforms Enterprise Leadership',
          description: 'How artificial intelligence is reshaping executive decision-making',
          content: 'A comprehensive analysis of how AI-driven insights are enabling technology leaders to make more informed strategic decisions. The integration of machine learning into enterprise workflows has accelerated innovation cycles and improved operational efficiency by 40%. Leaders who embrace these tools report better team alignment and faster time-to-market for new initiatives.',
          author: 'Tech Innovation Expert',
          published_at: new Date(),
          article_url: 'https://example.com/ai-leadership'
        },
        {
          id: 'flow-article-2',
          title: 'The Future of Authentic Leadership in Tech',
          description: 'Building trust through transparency in digital transformation',
          content: 'Authentic leadership has become crucial in technology organizations undergoing digital transformation. Studies show that teams led by authentic leaders demonstrate 35% higher engagement and 25% better retention rates. The key is balancing vulnerability with strength, and data-driven decisions with human intuition.',
          author: 'Leadership Researcher',
          published_at: new Date(Date.now() - 86400000),
          article_url: 'https://example.com/authentic-leadership'
        }
      ];

      // Insert articles
      for (const article of articles) {
        await query(
          `INSERT INTO news_articles 
           (id, title, description, content, author, published_at, article_url, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          Object.values({ ...article, source_id: newsSourceId })
        );

        // Calculate and store relevance scores
        await query(
          `INSERT INTO article_relevance_scores 
           (article_id, user_id, relevance_score, content_pillar_matches, is_featured)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            article.id,
            userId,
            article.title.includes('Innovation') ? 0.92 : 0.85,
            article.title.includes('Innovation') ? ['innovation', 'leadership'] : ['authenticity', 'leadership'],
            article.title.includes('Innovation')
          ]
        );
      }

      // Get relevant articles
      const articlesResponse = await request(app)
        .get('/api/news/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ minRelevance: 0.8, featured: 'true' });

      expect(articlesResponse.body.articles.length).toBeGreaterThan(0);
      const featuredArticle = articlesResponse.body.articles[0];

      // Step 4: Generate Content Ideas
      console.log('\nStep 4: Generating content ideas from news...');

      const ideasResponse = await request(app)
        .post(`/api/news/articles/${featuredArticle.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(ideasResponse.status).toBe(200);
      const contentIdeas = ideasResponse.body.ideas;
      expect(contentIdeas.length).toBeGreaterThan(0);

      console.log(`Generated ${contentIdeas.length} content ideas`);

      // Track interaction
      await request(app)
        .post(`/api/news/articles/${featuredArticle.id}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          interactionType: 'use_idea',
          interactionData: { 
            ideasGenerated: contentIdeas.length,
            source: 'automated_flow'
          }
        });

      // Step 5: Create Calendar Events
      console.log('\nStep 5: Creating calendar events from ideas...');

      // Create a content series first
      const seriesResponse = await request(app)
        .post('/api/calendar/series')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Innovation Leadership Insights',
          description: 'Weekly insights on innovation and technology leadership',
          seriesType: 'thematic',
          totalParts: 4,
          partsIntervalDays: 7,
          preferredTime: '10:00',
          preferredDaysOfWeek: [2, 4] // Tuesday, Thursday
        });

      contentSeries = seriesResponse.body.series;
      expect(seriesResponse.status).toBe(200);

      // Create calendar events from top ideas
      const calendarEvents = [];
      const topIdeas = contentIdeas.slice(0, 3);
      const baseDate = new Date();
      
      // Find next Tuesday
      while (baseDate.getDay() !== 2) {
        baseDate.setDate(baseDate.getDate() + 1);
      }

      for (let i = 0; i < topIdeas.length; i++) {
        const idea = topIdeas[i];
        const scheduledDate = new Date(baseDate);
        scheduledDate.setDate(scheduledDate.getDate() + (i * 3)); // Every 3 days
        scheduledDate.setHours(10, 0, 0, 0);

        const eventResponse = await request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: idea.headline,
            description: `Based on: ${featuredArticle.title}`,
            contentType: idea.contentFormat || 'post',
            contentBody: idea.hook + '\n\n' + idea.keyPoints.join('\n'),
            scheduledFor: scheduledDate.toISOString(),
            platforms: { linkedin: true },
            hashtags: ['InnovationLeadership', 'TechLeadership', 'DigitalTransformation'],
            mentions: ['@techleaders'],
            color: '#3B82F6',
            sourceType: 'idea',
            sourceId: idea.id,
            contentData: {
              ideaId: idea.id,
              articleId: featuredArticle.id,
              articleTitle: featuredArticle.title,
              seriesId: i === 0 ? contentSeries.id : null,
              partNumber: i === 0 ? 1 : null,
              targetAudience: idea.targetAudience,
              estimatedEngagement: 'high',
              contentPillars: brandProfile.content_pillars.filter(pillar => 
                idea.headline.toLowerCase().includes(pillar.toLowerCase())
              )
            }
          });

        expect(eventResponse.status).toBe(200);
        calendarEvents.push(eventResponse.body.event);

        // Update idea status
        await request(app)
          .patch(`/api/news/ideas/${idea.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'drafted' });
      }

      console.log(`Created ${calendarEvents.length} calendar events`);

      // Step 6: Queue for LinkedIn Publishing
      console.log('\nStep 6: Queuing content for LinkedIn...');

      const linkedinQueue = [];
      for (const event of calendarEvents) {
        const queueResponse = await request(app)
          .post('/api/linkedin/queue')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            contentId: event.id,
            postText: event.content_body,
            postType: event.content_type === 'article' ? 'article' : 'text',
            mediaUrls: [],
            scheduledFor: event.scheduled_for
          });

        expect(queueResponse.status).toBe(200);
        linkedinQueue.push(queueResponse.body.queueEntry);

        // Approve first item for immediate publishing
        if (linkedinQueue.length === 1) {
          await request(app)
            .put(`/api/linkedin/queue/${queueResponse.body.queueEntry.id}/approve`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({});
        }
      }

      console.log(`Queued ${linkedinQueue.length} items for LinkedIn`);

      // Step 7: Simulate Publishing and Analytics
      console.log('\nStep 7: Simulating publishing and analytics...');

      // Simulate publishing the first item
      const firstQueueItem = linkedinQueue[0];
      const linkedinPostId = 'flow-test-post-123';
      
      await query(
        `UPDATE linkedin_publishing_queue 
         SET status = 'published',
             published_at = NOW(),
             linkedin_post_id = $2,
             linkedin_post_url = 'https://linkedin.com/posts/flow-test-123'
         WHERE id = $1`,
        [firstQueueItem.id, linkedinPostId]
      );

      // Update calendar event status
      await request(app)
        .put(`/api/calendar/events/${calendarEvents[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'published',
          publishedAt: new Date().toISOString()
        });

      // Simulate analytics data
      await query(
        `INSERT INTO linkedin_post_analytics 
         (queue_id, linkedin_post_id, impressions, clicks, reactions, comments, shares, engagement_rate, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          firstQueueItem.id,
          linkedinPostId,
          2500,    // impressions
          125,     // clicks
          45,      // reactions
          12,      // comments
          8,       // shares
          0.074    // engagement rate
        ]
      );

      // Step 8: Verify Complete Flow
      console.log('\nStep 8: Verifying complete flow...');

      // Check workshop influence throughout
      const workshopInfluence = await query(
        `SELECT 
          COUNT(DISTINCT ws.id) as workshop_sessions,
          COUNT(DISTINCT na.id) as news_articles,
          COUNT(DISTINCT ci.id) as content_ideas,
          COUNT(DISTINCT ce.id) as calendar_events,
          COUNT(DISTINCT lpq.id) as linkedin_queue_items,
          COUNT(DISTINCT lpq.id) FILTER (WHERE lpq.status = 'published') as published_posts
         FROM workshop_sessions ws
         CROSS JOIN news_articles na
         LEFT JOIN content_ideas ci ON ci.user_id = ws.user_id
         LEFT JOIN calendar_events ce ON ce.user_id = ws.user_id
         LEFT JOIN linkedin_publishing_queue lpq ON lpq.user_id = ws.user_id
         WHERE ws.user_id = $1`,
        [userId]
      );

      const stats = workshopInfluence.rows[0];
      expect(parseInt(stats.workshop_sessions)).toBeGreaterThan(0);
      expect(parseInt(stats.news_articles)).toBeGreaterThan(0);
      expect(parseInt(stats.content_ideas)).toBeGreaterThan(0);
      expect(parseInt(stats.calendar_events)).toBeGreaterThan(0);
      expect(parseInt(stats.linkedin_queue_items)).toBeGreaterThan(0);
      expect(parseInt(stats.published_posts)).toBeGreaterThan(0);

      console.log('\nFlow Statistics:', stats);
      console.log('Complete flow test successful!');
    });

    test('should maintain data consistency across all features', async () => {
      // Verify workshop data persists and influences all downstream features
      const workshopData = await request(app)
        .get(`/api/workshop/session/${workshopSessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(workshopData.body.session.is_completed).toBe(true);
      const values = workshopData.body.session.values.map(v => v.value_name);

      // Check news preferences reflect workshop values
      const newsPrefs = await request(app)
        .get('/api/news/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      const prefsKeywords = newsPrefs.body.preferences.keywords;
      expect(prefsKeywords.some(keyword => values.includes(keyword))).toBe(true);

      // Check calendar events contain workshop-influenced content
      const calendarEvents = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ view: 'month' });

      const workshopInfluencedEvents = calendarEvents.body.events.filter(event =>
        event.content_data?.contentPillars?.some(pillar => values.includes(pillar))
      );

      expect(workshopInfluencedEvents.length).toBeGreaterThan(0);

      // Check LinkedIn queue maintains consistency
      const linkedinQueue = await request(app)
        .get('/api/linkedin/queue')
        .set('Authorization', `Bearer ${authToken}`);

      const queueWithCalendarIds = linkedinQueue.body.queue.filter(item =>
        item.content_id && calendarEvents.body.events.some(e => e.id === item.content_id)
      );

      expect(queueWithCalendarIds.length).toBeGreaterThan(0);
    });

    test('should handle updates propagating through the system', async () => {
      // Update workshop tone preferences
      const updatedTonePrefs = {
        formal_casual: 0.3, // More casual
        concise_detailed: 0.8, // More detailed
        analytical_creative: 0.4, // More creative
        serious_playful: 0.3 // More playful
      };

      await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentStep: 2,
          completedSteps: [1, 2],
          tonePreferences: updatedTonePrefs
        });

      // Create new article
      const newArticle = {
        id: 'tone-update-article',
        title: 'Creative Approaches to Team Building',
        description: 'Fun and innovative team building strategies',
        content: 'Explore creative and playful approaches to building stronger teams in tech organizations.',
        author: 'Team Expert',
        published_at: new Date(),
        article_url: 'https://example.com/creative-teams',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(newArticle)
      );

      // Generate ideas with new tone preferences
      const ideasResponse = await request(app)
        .post(`/api/news/articles/${newArticle.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const ideas = ideasResponse.body.ideas;
      
      // Ideas should reflect more casual, creative tone
      expect(ideas.length).toBeGreaterThan(0);
      ideas.forEach(idea => {
        // Check for creative/playful elements in generated content
        const hasCreativeElements = 
          idea.hook.includes('fun') ||
          idea.hook.includes('creative') ||
          idea.hook.includes('innovative') ||
          idea.contentFormat === 'carousel' ||
          idea.contentFormat === 'poll';
        
        expect(hasCreativeElements).toBe(true);
      });
    });
  });

  describe('Error recovery and resilience', () => {
    test('should handle partial failures in the flow', async () => {
      // Create article but fail news processing
      const failArticle = {
        id: 'fail-article-1',
        title: 'Article That Fails Processing',
        description: 'This will fail',
        content: null, // Invalid content
        author: 'Test',
        published_at: new Date(),
        article_url: 'https://example.com/fail',
        source_id: newsSourceId
      };

      try {
        await query(
          `INSERT INTO news_articles 
           (id, title, description, content, author, published_at, article_url, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          Object.values(failArticle)
        );
      } catch (error) {
        // Expected to fail
      }

      // System should continue functioning
      const calendarResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`);

      expect(calendarResponse.status).toBe(200);

      // Create valid article to recover
      const recoveryArticle = {
        id: 'recovery-article-1',
        title: 'Recovery Article',
        description: 'System recovery test',
        content: 'Valid content for recovery testing.',
        author: 'Test',
        published_at: new Date(),
        article_url: 'https://example.com/recovery',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(recoveryArticle)
      );

      // Should be able to generate ideas
      const ideasResponse = await request(app)
        .post(`/api/news/articles/${recoveryArticle.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(ideasResponse.status).toBe(200);
    });

    test('should handle concurrent operations across features', async () => {
      // Simulate concurrent operations
      const operations = [
        // Workshop update
        request(app)
          .get(`/api/workshop/sessions`)
          .set('Authorization', `Bearer ${authToken}`),
        
        // News fetch
        request(app)
          .get('/api/news/articles')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ limit: 10 }),
        
        // Calendar events
        request(app)
          .get('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ view: 'week' }),
        
        // LinkedIn queue
        request(app)
          .get('/api/linkedin/queue')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ status: 'pending' }),
        
        // Create new calendar event
        request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Concurrent Test Event',
            contentType: 'post',
            contentBody: 'Testing concurrent operations',
            scheduledFor: new Date(Date.now() + 86400000).toISOString()
          })
      ];

      const results = await Promise.all(operations);
      
      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    });
  });

  describe('Performance and optimization', () => {
    test('should efficiently handle bulk operations across features', async () => {
      const startTime = Date.now();
      
      // Bulk create articles
      const bulkArticles = [];
      for (let i = 0; i < 10; i++) {
        bulkArticles.push({
          id: `bulk-flow-article-${i}`,
          title: `Bulk Article ${i}: ${i % 2 === 0 ? 'Innovation' : 'Leadership'} Insights`,
          description: `Bulk description ${i}`,
          content: `Detailed content about ${i % 2 === 0 ? 'innovation' : 'leadership'} strategies.`,
          author: 'Bulk Author',
          published_at: new Date(Date.now() - i * 3600000),
          article_url: `https://example.com/bulk-${i}`,
          source_id: newsSourceId
        });
      }

      await withTransaction(async (client) => {
        for (const article of bulkArticles) {
          await client.query(
            `INSERT INTO news_articles 
             (id, title, description, content, author, published_at, article_url, source_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            Object.values(article)
          );
        }
      });

      // Generate ideas for half of them
      const ideaPromises = bulkArticles.slice(0, 5).map(article =>
        request(app)
          .post(`/api/news/articles/${article.id}/generate-ideas`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
      );

      const ideaResults = await Promise.all(ideaPromises);
      const allIdeas = ideaResults.flatMap(r => r.body.ideas || []);

      // Create calendar events from ideas
      const eventPromises = allIdeas.slice(0, 10).map((idea, index) => {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + Math.floor(index / 2) + 1);
        
        return request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: idea.headline,
            contentType: idea.contentFormat,
            contentBody: idea.hook,
            scheduledFor: scheduledDate.toISOString(),
            sourceType: 'idea',
            sourceId: idea.id
          });
      });

      const eventResults = await Promise.all(eventPromises);

      // Queue some for LinkedIn
      const queuePromises = eventResults.slice(0, 5).map(result =>
        request(app)
          .post('/api/linkedin/queue')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            contentId: result.body.event.id,
            postText: result.body.event.content_body,
            postType: 'text',
            scheduledFor: result.body.event.scheduled_for
          })
      );

      await Promise.all(queuePromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`Bulk operation completed in ${totalTime}ms`);
      
      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(30000); // 30 seconds

      // Verify data integrity
      const stats = await query(
        `SELECT 
          COUNT(DISTINCT na.id) as articles,
          COUNT(DISTINCT ci.id) as ideas,
          COUNT(DISTINCT ce.id) as events,
          COUNT(DISTINCT lpq.id) as queued
         FROM news_articles na
         LEFT JOIN content_ideas ci ON ci.article_id = na.id
         LEFT JOIN calendar_events ce ON ce.source_type = 'idea'
         LEFT JOIN linkedin_publishing_queue lpq ON lpq.content_id = ce.id
         WHERE na.id LIKE 'bulk-flow-article-%'`,
        []
      );

      expect(parseInt(stats.rows[0].articles)).toBe(10);
      expect(parseInt(stats.rows[0].ideas)).toBeGreaterThan(0);
      expect(parseInt(stats.rows[0].events)).toBeGreaterThan(0);
      expect(parseInt(stats.rows[0].queued)).toBeGreaterThan(0);
    });

    test('should track metrics across the entire flow', async () => {
      // Get comprehensive metrics
      const metrics = await query(
        `SELECT 
          -- Workshop metrics
          COUNT(DISTINCT ws.id) as workshop_sessions,
          COUNT(DISTINCT ws.id) FILTER (WHERE ws.is_completed) as completed_workshops,
          
          -- News metrics
          COUNT(DISTINCT ns.id) as news_sources,
          COUNT(DISTINCT na.id) as total_articles,
          COUNT(DISTINCT ars.article_id) FILTER (WHERE ars.relevance_score > 0.8) as high_relevance_articles,
          
          -- Content creation metrics
          COUNT(DISTINCT ci.id) as content_ideas,
          COUNT(DISTINCT ci.id) FILTER (WHERE ci.status = 'drafted') as drafted_ideas,
          COUNT(DISTINCT ce.id) as calendar_events,
          COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'scheduled') as scheduled_events,
          
          -- Publishing metrics
          COUNT(DISTINCT lpq.id) as linkedin_queue_items,
          COUNT(DISTINCT lpq.id) FILTER (WHERE lpq.status = 'published') as published_posts,
          COUNT(DISTINCT lpq.id) FILTER (WHERE lpq.approval_status = 'approved') as approved_posts,
          
          -- Engagement metrics
          AVG(lpa.engagement_rate) as avg_engagement_rate,
          MAX(lpa.impressions) as max_impressions
          
         FROM users u
         LEFT JOIN workshop_sessions ws ON ws.user_id = u.id
         LEFT JOIN news_sources ns ON ns.user_id = u.id
         LEFT JOIN news_articles na ON na.source_id = ns.id
         LEFT JOIN article_relevance_scores ars ON ars.user_id = u.id
         LEFT JOIN content_ideas ci ON ci.user_id = u.id
         LEFT JOIN calendar_events ce ON ce.user_id = u.id
         LEFT JOIN linkedin_publishing_queue lpq ON lpq.user_id = u.id
         LEFT JOIN linkedin_post_analytics lpa ON lpa.queue_id = lpq.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );

      const flowMetrics = metrics.rows[0];
      
      console.log('\nComplete Flow Metrics:');
      console.log('- Workshop sessions:', flowMetrics.workshop_sessions);
      console.log('- Completed workshops:', flowMetrics.completed_workshops);
      console.log('- News sources:', flowMetrics.news_sources);
      console.log('- Total articles:', flowMetrics.total_articles);
      console.log('- High relevance articles:', flowMetrics.high_relevance_articles);
      console.log('- Content ideas:', flowMetrics.content_ideas);
      console.log('- Drafted ideas:', flowMetrics.drafted_ideas);
      console.log('- Calendar events:', flowMetrics.calendar_events);
      console.log('- Scheduled events:', flowMetrics.scheduled_events);
      console.log('- LinkedIn queue items:', flowMetrics.linkedin_queue_items);
      console.log('- Published posts:', flowMetrics.published_posts);
      console.log('- Average engagement rate:', flowMetrics.avg_engagement_rate);

      // Verify flow is working end-to-end
      expect(parseInt(flowMetrics.workshop_sessions)).toBeGreaterThan(0);
      expect(parseInt(flowMetrics.completed_workshops)).toBeGreaterThan(0);
      expect(parseInt(flowMetrics.news_sources)).toBeGreaterThan(0);
      expect(parseInt(flowMetrics.total_articles)).toBeGreaterThan(0);
      expect(parseInt(flowMetrics.content_ideas)).toBeGreaterThan(0);
      expect(parseInt(flowMetrics.calendar_events)).toBeGreaterThan(0);
      expect(parseInt(flowMetrics.linkedin_queue_items)).toBeGreaterThan(0);
    });
  });
});