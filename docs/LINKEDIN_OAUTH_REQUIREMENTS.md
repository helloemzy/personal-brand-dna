# LinkedIn OAuth 2.0 Integration Requirements

## Overview
LinkedIn OAuth 2.0 implementation for the Personal Brand DNA System with strict safety controls and compliance measures.

## LinkedIn API Requirements

### 1. OAuth 2.0 Flow
**Authorization URL**: https://www.linkedin.com/oauth/v2/authorization
**Token URL**: https://www.linkedin.com/oauth/v2/accessToken

**Required Scopes**:
- `r_liteprofile` - Read member's lite profile
- `r_emailaddress` - Read member's email address
- `w_member_social` - Post, comment and like on behalf of member
- `r_member_social` - Retrieve posts, comments, and likes

### 2. API Rate Limits
- **Daily Limits**: 
  - 100 requests per day per user for posting
  - 1000 requests per day for reading
- **Throttling**: 
  - Maximum 30 requests per minute
  - Exponential backoff required for 429 responses

### 3. Content Requirements
- **Character Limits**:
  - Text posts: 3,000 characters
  - Article titles: 200 characters
  - Article descriptions: 600 characters
- **Media**:
  - Images: JPEG, PNG, GIF (max 10MB)
  - Videos: MP4 (max 200MB, 10 minutes)
- **URL Validation**: All URLs must be validated and accessible

## Safety Implementation Requirements

### 1. Manual Approval Workflow
**CRITICAL**: All posts must go through manual approval before publishing
- No automated posting without explicit user action
- Clear preview of content before publishing
- Confirmation dialog with safety warnings
- Audit trail of all publishing actions

### 2. Rate Limiting Controls
```javascript
const rateLimits = {
  postsPerDay: 10,          // Max posts per 24 hours
  postsPerHour: 3,          // Max posts per hour
  minimumInterval: 30,      // Minutes between posts
  weeklyLimit: 50,          // Max posts per week
  monthlyLimit: 150         // Max posts per month
};
```

### 3. Content Safety Checks
- Profanity filtering
- Spam detection
- Duplicate content prevention
- Sensitive information scanning
- Link validation and security check

### 4. Compliance Features
- GDPR compliance for data storage
- Right to deletion
- Activity logging
- Export functionality
- Consent management

## Technical Architecture

### 1. OAuth Token Storage
```sql
-- OAuth tokens table
CREATE TABLE linkedin_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL, -- Encrypted
  refresh_token TEXT,         -- Encrypted
  expires_at TIMESTAMP NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX idx_linkedin_oauth_user ON linkedin_oauth_tokens(user_id);
CREATE INDEX idx_linkedin_oauth_active ON linkedin_oauth_tokens(is_active, expires_at);
```

### 2. Publishing Queue
```sql
-- Publishing queue table
CREATE TABLE linkedin_publishing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES generated_content(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMP,
  published_at TIMESTAMP,
  linkedin_post_id VARCHAR(255),
  approval_status VARCHAR(50) DEFAULT 'pending_review',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status values: pending, approved, rejected, publishing, published, failed
-- Approval status: pending_review, approved, rejected, auto_approved
```

### 3. Rate Limiting Tracking
```sql
-- Rate limiting table
CREATE TABLE linkedin_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  count INTEGER DEFAULT 0,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, action_type, window_start)
);

-- Analytics tracking
CREATE TABLE linkedin_post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  linkedin_post_id VARCHAR(255) NOT NULL,
  queue_id UUID REFERENCES linkedin_publishing_queue(id),
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints Design

### 1. OAuth Flow
- `GET /api/linkedin/auth` - Initiate OAuth flow
- `GET /api/linkedin/callback` - Handle OAuth callback
- `POST /api/linkedin/disconnect` - Revoke access

### 2. Publishing Queue
- `POST /api/linkedin/queue` - Add content to queue
- `GET /api/linkedin/queue` - Get user's queue
- `PUT /api/linkedin/queue/:id/approve` - Approve for publishing
- `PUT /api/linkedin/queue/:id/reject` - Reject with reason
- `DELETE /api/linkedin/queue/:id` - Remove from queue

### 3. Publishing
- `POST /api/linkedin/publish/:id` - Manually publish approved content
- `GET /api/linkedin/posts` - Get published posts
- `GET /api/linkedin/analytics/:id` - Get post analytics

### 4. Rate Limiting
- `GET /api/linkedin/limits` - Get current rate limit status
- `GET /api/linkedin/compliance` - Get compliance report

## Security Implementation

### 1. Token Encryption
```javascript
// Use AES-256-GCM for token encryption
const crypto = require('crypto');

function encryptToken(token) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.LINKEDIN_TOKEN_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}
```

### 2. Request Signing
All LinkedIn API requests must include:
- Valid OAuth 2.0 bearer token
- User-Agent header with app information
- Request ID for tracking
- Timestamp for audit trail

### 3. Error Handling
- Implement exponential backoff for rate limits
- Graceful degradation for API failures
- User notification for publishing failures
- Automatic token refresh before expiry

## Compliance Checklist

- [ ] Implement manual approval workflow
- [ ] Add rate limiting controls
- [ ] Create audit logging system
- [ ] Build content safety checks
- [ ] Add GDPR compliance features
- [ ] Implement token encryption
- [ ] Create analytics tracking
- [ ] Add error handling and recovery
- [ ] Build user consent management
- [ ] Create compliance reporting

## LinkedIn Best Practices

1. **Content Quality**
   - Original, valuable content only
   - No spam or repetitive posts
   - Respect platform guidelines

2. **Timing**
   - Optimal posting times: 7-9 AM, 12-1 PM, 5-6 PM (user's timezone)
   - Avoid weekends for B2B content
   - Space posts at least 3 hours apart

3. **Engagement**
   - Monitor comments and respond
   - Don't auto-like or auto-comment
   - Build genuine connections

4. **Safety First**
   - Never store passwords
   - Use OAuth tokens only
   - Implement token rotation
   - Regular security audits