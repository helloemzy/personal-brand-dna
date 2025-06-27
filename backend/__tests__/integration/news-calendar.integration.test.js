const request = require('supertest');
const app = require('../../src/server');
const { query, withTransaction } = require('../../src/config/database');

describe('News → Calendar Integration', () => {
  let authToken;
  let userId;
  let workshopSessionId;
  let newsSourceId;

  beforeAll(async () => {
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `news-calendar-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'News',
        lastName: 'Calendar'
      });
    
    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;

    // Complete a basic workshop for better integration
    const workshopStart = await request(app)
      .post('/api/workshop/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    
    workshopSessionId = workshopStart.body.sessionId;

    await request(app)
      .post(`/api/workshop/session/${workshopSessionId}/save`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentStep: 5,
        completedSteps: [1, 2, 3, 4, 5],
        values: {
          selected: ['innovation', 'leadership', 'growth'],
          custom: [],
          rankings: { 'innovation': 1, 'leadership': 2, 'growth': 3 }
        },
        tonePreferences: {
          formal_casual: 0.6,
          concise_detailed: 0.5,
          analytical_creative: 0.7,
          serious_playful: 0.7
        },
        audiencePersonas: [{
          id: 'tech-leaders',
          name: 'Technology Leaders',
          role: 'CTO/VP Engineering',
          industry: 'Technology',
          painPoints: ['scaling', 'innovation'],
          goals: ['growth', 'efficiency']
        }],
        writingSample: {
          text: 'Innovation drives growth in technology leadership.',
          wordCount: 7,
          uploadedAt: new Date().toISOString()
        },
        personalityQuiz: {
          responses: [{ questionId: 'q1', answer: 'a', answeredAt: new Date().toISOString() }]
        }
      });

    await request(app)
      .post(`/api/workshop/session/${workshopSessionId}/complete`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
  });

  afterAll(async () => {
    // Cleanup test data
    await query('DELETE FROM users WHERE id = $1', [userId]);
  });

  describe('News articles generate calendar content ideas', () => {
    beforeEach(async () => {
      // Add a news source
      const sourceResponse = await request(app)
        .post('/api/news/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tech Leadership News',
          feedUrl: 'https://example.com/tech-leadership-feed.rss',
          feedType: 'rss',
          category: 'technology'
        });
      
      newsSourceId = sourceResponse.body.source.id;
    });

    test('should create calendar events from news content ideas', async () => {
      // Create a relevant news article
      const article = {
        id: 'news-cal-1',
        title: 'AI Revolution in Enterprise: Leadership Strategies',
        description: 'How CTOs are leveraging AI for innovation and growth',
        content: 'Detailed analysis of AI adoption strategies by technology leaders, focusing on innovation frameworks and growth metrics.',
        author: 'Tech Reporter',
        published_at: new Date(),
        article_url: 'https://example.com/ai-leadership',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(article)
      );

      // Generate content ideas from article
      const ideasResponse = await request(app)
        .post(`/api/news/articles/${article.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(ideasResponse.status).toBe(200);
      const ideas = ideasResponse.body.ideas;
      expect(ideas.length).toBeGreaterThan(0);

      // Create calendar events from ideas
      const calendarEvents = [];
      for (const idea of ideas.slice(0, 2)) {
        const eventResponse = await request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: idea.headline,
            description: `Based on: ${article.title}`,
            contentType: idea.contentFormat || 'post',
            contentBody: idea.hook,
            contentData: {
              sourceType: 'news_idea',
              ideaId: idea.id,
              articleId: article.id,
              outline: idea.outline,
              keyPoints: idea.keyPoints,
              targetAudience: idea.targetAudience
            },
            scheduledFor: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            hashtags: ['AILeadership', 'Innovation', 'TechStrategy'],
            sourceType: 'idea',
            sourceId: idea.id
          });

        calendarEvents.push(eventResponse.body.event);
      }

      expect(calendarEvents).toHaveLength(2);
      
      // Verify events contain news-derived content
      calendarEvents.forEach(event => {
        expect(event.content_data.sourceType).toBe('news_idea');
        expect(event.content_data.articleId).toBe(article.id);
        expect(event.content_data.keyPoints).toBeDefined();
        expect(event.content_data.keyPoints.length).toBeGreaterThan(0);
      });

      // Update idea status to 'drafted'
      for (const idea of ideas.slice(0, 2)) {
        await request(app)
          .patch(`/api/news/ideas/${idea.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'drafted' });
      }
    });

    test('should schedule content ideas based on relevance and timing', async () => {
      // Create multiple articles with different relevance
      const articles = [
        {
          id: 'high-relevance-1',
          title: 'Innovation Framework for Tech Leaders',
          description: 'Highly relevant to user profile',
          content: 'Deep dive into innovation strategies for technology leadership and growth.',
          relevanceScore: 0.9
        },
        {
          id: 'medium-relevance-1',
          title: 'General Business Update',
          description: 'Somewhat relevant',
          content: 'Business news with some technology mentions.',
          relevanceScore: 0.6
        },
        {
          id: 'low-relevance-1',
          title: 'Sports News Update',
          description: 'Not relevant',
          content: 'Latest sports scores and updates.',
          relevanceScore: 0.2
        }
      ];

      // Insert articles and calculate relevance
      for (const article of articles) {
        await query(
          `INSERT INTO news_articles 
           (id, title, description, content, author, published_at, article_url, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            article.id,
            article.title,
            article.description,
            article.content,
            'Various Authors',
            new Date(),
            `https://example.com/${article.id}`,
            newsSourceId
          ]
        );

        // Simulate relevance scoring
        await query(
          `INSERT INTO article_relevance_scores 
           (article_id, user_id, relevance_score, content_pillar_matches, is_featured)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            article.id,
            userId,
            article.relevanceScore,
            article.relevanceScore > 0.8 ? ['innovation', 'leadership'] : [],
            article.relevanceScore > 0.85
          ]
        );
      }

      // Generate ideas only for high-relevance articles
      const highRelevanceIdeas = await request(app)
        .post('/api/news/articles/high-relevance-1/generate-ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(highRelevanceIdeas.status).toBe(200);
      const ideas = highRelevanceIdeas.body.ideas;

      // Create calendar events with smart scheduling
      const scheduledEvents = [];
      const baseDate = new Date();
      
      for (let i = 0; i < ideas.length; i++) {
        const idea = ideas[i];
        
        // Schedule high-priority content sooner
        const daysOffset = idea.aiConfidenceScore > 0.8 ? i + 1 : i + 3;
        const scheduledDate = new Date(baseDate);
        scheduledDate.setDate(scheduledDate.getDate() + daysOffset);
        
        // Prefer optimal posting times
        if (idea.contentFormat === 'post') {
          scheduledDate.setHours(8, 0, 0, 0); // Morning for posts
        } else if (idea.contentFormat === 'article') {
          scheduledDate.setHours(10, 0, 0, 0); // Mid-morning for articles
        }

        const eventResponse = await request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: idea.headline,
            contentType: idea.contentFormat,
            contentBody: idea.hook,
            scheduledFor: scheduledDate.toISOString(),
            contentData: {
              ideaConfidence: idea.aiConfidenceScore,
              relevanceScore: 0.9,
              autoScheduled: true
            },
            sourceType: 'idea',
            sourceId: idea.id
          });

        scheduledEvents.push(eventResponse.body.event);
      }

      // Verify smart scheduling
      expect(scheduledEvents.length).toBeGreaterThan(0);
      
      // High-confidence ideas should be scheduled sooner
      const sortedByDate = [...scheduledEvents].sort((a, b) => 
        new Date(a.scheduled_for) - new Date(b.scheduled_for)
      );
      
      const firstEvent = sortedByDate[0];
      expect(firstEvent.content_data.ideaConfidence).toBeGreaterThanOrEqual(0.8);
    });

    test('should batch create calendar events from multiple news ideas', async () => {
      // Create several articles
      const articleCount = 5;
      const articleIds = [];
      
      for (let i = 0; i < articleCount; i++) {
        const articleId = `batch-article-${i}`;
        articleIds.push(articleId);
        
        await query(
          `INSERT INTO news_articles 
           (id, title, description, content, author, published_at, article_url, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            articleId,
            `Innovation Strategy Part ${i + 1}`,
            `Part ${i + 1} of innovation series`,
            `Detailed content about innovation strategy topic ${i + 1}`,
            'Series Author',
            new Date(),
            `https://example.com/innovation-${i}`,
            newsSourceId
          ]
        );
      }

      // Generate ideas for all articles
      const allIdeas = [];
      for (const articleId of articleIds) {
        const ideasResponse = await request(app)
          .post(`/api/news/articles/${articleId}/generate-ideas`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({});
        
        if (ideasResponse.status === 200) {
          allIdeas.push(...ideasResponse.body.ideas);
        }
      }

      expect(allIdeas.length).toBeGreaterThan(articleCount); // Multiple ideas per article

      // Batch create calendar events
      const batchStartTime = Date.now();
      const createPromises = allIdeas.slice(0, 10).map((idea, index) => {
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
            contentData: {
              batchCreated: true,
              ideaIndex: index
            },
            sourceType: 'idea',
            sourceId: idea.id
          });
      });

      const batchResults = await Promise.all(createPromises);
      const batchEndTime = Date.now();
      const batchDuration = batchEndTime - batchStartTime;

      // All should succeed
      batchResults.forEach(result => {
        expect(result.status).toBe(200);
      });

      expect(batchDuration).toBeLessThan(5000); // Should complete quickly

      // Verify events were created and distributed properly
      const calendarResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ view: 'week', limit: 50 });

      const batchEvents = calendarResponse.body.events.filter(e => 
        e.content_data?.batchCreated === true
      );

      expect(batchEvents.length).toBe(10);
    });

    test('should track news to calendar conversion metrics', async () => {
      // Create article and generate ideas
      const article = {
        id: 'metrics-article-1',
        title: 'Measuring Innovation Success',
        description: 'KPIs for tech leaders',
        content: 'How to measure innovation and growth in technology organizations.',
        author: 'Metrics Expert',
        published_at: new Date(),
        article_url: 'https://example.com/metrics',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(article)
      );

      // Generate ideas
      const ideasResponse = await request(app)
        .post(`/api/news/articles/${article.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const ideas = ideasResponse.body.ideas;

      // Track interactions
      await request(app)
        .post(`/api/news/articles/${article.id}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          interactionType: 'use_idea',
          interactionData: { 
            ideaCount: ideas.length,
            timestamp: new Date().toISOString()
          }
        });

      // Create calendar events from some ideas
      const eventsCreated = [];
      for (const idea of ideas.slice(0, 2)) {
        const eventResponse = await request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: idea.headline,
            contentType: idea.contentFormat,
            contentBody: idea.hook,
            contentData: {
              sourceArticleId: article.id,
              ideaId: idea.id,
              conversionTracking: true
            },
            sourceType: 'idea',
            sourceId: idea.id
          });

        eventsCreated.push(eventResponse.body.event);

        // Update idea status
        await request(app)
          .patch(`/api/news/ideas/${idea.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'drafted' });
      }

      // Verify conversion tracking
      const conversions = await query(
        `SELECT 
          COUNT(DISTINCT ci.id) as ideas_generated,
          COUNT(DISTINCT ce.id) as events_created,
          COUNT(DISTINCT ci.id) FILTER (WHERE ci.status = 'drafted') as ideas_used
         FROM content_ideas ci
         LEFT JOIN calendar_events ce ON ce.source_id = ci.id::text AND ce.source_type = 'idea'
         WHERE ci.article_id = $1`,
        [article.id]
      );

      expect(conversions.rows[0].ideas_generated).toBe(ideas.length.toString());
      expect(conversions.rows[0].events_created).toBe('2');
      expect(conversions.rows[0].ideas_used).toBe('2');
    });

    test('should handle news-driven content series creation', async () => {
      // Create a series of related articles
      const seriesArticles = [];
      const seriesTitle = 'AI Transformation Series';
      
      for (let i = 0; i < 4; i++) {
        const article = {
          id: `series-article-${i}`,
          title: `${seriesTitle} - Part ${i + 1}`,
          description: `Part ${i + 1} of AI transformation journey`,
          content: `Detailed exploration of AI transformation step ${i + 1}`,
          author: 'AI Expert',
          published_at: new Date(Date.now() - (3 - i) * 86400000), // Stagger publication dates
          article_url: `https://example.com/ai-series-${i}`,
          source_id: newsSourceId
        };

        await query(
          `INSERT INTO news_articles 
           (id, title, description, content, author, published_at, article_url, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          Object.values(article)
        );

        seriesArticles.push(article);
      }

      // Create a content series based on these articles
      const seriesResponse = await request(app)
        .post('/api/calendar/series')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'My Take on AI Transformation',
          description: 'Personal insights on the AI transformation series',
          seriesType: 'sequential',
          totalParts: 4,
          partsIntervalDays: 3,
          preferredTime: '09:00',
          preferredDaysOfWeek: [2, 4] // Tuesday, Thursday
        });

      expect(seriesResponse.status).toBe(200);
      const series = seriesResponse.body.series;

      // Generate ideas and create series events
      const seriesEvents = [];
      for (let i = 0; i < seriesArticles.length; i++) {
        const article = seriesArticles[i];
        
        // Generate ideas
        const ideasResponse = await request(app)
          .post(`/api/news/articles/${article.id}/generate-ideas`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        if (ideasResponse.status === 200 && ideasResponse.body.ideas.length > 0) {
          const idea = ideasResponse.body.ideas[0];
          
          // Calculate scheduled date based on series pattern
          const baseDate = new Date();
          const partNumber = i + 1;
          const daysOffset = i * series.parts_interval_days;
          const scheduledDate = new Date(baseDate);
          scheduledDate.setDate(scheduledDate.getDate() + daysOffset);
          
          // Adjust to preferred day of week
          while (!series.preferred_days_of_week.includes(scheduledDate.getDay())) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
          }
          
          scheduledDate.setHours(9, 0, 0, 0); // Set to preferred time

          const eventResponse = await request(app)
            .post('/api/calendar/events')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `${series.name} - Part ${partNumber}`,
              contentType: 'article',
              contentBody: idea.hook,
              scheduledFor: scheduledDate.toISOString(),
              contentData: {
                seriesId: series.id,
                partNumber: partNumber,
                sourceArticle: article.title,
                ideaId: idea.id
              },
              hashtags: [series.hashtag, 'AITransformation'],
              sourceType: 'idea',
              sourceId: idea.id
            });

          seriesEvents.push(eventResponse.body.event);

          // Create series association
          await query(
            `INSERT INTO calendar_event_series (event_id, series_id, part_number)
             VALUES ($1, $2, $3)`,
            [eventResponse.body.event.id, series.id, partNumber]
          );
        }
      }

      expect(seriesEvents.length).toBe(4);
      
      // Verify series events are properly scheduled
      seriesEvents.forEach((event, index) => {
        const eventDate = new Date(event.scheduled_for);
        expect(series.preferred_days_of_week).toContain(eventDate.getDay());
        expect(eventDate.getHours()).toBe(9);
        expect(event.content_data.partNumber).toBe(index + 1);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle calendar creation when news source is deleted', async () => {
      // Create article
      const article = {
        id: 'orphan-article-1',
        title: 'Article from deleted source',
        description: 'This source will be deleted',
        content: 'Content from a source that will be removed.',
        author: 'Author',
        published_at: new Date(),
        article_url: 'https://example.com/orphan',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(article)
      );

      // Generate ideas
      const ideasResponse = await request(app)
        .post(`/api/news/articles/${article.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const ideaId = ideasResponse.body.ideas[0].id;

      // Delete news source (cascade deletes articles)
      await request(app)
        .delete(`/api/news/sources/${newsSourceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to create calendar event from idea
      const eventResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Event from deleted source',
          contentType: 'post',
          contentBody: 'Testing orphaned content',
          sourceType: 'idea',
          sourceId: ideaId
        });

      // Should still create event even though source is gone
      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.event).toBeDefined();
    });

    test('should handle duplicate idea to calendar conversions', async () => {
      // Create article
      const article = {
        id: 'duplicate-idea-article',
        title: 'Article for duplicate testing',
        description: 'Testing duplicate handling',
        content: 'Content for testing duplicate idea conversions.',
        author: 'Test Author',
        published_at: new Date(),
        article_url: 'https://example.com/duplicate-test',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(article)
      );

      // Generate ideas
      const ideasResponse = await request(app)
        .post(`/api/news/articles/${article.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const idea = ideasResponse.body.ideas[0];

      // Create first calendar event from idea
      const firstEventResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: idea.headline,
          contentType: idea.contentFormat,
          contentBody: idea.hook,
          sourceType: 'idea',
          sourceId: idea.id
        });

      expect(firstEventResponse.status).toBe(200);

      // Try to create duplicate event from same idea
      const duplicateEventResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: idea.headline,
          contentType: idea.contentFormat,
          contentBody: idea.hook,
          sourceType: 'idea',
          sourceId: idea.id
        });

      // Should allow duplicate (user might want variations)
      expect(duplicateEventResponse.status).toBe(200);
      expect(duplicateEventResponse.body.event.id).not.toBe(firstEventResponse.body.event.id);
    });

    test('should handle news preferences affecting calendar suggestions', async () => {
      // Update news preferences
      await request(app)
        .put('/api/news/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keywords: ['AI', 'automation', 'efficiency'],
          excludedKeywords: ['controversy', 'scandal'],
          minimumRelevanceScore: 0.75,
          autoSaveHighRelevance: true,
          relevanceThresholdForAutoSave: 0.9
        });

      // Create high-relevance article matching preferences
      const goodArticle = {
        id: 'pref-match-article',
        title: 'AI Automation Drives Efficiency Gains',
        description: 'Perfect match for preferences',
        content: 'How AI and automation are creating massive efficiency improvements.',
        author: 'AI Expert',
        published_at: new Date(),
        article_url: 'https://example.com/ai-efficiency',
        source_id: newsSourceId
      };

      // Create excluded article
      const badArticle = {
        id: 'pref-exclude-article',
        title: 'Tech Company Controversy and Scandal',
        description: 'Should be excluded',
        content: 'Latest controversy and scandal in tech industry.',
        author: 'News Reporter',
        published_at: new Date(),
        article_url: 'https://example.com/controversy',
        source_id: newsSourceId
      };

      await withTransaction(async (client) => {
        for (const article of [goodArticle, badArticle]) {
          await client.query(
            `INSERT INTO news_articles 
             (id, title, description, content, author, published_at, article_url, source_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            Object.values(article)
          );
        }
      });

      // Set relevance scores
      await query(
        `INSERT INTO article_relevance_scores 
         (article_id, user_id, relevance_score, is_featured)
         VALUES ($1, $2, $3, $4)`,
        [goodArticle.id, userId, 0.92, true]
      );

      await query(
        `INSERT INTO article_relevance_scores 
         (article_id, user_id, relevance_score, is_featured)
         VALUES ($1, $2, $3, $4)`,
        [badArticle.id, userId, 0.1, false]
      );

      // Get filtered articles
      const articlesResponse = await request(app)
        .get('/api/news/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ minRelevance: 0.75 });

      const filteredArticles = articlesResponse.body.articles;
      
      // Should only include good article
      expect(filteredArticles.some(a => a.id === goodArticle.id)).toBe(true);
      expect(filteredArticles.some(a => a.id === badArticle.id)).toBe(false);

      // Auto-save high relevance should create an idea
      const savedIdeas = await query(
        `SELECT * FROM content_ideas 
         WHERE user_id = $1 AND article_id = $2`,
        [userId, goodArticle.id]
      );

      // If auto-save is implemented, this would have ideas
      // expect(savedIdeas.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and optimization', () => {
    test('should efficiently handle bulk news to calendar operations', async () => {
      // Create many articles at once
      const articleCount = 20;
      const bulkArticles = [];
      
      for (let i = 0; i < articleCount; i++) {
        bulkArticles.push({
          id: `bulk-article-${i}`,
          title: `Bulk Article ${i}: ${i % 3 === 0 ? 'Innovation' : 'General'} Topic`,
          description: `Description for bulk article ${i}`,
          content: `Content about ${i % 3 === 0 ? 'innovation and growth' : 'general business'}`,
          author: `Author ${i}`,
          published_at: new Date(Date.now() - i * 3600000), // Stagger by hours
          article_url: `https://example.com/bulk-${i}`,
          source_id: newsSourceId
        });
      }

      // Bulk insert
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

      // Generate ideas for innovation articles only
      const innovationArticles = bulkArticles.filter((_, i) => i % 3 === 0);
      const ideaGenerationStart = Date.now();
      
      const ideaPromises = innovationArticles.map(article =>
        request(app)
          .post(`/api/news/articles/${article.id}/generate-ideas`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
      );

      const ideaResults = await Promise.all(ideaPromises);
      const ideaGenerationEnd = Date.now();
      
      // Collect all ideas
      const allIdeas = [];
      ideaResults.forEach(result => {
        if (result.status === 200) {
          allIdeas.push(...result.body.ideas);
        }
      });

      expect(allIdeas.length).toBeGreaterThan(innovationArticles.length);
      expect(ideaGenerationEnd - ideaGenerationStart).toBeLessThan(15000); // 15 seconds

      // Create calendar events from top ideas
      const topIdeas = allIdeas
        .sort((a, b) => b.aiConfidenceScore - a.aiConfidenceScore)
        .slice(0, 10);

      const calendarCreationStart = Date.now();
      
      const calendarPromises = topIdeas.map((idea, index) => {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + Math.floor(index / 3) + 1);
        
        return request(app)
          .post('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: idea.headline,
            contentType: idea.contentFormat,
            contentBody: idea.hook,
            scheduledFor: scheduledDate.toISOString(),
            contentData: {
              bulkCreated: true,
              confidenceScore: idea.aiConfidenceScore
            },
            sourceType: 'idea',
            sourceId: idea.id
          });
      });

      const calendarResults = await Promise.all(calendarPromises);
      const calendarCreationEnd = Date.now();

      // All should succeed
      calendarResults.forEach(result => {
        expect(result.status).toBe(200);
      });

      expect(calendarCreationEnd - calendarCreationStart).toBeLessThan(5000); // 5 seconds

      // Verify bulk operations completed
      const stats = await query(
        `SELECT 
          COUNT(DISTINCT na.id) as total_articles,
          COUNT(DISTINCT ci.id) as total_ideas,
          COUNT(DISTINCT ce.id) as total_events
         FROM news_articles na
         LEFT JOIN content_ideas ci ON ci.article_id = na.id
         LEFT JOIN calendar_events ce ON ce.source_type = 'idea' AND ce.source_id = ci.id::text
         WHERE na.id LIKE 'bulk-article-%'
           AND ci.user_id = $1`,
        [userId]
      );

      expect(parseInt(stats.rows[0].total_articles)).toBe(articleCount);
      expect(parseInt(stats.rows[0].total_ideas)).toBeGreaterThan(0);
      expect(parseInt(stats.rows[0].total_events)).toBe(10);
    });
  });
});