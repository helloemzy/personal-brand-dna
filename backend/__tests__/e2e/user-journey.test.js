const request = require('supertest');
const app = require('../../src/server');
const { connectDB, disconnectDB, query } = require('../../src/config/database');

describe('End-to-End User Journey Tests', () => {
  let authToken;
  let userId;
  let voiceProfileId;
  let contentId;
  let testUser;

  beforeAll(async () => {
    // Connect to test database
    await connectDB();
    
    // Clean up test data
    await query('DELETE FROM users WHERE email LIKE $1', ['e2e-test%']);
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    
    // Disconnect from database
    await disconnectDB();
  });

  describe('User Registration and Authentication Journey', () => {
    beforeEach(() => {
      testUser = global.testUtils.generateTestUser();
      testUser.email = `e2e-test-${Date.now()}@example.com`;
    });

    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('registered successfully'),
        user: {
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName
        }
      });

      userId = response.body.user.id;
    });

    test('should not allow duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Email already registered'
      });
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName
        }
      });

      authToken = response.body.token;
    });

    test('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Invalid credentials'
      });
    });

    test('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: testUser.email,
          id: userId
        }
      });
    });

    test('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'No token provided'
      });
    });
  });

  describe('Voice Discovery and Analysis Journey', () => {
    test('should initiate voice discovery session', async () => {
      const response = await request(app)
        .post('/api/voice/discovery/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          discoveryType: 'conversation'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        session: {
          id: expect.any(String),
          status: 'active',
          questions: expect.any(Array)
        }
      });
    });

    test('should upload audio recording for analysis', async () => {
      // Mock audio file upload
      const mockAudioBuffer = Buffer.from('mock-audio-data');
      
      const response = await request(app)
        .post('/api/voice/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', mockAudioBuffer, 'test-recording.webm')
        .field('duration', '300')
        .field('transcript', 'This is a test transcript of my speaking style.')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Audio uploaded successfully',
        transcriptionId: expect.any(String)
      });
    });

    test('should analyze voice and create profile', async () => {
      const response = await request(app)
        .post('/api/voice/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transcript: 'I am passionate about innovation and technology. My approach is collaborative and I believe in empowering teams.',
          context: 'professional_introduction'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        voiceProfile: {
          id: expect.any(String),
          userId: userId,
          dimensions: expect.objectContaining({
            formality: expect.any(Number),
            analyticalDepth: expect.any(Number),
            emotionalExpressiveness: expect.any(Number)
          })
        }
      });

      voiceProfileId = response.body.voiceProfile.id;
    });

    test('should retrieve voice profile', async () => {
      const response = await request(app)
        .get('/api/voice/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        voiceProfile: {
          id: voiceProfileId,
          userId: userId
        }
      });
    });
  });

  describe('Content Generation Journey', () => {
    test('should generate content based on voice profile', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topic: 'The importance of continuous learning in tech',
          contentType: 'linkedin_post',
          tone: 'professional',
          includeHashtags: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: {
          id: expect.any(String),
          text: expect.any(String),
          contentType: 'linkedin_post',
          metadata: expect.objectContaining({
            topic: 'The importance of continuous learning in tech',
            voiceProfileId: voiceProfileId
          })
        }
      });

      contentId = response.body.content.id;
      
      // Verify content includes expected elements
      expect(response.body.content.text).toContain('learning');
      expect(response.body.content.text).toMatch(/#\w+/); // Has hashtags
    });

    test('should generate content variations', async () => {
      const response = await request(app)
        .post('/api/content/variations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalContentId: contentId,
          count: 3
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        variations: expect.arrayContaining([
          expect.objectContaining({
            text: expect.any(String),
            variationType: expect.any(String)
          })
        ])
      });

      expect(response.body.variations).toHaveLength(3);
    });

    test('should retrieve content history', async () => {
      const response = await request(app)
        .get('/api/content/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: expect.arrayContaining([
          expect.objectContaining({
            id: contentId,
            contentType: 'linkedin_post'
          })
        ]),
        pagination: {
          total: expect.any(Number),
          limit: 10,
          offset: 0
        }
      });
    });

    test('should update content status', async () => {
      const response = await request(app)
        .patch(`/api/content/${contentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'published'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: {
          id: contentId,
          status: 'published'
        }
      });
    });
  });

  describe('Subscription and Payment Journey', () => {
    test('should retrieve available subscription plans', async () => {
      const response = await request(app)
        .get('/api/payments/plans')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        plans: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            price: expect.any(Number),
            features: expect.any(Array)
          })
        ])
      });
    });

    test('should create payment intent for subscription', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'professional',
          billingInterval: 'monthly'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        clientSecret: expect.any(String),
        amount: expect.any(Number)
      });
    });

    test('should check subscription status', async () => {
      const response = await request(app)
        .get('/api/users/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        subscription: {
          tier: 'free',
          status: 'active'
        }
      });
    });
  });

  describe('Analytics and Performance Journey', () => {
    test('should track content performance', async () => {
      // First, simulate some engagement
      await request(app)
        .post(`/api/content/${contentId}/engagement`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'linkedin',
          metrics: {
            views: 150,
            likes: 12,
            comments: 3,
            shares: 2
          }
        })
        .expect(200);

      // Then retrieve analytics
      const response = await request(app)
        .get('/api/analytics/content')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: '7d'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        analytics: {
          totalPosts: expect.any(Number),
          totalEngagement: expect.any(Number),
          averageEngagementRate: expect.any(Number),
          topPerformingContent: expect.any(Array)
        }
      });
    });

    test('should get voice analysis insights', async () => {
      const response = await request(app)
        .get('/api/analytics/voice-insights')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        insights: {
          voiceConsistency: expect.any(Number),
          mostEffectiveTones: expect.any(Array),
          contentTypePerformance: expect.any(Object)
        }
      });
    });
  });

  describe('Profile Management Journey', () => {
    test('should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          industry: 'Technology',
          role: 'Senior Software Engineer',
          company: 'Tech Corp',
          bio: 'Passionate about building scalable systems'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          industry: 'Technology',
          role: 'Senior Software Engineer',
          company: 'Tech Corp'
        }
      });
    });

    test('should update notification preferences', async () => {
      const response = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          emailNotifications: {
            contentReady: true,
            weeklyDigest: false,
            tipsAndTricks: true
          },
          contentPreferences: {
            defaultContentType: 'linkedin_post',
            includeHashtags: true,
            includeEmojis: false
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        preferences: {
          emailNotifications: expect.any(Object),
          contentPreferences: expect.any(Object)
        }
      });
    });

    test('should change password', async () => {
      const newPassword = 'NewSecurePassword123!';
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: newPassword
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully'
      });

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid content generation request', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          contentType: 'linkedin_post'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('required')
      });
    });

    test('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(11).fill(null).map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password'
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      expect(rateLimited).toBe(true);
    });

    test('should handle expired token gracefully', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6MTYwOTQ1OTIwMX0.invalid';
      
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('token')
      });
    });
  });

  describe('Cleanup and Logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });

      // Verify token is invalidated
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(profileResponse.body.error).toBeDefined();
    });
  });
});