# Security Testing Infrastructure

## Overview

This directory contains comprehensive security penetration testing suites for the Personal Brand DNA backend application. These tests are designed to identify and prevent common security vulnerabilities based on OWASP guidelines.

## Test Suites

### 1. Authentication Security (`authentication-security.test.js`)
Tests for JWT vulnerabilities, session management, and authentication bypass attempts:
- JWT token manipulation and weak algorithms
- Session hijacking and fixation
- Brute force protection
- Token storage security
- Privilege escalation prevention

### 2. API Security (`api-security.test.js`)
Tests for API-level security issues:
- Unauthorized access prevention
- CORS policy enforcement
- Rate limiting effectiveness
- HTTP method validation
- Admin endpoint protection

### 3. Input Validation (`input-validation.test.js`)
Tests for injection attacks and input sanitization:
- XSS (Cross-Site Scripting) prevention
- SQL injection prevention
- Command injection prevention
- Path traversal prevention
- NoSQL injection prevention
- Email header injection

### 4. File Upload Security (`file-upload-security.test.js`)
Tests for file upload vulnerabilities:
- Malicious file type detection
- File size limits
- Path traversal in filenames
- Magic byte verification
- Executable file prevention

### 5. OAuth Security (`oauth-security.test.js`)
Tests for OAuth implementation vulnerabilities:
- State parameter validation
- Authorization code security
- Token storage and rotation
- Scope validation
- Redirect URI validation

## Running Security Tests

### Run All Security Tests
```bash
npm run test:security
```

### Run Individual Test Suites
```bash
# Authentication tests
npm test __tests__/security/authentication-security.test.js

# API security tests
npm test __tests__/security/api-security.test.js

# Input validation tests
npm test __tests__/security/input-validation.test.js

# File upload tests
npm test __tests__/security/file-upload-security.test.js

# OAuth tests
npm test __tests__/security/oauth-security.test.js
```

### Run with Coverage
```bash
npm run test:security:coverage
```

## Security Scanner

The security scanner (`src/scripts/security-scan.js`) performs automated security checks:

### Running the Scanner
```bash
node src/scripts/security-scan.js
```

### What It Checks
1. **Sensitive Data Exposure**
   - API keys and secrets in code
   - Hardcoded passwords
   - Private keys
   - Database credentials

2. **Code Vulnerabilities**
   - SQL injection risks
   - Command injection risks
   - XSS vulnerabilities
   - Weak randomness
   - Eval usage

3. **Dependencies**
   - Known vulnerabilities via npm audit
   - Outdated packages

4. **Security Headers**
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security
   - Content-Security-Policy

5. **HTTPS Enforcement**
   - SSL/TLS redirect middleware
   - Secure cookie flags

## Security Configuration

The security configuration (`src/config/security-config.js`) provides:

### Password Policy
- Minimum length: 8 characters
- Character requirements (uppercase, lowercase, numbers, special)
- Common password prevention
- User info exclusion

### Session Management
- Session timeout: 30 minutes
- Absolute timeout: 24 hours
- Concurrent session limits
- IP/User-Agent binding options

### Encryption
- AES-256-GCM for sensitive data
- PBKDF2 key derivation
- Secure random generation

### Rate Limiting
- General: 100 requests per 15 minutes
- Authentication: 5 attempts per 15 minutes
- API: 1000 requests per hour

## Best Practices

### When Adding New Features
1. **Authentication Required**: Always use the `authenticate` middleware for protected routes
2. **Input Validation**: Validate and sanitize all user inputs
3. **SQL Queries**: Use parameterized queries, never string concatenation
4. **File Uploads**: Validate file types, scan content, use random names
5. **Sensitive Data**: Encrypt at rest, hash passwords, secure transmission

### Security Checklist for Code Reviews
- [ ] No hardcoded secrets or credentials
- [ ] All SQL queries are parameterized
- [ ] User input is validated and sanitized
- [ ] Authentication is properly implemented
- [ ] Rate limiting is applied to sensitive endpoints
- [ ] Error messages don't expose sensitive information
- [ ] Security headers are properly configured
- [ ] HTTPS is enforced in production

## Common Vulnerabilities and Fixes

### SQL Injection
```javascript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Secure
const query = 'SELECT * FROM users WHERE id = $1';
const params = [userId];
```

### XSS Prevention
```javascript
// ❌ Vulnerable
res.send(`<h1>Welcome ${username}</h1>`);

// ✅ Secure
res.json({ message: `Welcome ${username}` });
```

### Path Traversal
```javascript
// ❌ Vulnerable
const filePath = `/uploads/${req.params.filename}`;

// ✅ Secure
const filename = path.basename(req.params.filename);
const filePath = path.join('/uploads', filename);
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to: security@personalbranddna.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Testing in CI/CD

Add to your CI/CD pipeline:

```yaml
# .github/workflows/security.yml
name: Security Tests
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run test:security
      - run: npm audit
      - run: node src/scripts/security-scan.js
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)