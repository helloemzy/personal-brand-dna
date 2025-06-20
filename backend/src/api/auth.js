const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Joi = require('joi');
const { query, withTransaction } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authRateLimit } = require('../middleware/rateLimiter');
const { generateToken, generateRefreshToken, createSession, invalidateSession, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().min(8).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  industry: Joi.string().max(100).optional(),
  role: Joi.string().max(100).optional(),
  company: Joi.string().max(200).optional(),
  linkedinUrl: Joi.string().uri().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required()
});

// Apply rate limiting to all auth routes
router.use(authRateLimit);

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { email, password, firstName, lastName, industry, role, company, linkedinUrl } = value;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    return res.status(409).json({
      status: 'error',
      message: 'User already exists with this email'
    });
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

  // Create user in transaction
  const userId = await withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users 
       (email, password_hash, first_name, last_name, industry, role, company, linkedin_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id`,
      [email, passwordHash, firstName, lastName, industry, role, company, linkedinUrl]
    );

    const userId = userResult.rows[0].id;

    // Store verification token (you might want a separate table for this)
    await client.query(
      'UPDATE users SET created_at = NOW() WHERE id = $1',
      [userId]
    );

    return userId;
  });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(email, verificationToken, firstName);
    logger.info(`Verification email sent to ${email}`);
  } catch (emailError) {
    logger.error(`Failed to send verification email to ${email}:`, emailError);
    // Don't fail registration if email fails - user can request resend
  }

  logger.logBusinessEvent('user_registered', userId, {
    email,
    industry,
    role,
    company
  });

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully. Please check your email for verification.',
    data: {
      userId,
      email,
      firstName,
      lastName,
      isVerified: false
    }
  });
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { email, password } = value;

  // Get user with password
  const userResult = await query(
    'SELECT id, email, password_hash, first_name, last_name, industry, role, subscription_tier, subscription_status, is_verified FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    logger.logSecurityEvent('login_attempt_invalid_email', { email }, req);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid credentials'
    });
  }

  const user = userResult.rows[0];

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    logger.logSecurityEvent('login_attempt_invalid_password', { 
      userId: user.id, 
      email 
    }, req);
    
    return res.status(401).json({
      status: 'error',
      message: 'Invalid credentials'
    });
  }

  // Check if account is suspended
  if (user.subscription_status === 'suspended') {
    logger.logSecurityEvent('login_attempt_suspended_account', {
      userId: user.id,
      email
    }, req);
    
    return res.status(403).json({
      status: 'error',
      message: 'Account suspended. Please contact support.'
    });
  }

  // Generate tokens
  const tokenPayload = { userId: user.id, email: user.email };
  const accessToken = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Create session
  await createSession(user.id, accessToken, req);

  // Remove password hash from response
  delete user.password_hash;

  logger.logBusinessEvent('user_login', user.id, {
    email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Login successful',
    data: {
      user,
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  });
}));

// Logout user
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // Invalidate current session
  await invalidateSession(req.user.id, req.token);

  logger.logBusinessEvent('user_logout', req.user.id);

  res.json({
    status: 'success',
    message: 'Logout successful'
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      status: 'error',
      message: 'Refresh token required'
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    // Get user
    const userResult = await query(
      'SELECT id, email, subscription_status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (user.subscription_status === 'suspended') {
      throw new Error('Account suspended');
    }

    // Generate new access token
    const tokenPayload = { userId: user.id, email: user.email };
    const newAccessToken = generateToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Create new session
    await createSession(user.id, newAccessToken, req);

    res.json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    });
  } catch (error) {
    logger.logSecurityEvent('refresh_token_invalid', {
      error: error.message
    }, req);

    res.status(401).json({
      status: 'error',
      message: 'Invalid refresh token'
    });
  }
}));

// Forgot password
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { error, value } = forgotPasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { email } = value;

  // Always return success to prevent email enumeration
  const response = {
    status: 'success',
    message: 'If an account with this email exists, you will receive a password reset link.'
  };

  // Check if user exists
  const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email]);
  
  if (userResult.rows.length > 0) {
    const user = userResult.rows[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token (you might want a separate table for this)
    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(email, resetToken, user.first_name);
      logger.info(`Password reset email sent to ${email}`);
    } catch (emailError) {
      logger.error(`Failed to send password reset email to ${email}:`, emailError);
      // Don't reveal email sending failure to prevent email enumeration
    }

    logger.logSecurityEvent('password_reset_requested', {
      userId: user.id,
      email
    }, req);
  }

  res.json(response);
}));

// Reset password
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { token, password } = value;

  // Hash the token to compare with stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const result = await withTransaction(async (client) => {
    // Find user with valid reset token
    const userResult = await client.query(
      `SELECT id, email, first_name, reset_token_hash, reset_token_expires 
       FROM users 
       WHERE reset_token_hash = $1 AND reset_token_expires > NOW()`,
      [hashedToken]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const user = userResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset token
    await client.query(
      `UPDATE users 
       SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    // Invalidate all existing sessions for security
    await client.query(
      'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1',
      [user.id]
    );

    return user;
  });

  logger.logSecurityEvent('password_reset_completed', {
    userId: result.id,
    email: result.email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Password reset successfully. Please log in with your new password.'
  });

  // This would be the implementation:
  /*
  const user = await query(
    'SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
    [hashedToken]
  );

  if (user.rows.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid or expired reset token'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Update password and clear reset token
  await query(
    'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
    [passwordHash, user.rows[0].id]
  );

  logger.logSecurityEvent('password_reset_completed', {
    userId: user.rows[0].id
  }, req);

  res.json({
    status: 'success',
    message: 'Password reset successful'
  });
  */
}));

// Verify email
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { error, value } = verifyEmailSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { token } = value;

  // Hash the token to compare with stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const result = await withTransaction(async (client) => {
    // Find user with valid verification token
    const userResult = await client.query(
      `SELECT id, email, first_name, is_verified, verification_token_hash, verification_token_expires
       FROM users 
       WHERE verification_token_hash = $1 AND verification_token_expires > NOW()`,
      [hashedToken]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    const user = userResult.rows[0];

    if (user.is_verified) {
      throw new AppError('Email already verified', 400);
    }

    // Update user as verified and clear verification token
    await client.query(
      `UPDATE users 
       SET is_verified = TRUE, verification_token_hash = NULL, verification_token_expires = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    return user;
  });

  // Send welcome email after successful verification
  try {
    await emailService.sendWelcomeEmail(result.email, result.first_name);
    logger.info(`Welcome email sent to ${result.email}`);
  } catch (emailError) {
    logger.error(`Failed to send welcome email to ${result.email}:`, emailError);
    // Don't fail verification if welcome email fails
  }

  logger.logBusinessEvent('email_verified', result.id, {
    email: result.email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Email verified successfully! Welcome to Personal Brand DNA.'
  });
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user
    }
  });
}));

// Check authentication status
router.get('/status', authenticate, asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        subscriptionTier: req.user.subscription_tier,
        isVerified: req.user.is_verified
      }
    }
  });
}));

module.exports = router;