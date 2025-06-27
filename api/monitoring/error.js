const { Sentry, trackApiUsage } = require('../_lib/monitoring');
const { logger, BusinessMetrics } = require('../../datadog.config');

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, context } = req.body;
    
    // Track API usage
    trackApiUsage('/api/monitoring/error', req);

    // Enhanced error context
    const errorContext = {
      ...data,
      ...context,
      timestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      environment: process.env.NODE_ENV,
      deployment: process.env.VERCEL_ENV,
    };

    // Log to console for development
    console.error('[Monitoring] Error received:', errorContext);

    // Send to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setLevel(data?.level || 'error');
        scope.setTag('error.source', context?.source || 'client');
        scope.setContext('error_details', errorContext);
        
        if (context?.userId) {
          scope.setUser({ id: context.userId });
        }
        
        const error = new Error(data?.message || 'Client error');
        error.name = data?.name || 'ClientError';
        
        Sentry.captureException(error);
      });
    }

    // Log to DataDog
    if (process.env.DD_API_KEY) {
      logger.error('Client error reported', errorContext);
      
      // Track business metrics
      BusinessMetrics.trackUserAction(
        'client_error',
        context?.userId || 'anonymous',
        {
          error_type: data?.name || 'unknown',
          error_source: context?.source || 'unknown',
          url: context?.url || 'unknown',
        }
      );
    }

    // Return success with tracking ID
    return res.status(200).json({ 
      success: true,
      message: 'Error logged successfully',
      errorId: Sentry.lastEventId?.() || `error_${Date.now()}`,
    });

  } catch (error) {
    console.error('[Monitoring] Failed to log error:', error);
    
    // Log the meta-error
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { 'error.type': 'monitoring_failure' },
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to log error'
    });
  }
}