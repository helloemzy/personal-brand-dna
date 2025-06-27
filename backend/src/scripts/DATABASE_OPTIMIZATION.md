# Database Query Optimization Infrastructure

This document describes the database optimization tools and strategies implemented for the Personal Brand DNA System backend.

## Overview

The database optimization infrastructure provides:
- Query performance analysis
- Optimized indexes for common queries
- Connection pooling optimized for serverless environments
- Real-time performance monitoring
- Caching strategies

## Components

### 1. Query Performance Analysis (`analyze-queries.js`)

Analyzes database performance and generates optimization recommendations.

```bash
# Run the query analyzer
npm run db:analyze
```

Features:
- Identifies slow queries (>100ms)
- Analyzes table statistics and vacuum status
- Checks index usage and suggests unused indexes
- Finds missing indexes for common query patterns
- Analyzes query execution plans
- Generates migration files with index recommendations

### 2. Performance Indexes (migrations 007-010)

Four migration files optimize different areas:

#### `007_performance_indexes.sql` - General Performance
- User authentication lookups
- Content generation and history
- Session management
- Payment processing
- Full-text search on content

#### `008_workshop_indexes.sql` - Workshop Features
- Workshop session management
- Values, tone, and audience data
- Progress tracking
- Writing sample analysis

#### `009_news_calendar_indexes.sql` - News & Calendar
- News article relevance scoring
- Calendar event retrieval
- RSS feed management
- Recurring events
- Monthly/weekly calendar views

#### `010_linkedin_indexes.sql` - LinkedIn Features
- OAuth token management
- Post queue optimization
- Analytics queries
- Hashtag tracking
- Publishing schedule

Apply all performance indexes:
```bash
npm run db:migrate:perf
```

### 3. Database Connection Pooling (`database-pool.js`)

Optimized connection pooling for both serverless and standard deployments.

#### Serverless Configuration
- Max 3 connections (lower for function limits)
- Aggressive idle timeout (10 seconds)
- Connection reuse strategies
- Graceful cleanup on function exit

#### Standard Configuration
- Max 20 connections
- 30-second idle timeout
- Connection keep-alive
- Prepared statement caching

Features:
- Automatic environment detection
- Query caching with Redis fallback
- Batch query operations
- Connection statistics
- Prepared statement optimization

### 4. Database Service Layer (`databaseService.js`)

High-level database operations with built-in optimizations.

Key Methods:
```javascript
// Cached query with TTL
await db.query(sql, params, {
  cached: true,
  cacheTTL: 300, // 5 minutes
  prepared: true // Use prepared statements
});

// Batch operations
await db.batchQuery([
  { text: sql1, params: [1, 2] },
  { text: sql2, params: [3, 4] }
]);

// Transaction handling
await db.transaction([
  { text: 'INSERT ...', params: [...] },
  { text: 'UPDATE ...', params: [...] }
]);
```

Optimized Operations:
- `getUserByEmail()` - Cached user lookups
- `getActiveWorkshopSession()` - Joins all workshop data
- `getRelevantNewsArticles()` - Smart relevance scoring
- `getCalendarEvents()` - Efficient date range queries
- `getLinkedInPublishQueue()` - Queue management with row locking

### 5. Performance Monitoring (`db-monitor.js`)

Real-time database performance monitoring.

#### CLI Mode
```bash
npm run db:monitor
```

Shows:
- Connection pool status
- Database statistics
- Recent slow queries

#### Dashboard Mode
```bash
npm run db:monitor:dashboard
```

Interactive dashboard with:
- Live connection pool metrics
- Query performance graphs
- Cache hit rate gauge
- Active query monitoring
- Database statistics
- Slow query log

## Usage Guidelines

### 1. Development Workflow

```bash
# 1. Analyze current performance
npm run db:analyze

# 2. Review generated recommendations
cat migrations/performance_indexes_*.sql

# 3. Apply performance indexes
npm run db:migrate:perf

# 4. Monitor improvements
npm run db:monitor:dashboard
```

### 2. Query Optimization Best Practices

#### Use Caching for Read-Heavy Operations
```javascript
// Cache user lookups
const user = await db.getUserByEmail(email);

// Cache news articles for 5 minutes
const articles = await db.query(sql, params, {
  cached: true,
  cacheTTL: 300
});
```

#### Batch Related Operations
```javascript
// Instead of multiple queries
for (const id of articleIds) {
  await db.query('UPDATE news_articles SET is_read = true WHERE id = $1', [id]);
}

// Use batch update
await db.markArticlesAsRead(articleIds);
```

#### Use Appropriate Indexes
```sql
-- For user lookups
CREATE INDEX idx_users_email ON users(email);

-- For time-based queries
CREATE INDEX idx_events_schedule ON calendar_events(user_id, scheduled_for);

-- For status filtering
CREATE INDEX idx_posts_queue ON linkedin_posts(status, scheduled_at) 
WHERE status IN ('pending', 'scheduled');
```

### 3. Monitoring in Production

#### Set Up Alerts
Monitor these metrics:
- Query execution time > 500ms
- Connection pool utilization > 80%
- Cache hit rate < 70%
- Dead row percentage > 20%

#### Regular Maintenance
```bash
# Weekly: Analyze query performance
npm run db:analyze

# Monthly: Review and optimize slow queries
npm run db:monitor -- --slow-queries

# Quarterly: Full index review
psql $DATABASE_URL -c "SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0"
```

## Serverless Considerations

### Connection Management
- Use connection pooling service for production (e.g., PgBouncer)
- Implement connection warming for cold starts
- Set aggressive timeouts to prevent connection leaks

### Caching Strategy
- Redis for shared cache across functions
- In-memory fallback for single invocations
- Cache warming for predictable queries

### Query Optimization
- Minimize JOIN operations
- Use materialized views for complex aggregations
- Implement read replicas for scaling

## Performance Benchmarks

Expected query performance after optimization:

| Query Type | Before | After | Cache Hit |
|------------|--------|-------|-----------|
| User Auth | 150ms | 15ms | 2ms |
| Workshop Load | 400ms | 50ms | 5ms |
| News Ranking | 800ms | 100ms | 10ms |
| Calendar View | 300ms | 40ms | 4ms |
| LinkedIn Queue | 200ms | 25ms | 3ms |

## Troubleshooting

### High Query Times
1. Run `npm run db:analyze` to identify slow queries
2. Check execution plans for sequential scans
3. Verify indexes are being used
4. Consider query restructuring

### Connection Pool Exhaustion
1. Check for connection leaks in application code
2. Reduce pool size for serverless
3. Implement connection timeout handling
4. Use PgBouncer for connection multiplexing

### Low Cache Hit Rate
1. Verify Redis connectivity
2. Check cache key generation
3. Review TTL settings
4. Monitor cache eviction

## Future Enhancements

1. **Query Plan Caching**
   - Implement query plan caching for complex queries
   - Use prepared statements more extensively

2. **Automated Index Management**
   - Weekly automated index analysis
   - Automatic unused index removal
   - Index usage statistics tracking

3. **Advanced Monitoring**
   - Integration with DataDog/New Relic
   - Custom performance dashboards
   - Predictive performance analytics

4. **Query Optimization AI**
   - ML-based query optimization suggestions
   - Automatic query rewriting
   - Performance prediction models