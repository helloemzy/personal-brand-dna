# SQL Injection and XSS Prevention Implementation Guide

## Overview

This guide covers the comprehensive security tools implemented for preventing SQL injection and XSS attacks in the Personal Brand DNA backend system.

## Components

### 1. Input Sanitization Service (`src/services/inputSanitizationService.js`)

The core service for sanitizing all user inputs across the application.

#### Key Features:
- Context-aware sanitization for SQL, HTML, JavaScript, CSS, and URLs
- Pattern detection for SQL injection and XSS attempts
- Support for various data types and validation rules
- Batch sanitization for complex objects

#### Usage Examples:

```javascript
const inputSanitizer = require('./services/inputSanitizationService');

// SQL Sanitization
const safeSqlString = inputSanitizer.sanitizeForSQL(userInput, 'string');
const safeSqlNumber = inputSanitizer.sanitizeForSQL(userInput, 'number');
const safeSqlIdentifier = inputSanitizer.sanitizeForSQL(tableName, 'identifier');

// HTML/XSS Sanitization
const safeHtml = inputSanitizer.sanitizeForHTML(userContent, 'html');
const safeAttribute = inputSanitizer.sanitizeForHTML(userInput, 'attribute');
const safeJavaScript = inputSanitizer.sanitizeForHTML(userInput, 'javascript');

// Object Sanitization
const sanitizedData = inputSanitizer.sanitizeObject(req.body, {
  username: { type: 'sql', context: 'string', required: true },
  email: { type: 'email', required: true },
  bio: { type: 'string', context: 'html' },
  age: { type: 'integer', options: { min: 0, max: 150 } }
});
```

### 2. Secure Query Builder (`src/utils/secureQueryBuilder.js`)

Enforces parameterized queries and prevents dynamic SQL construction.

#### Key Features:
- Fluent API for building SQL queries
- Automatic parameterization
- Query complexity limits
- Anomaly detection
- Prevents raw SQL execution

#### Usage Examples:

```javascript
const queryBuilder = require('./utils/secureQueryBuilder');

// SELECT query
const users = await queryBuilder
  .select('users', ['id', 'username', 'email'])
  .where('active', '=', true)
  .where('role', 'IN', ['admin', 'user'])
  .orderBy('created_at', 'DESC')
  .limit(10)
  .execute(dbPool);

// INSERT query
const newUser = await queryBuilder
  .insert('users', {
    username: 'johndoe',
    email: 'john@example.com',
    password_hash: hashedPassword
  })
  .execute(dbPool);

// UPDATE query
const updated = await queryBuilder
  .update('users', { last_login: new Date() })
  .where('id', '=', userId)
  .execute(dbPool);

// DELETE query (requires WHERE clause)
const deleted = await queryBuilder
  .delete('users')
  .where('id', '=', userId)
  .execute(dbPool);
```

### 3. XSS Prevention Middleware (`src/middleware/xssPrevention.js`)

Comprehensive middleware for preventing XSS attacks.

#### Key Features:
- Content Security Policy (CSP) with nonces
- Automatic input sanitization
- Security headers
- Trusted Types support
- File upload protection

#### Usage Examples:

```javascript
const xssPrevention = require('./middleware/xssPrevention');

// Apply to Express app
app.use(xssPrevention.prevent());

// Content type validation
app.use(xssPrevention.contentTypeValidation(['application/json']));

// Rate limiting
app.use('/api/', xssPrevention.rateLimiting({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// File upload protection
app.use(xssPrevention.fileUploadProtection());

// Secure JSON responses
app.use(xssPrevention.sanitizeJsonResponse());
```

### 4. Security Scanner (`src/scripts/injection-scanner.js`)

Automated tool for scanning codebase for vulnerabilities.

#### Usage:

```bash
# Scan entire project
npm run injection:scan

# Scan specific directory
npm run injection:scan:src

# Custom directory
node src/scripts/injection-scanner.js /path/to/scan
```

#### Output:
- Detailed vulnerability report
- Severity classification (CRITICAL, HIGH, MEDIUM, LOW)
- Remediation recommendations
- JSON report saved to `security-scan-report.json`

## Implementation Best Practices

### 1. Always Sanitize User Input

```javascript
// Bad
const username = req.body.username;
const query = `SELECT * FROM users WHERE username = '${username}'`;

// Good
const sanitized = inputSanitizer.sanitizeForSQL(req.body.username);
const result = await queryBuilder
  .select('users')
  .where('username', '=', sanitized)
  .execute(db);
```

### 2. Use Parameterized Queries

```javascript
// Bad
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// Good
const query = queryBuilder
  .select('users')
  .where('id', '=', userId)
  .build();
await db.query(query);
```

### 3. Context-Aware Output Encoding

```javascript
// HTML context
res.send(`<div>${inputSanitizer.sanitizeForHTML(userContent, 'html')}</div>`);

// JavaScript context
res.send(`<script>var data = '${inputSanitizer.sanitizeForHTML(userData, 'javascript')}';</script>`);

// Attribute context
res.send(`<input value="${inputSanitizer.sanitizeForHTML(userValue, 'attribute')}">`);
```

### 4. Implement CSP with Nonces

```javascript
app.get('/page', (req, res) => {
  const nonce = res.locals.nonce;
  res.send(`
    <script nonce="${nonce}">
      // This script is allowed
    </script>
  `);
});
```

## Testing

### Running Security Tests

```bash
# Run SQL injection tests
npm test __tests__/security/sql-injection-advanced.test.js

# Run XSS tests
npm test __tests__/security/xss-advanced.test.js

# Run all security tests
npm run test:security

# With coverage
npm run test:security:coverage
```

### Test Coverage

The test suites cover:
- Basic SQL injection patterns
- Advanced injection techniques (blind, time-based, union-based)
- Stored and reflected XSS
- DOM-based XSS
- File upload vulnerabilities
- Template injection
- Second-order SQL injection

## Common Vulnerabilities and Fixes

### SQL Injection

**Vulnerable:**
```javascript
app.get('/user/:id', (req, res) => {
  db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
});
```

**Secure:**
```javascript
app.get('/user/:id', (req, res) => {
  const userId = inputSanitizer.sanitizeInteger(req.params.id);
  const query = queryBuilder
    .select('users')
    .where('id', '=', userId)
    .build();
  db.query(query);
});
```

### XSS

**Vulnerable:**
```javascript
app.post('/comment', (req, res) => {
  const html = `<div>${req.body.comment}</div>`;
  res.send(html);
});
```

**Secure:**
```javascript
app.post('/comment', (req, res) => {
  const safeComment = inputSanitizer.sanitizeForHTML(req.body.comment, 'html');
  const html = `<div>${safeComment}</div>`;
  res.send(html);
});
```

## Monitoring and Alerts

1. **Query Monitoring**: The secure query builder logs all queries for anomaly detection
2. **Attack Detection**: Input sanitizer logs potential attack attempts
3. **Security Headers**: Monitor CSP violations through report-uri
4. **Rate Limiting**: Track and alert on rate limit violations

## Deployment Checklist

- [ ] Install required dependencies: `npm install`
- [ ] Run security scanner: `npm run injection:scan`
- [ ] Enable all security middleware in production
- [ ] Configure CSP report-uri for monitoring
- [ ] Set up log monitoring for security events
- [ ] Review and fix all CRITICAL and HIGH severity issues
- [ ] Enable rate limiting on all API endpoints
- [ ] Validate file upload restrictions
- [ ] Test with OWASP ZAP or similar tools
- [ ] Document any security exceptions

## Additional Resources

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)