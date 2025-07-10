/**
 * Standardized Error Handling System
 * Provides consistent error responses across all API endpoints
 */

// Standard error codes with consistent messaging
const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: { code: 'UNAUTHORIZED', defaultMessage: 'Authentication required' },
  FORBIDDEN: { code: 'FORBIDDEN', defaultMessage: 'Access denied' },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', defaultMessage: 'Session expired' },
  
  // Validation & Input
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', defaultMessage: 'Invalid input data' },
  MISSING_FIELDS: { code: 'MISSING_FIELDS', defaultMessage: 'Required fields missing' },
  INVALID_FORMAT: { code: 'INVALID_FORMAT', defaultMessage: 'Invalid data format' },
  
  // Resources
  NOT_FOUND: { code: 'NOT_FOUND', defaultMessage: 'Resource not found' },
  ALREADY_EXISTS: { code: 'ALREADY_EXISTS', defaultMessage: 'Resource already exists' },
  INVALID_REFERENCE: { code: 'INVALID_REFERENCE', defaultMessage: 'Referenced resource does not exist' },
  
  // Rate Limiting & Quotas
  RATE_LIMITED: { code: 'RATE_LIMITED', defaultMessage: 'Too many requests' },
  QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', defaultMessage: 'Usage quota exceeded' },
  
  // External Services
  EXTERNAL_SERVICE_ERROR: { code: 'EXTERNAL_SERVICE_ERROR', defaultMessage: 'External service unavailable' },
  AI_SERVICE_ERROR: { code: 'AI_SERVICE_ERROR', defaultMessage: 'AI service temporarily unavailable' },
  
  // Generic
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', defaultMessage: 'Internal server error' },
  METHOD_NOT_ALLOWED: { code: 'METHOD_NOT_ALLOWED', defaultMessage: 'HTTP method not allowed' },
  CONFLICT: { code: 'CONFLICT', defaultMessage: 'Resource conflict' }
};

// Enhanced AppError class with better error context
class StandardizedError extends Error {
  constructor(errorCode, customMessage = null, details = null, statusCode = null) {
    const errorConfig = ERROR_CODES[errorCode];
    if (!errorConfig) {
      throw new Error(`Unknown error code: ${errorCode}`);
    }

    const message = customMessage || errorConfig.defaultMessage;
    super(message);

    this.name = 'StandardizedError';
    this.code = errorConfig.code;
    this.message = message;
    this.details = details;
    this.statusCode = statusCode || this.getDefaultStatusCode(errorCode);
    this.timestamp = new Date().toISOString();
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  getDefaultStatusCode(errorCode) {
    const statusMap = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      TOKEN_EXPIRED: 401,
      VALIDATION_ERROR: 400,
      MISSING_FIELDS: 400,
      INVALID_FORMAT: 400,
      NOT_FOUND: 404,
      ALREADY_EXISTS: 409,
      INVALID_REFERENCE: 400,
      RATE_LIMITED: 429,
      QUOTA_EXCEEDED: 429,
      EXTERNAL_SERVICE_ERROR: 503,
      AI_SERVICE_ERROR: 503,
      INTERNAL_ERROR: 500,
      METHOD_NOT_ALLOWED: 405,
      CONFLICT: 409
    };
    return statusMap[errorCode] || 500;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details })
      }
    };
  }
}

// Standardized success response formatter
const createSuccessResponse = (data = null, message = null, meta = null) => {
  const response = {
    success: true,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};

// Enhanced async handler with request tracing
const standardizedAsyncHandler = (fn) => {
  return async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request context for debugging
    req.context = {
      requestId,
      startTime,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    };

    try {
      await fn(req, res);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('API Error:', {
        requestId,
        method: req.method,
        url: req.url,
        duration,
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });

      // Handle standardized errors
      if (error instanceof StandardizedError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      // Handle database-specific errors
      if (error.code === '23505') {
        const standardizedError = new StandardizedError('ALREADY_EXISTS');
        return res.status(standardizedError.statusCode).json(standardizedError.toJSON());
      }

      if (error.code === '23503') {
        const standardizedError = new StandardizedError('INVALID_REFERENCE');
        return res.status(standardizedError.statusCode).json(standardizedError.toJSON());
      }

      // Handle network/external service errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        const standardizedError = new StandardizedError('EXTERNAL_SERVICE_ERROR');
        return res.status(standardizedError.statusCode).json(standardizedError.toJSON());
      }

      // Generic error fallback
      const genericError = new StandardizedError('INTERNAL_ERROR');
      return res.status(genericError.statusCode).json(genericError.toJSON());
    }
  };
};

// Request validation middleware with standardized errors
const validateRequestBody = (requiredFields = [], optionalFields = []) => {
  return (req, res, next) => {
    const body = req.body || {};
    const missingFields = requiredFields.filter(field => !(field in body) || body[field] === null || body[field] === undefined);
    
    if (missingFields.length > 0) {
      const error = new StandardizedError(
        'MISSING_FIELDS',
        `Missing required fields: ${missingFields.join(', ')}`,
        { missingFields, requiredFields }
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    // Validate field types if specified
    const typeValidation = {
      string: (value) => typeof value === 'string',
      number: (value) => typeof value === 'number' && !isNaN(value),
      boolean: (value) => typeof value === 'boolean',
      array: (value) => Array.isArray(value),
      object: (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
    };

    const allFields = [...requiredFields, ...optionalFields];
    for (const field of allFields) {
      if (typeof field === 'object' && field.name && field.type && field.name in body) {
        const validator = typeValidation[field.type];
        if (validator && !validator(body[field.name])) {
          const error = new StandardizedError(
            'INVALID_FORMAT',
            `Field '${field.name}' must be of type ${field.type}`,
            { field: field.name, expectedType: field.type, receivedType: typeof body[field.name] }
          );
          return res.status(error.statusCode).json(error.toJSON());
        }
      }
    }

    next();
  };
};

// Method validation middleware
const validateMethod = (allowedMethods) => {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      const error = new StandardizedError(
        'METHOD_NOT_ALLOWED',
        `Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
        { allowedMethods, receivedMethod: req.method }
      );
      return res.status(error.statusCode).json(error.toJSON());
    }
    next();
  };
};

// Rate limiting error handler
const createRateLimitError = (retryAfter = null) => {
  return new StandardizedError(
    'RATE_LIMITED',
    'Too many requests. Please try again later.',
    retryAfter ? { retryAfter } : null
  );
};

// Common error factory functions
const createError = {
  unauthorized: (message) => new StandardizedError('UNAUTHORIZED', message),
  forbidden: (message) => new StandardizedError('FORBIDDEN', message),
  notFound: (resource) => new StandardizedError('NOT_FOUND', `${resource} not found`),
  validationError: (message, details) => new StandardizedError('VALIDATION_ERROR', message, details),
  conflict: (message) => new StandardizedError('CONFLICT', message),
  rateLimited: (retryAfter) => createRateLimitError(retryAfter),
  external: (service) => new StandardizedError('EXTERNAL_SERVICE_ERROR', `${service} is temporarily unavailable`),
  aiService: (message) => new StandardizedError('AI_SERVICE_ERROR', message)
};

module.exports = {
  StandardizedError,
  standardizedAsyncHandler,
  createSuccessResponse,
  validateRequestBody,
  validateMethod,
  createError,
  ERROR_CODES
};