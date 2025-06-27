const request = require('supertest');
const app = require('../../src/server');

describe('News Integration (Newshack) End-to-End Tests', () => {
  let authToken;
  let userId;
  let feedId;
  let articleId;

  beforeAll(async () => {
    // Create a test user and login
    const testUser = global.testUtils.generateTestUser();
    testUser.email = `news-test-${Date.now()}@example.com`;
    
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
  });

  describe('News Feed Configuration', () => {
    test('should add RSS feed source', async () => {
      const response = await request(app)
        .post('/api/news/feeds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'TechCrunch',
          url: 'https://techcrunch.com/feed/',
          type: 'rss',
          categories: ['technology', 'startups'],
          checkFrequency: 'hourly'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        feed: {
          id: expect.any(String),
          name: 'TechCrunch',
          url: 'https://techcrunch.com/feed/',
          type: 'rss',
          status: 'active',
          lastChecked: null,
          articleCount: 0
        }
      });

      feedId = response.body.feed.id;
    });

    test('should add JSON API feed source', async () => {
      const response = await request(app)
        .post('/api/news/feeds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'HackerNews Top Stories',
          url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
          type: 'json',
          categories: ['technology', 'programming'],
          checkFrequency: 'every_30_min',
          jsonConfig: {
            itemsPath: '$',
            titlePath: 'title',
            linkPath: 'url',
            descriptionPath: 'text'
          }
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        feed: {
          type: 'json',
          jsonConfig: expect.any(Object)
        }
      });
    });

    test('should list all configured feeds', async () => {
      const response = await request(app)
        .get('/api/news/feeds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        feeds: expect.arrayContaining([
          expect.objectContaining({
            id: feedId,
            name: 'TechCrunch'
          })
        ]),
        totalFeeds: expect.any(Number)
      });

      expect(response.body.feeds.length).toBeGreaterThanOrEqual(2);
    });

    test('should update feed configuration', async () => {
      const response = await request(app)
        .put(`/api/news/feeds/${feedId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categories: ['technology', 'startups', 'AI'],
          checkFrequency: 'every_2_hours',
          filters: {
            keywords: ['AI', 'machine learning', 'personal branding'],
            excludeKeywords: ['crypto', 'blockchain']
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        feed: {
          id: feedId,
          categories: expect.arrayContaining(['AI']),
          filters: expect.objectContaining({
            keywords: expect.arrayContaining(['AI'])
          })
        }
      });
    });

    test('should trigger manual feed refresh', async () => {
      const response = await request(app)
        .post(`/api/news/feeds/${feedId}/refresh`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Feed refresh initiated',
        jobId: expect.any(String)
      });

      // Wait for processing and check results
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await request(app)
        .get(`/api/news/feeds/${feedId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.feed).toMatchObject({
        lastChecked: expect.any(String),
        articleCount: expect.any(Number),
        status: 'active'
      });
    });
  });

  describe('Content Pillar Configuration', () => {
    test('should set up content pillars for relevance scoring', async () => {
      const response = await request(app)
        .post('/api/news/content-pillars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pillars: [
            {
              name: 'AI & Innovation',
              description: 'Artificial intelligence, machine learning, and technological innovation',
              keywords: ['AI', 'artificial intelligence', 'machine learning', 'innovation', 'technology'],
              weight: 1.5
            },
            {
              name: 'Personal Branding',
              description: 'Personal branding, thought leadership, and professional development',
              keywords: ['personal brand', 'thought leadership', 'career', 'professional development'],
              weight: 2.0
            },
            {
              name: 'Leadership',
              description: 'Leadership strategies, team building, and management',
              keywords: ['leadership', 'management', 'team building', 'culture'],
              weight: 1.2
            }
          ]
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        pillars: expect.arrayContaining([
          expect.objectContaining({
            name: 'AI & Innovation',
            weight: 1.5
          })
        ])
      });
    });

    test('should analyze pillar coverage in recent articles', async () => {
      const response = await request(app)
        .get('/api/news/pillar-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: '7d'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        analysis: {
          pillarCoverage: expect.any(Object),
          recommendations: expect.any(Array),
          gaps: expect.any(Array)
        }
      });
    });
  });

  describe('Article Discovery and Relevance', () => {
    test('should fetch and score articles by relevance', async () => {
      const response = await request(app)
        .get('/api/news/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          limit: 20,
          minRelevanceScore: 0.5
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        articles: expect.any(Array),
        totalArticles: expect.any(Number)
      });

      if (response.body.articles.length > 0) {
        const article = response.body.articles[0];
        expect(article).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          url: expect.any(String),
          source: expect.any(String),
          publishedAt: expect.any(String),
          relevanceScore: expect.any(Number),
          matchedPillars: expect.any(Array),
          summary: expect.any(String)
        });

        articleId = article.id;

        // Verify articles are sorted by relevance
        const scores = response.body.articles.map(a => a.relevanceScore);
        expect(scores).toEqual([...scores].sort((a, b) => b - a));
      }
    });

    test('should get detailed article analysis', async () => {
      if (!articleId) {
        console.log('No articles found, skipping detailed analysis test');
        return;
      }

      const response = await request(app)
        .get(`/api/news/articles/${articleId}/analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        analysis: {
          articleId: articleId,
          keyPoints: expect.any(Array),
          contentAngle: expect.any(String),
          potentialTopics: expect.any(Array),
          alignmentWithVoice: expect.any(Number)
        }
      });
    });

    test('should save article for later reference', async () => {
      if (!articleId) {
        console.log('No articles found, skipping save test');
        return;
      }

      const response = await request(app)
        .post(`/api/news/articles/${articleId}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Great article about AI trends, perfect for my next post',
          tags: ['AI', 'trends', 'inspiration']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        savedArticle: {
          articleId: articleId,
          notes: expect.any(String),
          tags: expect.arrayContaining(['AI'])
        }
      });
    });

    test('should get saved articles', async () => {
      const response = await request(app)
        .get('/api/news/saved-articles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        savedArticles: expect.any(Array)
      });

      if (articleId && response.body.savedArticles.length > 0) {
        expect(response.body.savedArticles).toContainEqual(
          expect.objectContaining({
            articleId: articleId
          })
        );
      }
    });
  });

  describe('Content Idea Generation from News', () => {
    test('should generate content ideas from trending articles', async () => {
      const response = await request(app)
        .post('/api/news/generate-ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timeframe: '24h',
          ideaCount: 5,
          contentTypes: ['linkedin_post', 'article_outline']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        ideas: expect.any(Array)
      });

      if (response.body.ideas.length > 0) {
        const idea = response.body.ideas[0];
        expect(idea).toMatchObject({
          id: expect.any(String),
          topic: expect.any(String),
          angle: expect.any(String),
          contentType: expect.any(String),
          relevanceScore: expect.any(Number),
          sourceArticles: expect.any(Array),
          outline: expect.any(Object)
        });
      }
    });

    test('should create content from news-inspired idea', async () => {
      if (!articleId) {
        console.log('No articles found, skipping content creation test');
        return;
      }

      const response = await request(app)
        .post('/api/content/generate-from-news')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          articleId: articleId,
          contentType: 'linkedin_post',
          angle: 'thought_leadership',
          includePersonalPerspective: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: {
          text: expect.any(String),
          contentType: 'linkedin_post',
          metadata: expect.objectContaining({
            sourceArticleId: articleId,
            newsInspired: true
          })
        }
      });

      // Verify content references the article appropriately
      expect(response.body.content.text.length).toBeGreaterThan(100);
    });
  });

  describe('Weekly News Digest and Insights', () => {
    test('should generate weekly news digest', async () => {
      const response = await request(app)
        .post('/api/news/weekly-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        digest: {
          id: expect.any(String),
          weekOf: expect.any(String),
          topArticles: expect.any(Array),
          trendingSummary: expect.any(String),
          contentRecommendations: expect.any(Array),
          pillarCoverage: expect.any(Object)
        }
      });
    });

    test('should subscribe to digest notifications', async () => {
      const response = await request(app)
        .post('/api/news/digest-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'weekly',
          deliveryDay: 'monday',
          deliveryTime: '09:00',
          includeContentIdeas: true,
          maxArticles: 10
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        subscription: {
          active: true,
          frequency: 'weekly',
          nextDelivery: expect.any(String)
        }
      });
    });
  });

  describe('News Analytics and Performance', () => {
    test('should track content performance from news-inspired posts', async () => {
      const response = await request(app)
        .get('/api/analytics/news-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: '30d'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        analytics: {
          newsInspiredPosts: expect.any(Number),
          averageEngagement: expect.any(Number),
          topPerformingSources: expect.any(Array),
          bestPerformingPillars: expect.any(Array),
          conversionRate: expect.any(Number) // Articles read to content created
        }
      });
    });

    test('should get source quality metrics', async () => {
      const response = await request(app)
        .get('/api/news/source-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        metrics: expect.any(Array)
      });

      if (response.body.metrics.length > 0) {
        const metric = response.body.metrics[0];
        expect(metric).toMatchObject({
          feedId: expect.any(String),
          feedName: expect.any(String),
          averageRelevance: expect.any(Number),
          articlesProcessed: expect.any(Number),
          contentGenerated: expect.any(Number),
          qualityScore: expect.any(Number)
        });
      }
    });
  });

  describe('Feed Management and Cleanup', () => {
    test('should pause feed temporarily', async () => {
      const response = await request(app)
        .post(`/api/news/feeds/${feedId}/pause`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Too many irrelevant articles',
          duration: '7d'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        feed: {
          id: feedId,
          status: 'paused',
          resumeAt: expect.any(String)
        }
      });
    });

    test('should delete feed and associated data', async () => {
      const response = await request(app)
        .delete(`/api/news/feeds/${feedId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deleteArticles: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('deleted'),
        articlesRemoved: expect.any(Number)
      });
    });
  });
});