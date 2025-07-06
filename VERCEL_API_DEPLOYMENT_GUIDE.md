# Vercel API Deployment Guide - Phone Auth & Auto-Posting System

## 🚀 Overview
This guide covers deploying all the new API endpoints for the phone authentication and auto-posting system to Vercel.

## 📁 API Endpoints to Deploy

### 1. Phone Authentication (`/api/phone-auth`)
- `/send-otp` - Send OTP via SMS
- `/verify-otp` - Verify OTP and create session
- `/check-status` - Check authentication status

### 2. Voice Discovery (`/api/voice-discovery`)
- `/initiate-call` - Start AI voice call
- `/webhook` - Handle voice provider webhooks
- `/analyze` - Analyze conversation transcript
- `/questions` - Get discovery questions

### 3. RSS Monitoring (`/api/rss-monitoring`)
- `/add-feed` - Add RSS/Google Alerts feeds
- `/fetch-articles` - Fetch new articles
- `/analyze-relevance` - Score article relevance
- `/trending-topics` - Get trending topics
- `/competitor-analysis` - Analyze competitors

### 4. Content Automation (`/api/content-automation`)
- `/generate-content` - Generate content variations
- `/approve-content` - Approve/reject content
- `/schedule-posts` - Schedule approved posts
- `/content-calendar` - View posting calendar

### 5. LinkedIn Autoposter (`/api/linkedin-autoposter`)
- `/connect-linkedin` - OAuth connection
- `/disconnect-linkedin` - Revoke access
- `/post-now` - Immediate posting
- `/check-posting-jobs` - Cron job handler

## 🔧 Pre-Deployment Checklist

### Environment Variables
Ensure all these are set in Vercel:

```bash
# Database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Authentication
JWT_SECRET=your-32-char-secret
JWT_REFRESH_SECRET=another-32-char-secret

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Voice AI (Vapi.ai or Bland.ai)
VOICE_AI_API_KEY=vapi_xxxxxxxxxxxxx
VOICE_AI_BASE_URL=https://api.vapi.ai
VOICE_AI_PROVIDER=vapi

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=86xxxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxxxx
LINKEDIN_REDIRECT_URI=https://your-app.vercel.app/api/linkedin/callback

# OpenAI (for content generation)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Encryption (for sensitive data)
ENCRYPTION_KEY=32-character-random-string-here

# App URL (for webhooks)
VERCEL_URL=https://your-app.vercel.app
```

## 📝 Deployment Steps

### Step 1: Verify API Files
Ensure these files exist in your `/api` directory:
```
api/
├── phone-auth.js
├── voice-discovery.js
├── rss-monitoring.js
├── content-automation.js
└── linkedin-autoposter.js
```

### Step 2: Update vercel.json
Add cron job configuration:

```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/rss-monitoring/fetch-articles",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/content-automation/generate-content", 
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/linkedin-autoposter/check-posting-jobs",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Step 3: Deploy to Vercel
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to production
vercel --prod

# Or push to GitHub (if connected)
git add .
git commit -m "feat: Add phone auth and auto-posting APIs"
git push origin main
```

### Step 4: Verify Deployment
Check each endpoint is accessible:

```bash
# Test phone auth
curl https://your-app.vercel.app/api/phone-auth/send-otp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "5551234567", "countryCode": "+1"}'

# Test voice discovery (requires auth)
curl https://your-app.vercel.app/api/voice-discovery/questions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test RSS monitoring (requires auth)
curl https://your-app.vercel.app/api/rss-monitoring/trending-topics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔄 Post-Deployment Configuration

### 1. Configure Webhooks
Update your external services with webhook URLs:

#### Vapi.ai/Bland.ai
Set webhook URL to:
```
https://your-app.vercel.app/api/voice-discovery/webhook
```

#### LinkedIn OAuth
Ensure redirect URI matches:
```
https://your-app.vercel.app/api/linkedin/callback
```

### 2. Test Cron Jobs
Manually trigger cron endpoints to verify they work:

```bash
# Test RSS feed fetching
curl https://your-app.vercel.app/api/rss-monitoring/fetch-articles

# Test content generation
curl https://your-app.vercel.app/api/content-automation/generate-content

# Test posting job checker
curl https://your-app.vercel.app/api/linkedin-autoposter/check-posting-jobs
```

### 3. Monitor Initial Usage
Use Vercel's dashboard to monitor:
- Function executions
- Error rates
- Execution duration
- Cron job success

## 🧪 Testing the Complete Flow

### 1. Phone Authentication Flow
```bash
# 1. Send OTP
curl -X POST https://your-app.vercel.app/api/phone-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "5551234567", "countryCode": "+1"}'

# 2. Verify OTP (use code from SMS)
curl -X POST https://your-app.vercel.app/api/phone-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "5551234567", "countryCode": "+1", "otpCode": "123456"}'

# Save the JWT token from response
```

### 2. Voice Discovery Flow
```bash
# Initiate voice call
curl -X POST https://your-app.vercel.app/api/voice-discovery/initiate-call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. RSS Feed Setup
```bash
# Add an RSS feed
curl -X POST https://your-app.vercel.app/api/rss-monitoring/add-feed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feedUrl": "https://example.com/feed.xml",
    "feedName": "Industry News",
    "keywords": ["AI", "automation"]
  }'
```

### 4. Content Generation
```bash
# Generate content from articles
curl -X POST https://your-app.vercel.app/api/content-automation/generate-content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 5. LinkedIn Posting
```bash
# Post approved content
curl -X POST https://your-app.vercel.app/api/linkedin-autoposter/post-now \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"postId": "POST_ID_HERE"}'
```

## 🚨 Common Deployment Issues

### "Function timeout"
- Increase `maxDuration` in vercel.json (max 300 for Pro accounts)
- Consider breaking long operations into background jobs

### "Environment variable not found"
- Double-check all variables are set in Vercel dashboard
- Redeploy after adding new variables

### "CORS errors"
- APIs already include CORS headers
- Check frontend is using correct API URLs

### "Database connection failed"
- Verify Supabase URL and service key
- Check if IP restrictions are enabled in Supabase

## 📊 Monitoring & Analytics

### Vercel Analytics
Monitor in Vercel dashboard:
- API response times
- Error rates by endpoint
- Cron job execution logs
- Bandwidth usage

### Custom Logging
APIs log important events:
- OTP send/verify attempts
- Voice call initiations
- Content generation requests
- LinkedIn posting attempts

### Error Tracking
Consider adding:
- Sentry for error tracking
- Custom alerts for critical failures
- Usage analytics for tier limits

## 🔒 Security Considerations

### API Security
- All sensitive endpoints require JWT authentication
- Rate limiting should be configured
- Input validation on all endpoints

### Data Protection
- Phone numbers are hashed in logs
- LinkedIn tokens should be encrypted
- OTP codes expire after 10 minutes

### Monitoring
- Track failed authentication attempts
- Monitor for unusual API usage patterns
- Set up alerts for security events

## ✅ Post-Deployment Checklist

### Immediate
- [ ] All endpoints return 200 OK
- [ ] Environment variables confirmed
- [ ] Webhooks configured
- [ ] Cron jobs scheduled
- [ ] Basic authentication tested

### Within 24 Hours
- [ ] Monitor error logs
- [ ] Check cron job execution
- [ ] Verify webhook deliveries
- [ ] Test complete user flow
- [ ] Document any issues

### Within 1 Week
- [ ] Analyze usage patterns
- [ ] Optimize slow endpoints
- [ ] Adjust rate limits if needed
- [ ] Gather user feedback
- [ ] Plan improvements

## 🎯 Success Metrics

### Technical
- API response time < 500ms
- Error rate < 1%
- Uptime > 99.9%
- Cron job success > 95%

### Business
- Phone auth completion > 80%
- Voice call completion > 70%
- Content approval rate > 60%
- LinkedIn posting success > 95%

## 🆘 Support Resources

### Vercel
- Status: https://vercel-status.com
- Docs: https://vercel.com/docs
- Support: support@vercel.com

### External Services
- Twilio: https://status.twilio.com
- LinkedIn API: https://developer.linkedin.com/support
- Vapi.ai: https://docs.vapi.ai

Remember: Deploy during low-traffic hours and monitor closely for the first 48 hours!