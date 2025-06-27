export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    // Instant demo login - no validation needed
    const userData = {
      id: `demo_${Date.now()}`,
      email: 'demo@personalbranddna.com',
      firstName: 'Demo',
      lastName: 'User',
      verified: true,
      subscriptionTier: 'professional',
      createdAt: new Date().toISOString()
    };

    // Generate simple JWT token
    const token = Buffer.from(JSON.stringify({
      ...userData,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    return res.status(200).json({
      success: true,
      message: 'Demo login successful!',
      user: userData,
      accessToken: token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('Demo login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Demo login failed'
    });
  }
}