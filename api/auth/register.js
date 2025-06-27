import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Joi from 'joi';
import { query, withTransaction } from '../_lib/database.js';
import { sendWelcomeEmail, sendEmailVerification } from '../_lib/emailService.js';

// Validation schema
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

export default async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password, firstName, lastName, industry, role, company, linkedinUrl } = value;

  await withTransaction(async (client) => {
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.email_verified) {
        throw new AppError('User already exists with this email', 409, 'USER_EXISTS');
      } else {
        // User exists but email not verified - we can proceed to update
        const hashedPassword = await bcrypt.hash(password, 12);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await client.query(
          `UPDATE users SET 
             password_hash = $2, first_name = $3, last_name = $4, 
             industry = $5, role = $6, company = $7, linkedin_url = $8,
             email_verification_token = $9, email_verification_expires = $10
           WHERE id = $1`,
          [user.id, hashedPassword, firstName, lastName, industry, role, company, linkedinUrl, verificationToken, verificationExpires]
        );

        // Send verification email
        await sendEmailVerification({ 
          email, 
          first_name: firstName 
        }, verificationToken);

        return res.status(200).json({
          success: true,
          message: 'Registration updated. Please check your email to verify your account.',
          code: 'REGISTRATION_UPDATED'
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert new user
    const newUser = await client.query(
      `INSERT INTO users (
         email, password_hash, first_name, last_name, industry, role, company, linkedin_url,
         email_verification_token, email_verification_expires, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING id, email, first_name, last_name, industry, role, company, linkedin_url, created_at`,
      [email, hashedPassword, firstName, lastName, industry, role, company, linkedinUrl, verificationToken, verificationExpires]
    );

    const user = newUser.rows[0];

    // Create user profile
    await client.query(
      `INSERT INTO user_profiles (
         user_id, total_content_generated, last_login, created_at
       ) VALUES ($1, 0, NULL, CURRENT_TIMESTAMP)`,
      [user.id]
    );

    // Send verification email
    await sendEmailVerification(user, verificationToken);

    // Log registration
    console.log(`New user registered: ${email} (ID: ${user.id})`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          industry: user.industry,
          role: user.role,
          company: user.company,
          linkedinUrl: user.linkedin_url,
          emailVerified: false
        }
      },
      code: 'REGISTRATION_SUCCESS'
    });
  });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};