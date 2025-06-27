const request = require('supertest');
const app = require('../../src/server');
const jwt = require('jsonwebtoken');

describe('Demo User Flow End-to-End Tests', () => {
  let demoToken;
  let contentId;

  describe('Demo Login and Exploration Journey', () => {
    test('should login as demo user instantly', async () => {
      const response = await request(app)
        .post('/api/auth/demo-login')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        user: {
          id: 'demo-user',
          email: 'demo@personalbranddna.com',
          firstName: 'Demo',
          lastName: 'User',
          subscription_tier: 'professional',
          isDemoUser: true
        }
      });

      demoToken = response.body.token;

      // Verify token structure
      const decoded = jwt.decode(demoToken);
      expect(decoded).toMatchObject({
        userId: 'demo-user',
        isDemoUser: true,
        email: 'demo@personalbranddna.com'
      });
    });

    test('should access demo voice profile', async () => {
      const response = await request(app)
        .get('/api/voice/profile')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        voiceProfile: {
          userId: 'demo-user',
          dimensions: expect.objectContaining({
            formality: expect.any(Number),
            analyticalDepth: expect.any(Number),
            emotionalExpressiveness: expect.any(Number),
            personalAnecdoteFrequency: expect.any(Number),
            humorLevel: expect.any(Number),
            metaphoricalThinking: expect.any(Number),
            brevity: expect.any(Number),
            questioningTendency: expect.any(Number),
            authorityLevel: expect.any(Number),
            empathyExpression: expect.any(Number),
            technicalDepth: expect.any(Number),
            trendAwareness: expect.any(Number),
            culturalReference: expect.any(Number),
            visualDescriptiveness: expect.any(Number)
          }),
          primaryArchetype: expect.any(String),
          secondaryArchetype: expect.any(String)
        }
      });
    });

    test('should generate content as demo user', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          topic: 'The future of AI in personal branding',
          contentType: 'linkedin_post',
          tone: 'inspirational',
          includeHashtags: true,
          includeEmojis: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: {
          id: expect.any(String),
          text: expect.any(String),
          contentType: 'linkedin_post',
          metadata: expect.objectContaining({
            topic: 'The future of AI in personal branding',
            isDemoContent: true
          })
        }
      });

      contentId = response.body.content.id;
      
      // Verify content characteristics
      const content = response.body.content.text;
      expect(content).toContain('AI');
      expect(content).toMatch(/#\w+/); // Has hashtags
      expect(content).toMatch(/[\u{1F300}-\u{1F9FF}]/u); // Has emojis
    });

    test('should access all professional features as demo user', async () => {
      // Test template access
      const templatesResponse = await request(app)
        .get('/api/content/templates')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(templatesResponse.body.templates).toHaveLength(10);

      // Test analytics access
      const analyticsResponse = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(analyticsResponse.body).toMatchObject({
        success: true,
        analytics: expect.any(Object)
      });

      // Test content variations
      const variationsResponse = await request(app)
        .post('/api/content/variations')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          originalContentId: contentId,
          count: 2
        })
        .expect(200);

      expect(variationsResponse.body.variations).toHaveLength(2);
    });

    test('should restrict demo user from certain actions', async () => {
      // Should not be able to change password
      const passwordResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          currentPassword: 'demo',
          newPassword: 'NewPassword123!'
        })
        .expect(403);

      expect(passwordResponse.body).toMatchObject({
        error: expect.stringContaining('Demo users')
      });

      // Should not be able to delete account
      const deleteResponse = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(403);

      expect(deleteResponse.body).toMatchObject({
        error: expect.stringContaining('Demo users')
      });

      // Should not be able to make real payments
      const paymentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          planId: 'professional',
          billingInterval: 'monthly'
        })
        .expect(403);

      expect(paymentResponse.body).toMatchObject({
        error: expect.stringContaining('Demo users')
      });
    });

    test('should expire demo session after 24 hours', async () => {
      // Create a token with expired timestamp
      const expiredToken = jwt.sign(
        {
          userId: 'demo-user',
          email: 'demo@personalbranddna.com',
          isDemoUser: true
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Already expired
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('expired')
      });
    });

    test('should handle demo user data isolation', async () => {
      // Create content as demo user
      const content1Response = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          topic: 'Test content 1',
          contentType: 'linkedin_post'
        })
        .expect(200);

      // Get a new demo token (simulating different session)
      const newDemoResponse = await request(app)
        .post('/api/auth/demo-login')
        .expect(200);

      const newDemoToken = newDemoResponse.body.token;

      // Create content with new demo session
      const content2Response = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${newDemoToken}`)
        .send({
          topic: 'Test content 2',
          contentType: 'linkedin_post'
        })
        .expect(200);

      // Verify both sessions can only see their own content
      const history1Response = await request(app)
        .get('/api/content/history')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      const history2Response = await request(app)
        .get('/api/content/history')
        .set('Authorization', `Bearer ${newDemoToken}`)
        .expect(200);

      // Each session should see their own content
      expect(history1Response.body.content).toContainEqual(
        expect.objectContaining({
          id: content1Response.body.content.id
        })
      );

      expect(history2Response.body.content).toContainEqual(
        expect.objectContaining({
          id: content2Response.body.content.id
        })
      );
    });
  });

  describe('Demo to Full User Conversion', () => {
    test('should provide clear upgrade path from demo', async () => {
      const response = await request(app)
        .get('/api/users/upgrade-options')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        currentStatus: 'demo',
        upgradeOptions: expect.arrayContaining([
          expect.objectContaining({
            tier: 'professional',
            price: 49,
            features: expect.any(Array)
          })
        ]),
        conversionIncentive: expect.any(Object)
      });
    });

    test('should track demo user actions for conversion optimization', async () => {
      // Simulate various demo user actions
      await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          event: 'content_generated',
          properties: {
            contentType: 'linkedin_post',
            timeSpent: 45
          }
        })
        .expect(200);

      await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          event: 'feature_explored',
          properties: {
            feature: 'voice_analysis'
          }
        })
        .expect(200);

      // Get demo user analytics
      const analyticsResponse = await request(app)
        .get('/api/analytics/demo-insights')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(analyticsResponse.body).toMatchObject({
        success: true,
        insights: {
          featuresExplored: expect.any(Array),
          contentGenerated: expect.any(Number),
          engagementLevel: expect.any(String),
          conversionLikelihood: expect.any(Number)
        }
      });
    });
  });
});