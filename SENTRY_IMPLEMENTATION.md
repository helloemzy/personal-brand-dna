# Sentry Error Monitoring Implementation Guide

## Overview

This guide documents the complete Sentry error monitoring implementation for BrandPillar AI. The integration provides comprehensive error tracking, performance monitoring, and user session replay capabilities.

## Implementation Status ✅

### Completed Components:

1. **Core Sentry Configuration** (`src/config/sentry.ts`)
   - Error tracking and filtering
   - Performance monitoring with BrowserTracing
   - Session replay with privacy protection
   - Custom breadcrumb filtering
   - User context management

2. **Error Boundaries** (`src/components/ErrorBoundary.tsx`)
   - React error boundary with Sentry integration
   - User-friendly error display
   - Error ID tracking for support
   - Development mode error details

3. **API Error Tracking** (`src/utils/sentryApiInterceptor.ts`)
   - Enhanced fetch wrapper with automatic error capture
   - Performance tracking for API calls
   - Slow API detection (>3s alerts)
   - Network error handling

4. **Redux Integration** (`src/store/middleware/sentryMiddleware.ts`)
   - Action tracking with breadcrumbs
   - Async operation performance monitoring
   - Workshop milestone tracking
   - Error state capture

5. **Enhanced API Service** (`src/services/sentryEnhancedApi.ts`)
   - Centralized API client with Sentry integration
   - Automatic error context capture
   - Performance measurement wrapper
   - Workshop and content-specific endpoints

## Configuration

### 1. Environment Variables

Add these to your `.env` file:

```env
# Sentry Configuration
VITE_SENTRY_DSN=https://your_project_key@o000000.ingest.sentry.io/0000000
VITE_APP_ENV=production  # or development, staging
VITE_APP_VERSION=1.0.0   # Your app version
```

### 2. Create Sentry Project

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (select React)
3. Copy the DSN from project settings
4. Configure these project settings:
   - Enable Session Replay
   - Set up Performance monitoring
   - Configure Alert rules

### 3. Vercel Deployment

Add environment variables in Vercel dashboard:
- `VITE_SENTRY_DSN`
- `VITE_APP_ENV` (set to "production")
- `VITE_APP_VERSION` (match your release version)

## Key Features

### 1. Error Tracking
- Automatic error capture with context
- Redux action tracking
- API error monitoring
- Custom error boundaries

### 2. Performance Monitoring
- Route transaction tracking
- API call performance
- Redux async action timing
- Slow operation alerts

### 3. Session Replay
- 10% sample rate for all sessions
- 100% capture for sessions with errors
- Privacy protection (masked text/media)

### 4. Smart Filtering
- Ignores common browser errors
- Filters out expected network errors
- Removes noisy console breadcrumbs
- Excludes auth errors (401/403)

### 5. Workshop Integration
- Track workshop progress
- Capture step completion
- Monitor drop-off points
- Archetype determination tracking

## Usage Examples

### Manual Error Capture
```typescript
import { captureSentryError } from '@/config/sentry';

try {
  // risky operation
} catch (error) {
  captureSentryError(error as Error, {
    workshop_step: 'values_audit',
    user_action: 'submit_values'
  });
}
```

### Track Custom Events
```typescript
import { trackSentryEvent } from '@/config/sentry';

trackSentryEvent('workshop_completed', {
  archetype: 'Innovative Leader',
  completion_time: 1200
});
```

### Performance Monitoring
```typescript
import { measurePerformance } from '@/config/sentry';

const result = await measurePerformance(
  'generate_content',
  async () => await generateContent(prompt)
);
```

### API Usage
```typescript
import { sentryFetch } from '@/utils/sentryApiInterceptor';

// Automatically tracked
const response = await sentryFetch('/api/workshop/save', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

## Monitoring Dashboard

### Key Metrics to Track:
1. **Error Rate**: Keep below 1%
2. **Performance**: P95 < 3 seconds
3. **Workshop Completion**: Track funnel
4. **API Health**: Monitor slow endpoints

### Recommended Alerts:
- Error spike (>10 errors/minute)
- Performance regression (>5s P95)
- Workshop crash rate >5%
- API error rate >2%

## Testing

### Local Testing:
1. Set `VITE_SENTRY_DSN` in `.env.local`
2. Trigger test error: `Sentry.captureException(new Error("Test"))`
3. Check Sentry dashboard for event

### Production Verification:
1. Deploy with environment variables
2. Check Sentry project for incoming events
3. Verify session replay is working
4. Test error boundary with forced error

## Troubleshooting

### Common Issues:

1. **No events appearing**:
   - Check DSN is correct
   - Verify environment variables are set
   - Check browser console for Sentry errors

2. **Missing context**:
   - Ensure user is set after login
   - Verify Redux middleware is added
   - Check breadcrumb filtering

3. **Performance issues**:
   - Reduce `tracesSampleRate` in production
   - Lower session replay sample rate
   - Filter more breadcrumbs

## Maintenance

### Regular Tasks:
1. Review and resolve errors weekly
2. Update ignored errors list
3. Adjust sampling rates based on quota
4. Archive resolved issues

### Performance Optimization:
- Use `beforeSend` to filter errors
- Implement custom fingerprinting for grouping
- Set up data scrubbing for PII
- Configure retention policies

## Security Considerations

1. **PII Protection**:
   - Session replay masks all text
   - Auth headers are redacted
   - User emails are hashed

2. **Data Retention**:
   - Set appropriate retention periods
   - Regular cleanup of old events
   - GDPR compliance settings

## Next Steps

1. Set up custom dashboards for business metrics
2. Implement release tracking with Git integration
3. Configure team alerts and assignments
4. Add source map uploads for better stack traces

## Support

For issues or questions:
- Sentry Documentation: https://docs.sentry.io/
- Support: https://sentry.io/support/
- Community Forum: https://forum.sentry.io/