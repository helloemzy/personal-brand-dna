/**
 * Security Configuration
 * Centralized security settings and validation
 */

const crypto = require('crypto');

// Security configuration with validation
const securityConfig = {
  // Password policy
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH) || 128,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    specialCharsRegex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    preventCommonPasswords: true,
    preventUserInfoInPassword: true,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  },

  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256',
    issuer: 'pbdna-api',
    audience: 'pbdna-frontend'
  },

  // Session settings
  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
    absoluteTimeout: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
    renewalThreshold: 0.5, // Renew when 50% of time remaining
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5,
    bindToIP: process.env.SESSION_BIND_TO_IP === 'true',
    bindToUserAgent: process.env.SESSION_BIND_TO_USER_AGENT === 'true'
  },

  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2',
    keyDerivationIterations: 100000,
    saltLength: 32,
    ivLength: 16,
    tagLength: 16
  },

  // CORS settings
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
    maxAge: 86400, // 24 hours
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  },

  // Rate limiting
  rateLimit: {
    general: {
      points: parseInt(process.env.RATE_LIMIT_GENERAL_POINTS) || 100,
      duration: parseInt(process.env.RATE_LIMIT_GENERAL_DURATION) || 900 // 15 minutes
    },
    auth: {
      points: parseInt(process.env.RATE_LIMIT_AUTH_POINTS) || 5,
      duration: parseInt(process.env.RATE_LIMIT_AUTH_DURATION) || 900,
      blockDuration: parseInt(process.env.RATE_LIMIT_AUTH_BLOCK) || 1800 // 30 minutes
    },
    api: {
      points: parseInt(process.env.RATE_LIMIT_API_POINTS) || 1000,
      duration: parseInt(process.env.RATE_LIMIT_API_DURATION) || 3600 // 1 hour
    }
  },

  // File upload settings
  fileUpload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'],
      documents: ['application/pdf']
    },
    dangerousExtensions: ['.exe', '.sh', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar', '.py', '.rb', '.php'],
    scanForMalware: process.env.SCAN_UPLOADS === 'true',
    storageLocation: process.env.UPLOAD_STORAGE_PATH || '/var/app/uploads'
  },

  // Security headers
  headers: {
    hsts: {
      enabled: process.env.NODE_ENV === 'production',
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    csp: {
      enabled: process.env.CSP_ENABLED !== 'false',
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.google-analytics.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'https://api.linkedin.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    }
  },

  // OAuth settings
  oauth: {
    stateExpiry: 10 * 60 * 1000, // 10 minutes
    codeExpiry: 5 * 60 * 1000, // 5 minutes
    allowedRedirectHosts: (process.env.OAUTH_REDIRECT_HOSTS || 'localhost,app.personalbranddna.com').split(',')
  },

  // Audit logging
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 90,
    sensitiveActions: [
      'login', 'logout', 'password_change', 'password_reset',
      'account_deletion', 'subscription_change', 'oauth_connect',
      'admin_action', 'data_export', 'data_deletion'
    ]
  }
};

/**
 * Validate security configuration
 */
function validateSecurityConfig() {
  const errors = [];

  // JWT Secret validation
  if (!securityConfig.jwt.secret || securityConfig.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  // Check if using default/weak secrets
  const weakSecrets = ['secret', 'password', '12345678', 'changeme', 'default'];
  if (weakSecrets.some(weak => securityConfig.jwt.secret?.toLowerCase().includes(weak))) {
    errors.push('JWT_SECRET appears to be weak or default');
  }

  // Password policy validation
  if (securityConfig.password.minLength < 8) {
    errors.push('Password minimum length should be at least 8 characters');
  }

  if (securityConfig.password.bcryptRounds < 10) {
    errors.push('Bcrypt rounds should be at least 10 for security');
  }

  // CORS validation
  if (securityConfig.cors.origins.includes('*')) {
    errors.push('CORS should not allow all origins (*)');
  }

  // File upload validation
  if (securityConfig.fileUpload.maxSize > 100 * 1024 * 1024) {
    errors.push('File upload size limit seems too large (>100MB)');
  }

  // Environment-specific checks
  if (process.env.NODE_ENV === 'production') {
    if (!securityConfig.headers.hsts.enabled) {
      errors.push('HSTS should be enabled in production');
    }

    if (securityConfig.cors.origins.includes('http://localhost:3000')) {
      errors.push('localhost should not be in CORS origins in production');
    }

    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
      errors.push('JWT_REFRESH_SECRET should be different from JWT_SECRET in production');
    }
  }

  return errors;
}

/**
 * Generate secure random string
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure random password
 */
function generateSecurePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  
  // Ensure at least one character from each required set
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

/**
 * Validate password against policy
 */
function validatePassword(password, userInfo = {}) {
  const errors = [];
  const policy = securityConfig.password;

  // Length checks
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must not exceed ${policy.maxLength} characters`);
  }

  // Character requirements
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !policy.specialCharsRegex.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common password check
  if (policy.preventCommonPasswords) {
    const commonPasswords = [
      'password', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];

    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      errors.push('Password is too common or easily guessable');
    }
  }

  // User info check
  if (policy.preventUserInfoInPassword && userInfo) {
    const userFields = [
      userInfo.email?.split('@')[0],
      userInfo.firstName,
      userInfo.lastName,
      userInfo.username
    ].filter(Boolean).map(field => field.toLowerCase());

    for (const field of userFields) {
      if (field && password.toLowerCase().includes(field)) {
        errors.push('Password should not contain personal information');
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Encrypt sensitive data
 */
function encryptData(data, key = null) {
  const encKey = key || process.env.ENCRYPTION_KEY;
  if (!encKey) {
    throw new Error('Encryption key not configured');
  }

  const salt = crypto.randomBytes(securityConfig.encryption.saltLength);
  const derivedKey = crypto.pbkdf2Sync(
    encKey,
    salt,
    securityConfig.encryption.keyDerivationIterations,
    32,
    'sha256'
  );

  const iv = crypto.randomBytes(securityConfig.encryption.ivLength);
  const cipher = crypto.createCipheriv(
    securityConfig.encryption.algorithm,
    derivedKey,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

/**
 * Decrypt sensitive data
 */
function decryptData(encryptedData, key = null) {
  const encKey = key || process.env.ENCRYPTION_KEY;
  if (!encKey) {
    throw new Error('Encryption key not configured');
  }

  const salt = Buffer.from(encryptedData.salt, 'base64');
  const derivedKey = crypto.pbkdf2Sync(
    encKey,
    salt,
    securityConfig.encryption.keyDerivationIterations,
    32,
    'sha256'
  );

  const decipher = crypto.createDecipheriv(
    securityConfig.encryption.algorithm,
    derivedKey,
    Buffer.from(encryptedData.iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData.encrypted, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Sanitize user input
 */
function sanitizeInput(input, type = 'text') {
  if (typeof input !== 'string') return input;

  switch (type) {
    case 'html':
      // Remove all HTML tags
      return input.replace(/<[^>]*>/g, '');
    
    case 'sql':
      // Escape SQL special characters
      return input.replace(/['";\\]/g, '');
    
    case 'filename':
      // Sanitize filename
      return input
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255);
    
    case 'email':
      // Basic email sanitization
      return input.toLowerCase().trim();
    
    case 'url':
      // Basic URL sanitization
      try {
        const url = new URL(input);
        return url.toString();
      } catch {
        return '';
      }
    
    default:
      // General text sanitization
      return input
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, 1000);
  }
}

// Run validation on startup
const configErrors = validateSecurityConfig();
if (configErrors.length > 0) {
  console.error('Security configuration errors:');
  configErrors.forEach(error => console.error(`  - ${error}`));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = {
  securityConfig,
  validateSecurityConfig,
  generateSecureToken,
  generateSecurePassword,
  validatePassword,
  encryptData,
  decryptData,
  sanitizeInput
};