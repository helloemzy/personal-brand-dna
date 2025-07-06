import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export const initSentry = () => {
  // Only initialize in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Sentry not initialized in development');
    return;
  }

  // Check if DSN is configured
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Release tracking
    release: process.env.REACT_APP_VERSION || 'unknown',
    environment: process.env.REACT_APP_ENV || 'production',
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out known non-critical errors
      const error = hint.originalException;
      
      // Ignore network errors that are expected
      if (error && error instanceof Error) {
        if (error.message?.includes('Network request failed')) {
          return null;
        }
        // Ignore ResizeObserver errors (common and non-critical)
        if (error.message?.includes('ResizeObserver loop limit exceeded')) {
          return null;
        }
      }
      
      // Add user context if available
      const user = getCurrentUser();
      if (user) {
        event.user = {
          id: user.id,
          email: user.email,
        };
      }
      
      return event;
    },
  });
};

// Helper to get current user from Redux store
const getCurrentUser = () => {
  try {
    const state = localStorage.getItem('persist:root');
    if (state) {
      const parsed = JSON.parse(state);
      const auth = JSON.parse(parsed.auth);
      return auth.user;
    }
  } catch (e) {
    // Ignore errors getting user
  }
  return null;
};

// Enhanced error boundary component
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Manual error capture
export const captureException = (error: Error, context?: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      contexts: {
        custom: context || {},
      },
    });
  } else {
    console.error('Error captured:', error, context);
  }
};

// Performance tracking
export const startTransaction = (name: string, op: string = 'navigation') => {
  return Sentry.startTransaction({ name, op });
};

// User identification
export const identifyUser = (user: { id: string; email?: string; name?: string }) => {
  Sentry.setUser(user);
};

// Clear user on logout
export const clearUser = () => {
  Sentry.setUser(null);
};

// Add breadcrumb for user actions
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
};