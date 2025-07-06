# 🚀 Phone Auth & Auto-Posting Deployment Steps

## Current Status (As of this session)

### ✅ Completed in This Session:
1. **Database Schema** - `CONSOLIDATED_PHONE_AUTH_SCHEMA.sql` is ready
2. **API Endpoints** - All 5 new API endpoints are implemented:
   - `/api/phone-auth/*` - Phone authentication
   - `/api/voice-discovery/*` - AI voice calls
   - `/api/rss-monitoring/*` - RSS feed management
   - `/api/content-automation/*` - Content generation
   - `/api/linkedin-autoposter/*` - LinkedIn posting
3. **Frontend Integration** - Updated:
   - Added phone auth methods to `authAPI.ts`
   - Added `/phone-login` route to `App.tsx`
   - Added `/brand-framework` route to `App.tsx`
   - Added phone login link to login page
4. **Documentation** - All guides are created

### 🔄 Next Steps Required:

## Step 1: Install Dependencies (2 minutes)
```bash
cd /Users/emily-gryfyn/Documents/pbdna
npm install react-phone-number-input
```

## Step 2: Deploy Database Schema (5 minutes)
1. Log into Supabase dashboard
2. Go to SQL Editor
3. Copy entire contents of `CONSOLIDATED_PHONE_AUTH_SCHEMA.sql`
4. Paste and run in SQL Editor
5. Verify with the test queries provided in the file

## Step 3: Configure External Services (30 minutes)

### Twilio Setup (10 min)
1. Create account at https://www.twilio.com
2. Get Account SID and Auth Token
3. Purchase a phone number for SMS
4. Note down credentials

### Vapi.ai Setup (10 min)
1. Create account at https://vapi.ai
2. Get API key
3. Configure voice assistant
4. Set webhook URL to: `https://personal-brand-dna.vercel.app/api/voice-discovery/webhook`

### LinkedIn OAuth Setup (10 min)
1. Go to https://www.linkedin.com/developers/
2. Create new app
3. Add OAuth redirect URL: `https://personal-brand-dna.vercel.app/api/linkedin/callback`
4. Request scopes: r_liteprofile, r_emailaddress, w_member_social
5. Note Client ID and Secret

## Step 4: Add Environment Variables to Vercel (10 minutes)

Go to Vercel Dashboard → Settings → Environment Variables and add:

```env
# Authentication
JWT_SECRET=[Generate 32 chars: use https://1password.com/password-generator/]
JWT_REFRESH_SECRET=[Generate another 32 chars]

# Twilio
TWILIO_ACCOUNT_SID=[From Twilio Console]
TWILIO_AUTH_TOKEN=[From Twilio Console]
TWILIO_PHONE_NUMBER=[Your Twilio phone like +15551234567]

# Voice AI
VOICE_AI_API_KEY=[From Vapi.ai]
VOICE_AI_BASE_URL=https://api.vapi.ai
VOICE_AI_PROVIDER=vapi

# LinkedIn
LINKEDIN_CLIENT_ID=[From LinkedIn App]
LINKEDIN_CLIENT_SECRET=[From LinkedIn App]
LINKEDIN_REDIRECT_URI=https://personal-brand-dna.vercel.app/api/linkedin/callback

# Security
ENCRYPTION_KEY=[Generate 32 chars]
```

## Step 5: Deploy to Vercel (5 minutes)
```bash
# From project root
vercel --prod
```

## Step 6: Test Deployment (15 minutes)

### Test Phone Auth:
```bash
curl -X POST https://personal-brand-dna.vercel.app/api/phone-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "5551234567", "countryCode": "+1"}'
```

### Test Frontend:
1. Go to https://personal-brand-dna.vercel.app/phone-login
2. Enter your phone number
3. Complete the OTP verification
4. Verify voice call initiates

## Step 7: Configure Cron Jobs (5 minutes)

Add to `vercel.json`:
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

## Total Time: ~1 hour

## 🎯 Success Checklist:
- [ ] Dependencies installed
- [ ] Database schema deployed
- [ ] Twilio configured
- [ ] Vapi.ai configured
- [ ] LinkedIn OAuth configured
- [ ] Environment variables added
- [ ] Deployed to Vercel
- [ ] Phone auth tested
- [ ] Voice call tested

## 🚨 Troubleshooting:

### If OTP not received:
- Check Twilio logs
- Verify phone number format
- Ensure Twilio account has balance

### If voice call fails:
- Check Vapi.ai API key
- Verify webhook URL is accessible
- Check browser console for errors

### If LinkedIn OAuth fails:
- Verify redirect URI matches exactly
- Check Client ID and Secret
- Ensure scopes are approved

## 📞 Support:
- Database issues: Check Supabase logs
- API issues: Check Vercel function logs
- SMS issues: Check Twilio console
- Voice issues: Check Vapi.ai dashboard