const sgMail = require('@sendgrid/mail');

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@personalbranddna.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('Email would be sent:', { to, subject, htmlContent });
      return { success: true, messageId: 'dev-mode' };
    }

    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const [response] = await sgMail.send(msg);
    return { success: true, messageId: response.headers['x-message-id'] };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Personal Brand DNA!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Personal Brand DNA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px;">Welcome to Personal Brand DNA!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Discover your authentic professional voice</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="color: #4a5568; margin-top: 0;">Hi ${user.first_name}!</h2>
        <p>Thank you for joining Personal Brand DNA. We're excited to help you discover and amplify your authentic professional voice.</p>
        
        <h3 style="color: #4a5568;">What's Next?</h3>
        <ol style="padding-left: 20px;">
          <li><strong>Complete Voice Discovery:</strong> Take our 5-minute conversation to map your communication style</li>
          <li><strong>Generate Content:</strong> Create LinkedIn posts that sound genuinely like you</li>
          <li><strong>Build Your Brand:</strong> Develop a consistent professional presence that drives real results</li>
        </ol>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/voice-discovery" 
           style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Start Voice Discovery
        </a>
      </div>
      
      <div style="background: #e2e8f0; padding: 20px; border-radius: 6px; margin-top: 30px;">
        <h4 style="margin-top: 0; color: #4a5568;">Need Help?</h4>
        <p style="margin-bottom: 0;">
          Have questions? Reply to this email or check out our 
          <a href="${FRONTEND_URL}/help" style="color: #667eea;">help center</a>.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;">
        <p>Personal Brand DNA - Authentic Voice, Real Results</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, subject, html);
};

const sendEmailVerification = async (user, verificationToken) => {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const subject = 'Verify Your Email Address';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px;">Verify Your Email</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Almost there! Just one more step.</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="color: #4a5568; margin-top: 0;">Hi ${user.first_name}!</h2>
        <p>Please verify your email address to complete your Personal Brand DNA account setup.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background: #48bb78; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p style="font-size: 14px; color: #718096;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
        </p>
      </div>
      
      <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 15px; border-radius: 6px; margin-top: 20px;">
        <p style="margin: 0; color: #c53030; font-size: 14px;">
          <strong>Security Note:</strong> This verification link will expire in 24 hours for your security.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;">
        <p>Personal Brand DNA - Authentic Voice, Real Results</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, subject, html);
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px;">Reset Your Password</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Secure your account with a new password</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="color: #4a5568; margin-top: 0;">Hi ${user.first_name}!</h2>
        <p>We received a request to reset your password for your Personal Brand DNA account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #e53e3e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p style="font-size: 14px; color: #718096;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
      
      <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 15px; border-radius: 6px; margin-top: 20px;">
        <p style="margin: 0; color: #c53030; font-size: 14px;">
          <strong>Security Notes:</strong><br>
          • This reset link will expire in 1 hour for your security<br>
          • If you didn't request this reset, please ignore this email<br>
          • Your password won't change until you click the link above
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;">
        <p>Personal Brand DNA - Authentic Voice, Real Results</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, subject, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
};