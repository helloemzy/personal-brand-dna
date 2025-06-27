# Personal Brand DNA - Deployment Guide

## Overview

This guide covers deploying Personal Brand DNA with BrandHack features to production using Vercel's serverless platform. The application is optimized for scalability, security, and performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Database Setup](#database-setup)
5. [External Services](#external-services)
6. [Post-Deployment](#post-deployment)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
- [Vercel](https://vercel.com) account
- [Supabase](https://supabase.com) account (database)
- [Upstash](https://upstash.com) account (Redis cache)
- [GitHub](https://github.com) account

### Optional Services
- [OpenAI](https://openai.com) API key
- [Google Cloud](https://cloud.google.com) account (Speech API)
- [Stripe](https://stripe.com) account (payments)
- [SendGrid](https://sendgrid.com) account (emails)
- [LinkedIn](https://developer.linkedin.com) app (OAuth)
- [Sentry](https://sentry.io) account (monitoring)
- [DataDog](https://datadoghq.com) account (APM)

### Local Requirements
- Node.js 18+ installed
- Git installed
- Vercel CLI: `npm i -g vercel`

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-username/personal-brand-dna.git
cd personal-brand-dna
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..

# Build the application
npm run build
```

### 3. Environment Variables
Create `.env.local` for local development:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis Cache
REDIS_URL=redis://default:password@host:port

# Authentication
JWT_SECRET=your-very-long-random-string
ENCRYPTION_KEY=another-very-long-random-string

# OpenAI
OPENAI_API_KEY=sk-proj-your-key

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Stripe (optional)
STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-secret

# LinkedIn OAuth (optional)
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=https://your-domain.com/api/linkedin/callback

# Email (optional)
SENDGRID_API_KEY=SG.your-key
EMAIL_FROM=noreply@yourdomain.com

# Monitoring (optional)
SENTRY_DSN=https://your-key@sentry.io/project-id
DD_API_KEY=your-datadog-api-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## Vercel Deployment

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Initial Deployment
```bash
# From project root
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: Select your account
# - Link to existing project: N
# - Project name: personal-brand-dna
# - Directory: ./
# - Override settings: N
```

### 4. Configure Project Settings

#### Build & Development Settings
In Vercel Dashboard → Settings → General:

- **Framework Preset**: Create React App
- **Build Command**: `npm run build`
- **Output Directory**: `build`
- **Install Command**: `npm install`
- **Development Command**: `npm start`

#### Node.js Version
In Vercel Dashboard → Settings → General:
- **Node.js Version**: 18.x

#### Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

1. Add all variables from `.env.local`
2. Set appropriate environment scopes:
   - Production
   - Preview
   - Development

### 5. Configure Functions
Create/verify `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Vercel-Skip-Protection",
          "value": "1"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### 6. Deploy to Production
```bash
# Deploy to production
vercel --prod

# Or use Git integration (recommended)
git push origin main
```

## Database Setup

### 1. Supabase Setup

#### Create Project
1. Go to [app.supabase.com](https://app.supabase.com)
2. Create new project
3. Save connection details

#### Run Migrations
```sql
-- Connect to Supabase SQL editor and run:

-- Users and authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  industry VARCHAR(100),
  role VARCHAR(100),
  company VARCHAR(255),
  linkedin_url VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workshop tables
CREATE TABLE workshop_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'in_progress',
  current_step INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '{}',
  session_data JSONB DEFAULT '{}',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add other tables from backend/migrations/
```

#### Configure Row Level Security
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
```

### 2. Redis Setup (Upstash)

1. Create account at [upstash.com](https://upstash.com)
2. Create new Redis database
3. Copy connection URL
4. Add to environment variables

## External Services

### 1. OpenAI Configuration
1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Add to environment variables
3. Test with: `curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models`

### 2. Google Cloud Setup
1. Create project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Speech-to-Text API
3. Create service account
4. Download credentials JSON
5. Upload to Vercel as environment variable

### 3. LinkedIn OAuth Setup
1. Create app at [linkedin.com/developers](https://www.linkedin.com/developers)
2. Add OAuth 2.0 redirect URLs:
   - `https://your-domain.vercel.app/api/linkedin/callback`
   - `http://localhost:3000/api/linkedin/callback` (development)
3. Request required scopes
4. Add credentials to environment

### 4. Stripe Configuration
1. Get keys from [dashboard.stripe.com](https://dashboard.stripe.com)
2. Configure webhooks:
   - Endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.*`
3. Add webhook secret to environment

## Post-Deployment

### 1. Verify Deployment
```bash
# Check deployment status
vercel ls

# Check logs
vercel logs

# Run health check
curl https://your-domain.vercel.app/api/monitoring/health
```

### 2. Test Critical Paths

#### Authentication Flow
1. Register new account
2. Verify email (if configured)
3. Login/logout
4. Password reset

#### Core Features
1. Complete brand workshop
2. Generate content
3. View content history
4. Update profile

#### BrandHack Features
1. Add news sources
2. View relevant articles
3. Create calendar events
4. Connect LinkedIn

### 3. Configure Custom Domain
1. In Vercel Dashboard → Settings → Domains
2. Add your domain: `app.yourdomain.com`
3. Configure DNS:
   ```
   CNAME app.yourdomain.com cname.vercel-dns.com
   ```

### 4. Enable Analytics
1. In Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Enable Speed Insights

## Monitoring Setup

### 1. Sentry Configuration
```javascript
// Already configured in:
// - sentry.client.config.js
// - sentry.server.config.js

// Add Sentry auth token for source maps
SENTRY_AUTH_TOKEN=your-auth-token
```

### 2. DataDog Setup
```bash
# Install DataDog buildpack
vercel env add DD_API_KEY your-api-key
vercel env add DD_APP_KEY your-app-key
```

### 3. Set Up Alerts

#### Vercel Alerts
- Function errors
- High latency
- Build failures

#### Custom Alerts (via monitoring service)
- API error rate > 5%
- Database connection failures
- Payment processing errors
- Low conversion rate

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs
vercel logs --type=build

# Common fixes:
- Clear cache: vercel --force
- Check Node version
- Verify all dependencies
```

#### Function Timeouts
- Increase timeout in vercel.json
- Optimize database queries
- Implement caching
- Use background jobs for long tasks

#### Database Connection Issues
```javascript
// Add connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Environment Variable Issues
- Verify all required vars are set
- Check variable scopes
- Rebuild after changes: `vercel --prod --force`

### Performance Optimization

#### Frontend
- Enable ISR for static pages
- Implement proper caching headers
- Optimize images with next/image
- Use dynamic imports

#### Backend
- Implement Redis caching
- Optimize database queries
- Use connection pooling
- Enable compression

#### Monitoring
- Set up performance budgets
- Monitor Core Web Vitals
- Track API latencies
- Review error rates

## Security Checklist

- [ ] All API endpoints require authentication
- [ ] Environment variables are secure
- [ ] Database has row-level security
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection enabled
- [ ] HTTPS enforced
- [ ] Security headers configured

## Maintenance

### Regular Tasks
1. **Daily**: Check monitoring dashboards
2. **Weekly**: Review error logs
3. **Monthly**: Update dependencies
4. **Quarterly**: Security audit

### Backup Strategy
1. Database: Automated daily backups (Supabase)
2. Code: Git repository (GitHub)
3. Environment: Document all configs
4. User data: Export functionality

### Scaling Considerations
1. **Database**: Enable read replicas when needed
2. **Caching**: Increase Redis memory
3. **Functions**: Adjust concurrency limits
4. **CDN**: Enable Vercel Edge Network

## Support Resources

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Project Issues**: [GitHub Issues](https://github.com/your-username/personal-brand-dna/issues)
- **Discord Community**: [Join Discord](https://discord.gg/your-invite)

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] External services configured
- [ ] Security review completed

### Deployment
- [ ] Deploy to Vercel
- [ ] Run database migrations
- [ ] Verify health check
- [ ] Test critical paths
- [ ] Enable monitoring

### Post-Deployment
- [ ] Configure custom domain
- [ ] Set up SSL certificate
- [ ] Enable analytics
- [ ] Configure alerts
- [ ] Document deployment

---

**Last Updated**: June 27, 2025
**Version**: 1.0.0