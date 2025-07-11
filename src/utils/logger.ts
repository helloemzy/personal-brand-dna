/**
 * Environment-aware logging utility
 * Only logs in development mode to prevent exposing debug info in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  log: (...args: any[]) => void;
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Create a logging function that only executes in development
 */
const createLogFunction = (level: LogLevel) => {
  return (...args: any[]) => {
    // Always suppress logs in test environment to keep test output clean
    if (isTest) return;
    
    // Only log in development
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      
      switch (level) {
        case 'debug':
          console.log(prefix, ...args);
          break;
        case 'info':
          console.info(prefix, ...args);
          break;
        case 'warn':
          console.warn(prefix, ...args);
          break;
        case 'error':
          console.error(prefix, ...args);
          break;
      }
    }
  };
};

/**
 * Logger instance with environment-aware logging methods
 */
export const logger: Logger = {
  debug: createLogFunction('debug'),
  info: createLogFunction('info'),
  warn: createLogFunction('warn'),
  error: createLogFunction('error'),
  log: createLogFunction('debug'), // Alias for debug
};

/**
 * Group logging for better organization in development
 */
export const logGroup = (label: string, fn: () => void) => {
  if (isDevelopment && !isTest) {
    console.group(label);
    fn();
    console.groupEnd();
  }
};

/**
 * Table logging for structured data
 */
export const logTable = (data: any) => {
  if (isDevelopment && !isTest) {
    console.table(data);
  }
};

/**
 * Performance logging
 */
export const logPerformance = (label: string, fn: () => void) => {
  if (isDevelopment && !isTest) {
    const start = performance.now();
    fn();
    const end = performance.now();
    logger.debug(`${label} took ${(end - start).toFixed(2)}ms`);
  } else {
    fn();
  }
};

// Export a default logger instance
export default logger;