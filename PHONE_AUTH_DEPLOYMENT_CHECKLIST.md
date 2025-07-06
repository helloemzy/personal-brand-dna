# Phone Authentication & Auto-Posting Deployment Checklist

## 🚀 Pre-Deployment Requirements

### 1. External Service Accounts
- [ ] **Twilio Account** (for SMS)
  - [ ] Sign up at https://www.twilio.com
  - [ ] Get Account SID
  - [ ] Get Auth Token
  - [ ] Purchase phone number for sending SMS
  - [ ] Configure messaging service

- [ ] **Vapi.ai or Bland.ai Account** (for AI voice calls)
  - [ ] Sign up for account
  - [ ] Get API key
  - [ ] Configure voice assistant
  - [ ] Set up webhook endpoints

- [ ] **LinkedIn OAuth Application**
  - [ ] Create app at https://www.linkedin.com/developers/
  - [ ] Get Client ID and Client Secret
  - [ ] Configure redirect URIs
  - [ ] Request necessary scopes (r_liteprofile, r_emailaddress, w_member_social)

### 2. Environment Variables to Add
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Voice AI Configuration
VAPI_API_KEY=your_vapi_key
# OR
BLAND_AI_API_KEY=your_bland_key

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=https://your-domain.vercel.app/api/linkedin/callback

# Encryption for sensitive data
ENCRYPTION_KEY=generate_32_char_random_string
```

### 3. Database Schema Updates
Run these SQL scripts in Supabase SQL editor:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add phone authentication fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS posting_tier VARCHAR(20) DEFAULT 'passive',
ADD COLUMN IF NOT EXISTS brand_framework JSONB;

-- Create phone OTP logs table
CREATE TABLE IF NOT EXISTS phone_otp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for phone authentication
CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_phone ON phone_otp_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_expires ON phone_otp_logs(expires_at);

-- Voice discovery tables
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_sid VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    call_status VARCHAR(50) DEFAULT 'initiated',
    duration INTEGER,
    recording_url TEXT,
    transcript TEXT,
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS discovery_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    user_response TEXT,
    response_duration INTEGER,
    sentiment_score FLOAT,
    keywords JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personal_brand_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voice_call_id UUID REFERENCES voice_calls(id),
    framework_type VARCHAR(50) NOT NULL,
    brand_archetype VARCHAR(50),
    communication_style JSONB,
    value_proposition TEXT,
    target_audience JSONB,
    content_pillars JSONB,
    personality_traits JSONB,
    fascination_advantages JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auto-posting system tables
CREATE TABLE IF NOT EXISTS posting_tiers (
    tier_name VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    posts_per_week_min INTEGER NOT NULL,
    posts_per_week_max INTEGER NOT NULL,
    max_rss_feeds INTEGER NOT NULL,
    content_variations INTEGER NOT NULL,
    approval_window_hours INTEGER NOT NULL,
    features JSONB NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL
);

-- Insert tier configurations
INSERT INTO posting_tiers (tier_name, display_name, posts_per_week_min, posts_per_week_max, max_rss_feeds, content_variations, approval_window_hours, features, price_monthly, price_yearly)
VALUES 
('passive', 'Authority Builder', 2, 3, 5, 3, 24, '{"analytics": "basic", "support": "email"}', 49, 470),
('regular', 'Influence Accelerator', 5, 7, 15, 5, 2, '{"analytics": "advanced", "support": "weekly_calls", "features": ["trend_detection", "competitor_analysis", "ab_testing"]}', 149, 1430),
('aggressive', 'Market Dominator', 14, 21, 999, 10, 0, '{"analytics": "premium", "support": "dedicated_manager", "features": ["instant_posting", "multimedia", "engagement_pods", "comment_ai"]}', 399, 3830);

CREATE TABLE IF NOT EXISTS rss_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_url TEXT NOT NULL,
    feed_name VARCHAR(200) NOT NULL,
    feed_type VARCHAR(50) DEFAULT 'rss',
    keywords TEXT[],
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feed_url)
);

CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rss_feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(200),
    author VARCHAR(200),
    categories TEXT[],
    relevance_score FLOAT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_url)
);

CREATE TABLE IF NOT EXISTS generated_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_article_id UUID REFERENCES news_articles(id),
    content_type VARCHAR(50) NOT NULL,
    content_angle VARCHAR(50),
    headline TEXT NOT NULL,
    body_content TEXT NOT NULL,
    hashtags TEXT[],
    media_urls TEXT[],
    media_type VARCHAR(50),
    timing_strategy VARCHAR(50),
    optimal_post_time TIMESTAMP WITH TIME ZONE,
    expiry_time TIMESTAMP WITH TIME ZONE,
    predicted_engagement_rate FLOAT,
    content_quality_score FLOAT,
    approval_status VARCHAR(50) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posting_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_post_id UUID NOT NULL REFERENCES generated_posts(id),
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    platform VARCHAR(50) DEFAULT 'linkedin',
    status VARCHAR(50) DEFAULT 'scheduled',
    posted_at TIMESTAMP WITH TIME ZONE,
    platform_post_id VARCHAR(255),
    post_url TEXT,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_schedule_id UUID NOT NULL REFERENCES posting_schedule(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    metrics_1_hour JSONB,
    metrics_24_hours JSONB,
    metrics_7_days JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_management (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL REFERENCES posting_tiers(tier_name),
    billing_cycle VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    posts_used_this_period INTEGER DEFAULT 0,
    rss_feeds_count INTEGER DEFAULT 0,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS linkedin_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL, -- Should be encrypted
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    profile_data JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_calls_user ON voice_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_feed ON news_articles(rss_feed_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_relevance ON news_articles(relevance_score);
CREATE INDEX IF NOT EXISTS idx_generated_posts_user ON generated_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON generated_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_user ON posting_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_time ON posting_schedule(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_subscription_user ON subscription_management(user_id);
```

## 📱 Phone Authentication Setup

### 1. Configure Twilio
```javascript
// Add to environment variables in Vercel
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### 2. Test SMS Sending
```bash
# Test Twilio configuration
curl -X POST https://your-domain.vercel.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

### 3. Configure Voice AI
```javascript
// For Vapi.ai
VAPI_API_KEY=vapi_xxxxxxxxxxxxx
VAPI_ASSISTANT_ID=asst_xxxxxxxxxxxxx

// For Bland.ai
BLAND_AI_API_KEY=bland_xxxxxxxxxxxxx
BLAND_AI_PHONE_NUMBER=+1234567890
```

## 🔗 LinkedIn OAuth Setup

### 1. Create LinkedIn App
1. Go to https://www.linkedin.com/developers/
2. Create new app
3. Add OAuth 2.0 redirect URLs:
   - `https://your-domain.vercel.app/api/linkedin/callback`
   - `http://localhost:3000/api/linkedin/callback` (for testing)

### 2. Configure Scopes
Required scopes:
- `r_liteprofile` - Read basic profile
- `r_emailaddress` - Read email address  
- `w_member_social` - Post content

### 3. Add to Environment
```javascript
LINKEDIN_CLIENT_ID=86xxxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxx
LINKEDIN_REDIRECT_URI=https://your-domain.vercel.app/api/linkedin/callback
```

## 🚀 Deployment Steps

### 1. Update Vercel Environment Variables
```bash
# Add all new environment variables in Vercel dashboard
# Project Settings → Environment Variables
```

### 2. Deploy API Endpoints
```bash
# Deploy to Vercel
vercel --prod
```

### 3. Test New Endpoints
```bash
# Test phone auth
curl https://your-domain.vercel.app/api/auth/send-otp

# Test voice discovery
curl https://your-domain.vercel.app/api/voice-discovery/start

# Test RSS monitoring
curl https://your-domain.vercel.app/api/rss-monitoring/user-feeds

# Test LinkedIn
curl https://your-domain.vercel.app/api/linkedin/auth
```

### 4. Configure Cron Jobs
Add to vercel.json:
```json
{
  "crons": [{
    "path": "/api/rss-monitoring/fetch-articles",
    "schedule": "0 */6 * * *"
  }, {
    "path": "/api/content-automation/generate-content",
    "schedule": "0 */4 * * *"
  }, {
    "path": "/api/linkedin-autoposter/check-posting-jobs",
    "schedule": "*/5 * * * *"
  }]
}
```

## ✅ Post-Deployment Verification

### 1. Phone Authentication Flow
- [ ] User can enter phone number
- [ ] OTP is sent via SMS
- [ ] User can verify OTP
- [ ] JWT token is generated

### 2. Voice Discovery Flow
- [ ] AI call is initiated
- [ ] Questions are asked naturally
- [ ] Responses are transcribed
- [ ] Brand framework is generated

### 3. Tier Selection
- [ ] All 3 tiers display correctly
- [ ] Pricing is accurate
- [ ] User can select tier
- [ ] Subscription is created

### 4. RSS Feed Setup
- [ ] User can add RSS feeds
- [ ] Feed validation works
- [ ] Articles are fetched
- [ ] Relevance scoring works

### 5. Content Generation
- [ ] AI generates content variations
- [ ] Content matches user voice
- [ ] Approval workflow functions
- [ ] Scheduling works

### 6. LinkedIn Posting
- [ ] OAuth flow completes
- [ ] Posts are published
- [ ] Analytics are tracked
- [ ] Rate limits enforced

## 🔒 Security Checklist

- [ ] All API keys are in environment variables
- [ ] LinkedIn tokens are encrypted
- [ ] Phone numbers are validated
- [ ] OTP codes expire after 10 minutes
- [ ] Rate limiting is implemented
- [ ] CORS is properly configured
- [ ] SQL injection prevention
- [ ] XSS protection enabled

## 📊 Monitoring Setup

### 1. Error Tracking
```javascript
// Already configured in monitoring.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production'
});
```

### 2. Performance Monitoring
```javascript
// DataDog APM configuration
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key
```

### 3. Usage Analytics
Track:
- Phone auth success rate
- Voice call completion rate
- Content generation volume
- LinkedIn posting success
- Tier conversion rates

## 🎯 Launch Checklist

### Day 1 - Soft Launch
- [ ] Deploy all code
- [ ] Configure external services
- [ ] Test with internal team
- [ ] Monitor error logs

### Day 2-3 - Beta Testing
- [ ] Invite 10-20 beta users
- [ ] Monitor system performance
- [ ] Collect user feedback
- [ ] Fix critical issues

### Day 4-7 - Public Launch
- [ ] Open registration
- [ ] Monitor scaling
- [ ] Customer support ready
- [ ] Marketing campaign live

## 📞 Support Preparation

### Documentation Needed
- [ ] Phone auth troubleshooting guide
- [ ] Voice call FAQ
- [ ] RSS feed setup guide
- [ ] LinkedIn connection guide
- [ ] Tier comparison guide

### Common Issues to Prepare For
1. "OTP not received" - Check phone format, Twilio logs
2. "Voice call dropped" - Check API limits, connection quality
3. "RSS feed not working" - Validate URL, check CORS
4. "LinkedIn won't connect" - Check OAuth scopes, token expiry
5. "Posts not publishing" - Check rate limits, approval status

## 🎉 Success Metrics

### Week 1 Goals
- 100+ phone registrations
- 50+ completed voice discoveries
- 30+ tier subscriptions
- 500+ posts generated
- 95%+ posting success rate

### Month 1 Goals
- 1,000+ active users
- 70% voice completion rate
- 40% paid conversion
- 10,000+ posts published
- 4.5+ user satisfaction

## 🆘 Emergency Procedures

### If Phone Auth Fails
1. Check Twilio status page
2. Verify account balance
3. Check rate limits
4. Enable email fallback

### If Voice AI Fails
1. Check API status
2. Verify quotas
3. Switch providers if needed
4. Enable form fallback

### If LinkedIn Posting Fails
1. Check OAuth tokens
2. Verify rate limits
3. Check LinkedIn API status
4. Queue for retry

## 📋 Final Notes

1. **Test Everything**: Run through complete user flow before launch
2. **Monitor Closely**: First 48 hours are critical
3. **Iterate Quickly**: Be ready to make rapid fixes
4. **Communicate**: Keep users informed of any issues
5. **Celebrate**: This is a major achievement! 🎉

Remember: The system is designed with fallbacks and safety measures. If something goes wrong, users can always fall back to manual processes while issues are resolved.