const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports array
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Create logs directory
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels: logLevels,
  format: fileFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: fileFormat 
    })
  );

  logger.rejections.handle(
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: fileFormat 
    })
  );
}

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
  const { method, url, ip } = req;
  const { statusCode } = res;
  const userAgent = req.get('User-Agent') || '';
  
  const logData = {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip,
    userAgent,
    userId: req.user?.id || 'anonymous'
  };

  if (statusCode >= 400) {
    logger.error(`${method} ${url} ${statusCode} - ${responseTime}ms`, logData);
  } else {
    logger.http(`${method} ${url} ${statusCode} - ${responseTime}ms`, logData);
  }
};

// Add security event logging
logger.logSecurityEvent = (event, details, req = null) => {
  const logData = {
    event,
    details,
    timestamp: new Date().toISOString(),
    ip: req?.ip || 'unknown',
    userAgent: req?.get('User-Agent') || 'unknown',
    userId: req?.user?.id || 'anonymous'
  };

  logger.warn(`Security Event: ${event}`, logData);
};

// Add performance logging
logger.logPerformance = (operation, duration, metadata = {}) => {
  const logData = {
    operation,
    duration: `${duration}ms`,
    ...metadata,
    timestamp: new Date().toISOString()
  };

  if (duration > 1000) {
    logger.warn(`Slow operation: ${operation} took ${duration}ms`, logData);
  } else {
    logger.debug(`Performance: ${operation} completed in ${duration}ms`, logData);
  }
};

// Add business event logging
logger.logBusinessEvent = (event, userId, details = {}) => {
  const logData = {
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  };

  logger.info(`Business Event: ${event}`, logData);
};

module.exports = logger;