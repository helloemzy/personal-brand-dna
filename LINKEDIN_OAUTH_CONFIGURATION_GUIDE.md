# LinkedIn OAuth Configuration Guide

## 🎯 Overview
LinkedIn OAuth enables safe, automated posting to LinkedIn with user consent. This guide covers setting up LinkedIn OAuth for the auto-posting system.

## 🚀 Quick Setup Steps

### 1. Create LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Click "Create app"
3. Fill in the required information:
   - **App name**: "Personal Brand DNA"
   - **LinkedIn Page**: Select your company page (or create one)
   - **Privacy policy URL**: https://your-domain.com/privacy
   - **App logo**: Upload your logo (300x300px)

### 2. Configure App Settings

#### Products
1. In your app dashboard, go to "Products" tab
2. Request access to:
   - **Share on LinkedIn** (for posting)
   - **Sign In with LinkedIn** (for authentication)
3. Wait for approval (usually instant for basic features)

#### OAuth 2.0 Settings
1. Go to "Auth" tab
2. Add redirect URLs:
   ```
   https://your-app.vercel.app/api/linkedin/callback
   http://localhost:3000/api/linkedin/callback
   ```

#### App Credentials
1. Go to "Auth" tab
2. Copy your credentials:
   - **Client ID**: `86xxxxxxxxxxxxxx`
   - **Client Secret**: `xxxxxxxxxxxxxxxx` (keep this secret!)

### 3. Required OAuth Scopes
For the auto-posting system, you need these scopes:
- `r_liteprofile` - Read member's lite profile
- `r_emailaddress` - Read member's email address
- `w_member_social` - Post, comment and like on behalf of the member

### 4. Add to Vercel Environment Variables
```bash
LINKEDIN_CLIENT_ID=86xxxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxxxx
LINKEDIN_REDIRECT_URI=https://your-app.vercel.app/api/linkedin/callback
```

## 🔐 OAuth Flow Implementation

### 1. Authorization URL
When users click "Connect LinkedIn", redirect them to:
```
https://www.linkedin.com/oauth/v2/authorization?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  state=RANDOM_STRING&
  scope=r_liteprofile%20r_emailaddress%20w_member_social
```

### 2. Handle Callback
LinkedIn will redirect back with:
```
https://your-app.vercel.app/api/linkedin/callback?
  code=AUTH_CODE&
  state=RANDOM_STRING
```

### 3. Exchange Code for Token
```javascript
POST https://www.linkedin.com/oauth/v2/accessToken
{
  grant_type: "authorization_code",
  code: "AUTH_CODE",
  client_id: "YOUR_CLIENT_ID",
  client_secret: "YOUR_CLIENT_SECRET",
  redirect_uri: "YOUR_REDIRECT_URI"
}
```

### 4. Store Access Token
- Tokens expire after 60 days
- Store encrypted in database
- Include expiration timestamp

## 📝 Posting to LinkedIn

### Content Format
```javascript
{
  "author": "urn:li:person:MEMBER_ID",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": {
        "text": "Your post content here #hashtag"
      },
      "shareMediaCategory": "NONE"
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

### Rate Limits
- **Daily limit**: 100 shares per day
- **Throttling**: Max 10 requests per minute
- **Recommendation**: Space posts at least 30 minutes apart

## 🛡️ Safety Features

### 1. Content Validation
Before posting, validate:
- Length: Max 3000 characters
- Hashtags: Max 30 hashtags
- URLs: Max 10 URLs
- No prohibited content

### 2. Rate Limiting
Implement tier-based limits:
- **Passive**: 2-3 posts/week
- **Regular**: 5-7 posts/week
- **Aggressive**: 14-21 posts/week

### 3. Manual Approval
For safety, require manual approval:
- 24-hour window (Passive tier)
- 2-hour window (Regular tier)
- Instant with override (Aggressive tier)

### 4. Compliance Logging
Log all activities:
- Authorization attempts
- Posts published
- Errors and failures
- Rate limit hits

## 🧪 Testing Your Integration

### 1. Test Authorization Flow
```bash
# Generate auth URL
curl https://your-app.vercel.app/api/linkedin/auth-url?userId=USER_ID

# Exchange code for token (after user authorizes)
curl -X POST https://your-app.vercel.app/api/linkedin/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AUTH_CODE_FROM_LINKEDIN",
    "state": "STATE_STRING",
    "userId": "USER_ID"
  }'
```

### 2. Test Posting
```bash
curl -X POST https://your-app.vercel.app/api/linkedin-autoposter/post-now \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "postId": "POST_ID"
  }'
```

### 3. Expected Responses
Success:
```json
{
  "message": "Posted successfully",
  "postUrl": "https://www.linkedin.com/feed/update/urn:li:share:123456/"
}
```

## 📊 Analytics & Monitoring

### Track Metrics
After posting, track:
- Views (impressions)
- Likes (reactions)
- Comments
- Shares
- Click-through rate

### API Endpoints for Analytics
```
GET https://api.linkedin.com/v2/socialActions/{shareUrn}
GET https://api.linkedin.com/v2/shares/{shareUrn}
```

### Performance Tracking Schedule
- 1 hour after posting
- 24 hours after posting
- 7 days after posting

## 🚨 Common Issues

### "Invalid redirect URI"
- Ensure redirect URI matches exactly (including https://)
- No trailing slashes
- Check for typos

### "Invalid scope"
- Verify app has requested products approved
- Check scope spelling
- Ensure proper URL encoding

### "Token expired"
- Tokens last 60 days
- Implement token refresh logic
- Monitor expiration dates

### "Rate limit exceeded"
- Check daily/hourly limits
- Implement backoff strategy
- Monitor usage patterns

## 💰 Cost Considerations
LinkedIn API is free, but consider:
- Development time for integration
- Server costs for scheduled jobs
- Database storage for analytics
- Monitoring and logging costs

## 🔒 Security Best Practices

### 1. Token Storage
- Encrypt tokens before storing
- Use environment variables for keys
- Never expose tokens in logs

### 2. User Consent
- Clear explanation of permissions
- Easy disconnect option
- Regular permission audits

### 3. Error Handling
- Never expose LinkedIn errors to users
- Log errors securely
- Implement retry logic

### 4. Data Protection
- Minimal data retention
- Regular data purges
- GDPR compliance

## 📋 Implementation Checklist

### Initial Setup
- [ ] Create LinkedIn app
- [ ] Configure OAuth settings
- [ ] Add redirect URLs
- [ ] Request necessary products
- [ ] Add environment variables

### Integration
- [ ] Implement OAuth flow
- [ ] Test authorization
- [ ] Implement posting logic
- [ ] Add safety validations
- [ ] Set up rate limiting

### Testing
- [ ] Test with personal account
- [ ] Verify post formatting
- [ ] Check rate limits
- [ ] Test error scenarios
- [ ] Monitor analytics

### Production
- [ ] Enable compliance logging
- [ ] Set up monitoring alerts
- [ ] Document user flow
- [ ] Create support guides
- [ ] Plan for scale

## 🎯 Next Steps

1. **Complete LinkedIn app setup**
2. **Add environment variables to Vercel**
3. **Test OAuth flow end-to-end**
4. **Implement content validation**
5. **Set up monitoring**
6. **Launch with small test group**

Remember: LinkedIn posting should enhance professional presence while respecting platform guidelines and user preferences. Always prioritize quality over quantity!