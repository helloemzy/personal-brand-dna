const { handler } = require('../../../api/auth/demo-login');

describe('Demo Login API', () => {
  let req, res;

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });

  test('should allow demo login with POST request', async () => {
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        token: expect.any(String),
        user: expect.objectContaining({
          id: 'demo-user',
          email: 'demo@personalbranddna.com',
          subscription_tier: 'professional'
        })
      })
    );
  });

  test('should reject non-POST requests', async () => {
    req.method = 'GET';
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Method not allowed'
      })
    );
  });

  test('should include correct CORS headers', async () => {
    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin', 
      '*'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods', 
      'POST, OPTIONS'
    );
  });

  test('should generate valid JWT token', async () => {
    const jwt = require('jsonwebtoken');
    
    await handler(req, res);

    const response = res.json.mock.calls[0][0];
    const decoded = jwt.decode(response.token);

    expect(decoded).toMatchObject({
      userId: 'demo-user',
      email: 'demo@personalbranddna.com',
      isDemoUser: true
    });
  });
});