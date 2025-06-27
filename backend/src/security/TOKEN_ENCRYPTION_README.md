# Token Encryption Security System

## Overview

This comprehensive token encryption system provides multiple layers of security for all token types in the Personal Brand DNA application, including JWT tokens, OAuth tokens, session tokens, and refresh tokens.

## Key Features

### 1. AES-256-GCM Encryption
- All tokens are encrypted using AES-256-GCM with authenticated encryption
- Unique initialization vectors (IVs) for each token
- Authentication tags prevent tampering
- Key derivation using PBKDF2 with 100,000 iterations

### 2. Token Versioning
- Support for key rotation without breaking existing tokens
- Backward compatibility during grace periods
- Automated re-encryption of tokens with new keys

### 3. Token Binding
- Binds tokens to specific devices/browsers
- Prevents token theft and replay attacks
- Uses device fingerprinting (User-Agent, IP, Device ID)

### 4. Comprehensive Audit Trail
- All token operations are logged
- Usage patterns tracked for anomaly detection
- Security events stored for compliance

### 5. Revocation System
- Immediate token revocation capability
- Centralized revocation list
- Cached lookups for performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Token Flow                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Generate Token → 2. Encrypt → 3. Store → 4. Transmit   │
│                                                             │
│  5. Receive → 6. Validate → 7. Decrypt → 8. Verify        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Security Layers                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: JWT Signing (HS512)                              │
│  Layer 2: AES-256-GCM Encryption                           │
│  Layer 3: Token Binding & Fingerprinting                   │
│  Layer 4: Revocation & Expiration Checks                   │
│  Layer 5: Usage Monitoring & Anomaly Detection             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### Token Encryption Service (`tokenEncryptionService.js`)

The core service providing encryption/decryption capabilities:

```javascript
// Encrypt a token
const encrypted = tokenEncryptionService.encryptToken(
  token,        // Token to encrypt
  'jwt',        // Token type
  metadata      // Additional metadata
);

// Decrypt a token
const decrypted = tokenEncryptionService.decryptToken(
  encrypted,    // Encrypted package
  'jwt'         // Expected type
);
```

### Enhanced JWT Utilities (`jwt.js`)

JWT-specific implementation with encryption layer:

```javascript
// Generate encrypted JWT
const tokenData = await generateToken(
  { userId: 123, email: 'user@example.com' },
  'access',
  { req: request }  // For fingerprinting
);

// Verify encrypted JWT
const payload = await verifyToken(
  tokenData.token,
  'access',
  { req: request }
);
```

### Token Security Middleware (`tokenSecurity.js`)

Express middleware for comprehensive token security:

```javascript
// Apply full token security
app.use(tokenSecurity.fullTokenSecurity());

// Or apply individual components
app.use(tokenSecurity.validateTokenEncryption());
app.use(tokenSecurity.enforceTokenBinding());
app.use(tokenSecurity.trackTokenUsage());
```

## Configuration

### Environment Variables

```bash
# Token Encryption
TOKEN_ENCRYPTION_KEY=<64-character-hex-string>
TOKEN_ENCRYPTION_KEY_V1=<previous-key-for-rotation>

# JWT Configuration
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<different-strong-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Security Features
JWT_ENCRYPTION_ENABLED=true
JWT_FINGERPRINTING_ENABLED=true
JWT_REVOCATION_ENABLED=true
TOKEN_BINDING_ENABLED=true
JWT_KEY_ROTATION_DAYS=90

# OAuth Security
OAUTH_STATE_KEY=<32-byte-hex-string>
OAUTH_PKCE_ENABLED=true
```

### Database Schema

The system requires the following tables:
- `encrypted_tokens` - Stores encrypted token data
- `token_revocation_list` - Central revocation list
- `jwt_revocation_list` - JWT-specific revocations
- `token_metadata` - Token tracking metadata
- `token_usage_metrics` - Usage statistics
- `jwt_key_rotation` - Key rotation history

Run migration: `npm run migrate -- 014_create_token_encryption_tables.sql`

## Security Best Practices

### 1. Key Management
- Generate strong encryption keys: `openssl rand -hex 32`
- Rotate keys every 90 days
- Never commit keys to version control
- Use separate keys for different environments

### 2. Token Lifecycle
- Short-lived access tokens (15 minutes)
- Longer refresh tokens (30 days)
- Immediate revocation on logout
- Automatic cleanup of expired tokens

### 3. Monitoring
- Run regular security audits: `npm run token-audit`
- Monitor suspicious activities
- Set up alerts for anomalies
- Review security logs regularly

### 4. Implementation Guidelines
- Always use HTTPS in production
- Implement rate limiting
- Use secure cookie settings
- Enable all security features

## Testing

### Run Security Tests

```bash
# Run token encryption tests
npm test -- __tests__/security/token-encryption.test.js

# Run token security audit
npm run token-audit

# Generate security report
npm run security-report
```

### Test Coverage Areas
- Encryption/decryption integrity
- Key rotation scenarios
- Token binding validation
- Revocation functionality
- Performance under load
- Concurrent operation safety

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Token Generation Rate** - Detect unusual spikes
2. **Failed Verification Attempts** - Potential attacks
3. **Revocation Frequency** - Security incidents
4. **Multi-IP Usage** - Token sharing/theft
5. **Expired Token Usage** - Implementation issues

### Security Dashboard View

```sql
-- Check token security overview
SELECT * FROM token_security_overview;

-- Recent suspicious activities
SELECT * FROM security_events 
WHERE event_type LIKE '%suspicious%' 
ORDER BY created_at DESC 
LIMIT 10;

-- Token usage patterns
SELECT user_id, COUNT(*) as token_count 
FROM encrypted_tokens 
WHERE expires_at > NOW() 
GROUP BY user_id 
HAVING COUNT(*) > 10;
```

## Incident Response

### Token Compromise Response
1. Immediately revoke affected tokens
2. Force user password reset
3. Audit recent account activity
4. Notify user of security event
5. Review and update security measures

### Key Compromise Response
1. Generate new encryption keys
2. Initiate key rotation process
3. Re-encrypt sensitive data
4. Update all environment configurations
5. Audit for potential data exposure

## Compliance

### GDPR Compliance
- Token data includes minimal PII
- Automatic expiration and cleanup
- User-initiated token revocation
- Audit trail for data processing

### Security Standards
- OWASP compliance for token handling
- NIST guidelines for encryption
- PCI DSS for payment-related tokens
- SOC 2 for access controls

## Troubleshooting

### Common Issues

1. **Token Decryption Failures**
   - Check key version compatibility
   - Verify token hasn't been tampered
   - Ensure proper environment configuration

2. **Performance Issues**
   - Implement token caching
   - Use connection pooling
   - Regular cleanup of expired tokens

3. **Token Binding Failures**
   - Check cookie settings
   - Verify HTTPS in production
   - Review proxy configurations

## Future Enhancements

1. **Hardware Security Module (HSM) Integration**
   - Store master keys in HSM
   - Hardware-based encryption

2. **Multi-Factor Token Authentication**
   - Require additional factors for sensitive operations
   - Time-based challenges

3. **Distributed Token Management**
   - Redis cluster for revocation list
   - Geo-distributed token validation

4. **Machine Learning Anomaly Detection**
   - Pattern recognition for usage
   - Predictive security alerts

## Support

For security issues or questions:
- Review security logs in `/logs/security/`
- Check monitoring dashboard
- Contact security team
- File security issues privately

Remember: Security is everyone's responsibility. Always follow best practices and report suspicious activities immediately.