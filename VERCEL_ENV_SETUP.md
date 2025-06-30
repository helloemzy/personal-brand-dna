# Vercel Environment Variables Setup Guide

## Current Status
✅ Frontend is working (registration page loads)
❌ API returns 500 errors (missing environment variables)

## Required Environment Variables

### 1. Go to Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Click on your "personal-brand-dna" project
3. Go to "Settings" tab
4. Click on "Environment Variables" in the left sidebar

### 2. Add These Variables

#### Critical Variables (Required for basic functionality):

**JWT_SECRET**
- Value: `your-super-secret-jwt-key-change-this`
- Description: Used for signing JWT tokens

**DATABASE_URL** 
- Value: Get from Supabase → Settings → Database → Connection string
- Example: `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres`

**SUPABASE_URL**
- Value: Get from Supabase → Settings → API → Project URL
- Example: `https://[project].supabase.co`

**SUPABASE_ANON_KEY**
- Value: Get from Supabase → Settings → API → anon/public key
- Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### Optional Variables (For full features):

**OPENAI_API_KEY**
- Value: Your OpenAI API key
- Get from: https://platform.openai.com/api-keys

**REDIS_URL**
- Value: Your Upstash Redis URL
- Get from: https://console.upstash.com/

**SENDGRID_API_KEY**
- Value: Your SendGrid API key (for emails)
- Get from: https://app.sendgrid.com/

**GOOGLE_APPLICATION_CREDENTIALS**
- Value: Path to Google credentials JSON
- Note: For Vercel, you might need to use base64 encoding

### 3. Apply to All Environments
Make sure to check:
- ✅ Production
- ✅ Preview
- ✅ Development

### 4. Redeploy
After adding variables:
1. Go to "Deployments" tab
2. Click on the latest deployment
3. Click "..." menu → "Redeploy"

## Testing After Setup

Once environment variables are added and redeployed:

```bash
# Test registration
curl -X POST https://personal-brand-dna.vercel.app/api/auth?action=register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# Test demo login
curl -X POST https://personal-brand-dna.vercel.app/api/auth?action=demo-login \
  -H "Content-Type: application/json"
```

## Quick Database Setup (if needed)

If you don't have a Supabase database yet:

1. Go to https://supabase.com
2. Create a new project (free tier is fine)
3. Wait for it to provision
4. Go to SQL Editor and run:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add other tables as needed...
```

## Troubleshooting

If you still get 500 errors after adding environment variables:

1. Check Vercel Function logs:
   - Go to Functions tab in Vercel
   - Click on the failing function
   - View logs for specific error

2. Common issues:
   - Database connection string format
   - Missing required variables
   - Incorrect variable names (case sensitive)

3. Test with minimal setup:
   - Start with just JWT_SECRET
   - Add database variables
   - Then add optional services

## Success Indicators

When properly configured:
- Registration will create user accounts
- Demo login will return JWT token
- No more 500 errors on API calls
- Users can log in and access protected routes