const request = require('supertest');
const app = require('../../src/server');

describe('BrandHack Workshop End-to-End Tests', () => {
  let authToken;
  let userId;
  let workshopSessionId;
  
  beforeAll(async () => {
    // Create a test user and login
    const testUser = global.testUtils.generateTestUser();
    testUser.email = `workshop-test-${Date.now()}@example.com`;
    
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

  describe('5-Step Brand Workshop Journey', () => {
    test('should start a new workshop session', async () => {
      const response = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        session: {
          id: expect.any(String),
          userId: userId,
          status: 'in_progress',
          currentStep: 1,
          completedSteps: []
        }
      });

      workshopSessionId = response.body.session.id;
    });

    test('should complete Step 1: Values Audit', async () => {
      const response = await request(app)
        .post('/api/workshop/values-audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: workshopSessionId,
          values: [
            { value: 'Innovation', importance: 'core' },
            { value: 'Integrity', importance: 'core' },
            { value: 'Collaboration', importance: 'important' },
            { value: 'Excellence', importance: 'important' },
            { value: 'Growth', importance: 'supportive' }
          ],
          professionalMission: 'To leverage technology to create meaningful impact and empower teams to achieve their full potential.'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        workshop: {
          sessionId: workshopSessionId,
          currentStep: 2,
          completedSteps: expect.arrayContaining([1]),
          valuesProfile: {
            coreValues: expect.arrayContaining(['Innovation', 'Integrity']),
            importantValues: expect.arrayContaining(['Collaboration', 'Excellence']),
            supportiveValues: expect.arrayContaining(['Growth'])
          }
        }
      });
    });

    test('should complete Step 2: Tone Preferences', async () => {
      const response = await request(app)
        .post('/api/workshop/tone-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: workshopSessionId,
          toneSettings: {
            formality: 7,
            enthusiasm: 8,
            analyticalDepth: 9,
            empathy: 7,
            humor: 4,
            brevity: 6,
            storytelling: 8,
            dataOrientation: 9,
            motivational: 7,
            educational: 9
          },
          communicationStyle: 'thought_leader'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        workshop: {
          sessionId: workshopSessionId,
          currentStep: 3,
          completedSteps: expect.arrayContaining([1, 2]),
          toneProfile: {
            primaryStyle: 'thought_leader',
            toneBalance: expect.any(Object)
          }
        }
      });
    });

    test('should complete Step 3: Audience Builder', async () => {
      const response = await request(app)
        .post('/api/workshop/audience-builder')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: workshopSessionId,
          audiences: [
            {
              name: 'Tech Leaders',
              description: 'CTOs, VPs of Engineering, and technical directors',
              demographics: {
                seniority: 'senior',
                industry: 'technology',
                companySize: 'enterprise'
              },
              painPoints: [
                'Scaling engineering teams',
                'Technical debt management',
                'Innovation vs stability'
              ],
              contentPreferences: ['case_studies', 'thought_leadership', 'trends']
            },
            {
              name: 'Aspiring Engineers',
              description: 'Junior to mid-level developers looking to grow',
              demographics: {
                seniority: 'junior_to_mid',
                industry: 'technology',
                companySize: 'all'
              },
              painPoints: [
                'Career growth',
                'Skill development',
                'Breaking into leadership'
              ],
              contentPreferences: ['tutorials', 'career_advice', 'personal_stories']
            }
          ],
          primaryAudience: 'Tech Leaders'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        workshop: {
          sessionId: workshopSessionId,
          currentStep: 4,
          completedSteps: expect.arrayContaining([1, 2, 3]),
          audienceProfile: {
            audiences: expect.arrayContaining([
              expect.objectContaining({ name: 'Tech Leaders' }),
              expect.objectContaining({ name: 'Aspiring Engineers' })
            ]),
            primaryFocus: 'Tech Leaders'
          }
        }
      });
    });

    test('should complete Step 4: Writing Sample Analysis', async () => {
      const writingSample = `
        The journey of building scalable systems has taught me that technology is only as powerful as the teams behind it. 
        In my 15 years leading engineering organizations, I've discovered that the most elegant solutions often emerge from 
        diverse perspectives colliding in productive ways.

        Last quarter, our team faced a critical decision: rebuild our entire infrastructure or patch the existing system. 
        The data suggested a rebuild would cost 40% more initially but save 60% in maintenance over two years. However, 
        the real insight came from our junior engineer who asked, "What if we could do both?"

        This question led to our hybrid approach - modernizing critical paths while maintaining stable legacy systems. 
        The result? We delivered 3x faster than a full rebuild with 50% less risk. 

        Leadership isn't about having all the answers. It's about creating space for the right questions to emerge.

        What unconventional decisions have shaped your engineering journey?
      `;

      const response = await request(app)
        .post('/api/workshop/writing-sample')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: workshopSessionId,
          writingSample: writingSample,
          context: 'linkedin_post'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        workshop: {
          sessionId: workshopSessionId,
          currentStep: 5,
          completedSteps: expect.arrayContaining([1, 2, 3, 4]),
          writingAnalysis: {
            styleElements: expect.objectContaining({
              usesData: true,
              usesStories: true,
              usesQuestions: true,
              usesMetaphors: expect.any(Boolean)
            }),
            voiceCharacteristics: expect.any(Object),
            contentPatterns: expect.any(Array)
          }
        }
      });
    });

    test('should complete Step 5: Personality Quiz', async () => {
      const response = await request(app)
        .post('/api/workshop/personality-quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: workshopSessionId,
          answers: [
            { questionId: 1, answer: 'b' }, // Analytical thinker
            { questionId: 2, answer: 'a' }, // Collaborative
            { questionId: 3, answer: 'c' }, // Strategic
            { questionId: 4, answer: 'b' }, // Data-driven
            { questionId: 5, answer: 'a' }, // Mentor
            { questionId: 6, answer: 'd' }, // Innovative
            { questionId: 7, answer: 'b' }, // Systematic
            { questionId: 8, answer: 'c' }, // Inspirational
            { questionId: 9, answer: 'a' }, // Patient
            { questionId: 10, answer: 'b' } // Results-oriented
          ]
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        workshop: {
          sessionId: workshopSessionId,
          status: 'completed',
          completedSteps: [1, 2, 3, 4, 5],
          personalityProfile: {
            primaryArchetype: expect.any(String),
            secondaryArchetype: expect.any(String),
            strengthAreas: expect.any(Array),
            communicationStyle: expect.any(Object)
          }
        }
      });
    });

    test('should generate comprehensive brand report', async () => {
      const response = await request(app)
        .get(`/api/workshop/report/${workshopSessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        brandReport: {
          sessionId: workshopSessionId,
          completionDate: expect.any(String),
          brandDNA: {
            coreValues: expect.any(Array),
            missionStatement: expect.any(String),
            voiceAttributes: expect.any(Object),
            targetAudiences: expect.any(Array),
            contentPillars: expect.any(Array),
            personalityArchetype: expect.any(Object)
          },
          recommendations: {
            contentTypes: expect.any(Array),
            postingFrequency: expect.any(String),
            topicSuggestions: expect.any(Array),
            engagementStrategies: expect.any(Array)
          },
          voiceGuidelines: {
            dos: expect.any(Array),
            donts: expect.any(Array),
            examplePhrases: expect.any(Array)
          }
        }
      });
    });

    test('should integrate workshop results with voice profile', async () => {
      const response = await request(app)
        .post('/api/voice/integrate-workshop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workshopSessionId: workshopSessionId
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        voiceProfile: {
          userId: userId,
          dimensions: expect.any(Object),
          workshopEnhanced: true,
          lastUpdated: expect.any(String)
        }
      });

      // Verify enhanced voice profile is used in content generation
      const contentResponse = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topic: 'The importance of team diversity in innovation',
          contentType: 'linkedin_post',
          useWorkshopProfile: true
        })
        .expect(200);

      expect(contentResponse.body.content.metadata).toMatchObject({
        workshopSessionId: workshopSessionId,
        enhancedProfile: true
      });
    });
  });

  describe('Workshop Progress and Recovery', () => {
    let newSessionId;

    test('should save progress between steps', async () => {
      // Start new session
      const startResponse = await request(app)
        .post('/api/workshop/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      newSessionId = startResponse.body.session.id;

      // Complete only first step
      await request(app)
        .post('/api/workshop/values-audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: newSessionId,
          values: [
            { value: 'Innovation', importance: 'core' },
            { value: 'Quality', importance: 'core' }
          ],
          professionalMission: 'To deliver exceptional value through innovation.'
        })
        .expect(200);

      // Get session status
      const statusResponse = await request(app)
        .get(`/api/workshop/session/${newSessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body).toMatchObject({
        success: true,
        session: {
          id: newSessionId,
          currentStep: 2,
          completedSteps: [1],
          status: 'in_progress',
          progress: 20 // 1 of 5 steps = 20%
        }
      });
    });

    test('should resume incomplete workshop', async () => {
      const response = await request(app)
        .post('/api/workshop/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: newSessionId
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        session: {
          id: newSessionId,
          currentStep: 2,
          completedSteps: [1],
          nextStepInstructions: expect.any(String)
        }
      });
    });

    test('should list all workshop sessions for user', async () => {
      const response = await request(app)
        .get('/api/workshop/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        sessions: expect.arrayContaining([
          expect.objectContaining({
            id: workshopSessionId,
            status: 'completed'
          }),
          expect.objectContaining({
            id: newSessionId,
            status: 'in_progress'
          })
        ])
      });

      expect(response.body.sessions.length).toBeGreaterThanOrEqual(2);
    });

    test('should not allow duplicate values in values audit', async () => {
      const response = await request(app)
        .post('/api/workshop/values-audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: newSessionId,
          values: [
            { value: 'Innovation', importance: 'core' },
            { value: 'Innovation', importance: 'important' } // Duplicate
          ],
          professionalMission: 'Test mission'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('duplicate')
      });
    });
  });

  describe('Workshop Analytics and Insights', () => {
    test('should track workshop completion metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/workshop-insights')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        insights: {
          completedWorkshops: 1,
          averageCompletionTime: expect.any(Number),
          mostSelectedValues: expect.any(Array),
          dominantArchetypes: expect.any(Array),
          contentImpact: {
            beforeWorkshop: expect.any(Object),
            afterWorkshop: expect.any(Object),
            improvement: expect.any(Number)
          }
        }
      });
    });

    test('should provide workshop-based content recommendations', async () => {
      const response = await request(app)
        .get('/api/content/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          workshopSessionId: workshopSessionId
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            topic: expect.any(String),
            rationale: expect.any(String),
            alignmentScore: expect.any(Number),
            suggestedFormat: expect.any(String),
            targetAudience: expect.any(String)
          })
        ])
      });

      expect(response.body.recommendations.length).toBeGreaterThanOrEqual(5);
    });
  });
});