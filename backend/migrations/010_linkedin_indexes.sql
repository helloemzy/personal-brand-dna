-- LinkedIn integration performance indexes
-- Optimizes LinkedIn OAuth, post queue management, and analytics

-- LinkedIn OAuth tokens
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_user ON linkedin_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_expires ON linkedin_oauth_tokens(user_id, expires_at) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_refresh ON linkedin_oauth_tokens(refresh_token, expires_at);
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_scope ON linkedin_oauth_tokens(user_id, scope) WHERE is_active = true;

-- LinkedIn posts queue management
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_queue ON linkedin_posts(status, scheduled_at) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_user_status ON linkedin_posts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_scheduled ON linkedin_posts(scheduled_at, status) WHERE status = 'scheduled' AND scheduled_at > NOW();
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_retry ON linkedin_posts(status, retry_count, next_retry_at) WHERE status = 'failed' AND retry_count < 3;
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_published ON linkedin_posts(user_id, published_at DESC) WHERE status = 'published';

-- LinkedIn post content and media
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_content ON linkedin_posts(content_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_has_media ON linkedin_posts(user_id, has_media) WHERE has_media = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_type ON linkedin_posts(post_type, created_at DESC);

-- LinkedIn analytics
CREATE INDEX IF NOT EXISTS idx_linkedin_analytics_post ON linkedin_analytics(post_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_analytics_engagement ON linkedin_analytics(post_id, impressions DESC, engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_analytics_recent ON linkedin_analytics(post_id, fetched_at) WHERE fetched_at > NOW() - INTERVAL '7 days';
CREATE INDEX IF NOT EXISTS idx_linkedin_analytics_top_posts ON linkedin_analytics(post_id, engagement_rate DESC) WHERE impressions > 100;

-- LinkedIn connections and audience
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user ON linkedin_connections(user_id, connection_degree);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_industry ON linkedin_connections(user_id, industry);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_seniority ON linkedin_connections(user_id, seniority_level);

-- LinkedIn hashtags optimization
CREATE INDEX IF NOT EXISTS idx_linkedin_hashtags_post ON linkedin_post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_hashtags_tag ON linkedin_post_hashtags(hashtag, post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_hashtags_trending ON linkedin_hashtags(hashtag, usage_count DESC, last_used_at DESC);

-- Publishing schedule optimization
CREATE INDEX IF NOT EXISTS idx_linkedin_schedule_user ON linkedin_publishing_schedule(user_id, day_of_week, time_slot);
CREATE INDEX IF NOT EXISTS idx_linkedin_schedule_optimal ON linkedin_publishing_schedule(user_id, is_optimal) WHERE is_optimal = true;

-- Error tracking and monitoring
CREATE INDEX IF NOT EXISTS idx_linkedin_errors_recent ON linkedin_posts(user_id, error_message, created_at DESC) WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours';
CREATE INDEX IF NOT EXISTS idx_linkedin_rate_limits ON linkedin_api_calls(user_id, endpoint, called_at DESC) WHERE called_at > NOW() - INTERVAL '1 hour';

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_priority ON linkedin_posts(status, priority DESC, scheduled_at) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_linkedin_user_dashboard ON linkedin_posts(user_id, status, scheduled_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';
CREATE INDEX IF NOT EXISTS idx_linkedin_analytics_dashboard ON linkedin_analytics(post_id, impressions, engagement_rate, fetched_at DESC);

-- Full-text search on LinkedIn content
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_search ON linkedin_posts USING gin(to_tsvector('english', content));

-- Performance optimization for batch operations
CREATE INDEX IF NOT EXISTS idx_linkedin_batch_publish ON linkedin_posts(status, scheduled_at, id) WHERE status = 'scheduled' AND scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour';
CREATE INDEX IF NOT EXISTS idx_linkedin_batch_analytics ON linkedin_posts(id, linkedin_post_id) WHERE status = 'published' AND linkedin_post_id IS NOT NULL AND updated_at < NOW() - INTERVAL '24 hours';

-- Update statistics
ANALYZE linkedin_oauth_tokens;
ANALYZE linkedin_posts;
ANALYZE linkedin_analytics;
ANALYZE linkedin_connections;
ANALYZE linkedin_post_hashtags;
ANALYZE linkedin_hashtags;
ANALYZE linkedin_publishing_schedule;

-- Add helpful comments
COMMENT ON INDEX idx_linkedin_posts_queue IS 'Primary index for LinkedIn publishing queue';
COMMENT ON INDEX idx_linkedin_posts_retry IS 'Manages failed post retry logic';
COMMENT ON INDEX idx_linkedin_analytics_top_posts IS 'Quick access to best performing content';
COMMENT ON INDEX idx_linkedin_batch_publish IS 'Optimizes batch publishing operations';