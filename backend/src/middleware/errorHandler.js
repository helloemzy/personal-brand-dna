const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database error handler
const handleDatabaseError = (error) => {
  if (error.code === '23505') { // Unique violation
    const field = error.detail?.match(/Key \((.*?)\)=/)?.[1] || 'field';
    return new AppError(`${field} already exists`, 409);
  }
  
  if (error.code === '23503') { // Foreign key violation
    return new AppError('Referenced resource not found', 404);
  }
  
  if (error.code === '23502') { // Not null violation
    const field = error.column || 'field';
    return new AppError(`${field} is required`, 400);
  }
  
  if (error.code === '22P02') { // Invalid input syntax
    return new AppError('Invalid input format', 400);
  }
  
  if (error.code === '28P01') { // Invalid password
    return new AppError('Database authentication failed', 500);
  }

  return new AppError('Database error occurred', 500);
};

// JWT error handler
const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401);
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401);
  }
  
  if (error.name === 'NotBeforeError') {
    return new AppError('Token not active', 401);
  }

  return new AppError('Authentication error', 401);
};

// Validation error handler
const handleValidationError = (error) => {
  if (error.details) {
    const message = error.details.map(detail => detail.message).join(', ');
    return new AppError(`Validation error: ${message}`, 400);
  }
  
  return new AppError('Validation failed', 400);
};

// Multer error handler
const handleMulterError = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 400);
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400);
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400);
  }

  return new AppError('File upload error', 400);
};

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      timestamp: new Date().toISOString()
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString()
    });
  }
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error details
  logger.error(`Error ${err.statusCode}: ${err.message}`, {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
  });

  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err.code && err.code.startsWith('23')) error = handleDatabaseError(err);
  if (err.name && err.name.includes('JWT')) error = handleJWTError(err);
  if (err.isJoi) error = handleValidationError(err);
  if (err.code && err.code.startsWith('LIMIT_')) error = handleMulterError(err);

  // Rate limiting error
  if (err.name === 'RateLimiterError') {
    error = new AppError('Too many requests, please try again later', 429);
  }

  // OpenAI API errors
  if (err.response?.data?.error) {
    const openAIError = err.response.data.error;
    if (openAIError.code === 'rate_limit_exceeded') {
      error = new AppError('AI service temporarily unavailable', 503);
    } else if (openAIError.code === 'invalid_api_key') {
      error = new AppError('AI service configuration error', 500);
    } else {
      error = new AppError('AI service error', 503);
    }
  }

  // Google Cloud Speech errors
  if (err.code === 3) { // INVALID_ARGUMENT
    error = new AppError('Invalid audio format', 400);
  } else if (err.code === 8) { // RESOURCE_EXHAUSTED
    error = new AppError('Speech service quota exceeded', 503);
  }

  // Send appropriate error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// 404 handler for unknown routes
const notFound = (req, res, next) => {
  const err = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(err);
};

// Async error handler helper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler
};