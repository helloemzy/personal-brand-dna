const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requireVerifiedEmail, invalidateAllSessions } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendEmailVerification } = require('../../../api/_lib/emailService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  industry: Joi.string().max(100).optional(),
  role: Joi.string().max(100).optional(),
  company: Joi.string().max(200).optional(),
  linkedinUrl: Joi.string().uri().optional().allow('')
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
});

const updateEmailSchema = Joi.object({
  newEmail: Joi.string().email().required().lowercase(),
  password: Joi.string().required()
});

// Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
  const userResult = await query(
    `SELECT 
      id, email, first_name, last_name, industry, role, company, linkedin_url,
      subscription_tier, subscription_status, is_verified, created_at, updated_at
     FROM users 
     WHERE id = $1`,
    [req.user.id]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = userResult.rows[0];

  // Get voice profile count
  const voiceProfileResult = await query(
    'SELECT COUNT(*) as count FROM voice_profiles WHERE user_id = $1',
    [req.user.id]
  );

  // Get content generation stats
  const contentStatsResult = await query(
    `SELECT 
      COUNT(*) as total_content,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as content_this_month,
      COUNT(CASE WHEN status = 'used' THEN 1 END) as content_used
     FROM generated_content 
     WHERE user_id = $1`,
    [req.user.id]
  );

  const stats = {
    voiceProfiles: parseInt(voiceProfileResult.rows[0].count),
    totalContent: parseInt(contentStatsResult.rows[0].total_content),
    contentThisMonth: parseInt(contentStatsResult.rows[0].content_this_month),
    contentUsed: parseInt(contentStatsResult.rows[0].content_used)
  };

  res.json({
    status: 'success',
    data: {
      user,
      stats
    }
  });
}));

// Update user profile
router.put('/profile', asyncHandler(async (req, res) => {
  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { firstName, lastName, industry, role, company, linkedinUrl } = value;

  // Build dynamic update query
  const updateFields = [];
  const updateValues = [];
  let paramCount = 1;

  if (firstName !== undefined) {
    updateFields.push(`first_name = $${paramCount++}`);
    updateValues.push(firstName);
  }
  if (lastName !== undefined) {
    updateFields.push(`last_name = $${paramCount++}`);
    updateValues.push(lastName);
  }
  if (industry !== undefined) {
    updateFields.push(`industry = $${paramCount++}`);
    updateValues.push(industry);
  }
  if (role !== undefined) {
    updateFields.push(`role = $${paramCount++}`);
    updateValues.push(role);
  }
  if (company !== undefined) {
    updateFields.push(`company = $${paramCount++}`);
    updateValues.push(company);
  }
  if (linkedinUrl !== undefined) {
    updateFields.push(`linkedin_url = $${paramCount++}`);
    updateValues.push(linkedinUrl || null);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'No fields to update'
    });
  }

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(req.user.id);

  const updateQuery = `
    UPDATE users 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, email, first_name, last_name, industry, role, company, linkedin_url, updated_at
  `;

  const result = await query(updateQuery, updateValues);

  logger.logBusinessEvent('profile_updated', req.user.id, {
    updatedFields: Object.keys(value),
    ...value
  });

  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: result.rows[0]
    }
  });
}));

// Change password
router.put('/password', asyncHandler(async (req, res) => {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { currentPassword, newPassword } = value;

  // Get current password hash
  const userResult = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!isCurrentPasswordValid) {
    logger.logSecurityEvent('password_change_invalid_current', {
      userId: req.user.id
    }, req);

    return res.status(400).json({
      status: 'error',
      message: 'Current password is incorrect'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newPasswordHash, req.user.id]
  );

  // Invalidate all sessions to force re-login
  await invalidateAllSessions(req.user.id);

  logger.logSecurityEvent('password_changed', {
    userId: req.user.id
  }, req);

  res.json({
    status: 'success',
    message: 'Password changed successfully. Please log in again with your new password.'
  });
}));

// Update email address
router.put('/email', asyncHandler(async (req, res) => {
  const { error, value } = updateEmailSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { newEmail, password } = value;

  // Verify password
  const userResult = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const isPasswordValid = await bcrypt.compare(password, userResult.rows[0].password_hash);
  if (!isPasswordValid) {
    logger.logSecurityEvent('email_change_invalid_password', {
      userId: req.user.id,
      newEmail
    }, req);

    return res.status(400).json({
      status: 'error',
      message: 'Password is incorrect'
    });
  }

  // Check if new email is already in use
  const existingUserResult = await query(
    'SELECT id FROM users WHERE email = $1 AND id != $2',
    [newEmail, req.user.id]
  );

  if (existingUserResult.rows.length > 0) {
    return res.status(409).json({
      status: 'error',
      message: 'Email address is already in use'
    });
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update email and set as unverified with new verification token
  await query(
    `UPDATE users 
     SET email = $1, 
         is_verified = false, 
         verification_token = $2,
         verification_token_expires = $3,
         updated_at = NOW() 
     WHERE id = $4`,
    [newEmail, verificationToken, verificationExpiry, req.user.id]
  );

  // Send verification email to new address
  try {
    await sendEmailVerification({ 
      email: newEmail, 
      first_name: req.user.first_name || 'User',
      id: req.user.id 
    }, verificationToken);
  } catch (emailError) {
    logger.error('Failed to send verification email:', emailError);
    // Don't fail the whole operation if email fails, just log it
  }

  logger.logSecurityEvent('email_changed', {
    userId: req.user.id,
    oldEmail: req.user.email,
    newEmail
  }, req);

  res.json({
    status: 'success',
    message: 'Email updated successfully. Please verify your new email address.'
  });
}));

// Get user's subscription info
router.get('/subscription', asyncHandler(async (req, res) => {
  const subscriptionResult = await query(
    `SELECT 
      subscription_tier, 
      subscription_status, 
      stripe_customer_id,
      created_at
     FROM users 
     WHERE id = $1`,
    [req.user.id]
  );

  if (subscriptionResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const subscription = subscriptionResult.rows[0];

  // Get usage statistics for current billing period
  const usageResult = await query(
    `SELECT 
      COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()) THEN 1 END) as content_this_month,
      COUNT(CASE WHEN DATE_TRUNC('day', created_at) = DATE_TRUNC('day', NOW()) THEN 1 END) as content_today
     FROM generated_content 
     WHERE user_id = $1`,
    [req.user.id]
  );

  const usage = {
    contentThisMonth: parseInt(usageResult.rows[0].content_this_month),
    contentToday: parseInt(usageResult.rows[0].content_today)
  };

  // Define tier limits
  const tierLimits = {
    free: { content: 3, voiceProfiles: 1 },
    professional: { content: 1000, voiceProfiles: 3 },
    executive: { content: 5000, voiceProfiles: 10 },
    enterprise: { content: -1, voiceProfiles: -1 } // unlimited
  };

  const limits = tierLimits[subscription.subscription_tier] || tierLimits.free;

  res.json({
    status: 'success',
    data: {
      subscription,
      usage,
      limits
    }
  });
}));

// Get user activity log
router.get('/activity', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  // Get recent content generation activity
  const activityResult = await query(
    `SELECT 
      'content_generated' as activity_type,
      created_at,
      content_type,
      topic,
      status,
      id as content_id
     FROM generated_content 
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );

  // Get total count for pagination
  const countResult = await query(
    'SELECT COUNT(*) as total FROM generated_content WHERE user_id = $1',
    [req.user.id]
  );

  const totalItems = parseInt(countResult.rows[0].total);
  const totalPages = Math.ceil(totalItems / limit);

  res.json({
    status: 'success',
    data: {
      activities: activityResult.rows,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// Delete user account
router.delete('/account', asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      status: 'error',
      message: 'Password is required to delete account'
    });
  }

  // Verify password
  const userResult = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const isPasswordValid = await bcrypt.compare(password, userResult.rows[0].password_hash);
  if (!isPasswordValid) {
    logger.logSecurityEvent('account_deletion_invalid_password', {
      userId: req.user.id
    }, req);

    return res.status(400).json({
      status: 'error',
      message: 'Password is incorrect'
    });
  }

  // Soft delete - mark as deleted instead of actually deleting
  await withTransaction(async (client) => {
    // Update user record
    await client.query(
      `UPDATE users 
       SET 
         email = CONCAT('deleted_', id, '@deleted.com'),
         first_name = 'Deleted',
         last_name = 'User',
         subscription_status = 'cancelled',
         is_verified = false,
         updated_at = NOW()
       WHERE id = $1`,
      [req.user.id]
    );

    // Invalidate all sessions
    await client.query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
      [req.user.id]
    );

    // Cancel Stripe subscription if exists
    if (req.user.stripe_customer_id) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Get all active subscriptions for the customer
        const subscriptions = await stripe.subscriptions.list({
          customer: req.user.stripe_customer_id,
          status: 'active'
        });
        
        // Cancel each active subscription immediately
        for (const subscription of subscriptions.data) {
          await stripe.subscriptions.cancel(subscription.id);
          
          logger.logBusinessEvent('subscription_cancelled_account_deletion', req.user.id, {
            subscriptionId: subscription.id,
            customerId: req.user.stripe_customer_id,
            reason: 'account_deletion'
          });
        }
      } catch (stripeError) {
        logger.error('Failed to cancel Stripe subscription during account deletion:', stripeError);
        // Don't fail the account deletion if Stripe cancellation fails
      }
    }
    
    // Anonymize user data based on retention policy
    // Keep minimal data for audit/legal purposes
    await client.query(
      `INSERT INTO deleted_users_audit (
        user_id, 
        deleted_at, 
        stripe_customer_id,
        subscription_tier,
        reason
      ) VALUES ($1, NOW(), $2, $3, 'user_requested')
      ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id, req.user.stripe_customer_id, req.user.subscription_tier]
    );
  });

  logger.logBusinessEvent('account_deleted', req.user.id, {
    deletedAt: new Date().toISOString()
  });

  res.json({
    status: 'success',
    message: 'Account deleted successfully'
  });
}));

module.exports = router;