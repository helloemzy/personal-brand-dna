const Joi = require('joi');
const { query } = require('../_lib/database');
const { AppError, asyncHandler } = require('../_lib/errorHandler');
const { sendWelcomeEmail } = require('../_lib/emailService');

// Validation schema
const verifyEmailSchema = Joi.object({
  token: Joi.string().required()
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

  // Validate request body
  const { error, value } = verifyEmailSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }

  const { token } = value;

  // Find user with this verification token
  const userResult = await query(
    `SELECT id, email, first_name, email_verified, email_verification_expires
     FROM users 
     WHERE email_verification_token = $1`,
    [token]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
  }

  const user = userResult.rows[0];

  // Check if email is already verified
  if (user.email_verified) {
    return res.status(200).json({
      success: true,
      message: 'Email is already verified',
      code: 'ALREADY_VERIFIED'
    });
  }

  // Check if token has expired
  if (new Date() > user.email_verification_expires) {
    throw new AppError('Verification token has expired', 400, 'TOKEN_EXPIRED');
  }

  // Update user as verified
  await query(
    `UPDATE users SET 
       email_verified = true, 
       email_verification_token = NULL, 
       email_verification_expires = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [user.id]
  );

  // Send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail the verification if welcome email fails
  }

  // Log verification
  console.log(`Email verified for user: ${user.email} (ID: ${user.id})`);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! Welcome to Personal Brand DNA.',
    code: 'EMAIL_VERIFIED'
  });
});