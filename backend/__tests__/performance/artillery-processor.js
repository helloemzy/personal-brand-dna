// Artillery processor functions for custom logic
const crypto = require('crypto');

module.exports = {
  // Generate random data for testing
  generateRandomEmail: (context, events, done) => {
    context.vars.randomEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
    return done();
  },

  generateRandomUsername: (context, events, done) => {
    context.vars.randomUsername = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return done();
  },

  generateRandomPhone: (context, events, done) => {
    const randomDigits = Math.floor(Math.random() * 9000000000) + 1000000000;
    context.vars.randomPhone = `+1${randomDigits}`;
    return done();
  },

  // Generate OTP for testing
  generateOTP: (context, events, done) => {
    context.vars.otp = Math.floor(100000 + Math.random() * 900000).toString();
    return done();
  },

  // Save authentication token from response
  saveAuthToken: (context, events, done) => {
    if (context.vars.response && context.vars.response.body) {
      const body = JSON.parse(context.vars.response.body);
      if (body.token) {
        context.vars.authToken = body.token;
      }
    }
    return done();
  },

  // Set authorization header
  setAuthHeader: (context, events, done) => {
    if (context.vars.authToken) {
      context.headers = context.headers || {};
      context.headers['Authorization'] = `Bearer ${context.vars.authToken}`;
    }
    return done();
  },

  // Generate workshop data
  generateWorkshopData: (context, events, done) => {
    context.vars.workshopData = {
      values: ['innovation', 'integrity', 'collaboration', 'excellence', 'growth'].sort(() => 0.5 - Math.random()).slice(0, 3),
      tone: {
        formality: Math.floor(Math.random() * 5) + 1,
        enthusiasm: Math.floor(Math.random() * 5) + 1,
        assertiveness: Math.floor(Math.random() * 5) + 1,
        empathy: Math.floor(Math.random() * 5) + 1
      },
      audience: {
        title: `Test Audience ${Date.now()}`,
        description: 'Auto-generated test audience',
        demographics: ['25-34', 'Tech professionals']
      }
    };
    return done();
  },

  // Generate news article data
  generateNewsData: (context, events, done) => {
    context.vars.newsArticle = {
      title: `Test Article ${Date.now()}`,
      url: `https://example.com/article/${Date.now()}`,
      source: 'Test News Source',
      publishedAt: new Date().toISOString(),
      content: 'This is test content for performance testing purposes.'
    };
    return done();
  },

  // Generate calendar event data
  generateCalendarEvent: (context, events, done) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
    
    context.vars.calendarEvent = {
      title: `Test Event ${Date.now()}`,
      content: 'Performance test content',
      scheduledFor: startDate.toISOString(),
      contentType: ['post', 'article', 'story'][Math.floor(Math.random() * 3)],
      status: 'scheduled'
    };
    return done();
  },

  // Measure cold start performance
  markColdStart: (context, events, done) => {
    context.vars.isFirstRequest = !context.vars.hasRequested;
    context.vars.hasRequested = true;
    context.vars.coldStartTime = Date.now();
    return done();
  },

  measureColdStart: (context, events, done) => {
    if (context.vars.isFirstRequest && context.vars.coldStartTime) {
      const coldStartDuration = Date.now() - context.vars.coldStartTime;
      console.log(`Cold start duration: ${coldStartDuration}ms`);
      context.vars.coldStartDuration = coldStartDuration;
    }
    return done();
  },

  // Log errors for debugging
  logError: (context, events, done) => {
    if (context.vars.response && context.vars.response.statusCode >= 400) {
      console.error(`Error ${context.vars.response.statusCode}: ${context.vars.response.body}`);
    }
    return done();
  }
};