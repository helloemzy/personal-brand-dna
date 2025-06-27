const { handler } = require('../../../api/content/generate');

describe('Content Generation API', () => {
  let req, res;
  const validToken = 'Bearer ' + global.testUtils.generateAuthToken('test-user-123');

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {
        'authorization': validToken,
        'content-type': 'application/json'
      },
      body: {
        topic: 'Leadership lessons from remote work',
        contentType: 'linkedin_post',
        template: 'thought_leadership',
        tone: 'professional',
        targetAudience: 'Senior managers and executives'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });

  test('should generate content with valid request', async () => {
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        content: expect.objectContaining({
          id: expect.any(String),
          text: expect.any(String),
          topic: req.body.topic,
          contentType: req.body.contentType,
          template: req.body.template
        })
      })
    );
  });

  test('should require authentication', async () => {
    req.headers.authorization = '';
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Authentication required')
      })
    );
  });

  test('should validate required fields', async () => {
    req.body = { topic: 'Test topic' }; // Missing contentType
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('contentType')
      })
    );
  });

  test('should validate content type options', async () => {
    req.body.contentType = 'invalid_type';
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Invalid content type')
      })
    );
  });

  test('should handle voice profile when provided', async () => {
    req.body.voiceProfile = {
      tone: 'conversational',
      style: 'storytelling',
      vocabulary: 'accessible'
    };
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        content: expect.objectContaining({
          voiceProfileUsed: true
        })
      })
    );
  });

  test('should reject non-POST requests', async () => {
    req.method = 'GET';
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});