# OAuth Security Implementation Guide

## Overview

This document describes the comprehensive OAuth 2.0 security implementation for the Personal Brand DNA System, with a focus on LinkedIn OAuth integration. The implementation follows industry best practices and includes advanced security features to protect against common OAuth vulnerabilities.

## Security Features

### 1. PKCE (Proof Key for Code Exchange) - RFC 7636

Our implementation includes full PKCE support to prevent authorization code interception attacks:

- **Code Verifier**: Cryptographically random string (43-128 characters)
- **Code Challenge**: SHA256 hash of code verifier, base64url encoded
- **Challenge Method**: S256 (SHA256) only - plain text method is rejected

```javascript
// Example PKCE flow
const { url, state, pkce } = linkedinOAuthService.getAuthorizationUrl(userId);
// Store pkce.codeVerifier securely for token exchange
// Include pkce.codeChallenge in authorization request
```

### 2. Enhanced State Parameter Security

State parameters are generated with high entropy and encrypted using AES-256-GCM:

- **Minimum entropy**: 128 bits
- **Encryption**: AES-256-GCM with authenticated encryption
- **Expiration**: 1 hour maximum lifetime
- **One-time use**: States are invalidated after verification

### 3. Token Encryption

All OAuth tokens are encrypted at rest using AES-256-GCM:

- **Unique IV**: Generated for each encryption operation
- **Authentication tags**: Ensure data integrity
- **Key rotation**: Supported through configuration

### 4. Redirect URI Validation

Strict validation of redirect URIs to prevent open redirect vulnerabilities:

- **Whitelist patterns**: Only pre-configured patterns allowed
- **Protocol enforcement**: HTTPS required (except localhost development)
- **No fragments**: Hash fragments are rejected
- **No query parameters**: Additional parameters trigger warnings

### 5. Token Rotation

Automatic token rotation to limit exposure window:

- **Rotation window**: 30 days by default
- **Graceful handling**: Old tokens remain valid during rotation
- **Audit logging**: All rotation events are logged

## Security Validators

### OAuthSecurityValidator (`src/validators/oauthSecurityValidator.js`)

Comprehensive validation functions for OAuth security:

```javascript
// Validate state parameter
const stateValidation = oauthSecurityValidator.validateStateParameter(state);

// Validate redirect URI
const redirectValidation = oauthSecurityValidator.validateRedirectUri(redirectUri);

// Verify token encryption
const encryptionValidation = oauthSecurityValidator.verifyTokenEncryption(tokenData);

// Validate scopes
const scopeValidation = oauthSecurityValidator.validateScopePermissions(scopes);

// Check for token leakage
const leakageCheck = oauthSecurityValidator.checkTokenLeakage(content, context);

// Validate PKCE parameters
const pkceValidation = oauthSecurityValidator.validatePKCE(codeVerifier, codeChallenge, 'S256');
```

### Security Middleware (`src/middleware/oauthSecurity.js`)

OAuth-specific security middleware:

```javascript
// Initialize PKCE for authorization request
app.get('/oauth/authorize', oauthSecurity.initializePKCE(), handleAuthorize);

// Verify PKCE on token exchange
app.post('/oauth/token', oauthSecurity.verifyPKCE(), handleTokenExchange);

// Validate redirect URIs
app.use('/oauth/*', oauthSecurity.validateRedirectUri());

// Add security headers
app.use('/oauth/*', oauthSecurity.addSecurityHeaders());

// Enforce token rotation
app.use('/api/*', auth, oauthSecurity.enforceTokenRotation());

// Rate limiting for OAuth endpoints
app.use('/oauth/*', oauthSecurity.oauthRateLimit());

// Audit logging
app.use('/oauth/*', oauthSecurity.auditOAuthEvent('oauth_request'));
```

## Security Audit

### Running the Security Audit

```bash
# Run comprehensive OAuth security audit
node src/scripts/oauth-audit.js

# The audit checks:
# - Configuration security
# - Implementation correctness
# - Token security
# - Database security
# - API endpoint security
# - Compliance with OAuth 2.0
# - Best practices
```

### Audit Output

The audit generates a detailed JSON report with:
- Overall security score and grade
- Detailed findings by category
- Critical issues requiring immediate attention
- Warnings for improvement
- Compliance status
- Recommendations

## Security Headers

All OAuth endpoints include the following security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; frame-ancestors 'none';
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
```

## LinkedIn OAuth Specific Security

### Scope Management

We request only the minimum required scopes:
- `r_liteprofile`: Basic profile information
- `r_emailaddress`: Email address
- `w_member_social`: Post content
- `r_member_social`: Read social data

Dangerous scopes like `r_fullprofile` and `rw_company_admin` are explicitly rejected.

### Compliance Logging

All OAuth events are logged for compliance:
- Authorization attempts
- Token exchanges
- Token refreshes
- Access revocations
- Security violations

## Testing

Comprehensive test suite in `__tests__/security/oauth-advanced.test.js`:

```bash
# Run OAuth security tests
npm test oauth-advanced

# Test categories:
# - PKCE implementation
# - Token rotation
# - State parameter entropy
# - Redirect URI validation
# - Token storage encryption
# - Security middleware
# - Token leakage detection
# - Security audit functionality
```

## Configuration

### Required Environment Variables

```bash
# OAuth Client Configuration
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=https://yourapp.com/api/linkedin/callback

# Security Keys (32 bytes hex encoded)
LINKEDIN_TOKEN_KEY=64-character-hex-string
OAUTH_STATE_KEY=64-character-hex-string

# Optional Security Settings
OAUTH_PKCE_ENABLED=true # Default: true
OAUTH_TOKEN_ROTATION_DAYS=30 # Default: 30
```

### Generating Secure Keys

```bash
# Generate secure keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Best Practices

1. **Always use HTTPS** in production
2. **Enable PKCE** for all OAuth flows
3. **Rotate tokens** regularly (30-day default)
4. **Monitor audit logs** for suspicious activity
5. **Run security audits** before deployment
6. **Keep dependencies updated** for security patches
7. **Use environment variables** for sensitive configuration
8. **Implement rate limiting** on all OAuth endpoints
9. **Validate all inputs** including redirect URIs and scopes
10. **Encrypt tokens at rest** using AES-256-GCM

## Troubleshooting

### Common Issues

1. **PKCE validation fails**
   - Ensure code verifier is stored between authorization and token exchange
   - Verify code challenge calculation uses SHA256
   - Check that code verifier meets length requirements (43-128 chars)

2. **State parameter expires**
   - States expire after 1 hour
   - Ensure timely completion of OAuth flow
   - Check server time synchronization

3. **Token decryption fails**
   - Verify encryption keys match
   - Check for data corruption
   - Ensure IV and auth tag are preserved

4. **Redirect URI rejected**
   - URI must match whitelist patterns exactly
   - Use HTTPS (except localhost)
   - Remove any fragments or unexpected query parameters

## Security Incident Response

If a security issue is detected:

1. **Immediate Actions**
   - Revoke affected tokens
   - Review audit logs
   - Disable compromised accounts

2. **Investigation**
   - Run security audit
   - Check for token leakage
   - Review recent OAuth flows

3. **Remediation**
   - Rotate all keys
   - Force token refresh for all users
   - Update security configurations

4. **Prevention**
   - Implement additional monitoring
   - Update security policies
   - Enhance validation rules

## Compliance

This implementation complies with:
- OAuth 2.0 (RFC 6749)
- PKCE (RFC 7636)
- OAuth 2.0 Security Best Practices (RFC 8252)
- LinkedIn API Terms of Service

## Support

For security concerns or questions:
- Review test cases in `__tests__/security/`
- Run the security audit tool
- Check audit logs for detailed information
- Contact the security team for critical issues