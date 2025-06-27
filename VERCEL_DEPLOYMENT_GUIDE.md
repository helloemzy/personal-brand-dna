# Personal Brand DNA - Vercel Deployment Guide

## Overview

This guide explains how to deploy the Personal Brand DNA system to Vercel. The application has been converted from a traditional full-stack architecture to a serverless architecture suitable for Vercel.

## Architecture Changes

### Original Architecture (Railway)
- Express.js server (backend)
- Python FastAPI server (AI pipeline)
- React frontend
- PostgreSQL + Redis (containerized)

### New Architecture (Vercel)
- Vercel Serverless Functions (Node.js + Python)
- React Static Site
- External PostgreSQL + Redis hosting
- File storage via Supabase

## Prerequisites

### 1. External Services Required

#### Database & Cache
- **PostgreSQL Database**: Use Supabase, Neon, or Railway for PostgreSQL hosting
- **Redis Cache**: Use Upstash Redis or Railway for Redis hosting

#### APIs & Storage
- **OpenAI API Key**: For content generation (GPT-4 access required)
- **Google Cloud Speech API**: For voice transcription
- **Supabase Storage**: For audio file storage (already configured)
- **SendGrid** (Optional): For production email delivery

### 2. Vercel Account
- Create account at vercel.com
- Install Vercel CLI: `npm i -g vercel`

## Deployment Steps

### Step 1: Set Up External Services

#### 1.1 Database Setup (Choose one)

**Option A: Supabase (Recommended)**
```bash
# 1. Go to https://supabase.com
# 2. Create new project
# 3. Get connection string from Settings > Database
# Format: postgresql://postgres:[password]@[host]:5432/postgres
```

**Option B: Neon Database**
```bash
# 1. Go to https://neon.tech
# 2. Create new project
# 3. Get connection string from dashboard
```

**Option C: Railway Database**
```bash
# 1. Go to https://railway.app
# 2. Create PostgreSQL service
# 3. Get DATABASE_URL from variables
```

#### 1.2 Redis Setup

**Option A: Upstash Redis (Recommended)**
```bash
# 1. Go to https://upstash.com
# 2. Create Redis database
# 3. Get connection URL from dashboard
```

**Option B: Railway Redis**
```bash
# 1. Go to https://railway.app
# 2. Create Redis service
# 3. Get REDIS_URL from variables
```

### Step 2: Configure Database Schema

```bash
# 1. Connect to your PostgreSQL database
# 2. Run the following schema creation script:

# Copy the schema from backend/src/scripts/migrate.js
# Execute all CREATE TABLE statements in your database
# This includes tables for users, user_profiles, voice_transcriptions, 
# generated_content, user_sessions, etc.
```

### Step 3: Prepare Frontend

```bash
# Build the React frontend for Vercel
./build-frontend.sh
```

### Step 4: Deploy to Vercel

#### 4.1 Initial Setup
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy from project root
vercel
```

#### 4.2 Configure Environment Variables

In Vercel Dashboard (Settings > Environment Variables):

```bash
# Database & Cache
DATABASE_URL=postgresql://your-database-connection-string
REDIS_URL=redis://your-redis-connection-string

# AI & Content Generation
OPENAI_API_KEY=sk-proj-your-openai-key
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...} # JSON string

# Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Authentication
JWT_SECRET=your-secure-jwt-secret-256-bits

# Email (Optional)
SENDGRID_API_KEY=SG.your-sendgrid-key
FROM_EMAIL=noreply@yourdomain.com

# Application
FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
```

### Step 5: Domain Configuration (Optional)

```bash
# Add custom domain in Vercel dashboard
# 1. Go to Settings > Domains
# 2. Add your domain
# 3. Configure DNS records as instructed
```

## File Structure

```
/
├── api/                          # Vercel serverless functions
│   ├── _lib/                     # Shared utilities
│   │   ├── database.js           # Database connection
│   │   ├── auth.js               # Authentication
│   │   ├── errorHandler.js       # Error handling
│   │   ├── rateLimiter.js        # Rate limiting
│   │   └── emailService.js       # Email service
│   ├── auth/                     # Authentication endpoints
│   │   ├── register.js           # POST /api/auth/register
│   │   ├── login.js              # POST /api/auth/login
│   │   └── verify-email.js       # POST /api/auth/verify-email
│   ├── voice/                    # Voice analysis endpoints
│   │   └── analyze.py            # POST /api/voice/analyze
│   ├── content/                  # Content generation endpoints
│   │   └── generate.js           # POST /api/content/generate
│   ├── package.json              # Node.js dependencies
│   └── requirements.txt          # Python dependencies
├── build/                        # React build output (auto-generated)
├── vercel.json                   # Vercel configuration
└── VERCEL_DEPLOYMENT_GUIDE.md    # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Email verification

### Voice Analysis
- `POST /api/voice/analyze` - Analyze voice from audio

### Content Generation
- `POST /api/content/generate` - Generate LinkedIn content

## Frontend Configuration

The React app is configured to:
- Use `/api` as the base URL for all API calls
- Work with Vercel's static hosting
- Handle authentication with JWT tokens
- Support all existing features (voice discovery, content generation, etc.)

## Testing Deployment

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
```

### 2. Test Authentication
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User"}'
```

### 3. Test Frontend
Visit `https://your-app.vercel.app` and test:
- User registration
- Email verification
- Voice discovery
- Content generation

## Limitations & Considerations

### Vercel Limits
- **Function Timeout**: 60 seconds (Pro plan) / 10 seconds (Hobby)
- **Function Size**: 50MB max
- **Memory**: 1GB max
- **Concurrent Executions**: 1000 (Pro) / 100 (Hobby)

### Performance Optimization
- Database connections are pooled
- Redis caching for rate limiting
- Minimal dependencies in functions
- Error handling with graceful fallbacks

### Monitoring
- Vercel provides built-in analytics
- Function logs available in dashboard
- Consider adding external monitoring (DataDog, Sentry)

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check connection string format
# Ensure database allows external connections
# Verify SSL settings
```

#### Function Timeouts
```bash
# Voice analysis may timeout on long audio
# Consider implementing async processing for large files
# Use function timeout optimization
```

#### Environment Variables
```bash
# Ensure all required variables are set
# Check variable names match exactly
# Verify sensitive data is properly encoded
```

### Debug Commands
```bash
# View function logs
vercel logs

# Test locally
vercel dev

# Check function details
vercel inspect
```

## Production Checklist

- [ ] Database schema deployed
- [ ] All environment variables configured
- [ ] Domain configured (if using custom domain)
- [ ] Email service working
- [ ] Voice analysis working
- [ ] Content generation working
- [ ] Authentication flow working
- [ ] Rate limiting functional
- [ ] Error handling tested
- [ ] Performance monitoring setup

## Support

For deployment issues:
1. Check Vercel documentation
2. Review function logs
3. Test API endpoints individually
4. Verify external service connections

## Cost Estimation

### Vercel Costs
- **Hobby Plan**: Free (100GB bandwidth, 100 function executions)
- **Pro Plan**: $20/month (1TB bandwidth, 1000 function executions)

### External Services
- **Database**: $0-25/month (depending on provider and usage)
- **Redis**: $0-10/month (depending on provider)
- **Storage**: $0-5/month (Supabase/AWS)
- **APIs**: Variable (OpenAI, Google Cloud based on usage)

**Total Estimated**: $20-60/month for production workload

---

**Ready to Deploy!** 🚀

Your Personal Brand DNA system is now configured for Vercel deployment with all core features maintained in a serverless architecture.