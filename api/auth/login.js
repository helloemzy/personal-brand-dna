const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { query } = require('../_lib/database');
const { AppError, asyncHandler } = require('../_lib/errorHandler');
const { authRateLimit } = require('../_lib/rateLimiter');
const { generateToken, createSession } = require('../_lib/auth');

// Validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required()
});

module.exports = asyncHandler(async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  // Apply rate limiting
  await authRateLimit(req, res, () => {});

  // Validate request body
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }

  const { email, password } = value;

  // Get user from database
  const userResult = await query(
    `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, 
            u.email_verified, u.subscription_tier, u.status, u.industry, u.role, u.company, u.linkedin_url,
            up.total_content_generated, up.last_voice_analysis
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     WHERE u.email = $1`,
    [email]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const user = userResult.rows[0];

  // Check if account is active
  if (user.status !== 'active') {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login
  await query(
    'UPDATE user_profiles SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
    [user.id]
  );

  // Generate tokens and create session
  const { sessionId, refreshToken } = await createSession(user.id, req.headers['user-agent']);
  const accessToken = generateToken({ 
    userId: user.id, 
    email: user.email, 
    sessionId 
  });

  // Log successful login
  console.log(`User logged in: ${email} (ID: ${user.id})`);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: user.email_verified,
        subscriptionTier: user.subscription_tier,
        industry: user.industry,
        role: user.role,
        company: user.company,
        linkedinUrl: user.linkedin_url,
        totalContentGenerated: user.total_content_generated,
        lastVoiceAnalysis: user.last_voice_analysis,
        hasVoiceProfile: !!user.last_voice_analysis
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '1h'
      }
    },
    code: 'LOGIN_SUCCESS'
  });
});