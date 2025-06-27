export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { email, otp, firstName, lastName, verificationToken } = req.body;

    // Validate inputs
    if (!email || !otp || !verificationToken) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and verification token are required'
      });
    }

    // Decode and verify the verification token
    let tokenData;
    try {
      const decodedToken = Buffer.from(verificationToken, 'base64').toString('utf8');
      tokenData = JSON.parse(decodedToken);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Check if token is for the correct email
    if (tokenData.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Token email mismatch'
      });
    }

    // Check if OTP is expired
    if (Date.now() > tokenData.expires) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Verify OTP
    if (tokenData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // OTP verified successfully
    // Create user session (simplified JWT)
    const userData = {
      id: `user_${Date.now()}`,
      email: email,
      firstName: firstName || 'User',
      lastName: lastName || '',
      verified: true,
      createdAt: new Date().toISOString()
    };

    // Generate simple JWT token (in production, use proper JWT library)
    const token = Buffer.from(JSON.stringify({
      ...userData,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userData,
      accessToken: token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
}