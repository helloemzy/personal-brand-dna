# Vercel Function Consolidation Plan

## Current State
- **Total Functions**: 29
- **Vercel Hobby Limit**: 12
- **Need to Reduce**: 17 functions

## Consolidation Strategy

### 1. Core Functions to Keep (7)
These are essential and should remain separate:
- `/api/hello` - Health check
- `/api/auth/demo-login` - Instant demo access
- `/api/auth/login` - User authentication
- `/api/auth/register` - User registration
- `/api/auth/send-otp` - OTP authentication
- `/api/auth/verify-otp` - OTP verification
- `/api/content/generate` - Core content generation

### 2. Functions to Consolidate (5 consolidated endpoints)

#### A. Workshop API (1 function instead of 5)
**Original**:
- `/api/workshop/start`
- `/api/workshop/sessions`
- `/api/workshop/session/[sessionId]/index`
- `/api/workshop/session/[sessionId]/save`
- `/api/workshop/session/[sessionId]/complete`

**Consolidated**: `/api/workshop`
```javascript
// Handle all workshop operations based on method and query params
// POST /api/workshop?action=start
// GET /api/workshop?action=sessions
// GET /api/workshop?sessionId=123
// POST /api/workshop?sessionId=123&action=save
// POST /api/workshop?sessionId=123&action=complete
```

#### B. LinkedIn API (1 function instead of 4)
**Original**:
- `/api/linkedin/auth`
- `/api/linkedin/callback`
- `/api/linkedin/status`
- `/api/linkedin/queue`

**Consolidated**: `/api/linkedin`
```javascript
// Handle all LinkedIn operations
// GET /api/linkedin?action=auth
// GET /api/linkedin?action=callback&code=xxx
// GET /api/linkedin?action=status
// GET/POST /api/linkedin?action=queue
```

#### C. News API (1 function instead of 2)
**Original**:
- `/api/news/sources`
- `/api/news/articles`

**Consolidated**: `/api/news`
```javascript
// Handle all news operations
// GET/POST/DELETE /api/news?type=sources
// GET /api/news?type=articles
```

#### D. Calendar API (keep as 1)
- `/api/calendar/events` - Already consolidated

#### E. Monitoring API (1 function instead of 2)
**Original**:
- `/api/monitoring/health`
- `/api/monitoring/error`

**Consolidated**: `/api/monitoring`
```javascript
// Handle all monitoring operations
// GET /api/monitoring?type=health
// POST /api/monitoring?type=error
```

## Final Function Count
1. `/api/hello`
2. `/api/auth/demo-login`
3. `/api/auth/login`
4. `/api/auth/register`
5. `/api/auth/send-otp`
6. `/api/auth/verify-otp`
7. `/api/content/generate`
8. `/api/workshop` (consolidated)
9. `/api/linkedin` (consolidated)
10. `/api/news` (consolidated)
11. `/api/calendar/events`
12. `/api/monitoring` (consolidated)

**Total**: 12 functions ✅ (fits within Hobby plan limit)

## Implementation Steps

1. Create consolidated endpoint files
2. Use query parameters or request body to determine operation
3. Import existing logic from individual files
4. Update frontend API calls to use new endpoints
5. Test all operations work correctly
6. Deploy to Vercel

## Benefits
- Fits within Vercel Hobby plan limits
- Reduces cold start overhead
- Simplifies API structure
- Maintains all functionality

## Drawbacks
- Less RESTful design
- Slightly more complex endpoint logic
- May need request body for some GET operations

## Alternative Solutions
1. **Upgrade to Vercel Pro**: $20/month for unlimited functions
2. **Use Next.js API Routes**: Would require migrating to Next.js
3. **Deploy to Railway/Render**: No function limits
4. **Use Edge Functions**: Different limits, may work better

## Recommendation
For immediate deployment without additional cost, implement the consolidation plan. This maintains all functionality while fitting within the Hobby plan limits. The consolidated endpoints can be refactored later if needed when upgrading to Pro plan.