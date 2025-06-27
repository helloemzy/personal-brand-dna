# BrandHack Features Documentation

## Overview

BrandHack is a comprehensive suite of advanced features that enhance the Personal Brand DNA System with sophisticated brand strategy tools and content automation capabilities. This documentation covers all BrandHack features, their implementation, and usage.

## Table of Contents

1. [Brand Workshop](#brand-workshop)
2. [News Integration (Newshack)](#news-integration-newshack)
3. [Content Calendar](#content-calendar)
4. [LinkedIn Automation](#linkedin-automation)
5. [Integration Architecture](#integration-architecture)
6. [API Reference](#api-reference)

## Brand Workshop

### Overview
The Brand Workshop is a comprehensive 5-step discovery process that creates a detailed brand profile through interactive exercises and AI-powered analysis.

### Features

#### 1. Values Audit
**Purpose**: Identify core professional values that guide decision-making and communication.

**Implementation**:
- 30+ professional values across 6 categories
- Custom value addition capability
- 1-5 importance ranking system
- Visual card selection interface

**User Flow**:
1. Select values from predefined categories
2. Add custom values if needed
3. Rank each value's importance
4. Review and confirm selections

#### 2. Tone Preferences
**Purpose**: Define communication style across multiple dimensions.

**Dimensions**:
- Formal ↔ Casual (professional vs. conversational)
- Concise ↔ Detailed (brief vs. comprehensive)
- Analytical ↔ Creative (data-driven vs. imaginative)
- Serious ↔ Playful (professional vs. lighthearted)

**Features**:
- Interactive slider controls
- Real-time tone preview
- Preset profiles for quick selection
- Tone combination examples

#### 3. Audience Builder
**Purpose**: Create detailed personas of target audience members.

**Persona Attributes**:
- Name and job title
- Industry and company size
- Key pain points
- Professional goals
- Preferred communication style
- Content preferences

**Features**:
- Multiple persona support
- Template personas for common roles
- Persona comparison view
- Content recommendations per persona

#### 4. Writing Sample Analysis
**Purpose**: Extract authentic writing style from user's existing content.

**Process**:
1. User provides 150-1000 word sample
2. AI analyzes style elements:
   - Sentence structure
   - Vocabulary complexity
   - Tone consistency
   - Unique phrases
3. Generates style fingerprint

**Supported Formats**:
- Direct text input
- File upload (.txt, .doc)
- LinkedIn post import

#### 5. Personality Quiz
**Purpose**: Assess professional personality traits for content personalization.

**Assessment Areas**:
- Leadership style
- Innovation approach
- Analytical thinking
- Collaboration preferences
- Strategic planning

**Implementation**:
- 10 strategic questions
- Multiple choice format
- Automatic scoring
- Personality profile generation

### Workshop Completion
Upon completing all 5 steps, the system:
1. Generates comprehensive brand profile
2. Creates voice signature
3. Stores profile for content generation
4. Provides brand summary report

### Technical Implementation

**Frontend Components**:
```typescript
src/components/workshop/
├── WorkshopContainer.tsx       // Main workshop orchestrator
├── steps/
│   ├── ValuesAudit.tsx        // Values selection
│   ├── TonePreferences.tsx    // Tone sliders
│   ├── AudienceBuilder.tsx    // Persona creation
│   ├── WritingSample.tsx      // Writing analysis
│   └── PersonalityQuiz.tsx    // Quiz component
└── WorkshopProgress.tsx        // Progress indicator
```

**State Management**:
```typescript
// Redux slice structure
workshopSlice: {
  currentStep: number,
  completedSteps: number[],
  values: ValuesState,
  tonePreferences: ToneState,
  audiencePersonas: PersonaState[],
  writingSample: WritingState,
  personalityQuiz: QuizState[]
}
```

**API Endpoints**:
- `POST /api/workshop/start` - Initialize session
- `GET /api/workshop/session/{id}` - Retrieve progress
- `POST /api/workshop/session/{id}/save` - Save progress
- `POST /api/workshop/session/{id}/complete` - Finalize workshop

## News Integration (Newshack)

### Overview
Intelligent news aggregation system that curates relevant industry content and generates content ideas based on trending topics.

### Features

#### News Source Management
**Supported Sources**:
- RSS feeds
- JSON APIs
- Major news outlets
- Industry publications
- Company blogs

**Configuration Options**:
- Update frequency (1-24 hours)
- Category filtering
- Keyword alerts
- Source prioritization

#### Relevance Scoring
**AI-Powered Analysis**:
1. Content embedding generation
2. Similarity scoring against brand profile
3. Topic relevance calculation
4. Trending topic detection

**Scoring Factors**:
- Brand alignment (40%)
- Audience interest (30%)
- Trending potential (20%)
- Recency (10%)

#### News Dashboard
**Features**:
- Chronological feed view
- Relevance-based sorting
- Category filtering
- Save for later functionality
- Share to content calendar
- Quick content generation

**Metrics Displayed**:
- Relevance score (0-100)
- Read time estimate
- Engagement potential
- Related topics

#### Content Idea Generation
**Process**:
1. Select relevant article
2. AI analyzes key points
3. Generates 3-5 content angles
4. Provides writing prompts
5. Links to content generator

### Technical Implementation

**Database Schema**:
```sql
-- News source configuration
news_sources (
  id, user_id, source_name, source_url, 
  source_type, categories, fetch_frequency_hours
)

-- Aggregated articles
news_articles (
  id, source_id, title, description, content_snippet,
  article_url, published_at, relevance_score, relevance_factors
)

-- User interactions
user_article_interactions (
  user_id, article_id, is_saved, is_used, user_notes
)
```

**Background Worker**:
```javascript
// Runs every hour
async function fetchAndScoreNews() {
  const sources = await getActiveNewsSources();
  
  for (const source of sources) {
    const articles = await fetchArticles(source);
    const scoredArticles = await scoreRelevance(articles, userProfile);
    await storeArticles(scoredArticles);
  }
}
```

## Content Calendar

### Overview
Visual scheduling interface for planning and managing content publication across multiple platforms.

### Features

#### Calendar Views
**Display Options**:
- Month view - Overview of all content
- Week view - Detailed daily planning
- Day view - Hour-by-hour schedule
- List view - Sortable content list

#### Content Management
**Capabilities**:
- Drag-and-drop rescheduling
- Bulk operations (move, duplicate, delete)
- Content series management
- Recurring content patterns
- Color-coded categories

#### Scheduling Features
**Smart Scheduling**:
- Optimal time suggestions
- Conflict detection
- Platform-specific timing
- Time zone management
- Holiday awareness

#### Content States
**Workflow States**:
- `draft` - In progress
- `scheduled` - Ready to publish
- `published` - Live content
- `archived` - Past content

### Integration Features

#### Platform Integration
- LinkedIn post scheduling
- Content generation linking
- Analytics connection
- Team collaboration

#### Calendar Sync
- Export to Google Calendar
- iCal feed generation
- Email reminders
- Mobile notifications

### Technical Implementation

**Frontend Components**:
```typescript
src/components/calendar/
├── CalendarView.tsx           // Main calendar component
├── EventCard.tsx             // Individual content cards
├── SchedulingModal.tsx       // Content scheduling
├── BulkOperations.tsx        // Multi-select actions
└── CalendarFilters.tsx       // View filters
```

**Database Schema**:
```sql
content_calendar_events (
  id, user_id, content_id, title, description,
  content_type, status, scheduled_date, scheduled_time,
  time_zone, series_id, reminder_sent
)

content_series (
  id, user_id, series_name, series_type,
  total_parts, recurrence_pattern
)
```

## LinkedIn Automation

### Overview
Safe, compliant LinkedIn integration with manual approval workflow and comprehensive analytics.

### Key Features

#### OAuth Integration
**Security Features**:
- Secure OAuth 2.0 flow
- Token encryption (AES-256-GCM)
- Automatic token refresh
- Revocation support

**Permissions Requested**:
- Basic profile access
- Post creation
- Analytics reading
- Connection information

#### Publishing Queue
**Safety-First Approach**:
- Manual approval required
- Content preview
- Safety validation
- Rate limit enforcement

**Queue Management**:
- Priority ordering
- Scheduled publishing
- Bulk operations
- Failed post retry

#### Safety Controls

**Content Validation**:
1. Length check (3000 char limit)
2. Hashtag limit (30 max)
3. URL limit (10 max)
4. Profanity detection
5. Spam prevention
6. Duplicate detection (7-day window)
7. Sensitive info scanning

**Rate Limiting**:
- 30-minute minimum interval
- 3 posts per hour max
- 10 posts per day max
- 50 posts per week max
- 150 posts per month max

#### Analytics Dashboard

**Metrics Tracked**:
- Impressions and reach
- Engagement rate
- Click-through rate
- Follower growth
- Best performing content
- Optimal posting times

**Insights Generated**:
- Content type performance
- Hashtag effectiveness
- Post length impact
- Time/day analysis
- Audience demographics

### Compliance Features

**GDPR Compliance**:
- Data encryption at rest
- Export functionality
- Deletion options
- Consent management
- Audit logging

**LinkedIn ToS Compliance**:
- No automation of actual posting
- Respect for rate limits
- Authentic content only
- No engagement manipulation

### Technical Implementation

**API Endpoints**:
```javascript
// OAuth flow
GET  /api/linkedin/auth         // Initiate OAuth
GET  /api/linkedin/callback     // Handle callback
POST /api/linkedin/disconnect   // Revoke access

// Queue management
POST /api/linkedin/queue        // Add to queue
GET  /api/linkedin/queue        // View queue
PUT  /api/linkedin/queue/:id/approve    // Approve
PUT  /api/linkedin/queue/:id/reject     // Reject
POST /api/linkedin/publish/:id  // Publish

// Analytics
GET  /api/linkedin/analytics    // View metrics
GET  /api/linkedin/insights     // Get insights
```

**Security Implementation**:
```javascript
// Token encryption
const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv(algorithm, key, iv);
```

## Integration Architecture

### Data Flow
```
User Input → Brand Workshop → Brand Profile
                    ↓
News Sources → Relevance Scoring → Content Ideas
                    ↓
Content Generation ← Brand Profile
                    ↓
Content Calendar → Publishing Queue → LinkedIn
                    ↓
                Analytics
```

### Cross-Feature Integration

#### Workshop → Content Generation
- Brand profile informs tone
- Values guide content themes
- Audience personas target content

#### News → Content Generation
- Trending topics inspire content
- Article summaries provide context
- Industry insights enhance relevance

#### Calendar → LinkedIn
- Scheduled posts queue automatically
- Publishing respects calendar timing
- Analytics feed back to calendar

#### Analytics → All Features
- Performance data improves generation
- Engagement metrics refine targeting
- Insights optimize scheduling

## API Reference

### Workshop APIs

#### Start Workshop Session
```http
POST /api/workshop/start
Authorization: Bearer {token}

Request:
{
  "sessionType": "brand_workshop"
}

Response:
{
  "sessionId": "ws_123456",
  "currentStep": 1,
  "startedAt": "2025-06-27T10:00:00Z"
}
```

#### Save Workshop Progress
```http
POST /api/workshop/session/{sessionId}/save
Authorization: Bearer {token}

Request:
{
  "currentStep": 2,
  "values": {
    "selected": ["innovation", "integrity", "growth"],
    "rankings": { "innovation": 5, "integrity": 5, "growth": 4 }
  }
}
```

### News APIs

#### Add News Source
```http
POST /api/news/sources
Authorization: Bearer {token}

Request:
{
  "sourceName": "TechCrunch",
  "sourceUrl": "https://techcrunch.com/feed/",
  "sourceType": "rss",
  "categories": ["technology", "startups"]
}
```

#### Get Relevant Articles
```http
GET /api/news/articles?minRelevance=70&limit=20
Authorization: Bearer {token}

Response:
{
  "articles": [{
    "id": "art_123",
    "title": "AI Transforms Content Creation",
    "relevanceScore": 92,
    "relevanceLevel": "very_high",
    "publishedAt": "2025-06-27T09:00:00Z"
  }]
}
```

### Calendar APIs

#### Create Calendar Event
```http
POST /api/calendar/events
Authorization: Bearer {token}

Request:
{
  "title": "Industry Insights Post",
  "contentType": "post",
  "scheduledDate": "2025-06-28",
  "scheduledTime": "10:00:00",
  "timeZone": "America/New_York"
}
```

### LinkedIn APIs

#### Queue Content
```http
POST /api/linkedin/queue
Authorization: Bearer {token}

Request:
{
  "contentText": "Excited to share insights on AI in content creation...",
  "scheduledFor": "2025-06-28T14:00:00Z"
}

Response:
{
  "queueId": "lq_123",
  "status": "pending",
  "safetyResults": {
    "passed": true,
    "checks": {...}
  }
}
```

## Best Practices

### Workshop Completion
1. Complete all 5 steps for best results
2. Be authentic in responses
3. Update quarterly for accuracy
4. Export brand profile for reference

### News Curation
1. Add 5-10 quality sources
2. Review relevance scores daily
3. Save articles for content ideas
4. Adjust source configuration based on results

### Content Scheduling
1. Plan content 2 weeks ahead
2. Mix content types
3. Schedule during peak hours
4. Leave room for timely content

### LinkedIn Publishing
1. Review content before approval
2. Respect rate limits
3. Monitor analytics weekly
4. Adjust strategy based on data

## Troubleshooting

### Common Issues

#### Workshop Not Saving
- Check internet connection
- Ensure logged in
- Try manual save button
- Contact support if persists

#### News Not Updating
- Verify source URLs
- Check RSS/API availability
- Review error logs
- Adjust fetch frequency

#### Calendar Sync Issues
- Verify timezone settings
- Check calendar permissions
- Clear cache and retry
- Use manual export as backup

#### LinkedIn Connection Failed
- Re-authenticate with LinkedIn
- Check LinkedIn account status
- Verify API permissions
- Review error messages

## Support

For BrandHack feature support:
- Documentation: [docs.personalbranddna.com](https://docs.personalbranddna.com)
- Email: support@personalbranddna.com
- In-app chat: Available 9-5 EST
- Community: [community.personalbranddna.com](https://community.personalbranddna.com)