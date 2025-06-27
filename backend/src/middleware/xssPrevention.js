/**
 * XSS Prevention Middleware
 * Implements comprehensive XSS protection including CSP, input sanitization, and security headers
 */

const helmet = require('helmet');
const crypto = require('crypto');
const inputSanitizer = require('../services/inputSanitizationService');

class XSSPreventionMiddleware {
  constructor() {
    this.trustedTypes = this.initializeTrustedTypes();
  }

  /**
   * Initialize Trusted Types policy names
   */
  initializeTrustedTypes() {
    return {
      html: 'pbdna-html',
      script: 'pbdna-script',
      scriptURL: 'pbdna-script-url'
    };
  }

  /**
   * Generate nonce for CSP
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Main XSS prevention middleware
   */
  prevent() {
    return (req, res, next) => {
      // Generate nonce for this request
      res.locals.nonce = this.generateNonce();

      // Apply security headers
      this.applySecurityHeaders(req, res);

      // Sanitize all incoming data
      this.sanitizeRequest(req);

      // Override res.json to ensure output encoding
      this.overrideJsonResponse(res);

      // Override res.render for template safety
      this.overrideRenderResponse(res);

      next();
    };
  }

  /**
   * Apply comprehensive security headers
   */
  applySecurityHeaders(req, res) {
    // Content Security Policy with nonce
    const cspDirectives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", `'nonce-${res.locals.nonce}'`, "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles but restrict scripts
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
      blockAllMixedContent: [],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      requireTrustedTypesFor: ["'script'"],
      trustedTypes: [
        this.trustedTypes.html,
        this.trustedTypes.script,
        this.trustedTypes.scriptURL,
        "'allow-duplicates'"
      ]
    };

    // Build CSP header
    const csp = Object.entries(cspDirectives)
      .map(([key, values]) => {
        const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${directive} ${values.join(' ')}`;
      })
      .join('; ');

    res.setHeader('Content-Security-Policy', csp);

    // Additional security headers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Prevent browser from MIME-sniffing
    res.setHeader('X-Download-Options', 'noopen');
    
    // Strict Transport Security (if HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  }

  /**
   * Sanitize all request data
   */
  sanitizeRequest(req) {
    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize params
    if (req.params) {
      req.params = this.sanitizeObject(req.params);
    }

    // Sanitize headers (be careful not to break functionality)
    const dangerousHeaders = ['referer', 'user-agent'];
    dangerousHeaders.forEach(header => {
      if (req.headers[header]) {
        req.headers[header] = inputSanitizer.sanitizeForHTML(req.headers[header], 'text');
      }
    });
  }

  /**
   * Recursively sanitize object
   */
  sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // Don't sanitize certain fields that might need special characters
      const skipFields = ['password', 'token', 'hash', 'signature'];
      return inputSanitizer.sanitizeForHTML(obj, 'text');
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key as well
        const sanitizedKey = inputSanitizer.sanitizeForHTML(key, 'text');
        
        // Skip certain fields from sanitization
        if (['password', 'token', 'hash', 'signature', 'jwt'].includes(key.toLowerCase())) {
          sanitized[sanitizedKey] = value;
        } else {
          sanitized[sanitizedKey] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Override res.json to ensure proper encoding
   */
  overrideJsonResponse(res) {
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Ensure content type is set correctly
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      // Add X-Content-Type-Options header
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // For JSON responses, we don't need to HTML escape
      // But we should ensure it's valid JSON
      try {
        const jsonString = JSON.stringify(data);
        return originalJson(JSON.parse(jsonString));
      } catch (error) {
        console.error('Invalid JSON response:', error);
        return originalJson({ error: 'Invalid response data' });
      }
    };
  }

  /**
   * Override res.render for template safety
   */
  overrideRenderResponse(res) {
    const originalRender = res.render.bind(res);
    
    res.render = function(view, options = {}, callback) {
      // Add nonce to template locals
      options.nonce = res.locals.nonce;
      
      // Add sanitization helpers
      options.sanitizeHTML = (input) => inputSanitizer.sanitizeForHTML(input, 'html');
      options.sanitizeAttr = (input) => inputSanitizer.sanitizeForHTML(input, 'attribute');
      options.sanitizeJS = (input) => inputSanitizer.sanitizeForHTML(input, 'javascript');
      options.sanitizeCSS = (input) => inputSanitizer.sanitizeForHTML(input, 'css');
      options.sanitizeURL = (input) => inputSanitizer.sanitizeForHTML(input, 'url');
      
      return originalRender(view, options, callback);
    };
  }

  /**
   * Middleware for file upload validation
   */
  fileUploadProtection() {
    return (req, res, next) => {
      if (!req.files) {
        return next();
      }

      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/json'
      ];

      const maxFileSize = 10 * 1024 * 1024; // 10MB

      for (const fieldName in req.files) {
        const files = Array.isArray(req.files[fieldName]) 
          ? req.files[fieldName] 
          : [req.files[fieldName]];

        for (const file of files) {
          // Validate MIME type
          if (!allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({
              error: `Invalid file type: ${file.mimetype}`
            });
          }

          // Validate file size
          if (file.size > maxFileSize) {
            return res.status(400).json({
              error: 'File size exceeds maximum allowed'
            });
          }

          // Sanitize filename
          file.name = inputSanitizer.sanitizeFilename(file.name);

          // Add additional file metadata
          file.sanitized = true;
          file.uploadTime = new Date();
        }
      }

      next();
    };
  }

  /**
   * Create middleware for specific content types
   */
  contentTypeValidation(allowedTypes = ['application/json']) {
    return (req, res, next) => {
      if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
      }

      const contentType = req.headers['content-type'];
      if (!contentType) {
        return res.status(400).json({
          error: 'Content-Type header is required'
        });
      }

      const baseContentType = contentType.split(';')[0].trim();
      if (!allowedTypes.includes(baseContentType)) {
        return res.status(415).json({
          error: `Unsupported content type: ${baseContentType}`
        });
      }

      next();
    };
  }

  /**
   * Rate limiting middleware for XSS protection
   */
  rateLimiting(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // limit each IP to 100 requests per windowMs
      message = 'Too many requests from this IP'
    } = options;

    const requests = new Map();

    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      for (const [key, timestamps] of requests.entries()) {
        requests.set(key, timestamps.filter(time => time > windowStart));
        if (requests.get(key).length === 0) {
          requests.delete(key);
        }
      }

      // Check current IP
      const timestamps = requests.get(ip) || [];
      if (timestamps.length >= max) {
        return res.status(429).json({ error: message });
      }

      timestamps.push(now);
      requests.set(ip, timestamps);

      next();
    };
  }

  /**
   * Trusted Types implementation helper
   */
  trustedTypesPolicy() {
    return `
      if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
        // HTML sanitization policy
        trustedTypes.createPolicy('${this.trustedTypes.html}', {
          createHTML: (input) => {
            const div = document.createElement('div');
            div.textContent = input;
            return div.innerHTML;
          }
        });

        // Script policy
        trustedTypes.createPolicy('${this.trustedTypes.script}', {
          createScript: (input) => {
            // Only allow specific safe scripts
            if (input.includes('console.log') && !input.includes('eval')) {
              return input;
            }
            throw new Error('Unsafe script blocked');
          }
        });

        // Script URL policy
        trustedTypes.createPolicy('${this.trustedTypes.scriptURL}', {
          createScriptURL: (input) => {
            const url = new URL(input, window.location.origin);
            if (url.origin === window.location.origin) {
              return url.href;
            }
            throw new Error('Unsafe script URL blocked');
          }
        });
      }
    `;
  }

  /**
   * Create inline script with nonce
   */
  createInlineScript(scriptContent, nonce) {
    return `<script nonce="${nonce}">${scriptContent}</script>`;
  }

  /**
   * Validate and sanitize JSON response
   */
  sanitizeJsonResponse() {
    return (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        if (typeof data === 'object') {
          try {
            // Ensure we're sending valid JSON
            const jsonString = JSON.stringify(data);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return originalSend.call(this, jsonString);
          } catch (error) {
            console.error('JSON serialization error:', error);
            return res.status(500).json({ error: 'Internal server error' });
          }
        }
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
}

// Export singleton instance with all middleware functions
const xssPrevention = new XSSPreventionMiddleware();

module.exports = {
  prevent: xssPrevention.prevent.bind(xssPrevention),
  fileUploadProtection: xssPrevention.fileUploadProtection.bind(xssPrevention),
  contentTypeValidation: xssPrevention.contentTypeValidation.bind(xssPrevention),
  rateLimiting: xssPrevention.rateLimiting.bind(xssPrevention),
  trustedTypesPolicy: xssPrevention.trustedTypesPolicy.bind(xssPrevention),
  createInlineScript: xssPrevention.createInlineScript.bind(xssPrevention),
  sanitizeJsonResponse: xssPrevention.sanitizeJsonResponse.bind(xssPrevention),
  generateNonce: xssPrevention.generateNonce.bind(xssPrevention)
};