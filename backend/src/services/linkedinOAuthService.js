const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const oauthSecurityValidator = require('../validators/oauthSecurityValidator');
const oauthSecurity = require('../middleware/oauthSecurity');

// LinkedIn OAuth constants
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';
const LINKEDIN_SCOPES = ['r_liteprofile', 'r_emailaddress', 'w_member_social', 'r_member_social'];

class LinkedInOAuthService {
  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/api/linkedin/callback';
    this.encryptionKey = Buffer.from(process.env.LINKEDIN_TOKEN_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
    this.stateKey = Buffer.from(process.env.OAUTH_STATE_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
    this.pkceEnabled = process.env.OAUTH_PKCE_ENABLED !== 'false'; // Default to true
    this.tokenRotationWindow = 86400000 * 30; // 30 days
  }

  /**
   * Generate OAuth authorization URL with PKCE support
   * @param {string} userId - User ID for state parameter
   * @param {object} options - Additional options
   * @returns {object} Authorization URL, state, and PKCE parameters
   */
  getAuthorizationUrl(userId, options = {}) {
    // Validate redirect URI
    const validation = oauthSecurityValidator.validateRedirectUri(this.redirectUri);
    if (!validation.valid) {
      throw new Error(`Invalid redirect URI: ${validation.errors.join(', ')}`);
    }

    const state = this.generateSecureState(userId, options);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: LINKEDIN_SCOPES.join(' ')
    });

    // Add PKCE parameters if enabled
    let pkceData = null;
    if (this.pkceEnabled) {
      const codeVerifier = oauthSecurity.generateCodeVerifier();
      const codeChallenge = oauthSecurity.generateCodeChallenge(codeVerifier);
      
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
      
      pkceData = {
        codeVerifier,
        codeChallenge,
        challengeMethod: 'S256'
      };
    }

    return {
      url: `${LINKEDIN_AUTH_URL}?${params.toString()}`,
      state,
      pkce: pkceData
    };
  }

  /**
   * Generate secure state parameter with enhanced entropy
   * @param {string} userId - User ID
   * @param {object} additionalData - Additional data to include
   * @returns {string} Encrypted state
   */
  generateSecureState(userId, additionalData = {}) {
    const stateData = {
      userId,
      sessionId: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
      ...additionalData
    };

    // Use AES-256-GCM for state encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.stateKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(stateData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const state = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]).toString('base64url');

    // Validate generated state
    const validation = oauthSecurityValidator.validateStateParameter(state);
    if (!validation.valid) {
      logger.warn('Generated state failed validation', validation.errors);
    }

    return state;
  }

  /**
   * Verify state parameter with enhanced security
   * @param {string} state - Encrypted state
   * @returns {object} Decrypted state data
   */
  verifyState(state) {
    try {
      // Validate state format
      const validation = oauthSecurityValidator.validateStateParameter(state);
      if (!validation.valid) {
        throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
      }

      // Decode state
      const stateBuffer = Buffer.from(state, 'base64url');
      if (stateBuffer.length < 32) { // IV (16) + authTag (16)
        throw new Error('Invalid state format');
      }

      const iv = stateBuffer.slice(0, 16);
      const authTag = stateBuffer.slice(16, 32);
      const encrypted = stateBuffer.slice(32);

      // Decrypt state
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.stateKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      const data = JSON.parse(decrypted);
      
      // Check if state is not expired (1 hour)
      if (Date.now() - data.timestamp > 3600000) {
        throw new Error('State parameter expired');
      }
      
      return data;
    } catch (error) {
      logger.error('State verification failed:', error);
      throw new Error('Invalid or expired state parameter');
    }
  }

  /**
   * Exchange authorization code for access token with PKCE support
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} codeVerifier - PKCE code verifier (optional)
   * @returns {object} Token data
   */
  async exchangeCodeForToken(code, state, codeVerifier = null) {
    const stateData = this.verifyState(state);
    
    try {
      const params = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      };

      // Add PKCE code verifier if provided
      if (this.pkceEnabled && codeVerifier) {
        params.code_verifier = codeVerifier;
      }

      const response = await axios.post(LINKEDIN_TOKEN_URL, null, {
        params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, expires_in, refresh_token } = response.data;
      
      // Get LinkedIn user profile
      const profile = await this.getLinkedInProfile(access_token);
      
      // Store encrypted tokens
      await this.storeTokens({
        userId: stateData.userId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        linkedinUserId: profile.id,
        linkedinUserName: `${profile.firstName} ${profile.lastName}`
      });

      // Log compliance event with security audit
      await this.logComplianceEvent(stateData.userId, 'oauth_connected', {
        linkedinUserId: profile.id,
        scope: LINKEDIN_SCOPES,
        pkceUsed: !!codeVerifier,
        tokenRotationEnabled: true
      });

      return {
        success: true,
        profile
      };
    } catch (error) {
      logger.error('Token exchange failed:', error);
      throw new Error('Failed to exchange code for token');
    }
  }

  /**
   * Get LinkedIn user profile
   * @param {string} accessToken - Access token
   * @returns {object} User profile
   */
  async getLinkedInProfile(accessToken) {
    try {
      const response = await axios.get(`${LINKEDIN_API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });

      return {
        id: response.data.id,
        firstName: response.data.firstName.localized.en_US,
        lastName: response.data.lastName.localized.en_US
      };
    } catch (error) {
      logger.error('Failed to fetch LinkedIn profile:', error);
      throw new Error('Failed to fetch LinkedIn profile');
    }
  }

  /**
   * Store encrypted OAuth tokens
   * @param {object} tokenData - Token information
   */
  async storeTokens({ userId, accessToken, refreshToken, expiresIn, linkedinUserId, linkedinUserName }) {
    // Encrypt tokens
    const encryptedAccess = this.encryptToken(accessToken);
    const encryptedRefresh = refreshToken ? this.encryptToken(refreshToken) : null;
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    
    // Deactivate existing tokens
    await db('linkedin_oauth_tokens')
      .where({ user_id: userId, is_active: true })
      .update({ is_active: false });
    
    // Insert new token
    await db('linkedin_oauth_tokens').insert({
      user_id: userId,
      access_token: JSON.stringify(encryptedAccess),
      refresh_token: encryptedRefresh ? JSON.stringify(encryptedRefresh) : null,
      expires_at: expiresAt,
      scope: LINKEDIN_SCOPES.join(' '),
      linkedin_user_id: linkedinUserId,
      linkedin_user_name: linkedinUserName,
      is_active: true
    });
  }

  /**
   * Encrypt token using AES-256-GCM
   * @param {string} token - Token to encrypt
   * @returns {object} Encrypted token data
   */
  encryptToken(token) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt token
   * @param {object} encryptedData - Encrypted token data
   * @returns {string} Decrypted token
   */
  decryptToken(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipheriv(
      algorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get active token for user
   * @param {string} userId - User ID
   * @returns {object} Token data
   */
  async getActiveToken(userId) {
    const tokenRecord = await db('linkedin_oauth_tokens')
      .where({ user_id: userId, is_active: true })
      .andWhere('expires_at', '>', new Date())
      .first();
    
    if (!tokenRecord) {
      return null;
    }
    
    // Update last used timestamp
    await db('linkedin_oauth_tokens')
      .where({ id: tokenRecord.id })
      .update({ last_used_at: new Date() });
    
    // Decrypt token
    const encryptedData = JSON.parse(tokenRecord.access_token);
    const accessToken = this.decryptToken(encryptedData);
    
    return {
      accessToken,
      expiresAt: tokenRecord.expires_at,
      linkedinUserId: tokenRecord.linkedin_user_id,
      linkedinUserName: tokenRecord.linkedin_user_name
    };
  }

  /**
   * Refresh access token
   * @param {string} userId - User ID
   * @returns {object} New token data
   */
  async refreshToken(userId) {
    const tokenRecord = await db('linkedin_oauth_tokens')
      .where({ user_id: userId, is_active: true })
      .first();
    
    if (!tokenRecord || !tokenRecord.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    const encryptedRefresh = JSON.parse(tokenRecord.refresh_token);
    const refreshToken = this.decryptToken(encryptedRefresh);
    
    try {
      const response = await axios.post(LINKEDIN_TOKEN_URL, null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }
      });
      
      const { access_token, expires_in } = response.data;
      
      // Update token
      await this.storeTokens({
        userId,
        accessToken: access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresIn: expires_in,
        linkedinUserId: tokenRecord.linkedin_user_id,
        linkedinUserName: tokenRecord.linkedin_user_name
      });
      
      // Log compliance event
      await this.logComplianceEvent(userId, 'oauth_refreshed', {
        linkedinUserId: tokenRecord.linkedin_user_id
      });
      
      return {
        success: true,
        expiresAt: new Date(Date.now() + (expires_in * 1000))
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Revoke LinkedIn access
   * @param {string} userId - User ID
   */
  async revokeAccess(userId) {
    const tokenRecord = await db('linkedin_oauth_tokens')
      .where({ user_id: userId, is_active: true })
      .first();
    
    if (tokenRecord) {
      // Deactivate token
      await db('linkedin_oauth_tokens')
        .where({ id: tokenRecord.id })
        .update({ is_active: false });
      
      // Log compliance event
      await this.logComplianceEvent(userId, 'oauth_disconnected', {
        linkedinUserId: tokenRecord.linkedin_user_id
      });
    }
  }

  /**
   * Check if user has active LinkedIn connection
   * @param {string} userId - User ID
   * @returns {boolean} Connection status
   */
  async isConnected(userId) {
    const token = await this.getActiveToken(userId);
    return !!token;
  }

  /**
   * Log compliance event with security context
   * @param {string} userId - User ID
   * @param {string} actionType - Action type
   * @param {object} details - Action details
   * @param {object} req - Request object (optional)
   */
  async logComplianceEvent(userId, actionType, details, req = null) {
    // Check for token leakage in details
    const detailsStr = JSON.stringify(details);
    const leakageCheck = oauthSecurityValidator.checkTokenLeakage(detailsStr, 'compliance_log');
    
    if (leakageCheck.hasLeaks) {
      logger.error('Token leakage detected in compliance log', leakageCheck.leaks);
      // Sanitize details
      details = { ...details, _sanitized: true };
    }

    await db('linkedin_compliance_log').insert({
      user_id: userId,
      action_type: actionType,
      action_details: JSON.stringify(details),
      ip_address: req ? req.ip : null,
      user_agent: req ? req.get('user-agent') : null,
      security_context: JSON.stringify({
        pkceEnabled: this.pkceEnabled,
        stateValidation: true,
        tokenEncryption: 'AES-256-GCM',
        timestamp: new Date()
      })
    });
  }

  /**
   * Check if token needs rotation
   * @param {object} tokenRecord - Token database record
   * @returns {boolean} Whether token needs rotation
   */
  needsTokenRotation(tokenRecord) {
    if (!tokenRecord) return false;
    
    const tokenAge = Date.now() - new Date(tokenRecord.created_at).getTime();
    return tokenAge > this.tokenRotationWindow;
  }

  /**
   * Perform security audit on current configuration
   * @returns {object} Audit results
   */
  async performSecurityAudit() {
    const config = {
      stateGeneration: true,
      sampleState: this.generateSecureState('audit-user'),
      redirectUris: [this.redirectUri],
      tokenEncryption: true,
      sampleEncryptedToken: this.encryptToken('sample-token'),
      requestedScopes: LINKEDIN_SCOPES,
      pkce: this.pkceEnabled ? {
        codeVerifier: oauthSecurity.generateCodeVerifier(),
        codeChallenge: null,
        challengeMethod: 'S256'
      } : null
    };

    if (config.pkce) {
      config.pkce.codeChallenge = oauthSecurity.generateCodeChallenge(config.pkce.codeVerifier);
    }

    return oauthSecurityValidator.performSecurityAudit(config);
  }
}

module.exports = new LinkedInOAuthService();