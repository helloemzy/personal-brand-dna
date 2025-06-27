/**
 * Input Sanitization Service
 * Provides comprehensive sanitization for SQL injection and XSS prevention
 */

const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');
const sqlstring = require('sqlstring');

class InputSanitizationService {
  constructor() {
    // Configure DOMPurify for strict XSS prevention
    this.configureDOMPurify();
    
    // SQL injection patterns to detect
    this.sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick|onmouseover)\b)/gi,
      /(--|\/\*|\*\/|xp_|sp_|0x|\\x[0-9a-f]{2})/gi,
      /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/gi,
      /(\'\s*or\s*\'|\"\s*or\s*\")/gi,
      /(;|--|\*|\/\*|\*\/|@@|@|char|nchar|varchar|nvarchar|alter|begin|cast|create|cursor|declare|delete|drop|end|exec|execute|fetch|insert|kill|select|sys|sysobjects|syscolumns|table|update)/gi
    ];

    // XSS patterns to detect
    this.xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script[^>]*>/gi,
      /<iframe[^>]*>[\s\S]*?<\/iframe[^>]*>/gi,
      /<object[^>]*>[\s\S]*?<\/object[^>]*>/gi,
      /<embed[^>]*>[\s\S]*?<\/embed[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi
    ];
  }

  configureDOMPurify() {
    // Strict configuration for DOMPurify
    this.purifyConfig = {
      ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                     'blockquote', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 
                     'strike', 'code', 'hr', 'pre', 'sup', 'sub', 'u'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'onmouseover'],
      KEEP_CONTENT: true,
      SAFE_FOR_TEMPLATES: true,
      SANITIZE_DOM: true,
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      FORCE_BODY: true,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    };
  }

  /**
   * Sanitize input for SQL queries
   * @param {string} input - User input to sanitize
   * @param {string} context - Context of the input (string, number, identifier, like)
   * @returns {string} Sanitized input safe for SQL
   */
  sanitizeForSQL(input, context = 'string') {
    if (input === null || input === undefined) {
      return null;
    }

    // Convert to string
    input = String(input);

    // Check for SQL injection patterns
    if (this.detectSQLInjection(input)) {
      throw new Error('Potential SQL injection detected');
    }

    switch (context) {
      case 'number':
        // Ensure it's a valid number
        const num = parseFloat(input);
        if (isNaN(num)) {
          throw new Error('Invalid number input');
        }
        return num;

      case 'identifier':
        // For table/column names - very strict
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input)) {
          throw new Error('Invalid identifier');
        }
        return sqlstring.escapeId(input);

      case 'like':
        // For LIKE queries - escape wildcards
        return sqlstring.escape(input)
          .replace(/\\/g, '\\\\')
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_');

      case 'boolean':
        // Strict boolean conversion
        return input === 'true' || input === '1' || input === true;

      case 'string':
      default:
        // Use sqlstring for proper escaping
        return sqlstring.escape(input);
    }
  }

  /**
   * Sanitize input for HTML output (XSS prevention)
   * @param {string} input - User input to sanitize
   * @param {string} context - Context where the output will be used
   * @returns {string} Sanitized HTML-safe string
   */
  sanitizeForHTML(input, context = 'html') {
    if (!input) return '';

    // Convert to string
    input = String(input);

    // Check for XSS patterns
    if (this.detectXSS(input)) {
      console.warn('Potential XSS detected and sanitized');
    }

    switch (context) {
      case 'html':
        // Full HTML sanitization with DOMPurify
        return DOMPurify.sanitize(input, this.purifyConfig);

      case 'attribute':
        // For HTML attributes
        return validator.escape(input)
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

      case 'javascript':
        // For JavaScript context
        return input
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\//g, '\\/');

      case 'css':
        // For CSS context
        return input
          .replace(/[^a-zA-Z0-9\s\-_#.]/g, '')
          .substring(0, 100); // Limit length

      case 'url':
        // For URL context
        try {
          const url = new URL(input);
          if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
            throw new Error('Invalid protocol');
          }
          return url.href;
        } catch {
          return '';
        }

      case 'text':
        // Plain text - just escape
        return validator.escape(input);

      default:
        // Default to strict escaping
        return validator.escape(input);
    }
  }

  /**
   * Detect potential SQL injection
   * @param {string} input - Input to check
   * @returns {boolean} True if potential SQL injection detected
   */
  detectSQLInjection(input) {
    if (!input || typeof input !== 'string') return false;

    // Check against known SQL injection patterns
    for (const pattern of this.sqlPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    // Check for suspicious character combinations
    const suspiciousChars = ['--', '/*', '*/', 'xp_', 'sp_', '@@'];
    for (const chars of suspiciousChars) {
      if (input.includes(chars)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect potential XSS
   * @param {string} input - Input to check
   * @returns {boolean} True if potential XSS detected
   */
  detectXSS(input) {
    if (!input || typeof input !== 'string') return false;

    // Check against known XSS patterns
    for (const pattern of this.xssPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate and sanitize email
   * @param {string} email - Email to validate
   * @returns {string} Sanitized email
   */
  sanitizeEmail(email) {
    if (!email) return '';
    
    email = String(email).toLowerCase().trim();
    
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email address');
    }
    
    return validator.normalizeEmail(email);
  }

  /**
   * Validate and sanitize URL
   * @param {string} url - URL to validate
   * @returns {string} Sanitized URL
   */
  sanitizeURL(url) {
    if (!url) return '';
    
    url = String(url).trim();
    
    if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
      throw new Error('Invalid URL');
    }
    
    return url;
  }

  /**
   * Sanitize JSON input
   * @param {string} jsonString - JSON string to sanitize
   * @returns {object} Parsed and sanitized JSON
   */
  sanitizeJSON(jsonString) {
    try {
      // Parse JSON first
      const parsed = JSON.parse(jsonString);
      
      // Recursively sanitize all string values
      const sanitize = (obj) => {
        if (typeof obj === 'string') {
          return this.sanitizeForHTML(obj, 'text');
        } else if (Array.isArray(obj)) {
          return obj.map(sanitize);
        } else if (obj !== null && typeof obj === 'object') {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            // Sanitize keys too
            const sanitizedKey = this.sanitizeForHTML(key, 'text');
            sanitized[sanitizedKey] = sanitize(value);
          }
          return sanitized;
        }
        return obj;
      };
      
      return sanitize(parsed);
    } catch (error) {
      throw new Error('Invalid JSON input');
    }
  }

  /**
   * Create Content Security Policy
   * @returns {object} CSP configuration
   */
  getContentSecurityPolicy() {
    return {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'strict-dynamic'", "'nonce-'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
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
        workerSrc: ["'self'"]
      }
    };
  }

  /**
   * Sanitize file upload names
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    if (!filename) return 'unnamed';
    
    // Remove path traversal attempts
    filename = filename.replace(/\.\./g, '');
    
    // Keep only safe characters
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Limit length
    if (filename.length > 255) {
      const ext = filename.split('.').pop();
      filename = filename.substring(0, 250 - ext.length) + '.' + ext;
    }
    
    return filename;
  }

  /**
   * Validate and sanitize integer
   * @param {any} value - Value to validate
   * @param {object} options - Min/max constraints
   * @returns {number} Validated integer
   */
  sanitizeInteger(value, options = {}) {
    const num = parseInt(value, 10);
    
    if (isNaN(num)) {
      throw new Error('Invalid integer');
    }
    
    if (options.min !== undefined && num < options.min) {
      throw new Error(`Value must be at least ${options.min}`);
    }
    
    if (options.max !== undefined && num > options.max) {
      throw new Error(`Value must be at most ${options.max}`);
    }
    
    return num;
  }

  /**
   * Batch sanitize an object's properties
   * @param {object} data - Object to sanitize
   * @param {object} schema - Sanitization schema
   * @returns {object} Sanitized object
   */
  sanitizeObject(data, schema) {
    const sanitized = {};
    
    for (const [key, rules] of Object.entries(schema)) {
      if (!(key in data)) {
        if (rules.required) {
          throw new Error(`Missing required field: ${key}`);
        }
        continue;
      }
      
      const value = data[key];
      
      switch (rules.type) {
        case 'string':
          sanitized[key] = this.sanitizeForHTML(value, rules.context || 'text');
          break;
        case 'sql':
          sanitized[key] = this.sanitizeForSQL(value, rules.context || 'string');
          break;
        case 'email':
          sanitized[key] = this.sanitizeEmail(value);
          break;
        case 'url':
          sanitized[key] = this.sanitizeURL(value);
          break;
        case 'integer':
          sanitized[key] = this.sanitizeInteger(value, rules.options || {});
          break;
        case 'boolean':
          sanitized[key] = Boolean(value);
          break;
        case 'filename':
          sanitized[key] = this.sanitizeFilename(value);
          break;
        default:
          sanitized[key] = value;
      }
      
      // Apply additional validation if provided
      if (rules.validate && !rules.validate(sanitized[key])) {
        throw new Error(`Invalid value for field: ${key}`);
      }
    }
    
    return sanitized;
  }
}

// Export singleton instance
module.exports = new InputSanitizationService();