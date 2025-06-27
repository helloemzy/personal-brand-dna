class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

const asyncHandler = (fn) => {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error('Async handler error:', error);
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          ...(error.code && { code: error.code })
        });
      }

      // Handle specific database errors
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE'
        });
      }

      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'Referenced resource does not exist',
          code: 'INVALID_REFERENCE'
        });
      }

      // Generic error
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  };
};

module.exports = {
  AppError,
  asyncHandler,
  validateRequest,
};