const crypto = require('crypto');
const { errorHandler } = require('../_lib/errorHandler');
const { authenticateToken } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const authResult = await authenticateToken(req);
    if (!authResult.success) {
      return res.status(401).json({ error: authResult.message });
    }

    const userId = authResult.userId;
    
    // LinkedIn OAuth configuration
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 
      `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/linkedin/callback`;

    if (!clientId) {
      return res.status(500).json({ 
        error: 'LinkedIn integration not configured',
        message: 'Please configure LINKEDIN_CLIENT_ID in environment variables'
      });
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in Redis or database for verification
    // For now, we'll include userId in the state (in production, use Redis)
    const stateData = Buffer.from(JSON.stringify({ userId, state })).toString('base64');

    // LinkedIn OAuth 2.0 authorization URL
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', stateData);
    authUrl.searchParams.append('scope', 'r_liteprofile r_emailaddress w_member_social');

    res.status(200).json({
      success: true,
      data: {
        authUrl: authUrl.toString(),
        message: 'Redirect user to this URL to authenticate with LinkedIn'
      }
    });
  } catch (error) {
    console.error('Error initiating LinkedIn OAuth:', error);
    errorHandler(error, res);
  }
};