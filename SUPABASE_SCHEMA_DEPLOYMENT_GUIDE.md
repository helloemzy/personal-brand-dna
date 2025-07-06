# Supabase Schema Deployment Guide - Phone Auth & Auto-Posting

## 🚀 Quick Deployment Steps

### Step 1: Access Supabase SQL Editor
1. Log into your Supabase dashboard
2. Navigate to the SQL Editor (left sidebar)
3. Create a new query

### Step 2: Run the Consolidated Schema
1. Open the file: `CONSOLIDATED_PHONE_AUTH_SCHEMA.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click "Run" to execute

### Step 3: Verify Deployment
Run these verification queries in the SQL Editor:

```sql
-- Check all new tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN (
    'phone_otp_logs',
    'voice_calls',
    'discovery_conversations',
    'personal_brand_frameworks',
    'posting_tiers',
    'rss_feeds',
    'news_articles',
    'generated_posts',
    'posting_schedule',
    'post_performance',
    'subscription_management',
    'linkedin_connections'
)
ORDER BY table_name;

-- Verify users table has new columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('phone_number', 'phone_verified', 'posting_tier', 'brand_framework')
ORDER BY column_name;

-- Check posting tiers are populated
SELECT * FROM posting_tiers;
```

### Expected Results:
- ✅ 12 new tables created
- ✅ 4 new columns added to users table
- ✅ 3 posting tiers configured (passive, regular, aggressive)

## 🔍 Troubleshooting

### If you get permission errors:
- Ensure you're using the service_role key for schema modifications
- Check that RLS policies aren't blocking the operations

### If tables already exist:
- The script uses `IF NOT EXISTS` clauses, so it's safe to run multiple times
- Existing data will be preserved

### If indexes fail to create:
- They might already exist from previous migrations
- The script handles this gracefully with exception handling

## 📊 What Gets Created

### New Tables (12):
1. `phone_otp_logs` - OTP verification tracking
2. `voice_calls` - AI voice call sessions
3. `discovery_conversations` - Q&A from voice calls
4. `personal_brand_frameworks` - AI-generated brand profiles
5. `posting_tiers` - Subscription tier configurations
6. `rss_feeds` - User's RSS feed sources
7. `news_articles` - Fetched articles from feeds
8. `generated_posts` - AI-generated content
9. `posting_schedule` - Scheduled posts queue
10. `post_performance` - Analytics tracking
11. `subscription_management` - User subscriptions
12. `linkedin_connections` - OAuth tokens

### Updated Tables:
- `users` table gets 4 new columns:
  - `phone_number` - For phone auth
  - `phone_verified` - Verification status
  - `posting_tier` - Subscription level
  - `brand_framework` - AI analysis results

### Indexes Created:
- 20+ performance indexes for fast queries
- Covers all foreign keys and common lookups

### Security Features:
- Row Level Security (RLS) enabled on all tables
- Policies ensure users only see their own data
- Update triggers for timestamp management

## ✅ Success Confirmation

After running the schema, you should see:
```
Query returned successfully in XXms.
```

The final section of the script includes verification queries that you can run to confirm everything was created properly.

## 🎯 Next Steps

Once the schema is deployed:
1. Configure environment variables in Vercel
2. Set up external services (Twilio, Vapi.ai, LinkedIn)
3. Deploy the new API endpoints
4. Test the phone authentication flow

See `PHONE_AUTH_DEPLOYMENT_CHECKLIST.md` for detailed configuration steps.