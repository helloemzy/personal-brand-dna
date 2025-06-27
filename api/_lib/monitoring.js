const Sentry = require('@sentry/node');

// Performance monitoring wrapper
const monitorPerformance = (operationName, operationType = 'function') => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const transaction = Sentry.getCurrentHub().getScope().getTransaction();
      const span = transaction?.startChild({
        op: operationType,
        description: `${operationName}.${propertyKey}`,
      });
      
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        
        span?.setStatus('ok');
        span?.setData('duration_ms', Date.now() - startTime);
        
        // Log slow operations
        const duration = Date.now() - startTime;
        if (duration > 1000) {
          Sentry.captureMessage(`Slow operation: ${operationName}.${propertyKey} took ${duration}ms`, 'warning');
        }
        
        return result;
      } catch (error) {
        span?.setStatus('internal_error');
        span?.setData('error', error.message);
        throw error;
      } finally {
        span?.finish();
      }
    };
    
    return descriptor;
  };
};

// Custom error tracking
class MonitoredError extends Error {
  constructor(message, code, statusCode = 500, context = {}) {
    super(message);
    this.name = 'MonitoredError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    
    // Capture to Sentry with context
    Sentry.withScope((scope) => {
      scope.setTag('error.code', code);
      scope.setTag('error.statusCode', statusCode);
      scope.setContext('error_details', context);
      Sentry.captureException(this);
    });
  }
}

// API endpoint monitoring middleware
const monitorApiEndpoint = (endpointName) => {
  return async (req, res, next) => {
    const transaction = Sentry.startTransaction({
      op: 'http.server',
      name: `${req.method} ${endpointName}`,
    });
    
    Sentry.getCurrentHub().configureScope(scope => {
      scope.setSpan(transaction);
      scope.setTag('endpoint', endpointName);
      scope.setTag('method', req.method);
      scope.setContext('request', {
        url: req.url,
        query: req.query,
        headers: sanitizeHeaders(req.headers),
        ip: req.ip || req.connection.remoteAddress,
      });
    });
    
    // Track API usage metrics
    trackApiUsage(endpointName, req);
    
    // Intercept response to capture status
    const originalSend = res.send;
    res.send = function(data) {
      transaction.setHttpStatus(res.statusCode);
      
      if (res.statusCode >= 400) {
        transaction.setTag('error', true);
        Sentry.captureMessage(
          `API Error: ${endpointName} returned ${res.statusCode}`,
          res.statusCode >= 500 ? 'error' : 'warning'
        );
      }
      
      transaction.finish();
      return originalSend.call(this, data);
    };
    
    if (next) {
      next();
    }
  };
};

// Track API usage for analytics
const trackApiUsage = (endpoint, req) => {
  const userId = req.user?.id || 'anonymous';
  const userAgent = req.headers['user-agent'];
  
  Sentry.addBreadcrumb({
    category: 'api.usage',
    message: `API called: ${endpoint}`,
    level: 'info',
    data: {
      endpoint,
      method: req.method,
      userId,
      userAgent,
      timestamp: new Date().toISOString(),
    },
  });
};

// Database query monitoring
const monitorQuery = async (queryName, queryFn, params = {}) => {
  const span = Sentry.getCurrentHub().getScope().getSpan()?.startChild({
    op: 'db.query',
    description: queryName,
  });
  
  span?.setData('db.params', sanitizeQueryParams(params));
  
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    
    const duration = Date.now() - startTime;
    span?.setData('duration_ms', duration);
    span?.setStatus('ok');
    
    // Alert on slow queries
    if (duration > 500) {
      Sentry.captureMessage(
        `Slow query: ${queryName} took ${duration}ms`,
        'warning'
      );
    }
    
    return result;
  } catch (error) {
    span?.setStatus('internal_error');
    span?.setData('error', error.message);
    
    Sentry.withScope((scope) => {
      scope.setTag('query.name', queryName);
      scope.setContext('query_error', {
        query: queryName,
        params: sanitizeQueryParams(params),
        error: error.message,
      });
      Sentry.captureException(error);
    });
    
    throw error;
  } finally {
    span?.finish();
  }
};

// External API call monitoring
const monitorExternalApi = async (serviceName, apiCall) => {
  const span = Sentry.getCurrentHub().getScope().getSpan()?.startChild({
    op: 'http.client',
    description: `External API: ${serviceName}`,
  });
  
  const startTime = Date.now();
  
  try {
    const result = await apiCall();
    
    span?.setData('duration_ms', Date.now() - startTime);
    span?.setStatus('ok');
    
    return result;
  } catch (error) {
    span?.setStatus('internal_error');
    span?.setData('error', error.message);
    
    Sentry.withScope((scope) => {
      scope.setTag('external_api', serviceName);
      scope.setContext('api_error', {
        service: serviceName,
        error: error.message,
        statusCode: error.response?.status,
      });
      Sentry.captureException(error);
    });
    
    throw error;
  } finally {
    span?.finish();
  }
};

// Sanitize headers to remove sensitive data
const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Sanitize query parameters
const sanitizeQueryParams = (params) => {
  if (!params || typeof params !== 'object') return params;
  
  const sanitized = { ...params };
  const sensitiveParams = ['password', 'token', 'api_key', 'secret'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveParams.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Health check for monitoring
const createHealthCheck = () => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
};

module.exports = {
  monitorPerformance,
  MonitoredError,
  monitorApiEndpoint,
  monitorQuery,
  monitorExternalApi,
  trackApiUsage,
  createHealthCheck,
  Sentry,
};