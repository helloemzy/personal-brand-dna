import * as Sentry from '@sentry/react';
import { CaptureConsole } from '@sentry/integrations';
import React from 'react';
import { 
  useLocation, 
  useNavigationType, 
  createRoutesFromChildren, 
  matchRoutes 
} from 'react-router-dom';

/**
 * Initialize Sentry error monitoring and performance tracking
 * This should be called as early as possible in your application
 */
export const initSentry = () => {
  // Only initialize in production or staging environments
  if (import.meta.env.VITE_APP_ENV === 'development' && !import.meta.env.VITE_SENTRY_DSN) {
    console.log('Sentry not initialized in development without DSN');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    
    // Performance Monitoring
    integrations: [
      // Capture console errors
      new CaptureConsole({
        levels: ['error', 'warn'],
      }),
      new Sentry.BrowserTracing({
        // Set sampling to capture 100% of transactions for performance monitoring in production
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
        // Capture interactions like clicks
        tracingOrigins: [
          'localhost',
          /^https:\/\/brandpillar-ai\.vercel\.app/,
          /^https:\/\/api\.brandpillar\.ai/,
        ],
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
        sessionSampleRate: 0.1,
        errorSampleRate: 1.0,
      }),
    ],
    
    // Performance Monitoring sampling
    tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.1 : 1.0,
    
    // Session Replay sampling
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',
    
    // Don't send errors in development unless explicitly enabled
    enabled: import.meta.env.VITE_APP_ENV !== 'development' || !!import.meta.env.VITE_SENTRY_DSN,
    
    // Configure error filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Facebook related errors
      'fb_xd_fragment',
      // Network errors that are usually not actionable
      'NetworkError',
      'Network request failed',
      // Common browser errors
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
    
    // Don't log transactions from health checks
    ignoreTransactions: ['/api/health', '/health-check'],
    
    // Configure breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      
      // Don't log sensitive data in breadcrumbs
      if (breadcrumb.type === 'http' && breadcrumb.data?.url?.includes('/api/auth')) {
        // Redact auth tokens from breadcrumbs
        if (breadcrumb.data.request_headers) {
          breadcrumb.data.request_headers = {
            ...breadcrumb.data.request_headers,
            Authorization: '[REDACTED]',
          };
        }
      }
      
      return breadcrumb;
    },
    
    // Configure what to send with errors
    beforeSend(event, hint) {
      // Don't send events in development unless Sentry DSN is provided
      if (import.meta.env.VITE_APP_ENV === 'development' && !import.meta.env.VITE_SENTRY_DSN) {
        return null;
      }
      
      // Filter out specific errors
      if (event.exception && hint.originalException) {
        const error = hint.originalException as Error;
        
        // Don't log expected errors
        if (error.message?.includes('User cancelled') || 
            error.message?.includes('AbortError')) {
          return null;
        }
      }
      
      // Add additional context
      event.tags = {
        ...event.tags,
        component: 'react-app',
      };
      
      return event;
    },
  });
};

/**
 * Set user context for better error tracking
 */
export const setSentryUser = (user: {
  id: string;
  email?: string;
  username?: string;
  tier?: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    tier: user.tier,
  });
};

/**
 * Clear user context on logout
 */
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

/**
 * Add custom breadcrumb for tracking user actions
 */
export const addBreadcrumb = (message: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message,
    level: 'info',
    category: 'user-action',
    data,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture custom error with context
 */
export const captureError = (
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
) => {
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level || 'error',
  });
};

/**
 * Track custom events
 */
export const trackEvent = (
  eventName: string,
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message: `Event: ${eventName}`,
    category: 'custom-event',
    level: 'info',
    data,
  });
};

/**
 * Performance monitoring: Start a transaction
 */
export const startTransaction = (
  name: string,
  op: string = 'navigation'
): Sentry.Transaction | undefined => {
  return Sentry.startTransaction({
    name,
    op,
  });
};

/**
 * Performance monitoring: Measure async operations
 */
export const measureAsyncOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  operationType: string = 'task'
): Promise<T> => {
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  const span = transaction?.startChild({
    op: operationType,
    description: operationName,
  });

  try {
    const result = await operation();
    span?.setStatus('ok');
    return result;
  } catch (error) {
    span?.setStatus('internal_error');
    throw error;
  } finally {
    span?.finish();
  }
};