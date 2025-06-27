# Personal Brand DNA API Documentation

## Overview

The Personal Brand DNA API is a collection of serverless functions deployed on Vercel that power the AI-driven personal branding platform. This API handles user authentication, voice analysis, and AI-powered content generation for LinkedIn and other professional platforms.

## Base URLs

- **Production**: `https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app/api`
- **Local Development**: `http://localhost:3001/api`

## Authentication

Most endpoints require authentication via JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Quick Start

### 1. Instant Demo Access (No Registration Required)

```bash
curl -X POST https://your-domain.vercel.app/api/auth/demo-login
```

Response:
```json
{
  "success": true,
  "message": "Demo login successful!",
  "user": {
    "id": "demo_1703088000000",
    "email": "demo@personalbranddna.com",
    "firstName": "Demo",
    "lastName": "User",
    "verified": true,
    "subscriptionTier": "professional"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "24h"
}
```

### 2. OTP Login (Passwordless)

#### Step 1: Send OTP
```bash
curl -X POST https://your-domain.vercel.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

#### Step 2: Verify OTP
```bash
curl -X POST https://your-domain.vercel.app/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "456789",
    "verificationToken": "eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20i..."
  }'
```

## API Endpoints

### Health Check

#### `GET /api/hello`
Simple health check endpoint to verify the API is running.

**Response:**
```json
{
  "message": "Hello from Personal Brand DNA API!",
  "timestamp": "2024-12-18T12:00:00.000Z",
  "success": true
}
```

### Authentication Endpoints

#### `POST /api/auth/demo-login`
Instant demo access without registration. Returns a 24-hour JWT token with professional-tier access.

#### `POST /api/auth/register`
Register a new user account with email verification.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "industry": "Technology",
  "role": "Software Engineer",
  "company": "Tech Corp",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

#### `POST /api/auth/login`
Traditional login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### `POST /api/auth/send-otp`
Send a one-time password for passwordless login.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### `POST /api/auth/verify-otp`
Verify OTP and complete passwordless login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "456789",
  "verificationToken": "eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20i...",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### `POST /api/auth/verify-email`
Verify email address using token from registration email.

**Request Body:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

### Content Generation

#### `POST /api/content/generate` (Requires Authentication)
Generate AI-powered LinkedIn content based on user's voice profile.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "topic": "Announcing my promotion to Senior Software Engineer",
  "contentType": "Post",
  "template": "career-milestone",
  "variations": 2
}
```

**Available Content Types:**
- `Post` - Standard LinkedIn post (150-300 words)
- `Article` - Long-form LinkedIn article
- `Story` - Personal narrative format
- `Poll` - Engagement-focused poll post
- `Carousel` - Multi-slide visual post

**Available Templates:**
- `career-milestone` - Career achievements and milestones
- `industry-trend` - Industry analysis and insights
- `learning-story` - Personal learning experiences
- `company-news` - Company announcements
- `networking` - Building professional connections
- `thought-leadership` - Opinion pieces
- `quick-tip` - Professional tips and advice
- `achievement` - Celebrating accomplishments
- `learning-development` - Professional development
- `problem-solution` - Case studies

**Response:**
```json
{
  "success": true,
  "message": "Content generated successfully",
  "data": {
    "topic": "Announcing my promotion to Senior Software Engineer",
    "contentType": "Post",
    "template": "career-milestone",
    "templateInfo": {
      "name": "Career Milestone Achievement",
      "structure": "Hook → Achievement → Impact → Lesson → CTA"
    },
    "variations": [
      {
        "id": 1,
        "content": "🎯 Thrilled to announce my promotion to Senior Software Engineer...",
        "contentType": "Post",
        "template": "career-milestone",
        "createdAt": "2024-12-18T12:00:00.000Z"
      }
    ],
    "voiceProfile": {
      "summary": "Professional yet approachable communication style",
      "lastAnalysis": "2024-12-17T10:00:00.000Z"
    }
  }
}
```

### Brand Workshop Endpoints

#### `POST /api/workshop/start` (Requires Authentication)
Start a new brand workshop session.

**Request Body:**
```json
{
  "sessionType": "brand_workshop"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionType": "brand_workshop",
    "status": "in_progress",
    "currentStep": 1,
    "startedAt": "2025-06-27T10:00:00Z"
  }
}
```

#### `GET /api/workshop/session/{sessionId}` (Requires Authentication)
Get workshop session data and progress.

#### `POST /api/workshop/session/{sessionId}/save` (Requires Authentication)
Save workshop progress.

**Request Body:**
```json
{
  "currentStep": 2,
  "values": {
    "selected": ["innovation", "integrity", "growth"],
    "custom": [{"name": "sustainability", "category": "custom", "ranking": 4}],
    "rankings": {"innovation": 5, "integrity": 5, "growth": 4}
  },
  "tonePreferences": {
    "formalCasual": 65,
    "conciseDetailed": 40,
    "analyticalCreative": 55,
    "seriousPlayful": 30
  }
}
```

#### `POST /api/workshop/session/{sessionId}/complete` (Requires Authentication)
Complete workshop and generate brand profile.

#### `GET /api/workshop/sessions` (Requires Authentication)
Get all user workshop sessions.

### News Integration Endpoints

#### `GET /api/news/sources` (Requires Authentication)
Get user's configured news sources.

#### `POST /api/news/sources` (Requires Authentication)
Add a new news source.

**Request Body:**
```json
{
  "sourceName": "TechCrunch",
  "sourceUrl": "https://techcrunch.com/feed/",
  "sourceType": "rss",
  "categories": ["technology", "startups"],
  "fetchFrequency": 6
}
```

#### `DELETE /api/news/sources?sourceId={id}` (Requires Authentication)
Remove a news source.

#### `GET /api/news/articles` (Requires Authentication)
Get relevant articles with AI scoring.

**Query Parameters:**
- `sourceId` - Filter by specific source
- `category` - Filter by category
- `minRelevance` - Minimum relevance score (0-100)
- `saved` - Show only saved articles
- `used` - Show only used articles
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset
- `sortBy` - Sort by 'relevance' or 'date'

### Content Calendar Endpoints

#### `GET /api/calendar/events` (Requires Authentication)
Get calendar events.

**Query Parameters:**
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)
- `status` - Filter by status (draft, scheduled, published)
- `contentType` - Filter by content type

#### `POST /api/calendar/events` (Requires Authentication)
Create calendar event.

**Request Body:**
```json
{
  "title": "Industry Insights Post",
  "description": "Analysis of recent AI trends",
  "contentType": "post",
  "scheduledDate": "2025-06-28",
  "scheduledTime": "10:00:00",
  "timeZone": "America/New_York",
  "contentId": "optional-content-id"
}
```

#### `PUT /api/calendar/events?eventId={id}` (Requires Authentication)
Update calendar event.

#### `DELETE /api/calendar/events?eventId={id}` (Requires Authentication)
Delete calendar event.

### LinkedIn Integration Endpoints

#### `GET /api/linkedin/auth` (Requires Authentication)
Get LinkedIn OAuth URL.

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://www.linkedin.com/oauth/v2/authorization?...",
    "message": "Redirect user to this URL to authenticate with LinkedIn"
  }
}
```

#### `GET /api/linkedin/callback` 
Handle LinkedIn OAuth callback (automatically redirects).

#### `GET /api/linkedin/status` (Requires Authentication)
Check LinkedIn connection status and rate limits.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "linkedinUserId": "urn:li:person:ABC123",
    "linkedinName": "John Doe",
    "expiresAt": "2025-12-27T10:00:00Z",
    "rateLimit": {
      "daily": {"used": 3, "limit": 10, "remaining": 7},
      "hourly": {"used": 1, "limit": 3, "remaining": 2},
      "weekly": {"used": 15, "limit": 50, "remaining": 35},
      "monthly": {"used": 45, "limit": 150, "remaining": 105}
    }
  }
}
```

#### `POST /api/linkedin/queue` (Requires Authentication)
Add content to publishing queue.

**Request Body:**
```json
{
  "contentText": "Excited to share insights on AI in content creation...",
  "mediaUrls": [],
  "scheduledFor": "2025-06-28T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lq_123456",
    "status": "pending",
    "safetyCheckResults": {
      "passed": true,
      "checks": {
        "length": {"passed": true},
        "hashtags": {"passed": true},
        "urls": {"passed": true},
        "profanity": {"passed": true},
        "spam": {"passed": true},
        "sensitive": {"passed": true}
      },
      "warnings": ["Consider adding hashtags for better reach"]
    }
  },
  "message": "Content added to publishing queue. Manual approval required before publishing."
}
```

#### `GET /api/linkedin/queue` (Requires Authentication)
View publishing queue.

**Query Parameters:**
- `status` - Filter by status (pending, approved, published, rejected)
- `limit` - Results per page
- `offset` - Pagination offset

### Monitoring Endpoints

#### `GET /api/monitoring/health`
Comprehensive health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-27T10:00:00Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "latency": 23
    },
    "cache": {
      "status": "healthy",
      "latency": 5
    },
    "externalApis": {
      "openai": {"status": "healthy", "latency": 245},
      "google": {"status": "healthy"},
      "stripe": {"status": "not_configured"},
      "linkedin": {"status": "not_configured"}
    }
  },
  "metrics": {
    "uptime": 864000,
    "uptimeHuman": "10d",
    "heapUsed": 45234688,
    "heapTotal": 67108864,
    "rss": 89456789
  }
}
```

#### `POST /api/monitoring/error`
Report client-side errors.

**Request Body:**
```json
{
  "data": {
    "message": "Error message",
    "name": "ErrorType",
    "stack": "Error stack trace"
  },
  "context": {
    "userId": "user123",
    "url": "/dashboard",
    "source": "react-error-boundary"
  }
}
```

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `METHOD_NOT_ALLOWED` - Invalid HTTP method
- `VALIDATION_ERROR` - Request validation failed
- `USER_EXISTS` - User already registered
- `INVALID_CREDENTIALS` - Invalid email or password
- `UNAUTHORIZED` - Missing or invalid authentication token
- `VOICE_PROFILE_REQUIRED` - User needs to complete voice discovery
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `GENERATION_ERROR` - Content generation failed

## Rate Limiting

- Content generation: 10 requests per minute
- Other endpoints: 100 requests per minute

## Development Setup

### Environment Variables

Create a `.env` file with:

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pbdna_dev

# JWT
JWT_SECRET=your-secret-key

# Email (optional for development)
SENDGRID_API_KEY=SG...

# Google Cloud (for voice analysis)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### Local Testing

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Test endpoints:
```bash
# Health check
curl http://localhost:3001/api/hello

# Demo login
curl -X POST http://localhost:3001/api/auth/demo-login
```

## Security Considerations

1. **JWT Tokens**: Tokens expire after 24 hours
2. **Password Requirements**: Strong password policy enforced
3. **Rate Limiting**: Prevents API abuse
4. **Input Validation**: All inputs are validated and sanitized
5. **HTTPS Only**: Production API requires HTTPS

## Support

For API issues or questions:
- Email: support@personalbranddna.com
- GitHub Issues: [Repository Issues](https://github.com/helloemzy/personal-brand-dna/issues)