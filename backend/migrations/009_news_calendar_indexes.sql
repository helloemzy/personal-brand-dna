-- News and Calendar feature performance indexes
-- Optimizes news relevance scoring and calendar event management

-- News sources management
CREATE INDEX IF NOT EXISTS idx_news_sources_user_active ON news_sources(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_news_sources_type ON news_sources(source_type, is_active);
CREATE INDEX IF NOT EXISTS idx_news_sources_priority ON news_sources(user_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_news_sources_last_fetch ON news_sources(last_fetched_at) WHERE is_active = true;

-- News articles and relevance
CREATE INDEX IF NOT EXISTS idx_news_articles_user_relevance ON news_articles(user_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_high_relevance ON news_articles(user_id, relevance_score DESC) WHERE relevance_score > 0.7;
CREATE INDEX IF NOT EXISTS idx_news_articles_unread ON news_articles(user_id, is_read, relevance_score DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_news_articles_saved ON news_articles(user_id, is_saved, published_at DESC) WHERE is_saved = true;

-- Full-text search on news content
CREATE INDEX IF NOT EXISTS idx_news_articles_title_search ON news_articles USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_news_articles_content_search ON news_articles USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_news_articles_combined_search ON news_articles USING gin(to_tsvector('english', title || ' ' || COALESCE(summary, '')));

-- News categories and pillars
CREATE INDEX IF NOT EXISTS idx_news_categories_article ON news_article_categories(article_id, category);
CREATE INDEX IF NOT EXISTS idx_news_categories_user ON news_article_categories(article_id, category) 
  WHERE article_id IN (SELECT id FROM news_articles WHERE user_id IS NOT NULL);

-- Content pillars matching
CREATE INDEX IF NOT EXISTS idx_content_pillars_user ON content_pillars(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_content_pillars_priority ON content_pillars(user_id, priority DESC);

-- Calendar events optimization
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_schedule ON calendar_events(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_calendar_events_upcoming ON calendar_events(user_id, scheduled_for) WHERE scheduled_for >= NOW();
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(user_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_calendar_events_content ON calendar_events(content_id, scheduled_for);

-- Calendar views optimization
CREATE INDEX IF NOT EXISTS idx_calendar_events_month_view ON calendar_events(user_id, DATE_TRUNC('month', scheduled_for), scheduled_for);
CREATE INDEX IF NOT EXISTS idx_calendar_events_week_view ON calendar_events(user_id, DATE_TRUNC('week', scheduled_for), scheduled_for);
CREATE INDEX IF NOT EXISTS idx_calendar_events_day_view ON calendar_events(user_id, DATE_TRUNC('day', scheduled_for), scheduled_for);

-- Recurring events
CREATE INDEX IF NOT EXISTS idx_calendar_recurring ON calendar_recurring_patterns(event_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_recurring_next ON calendar_recurring_patterns(event_id, next_occurrence) WHERE is_active = true;

-- Calendar reminders
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_pending ON calendar_reminders(event_id, reminder_time, is_sent) WHERE is_sent = false AND reminder_time <= NOW() + INTERVAL '1 hour';

-- News fetch scheduling
CREATE INDEX IF NOT EXISTS idx_news_fetch_queue ON news_sources(last_fetched_at, is_active) WHERE is_active = true AND (last_fetched_at IS NULL OR last_fetched_at < NOW() - INTERVAL '1 hour');

-- Performance indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_news_daily_summary ON news_articles(user_id, published_at::date, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_content_stats ON calendar_events(user_id, event_type, status) WHERE scheduled_for >= NOW() - INTERVAL '30 days';

-- Composite indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_news_dashboard ON news_articles(user_id, is_read, relevance_score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_dashboard ON calendar_events(user_id, status, scheduled_for) WHERE scheduled_for BETWEEN NOW() - INTERVAL '7 days' AND NOW() + INTERVAL '30 days';

-- Update statistics
ANALYZE news_sources;
ANALYZE news_articles;
ANALYZE news_article_categories;
ANALYZE content_pillars;
ANALYZE calendar_events;
ANALYZE calendar_recurring_patterns;
ANALYZE calendar_reminders;

-- Add helpful comments
COMMENT ON INDEX idx_news_articles_high_relevance IS 'Quick access to highly relevant articles';
COMMENT ON INDEX idx_calendar_events_upcoming IS 'Optimizes queries for upcoming events';
COMMENT ON INDEX idx_news_fetch_queue IS 'Efficient news source fetching queue';
COMMENT ON INDEX idx_calendar_month_view IS 'Optimized for calendar month view queries';