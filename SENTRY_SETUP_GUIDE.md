# Sentry Error Monitoring Setup Guide

## Overview
This guide walks through setting up Sentry for error monitoring in BrandPillar AI.

## Prerequisites
- Sentry account (free tier available at sentry.io)
- Access to Vercel environment variables

## Setup Steps

### 1. Install Sentry Dependencies
```bash
npm install --save @sentry/react @sentry/tracing
```

### 2. Create Sentry Project
1. Log in to [Sentry](https://sentry.io)
2. Create a new project
3. Select "React" as the platform
4. Copy your DSN (Data Source Name)

### 3. Configure Environment Variables
Add to your `.env` file:
```env
REACT_APP_SENTRY_DSN=your_sentry_dsn_here
REACT_APP_VERSION=1.0.0
REACT_APP_ENV=production
```

In Vercel:
1. Go to Project Settings → Environment Variables
2. Add the same variables for Production environment

### 4. Initialize Sentry in App
Update `src/index.tsx`:
```typescript
import { initSentry } from './utils/sentry';

// Initialize Sentry before rendering
initSentry();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
```

### 5. Update Error Boundary
Replace the generic error boundary with Sentry's enhanced version:

In `src/App.tsx`:
```typescript
import { SentryErrorBoundary } from './utils/sentry';

function App() {
  return (
    <SentryErrorBoundary fallback={ErrorFallback} showDialog>
      {/* Your app content */}
    </SentryErrorBoundary>
  );
}
```

### 6. Track User Actions
Add breadcrumbs for important user actions:

```typescript
import { addBreadcrumb } from './utils/sentry';

// In your components
const handleSubmit = () => {
  addBreadcrumb('Form submitted', 'user', { formId: 'workshop' });
  // ... rest of handler
};
```

### 7. Identify Users
After login, identify the user:

```typescript
import { identifyUser } from './utils/sentry';

// After successful login
identifyUser({
  id: user.id,
  email: user.email,
  name: user.name
});
```

### 8. Track Performance
For critical operations:

```typescript
import { startTransaction } from './utils/sentry';

const loadWorkshop = async () => {
  const transaction = startTransaction('workshop.load');
  try {
    // ... load workshop data
  } finally {
    transaction.finish();
  }
};
```

## Testing

### Development Testing
1. Temporarily set `NODE_ENV=production` in `.env`
2. Add a test error button:
```typescript
<button onClick={() => {
  throw new Error('Test Sentry Error');
}}>
  Test Error
</button>
```
3. Click the button and verify error appears in Sentry dashboard

### Production Testing
1. Deploy to Vercel
2. Trigger an error in production
3. Check Sentry dashboard for the error report

## Features Configured

✅ **Error Tracking**: Automatic capture of JavaScript errors
✅ **Performance Monitoring**: 10% sample rate for transactions
✅ **Session Replay**: Records user sessions when errors occur
✅ **Release Tracking**: Links errors to specific releases
✅ **User Context**: Associates errors with logged-in users
✅ **Breadcrumbs**: Trail of user actions before errors
✅ **Error Filtering**: Ignores known non-critical errors

## Best Practices

1. **Don't Log Sensitive Data**: Never log passwords, tokens, or PII
2. **Use Context**: Add relevant context to errors for debugging
3. **Filter Noise**: Configure `beforeSend` to filter expected errors
4. **Monitor Performance**: Use transactions for critical user paths
5. **Set Alerts**: Configure Sentry alerts for critical errors

## Monitoring Dashboard

After setup, monitor your app at:
- Issues: Track and triage errors
- Performance: Monitor slow transactions
- Releases: Track error rates by release
- User Feedback: See user reports

## Cost Considerations

Free tier includes:
- 5,000 errors/month
- 10,000 performance events/month
- 500 session replays/month
- 1 team member

For BrandPillar AI's expected traffic, the free tier should be sufficient initially.

## Next Steps

1. Set up alert rules for critical errors
2. Create custom dashboards for key metrics
3. Integrate with Slack/email for notifications
4. Configure source maps for better stack traces