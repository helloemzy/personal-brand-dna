import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,
  environment,
  
  // Performance Monitoring
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  
  // Session Replay
  integrations: [
    new Sentry.Replay({
      // Mask all text content for privacy
      maskAllText: true,
      maskAllInputs: true,
      
      // Only capture sessions with errors
      sessionSampleRate: 0,
      errorSampleRate: environment === 'production' ? 0.5 : 1.0,
    }),
  ],
  
  // Release Health
  autoSessionTracking: true,
  
  // Error Filtering
  beforeSend(event, hint) {
    // Filter out common non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Ignore network errors that are expected
      if (error?.message?.includes('Network request failed')) {
        return null;
      }
      
      // Ignore authentication errors (handled by app)
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return null;
      }
    }
    
    // Add user context if available
    const user = getUser(); // Your user getter function
    if (user) {
      event.user = {
        id: user.id,
        email: user.email,
        subscription_tier: user.subscriptionTier,
      };
    }
    
    return event;
  },
  
  // Breadcrumb Configuration
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    
    // Add more context to navigation breadcrumbs
    if (breadcrumb.category === 'navigation') {
      breadcrumb.data = {
        ...breadcrumb.data,
        timestamp: new Date().toISOString(),
      };
    }
    
    return breadcrumb;
  },
});

// Custom error boundary configuration
export const ErrorBoundary = Sentry.ErrorBoundary;
export const withSentry = Sentry.withSentry;

// Helper function to add custom context
export function addSentryContext(context, data) {
  Sentry.setContext(context, data);
}

// Helper function to track custom events
export function trackEvent(eventName, data) {
  Sentry.addBreadcrumb({
    message: eventName,
    category: 'custom',
    level: 'info',
    data,
  });
}

// Mock user getter - replace with your actual implementation
function getUser() {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
}