const crypto = require('crypto');
const url = require('url');
const logger = require('../utils/logger');

class OAuthSecurityValidator {
  constructor() {
    // Allowed redirect URI patterns
    this.allowedRedirectPatterns = [
      /^https:\/\/localhost:\d+\/api\/linkedin\/callback$/,
      /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app\/api\/linkedin\/callback$/,
      /^https:\/\/personalbranddna\.com\/api\/linkedin\/callback$/,
      /^https:\/\/app\.personalbranddna\.com\/api\/linkedin\/callback$/
    ];

    // Security configuration
    this.config = {
      minStateEntropy: 128, // bits
      maxStateAge: 3600000, // 1 hour in ms
      minCodeVerifierLength: 43,
      maxCodeVerifierLength: 128,
      requiredScopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social', 'r_member_social'],
      tokenRotationWindow: 300000, // 5 minutes
      maxTokenLifetime: 86400000 * 60 // 60 days
    };
  }

  /**
   * Validate OAuth state parameter for CSRF protection
   * @param {string} state - State parameter
   * @returns {object} Validation result
   */
  validateStateParameter(state) {
    const errors = [];
    
    if (!state || typeof state !== 'string') {
      errors.push('State parameter is required and must be a string');
      return { valid: false, errors };
    }

    // Check minimum length (base64 encoded 128 bits = 22 chars minimum)
    if (state.length < 22) {
      errors.push('State parameter does not meet minimum entropy requirements');
    }

    // Check for patterns that might indicate weak generation
    if (/^[0-9]+$/.test(state) || /^[a-fA-F0-9]+$/.test(state)) {
      errors.push('State parameter appears to use weak generation (numeric or hex only)');
    }

    // Check for common prefixes that might indicate predictable generation
    const commonPrefixes = ['state_', 'oauth_', 'csrf_', 'token_'];
    if (commonPrefixes.some(prefix => state.startsWith(prefix))) {
      errors.push('State parameter uses predictable prefix');
    }

    // Estimate entropy
    const entropy = this.estimateEntropy(state);
    if (entropy < this.config.minStateEntropy) {
      errors.push(`State parameter entropy (${entropy} bits) is below minimum requirement (${this.config.minStateEntropy} bits)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      entropy,
      recommendations: this.getStateRecommendations(errors)
    };
  }

  /**
   * Validate redirect URI
   * @param {string} redirectUri - Redirect URI to validate
   * @returns {object} Validation result
   */
  validateRedirectUri(redirectUri) {
    const errors = [];
    const warnings = [];

    if (!redirectUri) {
      errors.push('Redirect URI is required');
      return { valid: false, errors, warnings };
    }

    // Parse URI
    let parsedUri;
    try {
      parsedUri = new url.URL(redirectUri);
    } catch (error) {
      errors.push('Invalid redirect URI format');
      return { valid: false, errors, warnings };
    }

    // Check protocol
    if (parsedUri.protocol !== 'https:') {
      if (parsedUri.hostname === 'localhost') {
        warnings.push('Using HTTP with localhost - ensure HTTPS in production');
      } else {
        errors.push('Redirect URI must use HTTPS protocol');
      }
    }

    // Check against allowed patterns
    const isAllowed = this.allowedRedirectPatterns.some(pattern => 
      pattern.test(redirectUri)
    );

    if (!isAllowed) {
      errors.push('Redirect URI not in allowed list');
    }

    // Check for suspicious patterns
    if (parsedUri.searchParams.toString()) {
      warnings.push('Redirect URI contains query parameters - ensure they are validated');
    }

    if (parsedUri.hash) {
      errors.push('Redirect URI must not contain fragment identifier');
    }

    // Check for open redirect vulnerabilities
    if (redirectUri.includes('//') && !redirectUri.startsWith('https://') && !redirectUri.startsWith('http://')) {
      errors.push('Potential open redirect vulnerability detected');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsedUri: errors.length === 0 ? parsedUri : null
    };
  }

  /**
   * Verify token encryption and storage
   * @param {object} tokenData - Token data to verify
   * @returns {object} Verification result
   */
  verifyTokenEncryption(tokenData) {
    const errors = [];
    const warnings = [];

    if (!tokenData || typeof tokenData !== 'object') {
      errors.push('Token data must be an object');
      return { valid: false, errors, warnings };
    }

    // Check encryption structure
    if (!tokenData.encrypted || !tokenData.iv || !tokenData.authTag) {
      errors.push('Token must include encrypted data, IV, and auth tag');
    }

    // Verify IV uniqueness (should be different each time)
    if (tokenData.iv && tokenData.iv.length !== 32) { // 16 bytes = 32 hex chars
      errors.push('IV must be 16 bytes (32 hex characters)');
    }

    // Verify auth tag presence
    if (tokenData.authTag && tokenData.authTag.length !== 32) { // 16 bytes = 32 hex chars
      errors.push('Auth tag must be 16 bytes (32 hex characters)');
    }

    // Check for potential token leakage indicators
    const tokenString = JSON.stringify(tokenData);
    const suspiciousPatterns = [
      /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/,
      /access_token["\s:]+[A-Za-z0-9\-._~+\/]+/,
      /refresh_token["\s:]+[A-Za-z0-9\-._~+\/]+/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(tokenString)) {
        errors.push('Potential unencrypted token detected in token data');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations: this.getEncryptionRecommendations(errors)
    };
  }

  /**
   * Validate scope permissions
   * @param {array|string} scopes - Requested scopes
   * @returns {object} Validation result
   */
  validateScopePermissions(scopes) {
    const errors = [];
    const warnings = [];

    // Normalize scopes to array
    const scopeArray = Array.isArray(scopes) 
      ? scopes 
      : (typeof scopes === 'string' ? scopes.split(' ') : []);

    if (scopeArray.length === 0) {
      errors.push('At least one scope is required');
      return { valid: false, errors, warnings };
    }

    // Check for required scopes
    const missingRequired = this.config.requiredScopes.filter(
      required => !scopeArray.includes(required)
    );

    if (missingRequired.length > 0) {
      warnings.push(`Missing recommended scopes: ${missingRequired.join(', ')}`);
    }

    // Check for dangerous or unnecessary scopes
    const dangerousScopes = [
      'r_fullprofile', // Full profile access
      'r_contactinfo', // Contact information
      'rw_company_admin', // Company administration
      'w_compliance' // Compliance writing
    ];

    const foundDangerous = scopeArray.filter(scope => 
      dangerousScopes.includes(scope)
    );

    if (foundDangerous.length > 0) {
      warnings.push(`Potentially excessive scopes requested: ${foundDangerous.join(', ')}`);
    }

    // Check for deprecated scopes
    const deprecatedScopes = ['r_basicprofile', 'r_fullprofile'];
    const foundDeprecated = scopeArray.filter(scope => 
      deprecatedScopes.includes(scope)
    );

    if (foundDeprecated.length > 0) {
      errors.push(`Deprecated scopes detected: ${foundDeprecated.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requestedScopes: scopeArray,
      analysis: {
        hasMinimumRequired: missingRequired.length === 0,
        hasExcessivePermissions: foundDangerous.length > 0,
        scopeCount: scopeArray.length
      }
    };
  }

  /**
   * Check for token leakage in logs/responses
   * @param {string} content - Content to check
   * @param {string} context - Context of the check (e.g., 'log', 'response')
   * @returns {object} Check result
   */
  checkTokenLeakage(content, context = 'unknown') {
    const leaks = [];
    const patterns = [
      {
        name: 'LinkedIn Access Token',
        pattern: /AQV[A-Za-z0-9\-._~+\/]{100,}/g,
        severity: 'critical'
      },
      {
        name: 'Bearer Token',
        pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g,
        severity: 'critical'
      },
      {
        name: 'OAuth Code',
        pattern: /[?&]code=([A-Za-z0-9\-._~+\/]+)/g,
        severity: 'high'
      },
      {
        name: 'Client Secret',
        pattern: /client_secret["\s:=]+([A-Za-z0-9\-._~+\/]{20,})/gi,
        severity: 'critical'
      },
      {
        name: 'Refresh Token',
        pattern: /refresh_token["\s:=]+([A-Za-z0-9\-._~+\/]+)/gi,
        severity: 'critical'
      }
    ];

    for (const { name, pattern, severity } of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        leaks.push({
          type: name,
          severity,
          context,
          count: matches.length,
          sample: matches[0].substring(0, 20) + '...' // Truncated sample
        });
      }
    }

    return {
      hasLeaks: leaks.length > 0,
      leaks,
      recommendations: this.getLeakageRecommendations(leaks, context)
    };
  }

  /**
   * Validate PKCE parameters
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string} codeChallenge - PKCE code challenge
   * @param {string} challengeMethod - Challenge method (S256)
   * @returns {object} Validation result
   */
  validatePKCE(codeVerifier, codeChallenge, challengeMethod = 'S256') {
    const errors = [];

    // Validate code verifier
    if (!codeVerifier) {
      errors.push('Code verifier is required for PKCE');
    } else {
      // Check length (43-128 characters)
      if (codeVerifier.length < this.config.minCodeVerifierLength || 
          codeVerifier.length > this.config.maxCodeVerifierLength) {
        errors.push(`Code verifier must be ${this.config.minCodeVerifierLength}-${this.config.maxCodeVerifierLength} characters`);
      }

      // Check characters (unreserved characters only)
      if (!/^[A-Za-z0-9\-._~]+$/.test(codeVerifier)) {
        errors.push('Code verifier contains invalid characters');
      }
    }

    // Validate code challenge
    if (!codeChallenge) {
      errors.push('Code challenge is required for PKCE');
    }

    // Validate challenge method
    if (challengeMethod !== 'S256') {
      errors.push('Only S256 challenge method is allowed');
    }

    // Verify challenge generation
    if (codeVerifier && codeChallenge && challengeMethod === 'S256') {
      const expectedChallenge = this.generateCodeChallenge(codeVerifier);
      if (expectedChallenge !== codeChallenge) {
        errors.push('Code challenge does not match code verifier');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      recommendations: errors.length > 0 ? ['Implement PKCE according to RFC 7636'] : []
    };
  }

  /**
   * Generate code challenge from verifier
   * @param {string} codeVerifier - Code verifier
   * @returns {string} Code challenge
   */
  generateCodeChallenge(codeVerifier) {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Estimate entropy of a string
   * @param {string} str - String to analyze
   * @returns {number} Estimated entropy in bits
   */
  estimateEntropy(str) {
    const charCounts = {};
    for (const char of str) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    let entropy = 0;
    const length = str.length;

    for (const count of Object.values(charCounts)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return Math.floor(entropy * length);
  }

  /**
   * Get state parameter recommendations
   * @param {array} errors - Current errors
   * @returns {array} Recommendations
   */
  getStateRecommendations(errors) {
    const recommendations = [];

    if (errors.length > 0) {
      recommendations.push('Use crypto.randomBytes(32).toString("base64url") for state generation');
      recommendations.push('Include timestamp in state to enable expiration checks');
      recommendations.push('Consider including user session identifier in state');
    }

    return recommendations;
  }

  /**
   * Get encryption recommendations
   * @param {array} errors - Current errors
   * @returns {array} Recommendations
   */
  getEncryptionRecommendations(errors) {
    const recommendations = [];

    if (errors.length > 0) {
      recommendations.push('Use AES-256-GCM for token encryption');
      recommendations.push('Generate unique IV for each encryption operation');
      recommendations.push('Store encryption keys in secure key management system');
      recommendations.push('Implement key rotation policy');
    }

    return recommendations;
  }

  /**
   * Get leakage prevention recommendations
   * @param {array} leaks - Detected leaks
   * @param {string} context - Context
   * @returns {array} Recommendations
   */
  getLeakageRecommendations(leaks, context) {
    const recommendations = [];

    if (leaks.length > 0) {
      recommendations.push(`Sanitize ${context} output to remove sensitive tokens`);
      recommendations.push('Implement token masking in logs');
      recommendations.push('Use structured logging with sensitive field filtering');
      recommendations.push('Enable audit logging for token access');
    }

    return recommendations;
  }

  /**
   * Perform comprehensive OAuth security audit
   * @param {object} config - OAuth configuration to audit
   * @returns {object} Audit results
   */
  async performSecurityAudit(config) {
    const auditResults = {
      timestamp: new Date(),
      overall: 'pass',
      categories: {},
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };

    // Audit state generation
    if (config.stateGeneration) {
      const stateAudit = this.validateStateParameter(config.sampleState);
      auditResults.categories.stateParameter = stateAudit;
      if (!stateAudit.valid) {
        auditResults.criticalIssues.push('State parameter generation is insecure');
      }
    }

    // Audit redirect URIs
    if (config.redirectUris) {
      const redirectResults = config.redirectUris.map(uri => 
        this.validateRedirectUri(uri)
      );
      auditResults.categories.redirectUris = redirectResults;
      
      const invalidUris = redirectResults.filter(r => !r.valid);
      if (invalidUris.length > 0) {
        auditResults.criticalIssues.push(`${invalidUris.length} invalid redirect URIs`);
      }
    }

    // Audit token encryption
    if (config.tokenEncryption) {
      const encryptionAudit = this.verifyTokenEncryption(config.sampleEncryptedToken);
      auditResults.categories.tokenEncryption = encryptionAudit;
      if (!encryptionAudit.valid) {
        auditResults.criticalIssues.push('Token encryption is inadequate');
      }
    }

    // Audit scopes
    if (config.requestedScopes) {
      const scopeAudit = this.validateScopePermissions(config.requestedScopes);
      auditResults.categories.scopes = scopeAudit;
      auditResults.warnings.push(...scopeAudit.warnings);
    }

    // Audit PKCE implementation
    if (config.pkce) {
      const pkceAudit = this.validatePKCE(
        config.pkce.codeVerifier,
        config.pkce.codeChallenge,
        config.pkce.challengeMethod
      );
      auditResults.categories.pkce = pkceAudit;
      if (!pkceAudit.valid) {
        auditResults.criticalIssues.push('PKCE implementation is incorrect');
      }
    } else {
      auditResults.warnings.push('PKCE not implemented - recommended for public clients');
    }

    // Set overall result
    if (auditResults.criticalIssues.length > 0) {
      auditResults.overall = 'fail';
    } else if (auditResults.warnings.length > 0) {
      auditResults.overall = 'pass_with_warnings';
    }

    // Log audit results
    logger.info('OAuth security audit completed', {
      overall: auditResults.overall,
      criticalIssueCount: auditResults.criticalIssues.length,
      warningCount: auditResults.warnings.length
    });

    return auditResults;
  }
}

module.exports = new OAuthSecurityValidator();