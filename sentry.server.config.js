import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,
  environment,
  
  // Performance Monitoring
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  
  // Profile Sample Rate
  profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
  
  // Integrations
  integrations: [
    // Database query monitoring
    new Sentry.Integrations.Postgres({
      usePgNative: false,
    }),
    
    // HTTP request monitoring
    new Sentry.Integrations.Http({
      tracing: true,
      breadcrumbs: true,
    }),
  ],
  
  // Error Filtering
  beforeSend(event, hint) {
    // Filter out health check errors
    if (event.request?.url?.includes('/api/hello') || 
        event.request?.url?.includes('/api/monitoring')) {
      return null;
    }
    
    // Add additional context
    if (event.exception) {
      event.extra = {
        ...event.extra,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };
    }
    
    // Sanitize sensitive data
    if (event.request?.data) {
      event.request.data = sanitizeSensitiveData(event.request.data);
    }
    
    return event;
  },
  
  // Transaction Filtering
  beforeTransaction(transaction) {
    // Don't track static asset requests
    if (transaction.name?.includes('/_next/static/')) {
      return null;
    }
    
    // Add custom tags
    transaction.tags = {
      ...transaction.tags,
      runtime: 'vercel',
      region: process.env.VERCEL_REGION || 'unknown',
    };
    
    return transaction;
  },
});

// Sanitize sensitive data from requests
function sanitizeSensitiveData(data) {
  if (typeof data !== 'object') return data;
  
  const sensitiveKeys = [
    'password', 'token', 'secret', 'api_key', 'apiKey',
    'authorization', 'cookie', 'session', 'credit_card',
    'ssn', 'social_security', 'private_key'
  ];
  
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeSensitiveData(sanitized[key]);
    }
  }
  
  return sanitized;
}

// Custom instrumentation for API routes
export function instrumentApiRoute(handler) {
  return async (req, res) => {
    const transaction = Sentry.startTransaction({
      op: 'api',
      name: `${req.method} ${req.url}`,
    });
    
    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
    
    try {
      const result = await handler(req, res);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      Sentry.captureException(error);
      throw error;
    } finally {
      transaction.finish();
    }
  };
}

// Monitor database performance
export function monitorDatabaseQuery(queryName, queryFn) {
  return async (...args) => {
    const span = Sentry.getCurrentHub().getScope().getSpan();
    const childSpan = span?.startChild({
      op: 'db.query',
      description: queryName,
    });
    
    try {
      const result = await queryFn(...args);
      childSpan?.setStatus('ok');
      return result;
    } catch (error) {
      childSpan?.setStatus('internal_error');
      childSpan?.setTag('error', true);
      throw error;
    } finally {
      childSpan?.finish();
    }
  };
}