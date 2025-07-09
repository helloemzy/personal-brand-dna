# Sentry Error Monitoring Implementation Guide

## Overview

This document outlines the Sentry error monitoring implementation for BrandPillar AI. The implementation provides comprehensive error tracking, performance monitoring, and user context tracking throughout the application.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install @sentry/react @sentry/tracing
```

### 2. Environment Configuration

Add these environment variables to your `.env` file:

```env
VITE_SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
VITE_APP_ENV=development  # or production, staging
VITE_APP_VERSION=1.0.0    # Your app version
```

### 3. Create Sentry Account and Project

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project for React
3. Copy the DSN from your project settings
4. Add the DSN to your environment variables

## Implementation Details

### Core Configuration (`src/config/sentry.ts`)

The main Sentry configuration includes:

- **Environment-based initialization**: Only runs in production or when DSN is provided
- **Performance monitoring**: Tracks slow API calls and component renders
- **Session replay**: Captures user sessions when errors occur
- **Error filtering**: Ignores common browser errors and noise
- **Breadcrumb tracking**: Records user actions leading to errors
- **User context**: Associates errors with logged-in users

### Error Boundary Components

1. **Enhanced ErrorBoundary** (`src/components/ErrorBoundary.tsx`)
   - Catches React component errors
   - Reports to Sentry automatically
   - Provides user-friendly error UI
   - Shows error details in development

2. **SentryErrorBoundary** (`src/components/SentryErrorBoundary.tsx`)
   - Wrapper with Sentry's HOC
   - Additional error context
   - Fallback UI for critical errors

3. **Custom Error Page** (`src/pages/ErrorPage.tsx`)
   - Dedicated error page with recovery options
   - Error reporting dialog
   - Network/permission error detection
   - User-friendly messaging

### API Error Tracking

**Sentry API Interceptor** (`src/utils/sentryApiInterceptor.ts`)
- Wraps fetch calls with error tracking
- Tracks slow API responses (>3s)
- Categorizes errors by type (network, server, client)
- Adds breadcrumbs for all API calls

**Enhanced API Service** (`src/services/sentryEnhancedApi.ts`)
- Type-safe API wrapper
- Automatic error capture
- Performance measurement
- Workshop and content-specific tracking

### Redux Integration

**Sentry Middleware** (`src/store/middleware/sentryMiddleware.ts`)
- Tracks all Redux actions as breadcrumbs
- Monitors workshop milestones
- Captures async action failures
- User context updates on auth changes
- Performance tracking for async operations

### Performance Monitoring

1. **Route-level tracking**: Automatic with `withSentryRouting`
2. **Component profiling**: Workshop steps tracked individually
3. **API performance**: Measures all API calls
4. **Redux performance**: Tracks async action duration

### Custom Hooks

**useSentryTracking** (`src/hooks/useSentryTracking.ts`)
- Automatically tracks user context
- Page navigation breadcrumbs
- Action tracking utilities
- Performance measurement helpers

## Usage Examples

### Basic Error Capture

```typescript
import { captureError } from '@/config/sentry';

try {
  // risky operation
} catch (error) {
  captureError(error as Error, {
    tags: { component: 'workshop' },
    level: 'error',
    extra: { step: currentStep }
  });
}
```

### Track User Actions

```typescript
import { useActionTracking } from '@/hooks/useSentryTracking';

const { trackAction } = useActionTracking();

const handleSubmit = () => {
  trackAction('workshop_completed', {
    step: 'personality-quiz',
    duration: Date.now() - startTime
  });
};
```

### Performance Monitoring

```typescript
import { measureAsyncOperation } from '@/config/sentry';

const result = await measureAsyncOperation(
  async () => {
    return await api.generateContent(prompt);
  },
  'content_generation'
);
```

### Custom Breadcrumbs

```typescript
import { addBreadcrumb } from '@/config/sentry';

addBreadcrumb('User clicked generate', {
  category: 'ui.click',
  data: { 
    contentType: 'linkedin-post',
    pillar: 'expertise' 
  }
});
```

## Best Practices

### 1. Error Context

Always provide context when capturing errors:

```typescript
captureError(error, {
  tags: {
    component: 'workshop',
    step: 'values-audit',
    user_tier: 'professional'
  },
  extra: {
    workshopData: currentData,
    attemptNumber: retryCount
  }
});
```

### 2. User Privacy

- Never log sensitive data (passwords, tokens)
- Sanitize user input before logging
- Use `beforeSend` to filter sensitive information

### 3. Performance Impact

- Sentry adds minimal overhead (~5-10ms per error)
- Performance monitoring samples at 10% in production
- Session replay only activates on errors

### 4. Error Grouping

Use consistent error messages for better grouping:

```typescript
// Good
throw new Error(`API Error: Failed to fetch workshop data for user ${userId}`);

// Bad
throw new Error(`Error at ${new Date()}: ${response.status}`);
```

## Monitoring Dashboard

### Key Metrics to Track

1. **Error Rate**: Errors per session
2. **Crash Rate**: Sessions with crashes
3. **Performance**: P75/P95 response times
4. **User Impact**: Users affected by errors

### Alerts to Configure

1. Error spike detection (>10 errors/minute)
2. New error types
3. Performance degradation (P95 > 3s)
4. High error rate for specific users

## Troubleshooting

### Common Issues

1. **Sentry not capturing errors**
   - Check DSN is configured
   - Verify environment is not 'development'
   - Check browser console for Sentry errors

2. **Too many events**
   - Adjust `tracesSampleRate` in config
   - Add more specific error filtering
   - Use `ignoreErrors` for known issues

3. **Missing context**
   - Ensure user context is set after login
   - Add breadcrumbs before critical operations
   - Use tags for better organization

## Security Considerations

1. **DSN Exposure**: Frontend DSN is public, this is expected
2. **Data Sanitization**: Configure `beforeSend` to remove sensitive data
3. **User Privacy**: Don't log PII without consent
4. **Rate Limiting**: Sentry has built-in rate limiting

## Maintenance

### Regular Tasks

1. **Review ignored errors** monthly
2. **Update error filtering** based on new issues
3. **Monitor quota usage** to avoid overages
4. **Archive old projects** to reduce noise

### Version Updates

Keep Sentry SDK updated for latest features:

```bash
npm update @sentry/react @sentry/tracing
```

## Support

- [Sentry Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Best Practices](https://docs.sentry.io/product/best-practices/)
- Internal: Contact DevOps team for quota increases or configuration changes