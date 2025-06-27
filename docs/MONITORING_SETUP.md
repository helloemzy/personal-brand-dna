# Monitoring Setup Guide

## Overview

Personal Brand DNA uses a comprehensive monitoring stack with Sentry for error tracking and DataDog for APM and business metrics. This guide covers setup, configuration, and best practices.

## Table of Contents
1. [Sentry Setup](#sentry-setup)
2. [DataDog Setup](#datadog-setup)
3. [Environment Variables](#environment-variables)
4. [Custom Metrics](#custom-metrics)
5. [Dashboards](#dashboards)
6. [Alerts](#alerts)
7. [Best Practices](#best-practices)

## Sentry Setup

### 1. Create Sentry Account
1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project for "Personal Brand DNA"
3. Select "Node.js" for backend and "React" for frontend

### 2. Install Sentry SDK
```bash
npm install @sentry/nextjs @sentry/node
```

### 3. Configure Sentry
The configuration files are already created:
- `sentry.client.config.js` - Frontend error tracking
- `sentry.server.config.js` - Backend error tracking

### 4. Key Features Configured
- **Error Filtering**: Ignores expected errors (network, auth)
- **Performance Monitoring**: Tracks API latency and database queries
- **Session Replay**: Records user sessions with errors
- **Release Tracking**: Automatic version tracking
- **User Context**: Associates errors with users

### 5. Sentry Dashboard Setup
1. Create custom dashboard with widgets:
   - Error rate over time
   - Most frequent errors
   - Affected users
   - Performance metrics
   - Release health

2. Set up issue alerts:
   - First occurrence of new error
   - Error spike detection
   - High error rate
   - Performance degradation

## DataDog Setup

### 1. Create DataDog Account
1. Sign up at [datadoghq.com](https://www.datadoghq.com)
2. Choose appropriate plan (recommend Pro for production)

### 2. Install DataDog Agent
```bash
# For Vercel/Serverless
npm install dd-trace node-statsd winston winston-datadog
```

### 3. Configure DataDog
Configuration is in `datadog.config.js`:
- APM tracing
- Custom business metrics
- Log aggregation
- Runtime metrics

### 4. DataDog Dashboards

#### System Overview Dashboard
- Service health status
- API response times
- Request volume
- Error rates
- Active users

#### Business Metrics Dashboard
- User signups
- Content generation
- Workshop completions
- Revenue metrics
- Feature usage

#### Performance Dashboard
- Database query performance
- Cache hit rates
- Memory usage
- External API latency

#### BrandHack Dashboard
- Workshop funnel
- News relevance scores
- Content calendar activity
- LinkedIn queue health

### 5. Configure Monitors
Create monitors for:
- API availability
- High error rates
- Database performance
- Memory usage
- Business KPIs

## Environment Variables

Add these to your `.env` file:

```env
# Sentry
SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your-org
SENTRY_PROJECT=personal-brand-dna
SENTRY_AUTH_TOKEN=your_auth_token_here

# DataDog
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_HOSTNAME=localhost
DD_TRACE_AGENT_PORT=8126
```

## Custom Metrics

### Business Metrics
```javascript
// Track user actions
BusinessMetrics.trackUserAction('content_generated', userId, {
  content_type: 'post',
  template: 'career_milestone'
});

// Track revenue
BusinessMetrics.trackSubscription('created', 'pro', 49.00);

// Track feature usage
BusinessMetrics.trackWorkshopProgress('values', true);
```

### Performance Metrics
```javascript
// Monitor API endpoints
const monitoredHandler = monitorApiEndpoint('/api/content/generate');

// Monitor database queries
const result = await monitorQuery('getUserProfile', async () => {
  return await db.query('SELECT * FROM users WHERE id = $1', [userId]);
});

// Monitor external APIs
const response = await monitorExternalApi('OpenAI', async () => {
  return await openai.createCompletion({...});
});
```

## Dashboards

### Import Dashboard Configuration
1. In DataDog, go to Dashboards → New Dashboard
2. Click "Import Dashboard JSON"
3. Upload `monitoring/dashboard-config.json`

### Customize Dashboards
- Adjust time ranges
- Add custom filters
- Create team-specific views
- Set up TV mode for office displays

## Alerts

### Critical Alerts (PagerDuty)
- Database down
- API availability < 99%
- Error rate > 10%
- Payment processing failures

### Warning Alerts (Slack)
- High memory usage
- Slow database queries
- Rate limit approaching
- Low cache hit rate

### Info Alerts (Email)
- Daily summary
- Weekly business metrics
- Monthly SLO report

## Best Practices

### 1. Error Handling
```javascript
try {
  // Your code
} catch (error) {
  // Add context before sending to Sentry
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'workshop');
    scope.setContext('user_action', { step: 'values_audit' });
    Sentry.captureException(error);
  });
  
  // Still handle the error appropriately
  throw error;
}
```

### 2. Performance Monitoring
```javascript
// Wrap slow operations
const transaction = Sentry.startTransaction({
  op: 'content.generation',
  name: 'Generate LinkedIn Post',
});

try {
  const result = await generateContent();
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

### 3. Custom Metrics
```javascript
// Track business events
metrics.increment('user.action.workshop_completed', 1, {
  workshop_type: 'brand_discovery',
  completion_time: duration,
});

// Track performance
metrics.histogram('api.response_time', responseTime, {
  endpoint: '/api/content/generate',
  status_code: '200',
});
```

### 4. Debugging Production Issues
1. Check Sentry for error details
2. Review DataDog APM traces
3. Analyze logs in DataDog
4. Check custom metrics
5. Review user session replay

### 5. Monitoring Checklist
- [ ] All API endpoints have monitoring
- [ ] Database queries are instrumented
- [ ] External API calls are wrapped
- [ ] Business events are tracked
- [ ] Alerts are configured
- [ ] Dashboards are set up
- [ ] Team is trained on tools

## Monitoring Endpoints

### Health Check
```bash
curl https://your-app.vercel.app/api/monitoring/health
```

Returns:
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "healthy", "latency": 23 },
    "cache": { "status": "healthy", "latency": 5 },
    "externalApis": {
      "openai": { "status": "healthy", "latency": 245 },
      "stripe": { "status": "healthy", "latency": 189 }
    }
  },
  "metrics": {
    "uptime": 864000,
    "memory": { "heapUsed": 45234688, "heapTotal": 67108864 }
  }
}
```

### Error Reporting
Frontend errors are automatically sent to `/api/monitoring/error` with full context.

## Troubleshooting

### Sentry Not Receiving Events
1. Check SENTRY_DSN is set correctly
2. Verify environment (development vs production)
3. Check browser console for errors
4. Verify network requests to Sentry

### DataDog Metrics Missing
1. Verify DD_API_KEY is set
2. Check DataDog agent is running
3. Verify metric names and tags
4. Check DataDog logs for errors

### High Memory Usage
1. Check for memory leaks in loops
2. Review database connection pooling
3. Analyze heap snapshots
4. Implement caching strategies

## Support

For monitoring issues:
- Sentry: support@sentry.io
- DataDog: support@datadoghq.com
- Internal: #monitoring Slack channel