const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  async initialize() {
    try {
      if (process.env.SENDGRID_API_KEY) {
        // Use SendGrid
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        logger.info('Email service initialized with SendGrid');
      } else if (process.env.SMTP_HOST) {
        // Use generic SMTP
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        logger.info('Email service initialized with SMTP');
      } else if (process.env.NODE_ENV === 'development') {
        // Use console for development
        this.transporter = {
          sendMail: async (mailOptions) => {
            logger.info('📧 Email would be sent:', {
              to: mailOptions.to,
              subject: mailOptions.subject,
              html: mailOptions.html ? 'HTML content included' : 'No HTML',
              text: mailOptions.text || 'No text content'
            });
            return { messageId: 'dev-' + Date.now() };
          }
        };
        logger.info('Email service initialized in development mode (console only)');
      } else {
        logger.warning('No email configuration found - emails will not be sent');
        this.transporter = null;
      }
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.transporter) {
      logger.warning('Email service not configured - skipping email send');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@personalbranddna.com',
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}`, { messageId: result.messageId });
      return true;
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendVerificationEmail(email, token, firstName = '') {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Personal Brand DNA</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background: #374151; color: #9ca3af; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
          .security-note { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🧬 Personal Brand DNA</h1>
          <p>Verify Your Email Address</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName || 'there'}! 👋</h2>
          
          <p>Welcome to Personal Brand DNA! We're excited to help you discover your authentic professional voice and create content that drives real career growth.</p>
          
          <p>To get started, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6366f1;">${verificationUrl}</p>
          
          <div class="security-note">
            <strong>🔐 Security Note:</strong> This verification link will expire in 24 hours. If you didn't create an account with Personal Brand DNA, you can safely ignore this email.
          </div>
          
          <p>Once verified, you'll be able to:</p>
          <ul>
            <li>Complete your 5-minute voice discovery conversation</li>
            <li>Generate authentic LinkedIn content that sounds like you</li>
            <li>Access advanced content templates and analytics</li>
          </ul>
          
          <p>Questions? Just reply to this email - we're here to help!</p>
          
          <p>Best,<br>The Personal Brand DNA Team</p>
        </div>
        
        <div class="footer">
          <p>Personal Brand DNA | Authentic Voice. Authentic Growth.</p>
          <p>If you no longer wish to receive these emails, you can unsubscribe at any time.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Hi ${firstName || 'there'}!
      
      Welcome to Personal Brand DNA! Please verify your email address by clicking this link:
      ${verificationUrl}
      
      This verification link will expire in 24 hours.
      
      Questions? Just reply to this email - we're here to help!
      
      Best,
      The Personal Brand DNA Team
    `;

    return await this.sendEmail(
      email,
      'Verify Your Email - Personal Brand DNA',
      html,
      text
    );
  }

  async sendPasswordResetEmail(email, token, firstName = '') {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Personal Brand DNA</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background: #374151; color: #9ca3af; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
          .security-note { background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🧬 Personal Brand DNA</h1>
          <p>Password Reset Request</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName || 'there'}! 🔐</h2>
          
          <p>We received a request to reset the password for your Personal Brand DNA account.</p>
          
          <p>Click the button below to create a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #ef4444;">${resetUrl}</p>
          
          <div class="security-note">
            <strong>🔐 Security Note:</strong> This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </div>
          
          <p><strong>For your security:</strong></p>
          <ul>
            <li>Never share this reset link with anyone</li>
            <li>Choose a strong, unique password</li>
            <li>Consider using a password manager</li>
          </ul>
          
          <p>If you're having trouble accessing your account, please contact our support team.</p>
          
          <p>Best,<br>The Personal Brand DNA Team</p>
        </div>
        
        <div class="footer">
          <p>Personal Brand DNA | Authentic Voice. Authentic Growth.</p>
          <p>If you received this email in error, please ignore it.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Hi ${firstName || 'there'}!
      
      We received a request to reset the password for your Personal Brand DNA account.
      
      Click this link to create a new password:
      ${resetUrl}
      
      This password reset link will expire in 1 hour.
      
      If you didn't request a password reset, please ignore this email and your password will remain unchanged.
      
      Best,
      The Personal Brand DNA Team
    `;

    return await this.sendEmail(
      email,
      'Reset Your Password - Personal Brand DNA',
      html,
      text
    );
  }

  async sendWelcomeEmail(email, firstName = '') {
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Personal Brand DNA!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background: #374151; color: #9ca3af; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #10b981; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Welcome to Personal Brand DNA!</h1>
          <p>Your journey to authentic professional growth starts now</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName}! 🚀</h2>
          
          <p>Congratulations! Your email has been verified and your Personal Brand DNA account is ready to go.</p>
          
          <p>You're about to discover something powerful - your authentic professional voice. In just 5 minutes, our AI will analyze how you naturally communicate and help you create LinkedIn content that sounds genuinely like you.</p>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">Start Your Voice Discovery</a>
          </div>
          
          <h3>What You'll Unlock:</h3>
          
          <div class="feature">
            <strong>🎙️ Voice Discovery:</strong> Our 5-minute conversation reveals 14 dimensions of your communication style
          </div>
          
          <div class="feature">
            <strong>📝 Authentic Content:</strong> Generate LinkedIn posts that match your voice perfectly
          </div>
          
          <div class="feature">
            <strong>📊 Performance Tracking:</strong> See how your content drives real business outcomes
          </div>
          
          <div class="feature">
            <strong>🎯 Growth-Focused:</strong> Every piece optimized for career advancement, not just likes
          </div>
          
          <h3>Your Next Steps:</h3>
          <ol>
            <li><strong>Complete Voice Discovery</strong> - Take the 5-minute conversation</li>
            <li><strong>Generate Your First Post</strong> - Pick a topic and watch the magic happen</li>
            <li><strong>Share & Track Results</strong> - Post on LinkedIn and measure your impact</li>
          </ol>
          
          <p>💡 <strong>Pro Tip:</strong> The more authentic and specific you are during voice discovery, the better your content will sound like you!</p>
          
          <p>Questions? Just reply to this email. We read every message and love helping our users succeed.</p>
          
          <p>Let's unlock your authentic professional voice!</p>
          
          <p>Best,<br>The Personal Brand DNA Team</p>
        </div>
        
        <div class="footer">
          <p>Personal Brand DNA | Authentic Voice. Authentic Growth.</p>
          <p>Need help? Contact us at ${process.env.SUPPORT_EMAIL || 'support@personalbranddna.com'}</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Hi ${firstName}!
      
      Welcome to Personal Brand DNA! Your email has been verified and your account is ready.
      
      Start your voice discovery journey: ${dashboardUrl}
      
      What you'll unlock:
      • Voice Discovery: 5-minute conversation reveals your communication style
      • Authentic Content: Generate LinkedIn posts that sound like you
      • Performance Tracking: Measure real business outcomes
      • Growth-Focused: Content optimized for career advancement
      
      Questions? Just reply to this email!
      
      Best,
      The Personal Brand DNA Team
    `;

    return await this.sendEmail(
      email,
      'Welcome to Personal Brand DNA! 🎉',
      html,
      text
    );
  }

  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;