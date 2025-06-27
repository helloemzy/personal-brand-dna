export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create a verification token that includes the OTP and expiry
    // This avoids needing to store state between serverless function calls
    const tokenData = {
      email: email,
      otp: otp,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      created: Date.now()
    };
    
    // Encode the token (in production, use proper encryption)
    const verificationToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    // For demo purposes, we'll return the OTP in the response
    // In production, you'd send this via email using SendGrid, AWS SES, etc.
    console.log(`OTP for ${email}: ${otp}`);
    
    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      verificationToken: verificationToken,
      // Remove this in production - only for demo
      debug: {
        otp: otp,
        note: 'In production, this would be sent via email'
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
}