const request = require('supertest');
const app = require('../../src/server');
const { query, withTransaction } = require('../../src/config/database');
const { calculateArticleRelevance } = require('../../src/services/newsRelevanceService');

describe('Workshop → News Integration', () => {
  let authToken;
  let userId;
  let workshopSessionId;
  let newsSourceId;

  beforeAll(async () => {
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `workshop-news-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Workshop',
        lastName: 'News'
      });
    
    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await query('DELETE FROM users WHERE id = $1', [userId]);
  });

  describe('Workshop data influences news relevance scoring', () => {
    beforeEach(async () => {
      // Create and complete a workshop session
      const workshopStart = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      workshopSessionId = workshopStart.body.sessionId;

      // Save workshop data with specific values and preferences
      await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5],
          values: {
            selected: ['innovation', 'collaboration', 'integrity'],
            custom: [],
            rankings: {
              'innovation': 1,
              'collaboration': 2,
              'integrity': 3
            }
          },
          tonePreferences: {
            formal_casual: 0.7,
            concise_detailed: 0.6,
            analytical_creative: 0.8,
            serious_playful: 0.5
          },
          audiencePersonas: [
            {
              id: 'persona-1',
              name: 'Tech Leaders',
              role: 'CTO/VP Engineering',
              industry: 'Technology',
              painPoints: ['scaling teams', 'technical debt'],
              goals: ['innovation', 'efficiency'],
              communicationStyle: 'data-driven'
            }
          ],
          writingSample: {
            text: 'I believe in building innovative solutions that drive meaningful change in the technology sector.',
            wordCount: 12,
            uploadedAt: new Date().toISOString()
          },
          personalityQuiz: {
            responses: [
              { questionId: 'q1', answer: 'a', answeredAt: new Date().toISOString() }
            ]
          }
        });

      // Complete workshop to generate brand profile
      await request(app)
        .post(`/api/workshop/session/${workshopSessionId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      // Add a news source
      const sourceResponse = await request(app)
        .post('/api/news/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tech Innovation Blog',
          feedUrl: 'https://example.com/tech-feed.rss',
          feedType: 'rss',
          category: 'technology'
        });
      
      newsSourceId = sourceResponse.body.source.id;
    });

    test('should score articles higher when they match workshop values', async () => {
      // Create test articles
      const innovationArticle = {
        id: 'article-1',
        title: 'Breaking Innovation in AI Technology',
        description: 'New collaborative approaches to innovation in tech',
        content: 'This article discusses innovative solutions and collaborative approaches to solving technical challenges.',
        author: 'Tech Writer',
        published_at: new Date(),
        article_url: 'https://example.com/innovation-article',
        source_id: newsSourceId
      };

      const unrelatedArticle = {
        id: 'article-2',
        title: 'Celebrity News Update',
        description: 'Latest celebrity gossip and entertainment news',
        content: 'Entertainment industry updates and celebrity lifestyle news.',
        author: 'Entertainment Writer',
        published_at: new Date(),
        article_url: 'https://example.com/celebrity-article',
        source_id: newsSourceId
      };

      // Insert articles into database
      await withTransaction(async (client) => {
        for (const article of [innovationArticle, unrelatedArticle]) {
          await client.query(
            `INSERT INTO news_articles 
             (id, title, description, content, author, published_at, article_url, source_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              article.id,
              article.title,
              article.description,
              article.content,
              article.author,
              article.published_at,
              article.article_url,
              article.source_id
            ]
          );
        }
      });

      // Get user profile for relevance calculation
      const profileResult = await query(
        `SELECT brand_voice_profile, content_pillars 
         FROM workshop_analysis_results 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      const userProfile = {
        userId,
        brandVoiceProfile: profileResult.rows[0].brand_voice_profile,
        contentPillars: profileResult.rows[0].content_pillars || []
      };

      // Calculate relevance scores
      const innovationScore = await calculateArticleRelevance(innovationArticle, userProfile);
      const unrelatedScore = await calculateArticleRelevance(unrelatedArticle, userProfile);

      // Innovation article should score significantly higher
      expect(innovationScore.relevanceScore).toBeGreaterThan(0.7);
      expect(unrelatedScore.relevanceScore).toBeLessThan(0.4);
      expect(innovationScore.contentPillarMatches).toContain('innovation');
    });

    test('should adjust relevance based on audience personas', async () => {
      // Create article targeting tech leaders
      const techLeaderArticle = {
        id: 'article-3',
        title: 'Scaling Engineering Teams: A CTO Guide',
        description: 'Best practices for CTOs managing technical debt while scaling',
        content: 'This guide helps technology leaders scale their engineering teams efficiently while managing technical debt.',
        author: 'Tech Leadership Expert',
        published_at: new Date(),
        article_url: 'https://example.com/cto-guide',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          techLeaderArticle.id,
          techLeaderArticle.title,
          techLeaderArticle.description,
          techLeaderArticle.content,
          techLeaderArticle.author,
          techLeaderArticle.published_at,
          techLeaderArticle.article_url,
          techLeaderArticle.source_id
        ]
      );

      // Get articles with relevance scores
      const response = await request(app)
        .get('/api/news/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ minRelevance: 0 });

      const techArticle = response.body.articles.find(a => a.id === 'article-3');
      
      expect(techArticle).toBeDefined();
      expect(techArticle.relevance_score).toBeGreaterThan(0.8);
      expect(techArticle.content_pillar_matches).toContain('leadership');
    });

    test('should apply tone preferences to content idea generation', async () => {
      // Generate content ideas from an article
      const articleForIdeas = {
        id: 'article-4',
        title: 'Data-Driven Innovation Strategies',
        description: 'How to use analytics for innovation',
        content: 'Detailed analysis of how data analytics drives innovation in technology companies.',
        author: 'Analytics Expert',
        published_at: new Date(),
        article_url: 'https://example.com/data-innovation',
        source_id: newsSourceId
      };

      await query(
        `INSERT INTO news_articles 
         (id, title, description, content, author, published_at, article_url, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          articleForIdeas.id,
          articleForIdeas.title,
          articleForIdeas.description,
          articleForIdeas.content,
          articleForIdeas.author,
          articleForIdeas.published_at,
          articleForIdeas.article_url,
          articleForIdeas.source_id
        ]
      );

      const ideasResponse = await request(app)
        .post(`/api/news/articles/${articleForIdeas.id}/generate-ideas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(ideasResponse.status).toBe(200);
      expect(ideasResponse.body.ideas).toHaveLength(3);

      // Ideas should reflect analytical tone preference (0.8)
      const ideas = ideasResponse.body.ideas;
      ideas.forEach(idea => {
        expect(idea.outline).toContain('data');
        expect(idea.keyPoints.length).toBeGreaterThan(2);
        expect(idea.estimatedWordCount).toBeGreaterThan(500); // Detailed preference
      });
    });

    test('should persist workshop influence on news preferences', async () => {
      // Update news preferences based on workshop data
      await request(app)
        .put('/api/news/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keywords: ['innovation', 'collaboration', 'technology leadership'],
          excludedKeywords: ['celebrity', 'entertainment'],
          minimumRelevanceScore: 0.6,
          ideaGenerationEnabled: true,
          autoSaveHighRelevance: true,
          relevanceThresholdForAutoSave: 0.85
        });

      // Verify preferences reflect workshop values
      const prefsResponse = await request(app)
        .get('/api/news/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(prefsResponse.body.preferences.keywords).toContain('innovation');
      expect(prefsResponse.body.preferences.keywords).toContain('collaboration');
      expect(prefsResponse.body.preferences.excludedKeywords).toContain('entertainment');
    });

    test('should track interaction patterns aligned with workshop profile', async () => {
      // Simulate user interactions
      const articles = [
        { id: 'article-1', expectedInteraction: 'save' },
        { id: 'article-2', expectedInteraction: 'dismiss' },
        { id: 'article-3', expectedInteraction: 'use_idea' }
      ];

      for (const { id, expectedInteraction } of articles) {
        await request(app)
          .post(`/api/news/articles/${id}/interact`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            interactionType: expectedInteraction,
            interactionData: { reason: 'relevance' }
          });
      }

      // Verify interaction patterns
      const interactionsResult = await query(
        `SELECT article_id, interaction_type 
         FROM user_article_interactions 
         WHERE user_id = $1 
         ORDER BY created_at`,
        [userId]
      );

      expect(interactionsResult.rows).toHaveLength(3);
      expect(interactionsResult.rows[0].interaction_type).toBe('save');
      expect(interactionsResult.rows[1].interaction_type).toBe('dismiss');
      expect(interactionsResult.rows[2].interaction_type).toBe('use_idea');
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle missing workshop data gracefully', async () => {
      // Create new user without workshop
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `no-workshop-${Date.now()}@test.com`,
          password: 'TestPassword123!',
          firstName: 'No',
          lastName: 'Workshop'
        });

      const newAuthToken = newUserResponse.body.token;

      // Try to generate ideas without workshop profile
      const response = await request(app)
        .post('/api/news/articles/article-1/generate-ideas')
        .set('Authorization', `Bearer ${newAuthToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('complete the brand workshop first');

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [newUserResponse.body.user.id]);
    });

    test('should handle concurrent workshop updates affecting news', async () => {
      // Start multiple workshop saves in parallel
      const saves = [];
      for (let i = 0; i < 3; i++) {
        saves.push(
          request(app)
            .post(`/api/workshop/session/${workshopSessionId}/save`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              currentStep: 2,
              completedSteps: [1, 2],
              values: {
                selected: [`value${i}`, 'collaboration'],
                custom: [],
                rankings: {}
              },
              tonePreferences: {
                formal_casual: 0.5 + (i * 0.1),
                concise_detailed: 0.5,
                analytical_creative: 0.5,
                serious_playful: 0.5
              }
            })
        );
      }

      const results = await Promise.all(saves);
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Verify final state is consistent
      const sessionResponse = await request(app)
        .get(`/api/workshop/session/${workshopSessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(sessionResponse.body.session.values).toBeDefined();
      expect(sessionResponse.body.session.tonePreferences).toBeDefined();
    });
  });

  describe('Performance considerations', () => {
    test('should efficiently calculate relevance for multiple articles', async () => {
      // Create many test articles
      const articles = [];
      for (let i = 0; i < 50; i++) {
        articles.push({
          id: `perf-article-${i}`,
          title: `Article ${i}: ${i % 3 === 0 ? 'Innovation' : 'Random'} Topic`,
          description: `Description for article ${i}`,
          content: `Content discussing ${i % 3 === 0 ? 'innovation and collaboration' : 'unrelated topics'}`,
          author: `Author ${i}`,
          published_at: new Date(),
          article_url: `https://example.com/article-${i}`,
          source_id: newsSourceId
        });
      }

      // Bulk insert articles
      await withTransaction(async (client) => {
        for (const article of articles) {
          await client.query(
            `INSERT INTO news_articles 
             (id, title, description, content, author, published_at, article_url, source_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            Object.values(article)
          );
        }
      });

      // Measure time to fetch and score articles
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/news/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 50, minRelevance: 0 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.articles.length).toBeLessThanOrEqual(50);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify relevance scoring worked
      const innovationArticles = response.body.articles.filter(a => 
        a.title.includes('Innovation')
      );
      const randomArticles = response.body.articles.filter(a => 
        !a.title.includes('Innovation')
      );

      if (innovationArticles.length > 0 && randomArticles.length > 0) {
        const avgInnovationScore = innovationArticles.reduce((sum, a) => 
          sum + (a.relevance_score || 0), 0
        ) / innovationArticles.length;
        
        const avgRandomScore = randomArticles.reduce((sum, a) => 
          sum + (a.relevance_score || 0), 0
        ) / randomArticles.length;

        expect(avgInnovationScore).toBeGreaterThan(avgRandomScore);
      }
    });
  });
});