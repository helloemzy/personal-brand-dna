const { handler } = require('../../../api/auth/register');

describe('User Registration API', () => {
  let req, res;

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });

  test('should register new user with valid data', async () => {
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('registered successfully')
      })
    );
  });

  test('should validate required fields', async () => {
    req.body = { email: 'test@example.com' }; // Missing password, firstName, lastName
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('required')
      })
    );
  });

  test('should validate email format', async () => {
    req.body.email = 'invalid-email';
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('email')
      })
    );
  });

  test('should validate password strength', async () => {
    req.body.password = '123'; // Weak password
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('password')
      })
    );
  });

  test('should reject non-POST requests', async () => {
    req.method = 'GET';
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});