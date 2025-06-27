const crypto = require('crypto');
const { withTransaction } = require('../_lib/database');
const { errorHandler } = require('../_lib/errorHandler');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error('LinkedIn OAuth error:', oauthError);
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=missing_params`);
    }

    // Decode and verify state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=invalid_state`);
    }

    const { userId } = stateData;
    if (!userId) {
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=invalid_state`);
    }

    // Exchange code for access token
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 
      `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/linkedin/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=config_missing`);
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('LinkedIn token exchange failed:', tokenData);
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=token_exchange_failed`);
    }

    // Get LinkedIn profile info
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error('LinkedIn profile fetch failed:', profileData);
      return res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=profile_fetch_failed`);
    }

    // Encrypt the access token
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encryptedToken = cipher.update(tokenData.access_token, 'utf8', 'hex');
    encryptedToken += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Store encrypted token in database
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO linkedin_oauth_tokens 
         (user_id, encrypted_access_token, encryption_iv, auth_tag, linkedin_user_id, linkedin_name, expires_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           encrypted_access_token = $2,
           encryption_iv = $3,
           auth_tag = $4,
           linkedin_user_id = $5,
           linkedin_name = $6,
           expires_at = $7,
           is_active = true,
           updated_at = NOW()`,
        [
          userId,
          encryptedToken,
          iv.toString('hex'),
          authTag.toString('hex'),
          profileData.id,
          `${profileData.firstName?.localized?.en_US || ''} ${profileData.lastName?.localized?.en_US || ''}`.trim(),
          new Date(Date.now() + (tokenData.expires_in * 1000))
        ]
      );
    });

    // Redirect to success page
    res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?success=connected`);
  } catch (error) {
    console.error('Error in LinkedIn callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || '/'}/linkedin/settings?error=server_error`);
  }
};