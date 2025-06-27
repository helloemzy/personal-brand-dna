-- Migration: Create LinkedIn OAuth and Publishing Tables
-- Version: 006
-- Description: Tables for LinkedIn OAuth integration, publishing queue, rate limiting, and analytics

-- 1. LinkedIn OAuth Tokens Table
CREATE TABLE IF NOT EXISTS linkedin_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- Will be encrypted
    refresh_token TEXT, -- Will be encrypted
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT NOT NULL,
    linkedin_user_id VARCHAR(255),
    linkedin_user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_user_linkedin_token UNIQUE(user_id, is_active)
);

-- Indexes for OAuth tokens
CREATE INDEX idx_linkedin_oauth_user ON linkedin_oauth_tokens(user_id);
CREATE INDEX idx_linkedin_oauth_active ON linkedin_oauth_tokens(is_active, expires_at);
CREATE INDEX idx_linkedin_oauth_last_used ON linkedin_oauth_tokens(last_used_at);

-- 2. Publishing Queue Table
CREATE TABLE IF NOT EXISTS linkedin_publishing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES generated_content(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    linkedin_post_id VARCHAR(255),
    linkedin_post_url TEXT,
    
    -- Approval workflow
    approval_status VARCHAR(50) DEFAULT 'pending_review',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Content details
    post_text TEXT NOT NULL,
    post_type VARCHAR(50) DEFAULT 'text', -- text, article, image, video
    media_urls JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
    CONSTRAINT valid_approval_status CHECK (approval_status IN ('pending_review', 'approved', 'rejected', 'auto_approved')),
    CONSTRAINT valid_post_type CHECK (post_type IN ('text', 'article', 'image', 'video', 'poll', 'document'))
);

-- Indexes for publishing queue
CREATE INDEX idx_linkedin_queue_user ON linkedin_publishing_queue(user_id);
CREATE INDEX idx_linkedin_queue_status ON linkedin_publishing_queue(status);
CREATE INDEX idx_linkedin_queue_scheduled ON linkedin_publishing_queue(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_linkedin_queue_approval ON linkedin_publishing_queue(approval_status);
CREATE INDEX idx_linkedin_queue_published ON linkedin_publishing_queue(published_at);

-- 3. Rate Limiting Table
CREATE TABLE IF NOT EXISTS linkedin_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_rate_limit_window UNIQUE(user_id, action_type, window_start),
    CONSTRAINT valid_action_type CHECK (action_type IN ('post', 'comment', 'like', 'share', 'api_call'))
);

-- Indexes for rate limiting
CREATE INDEX idx_linkedin_rate_user ON linkedin_rate_limits(user_id);
CREATE INDEX idx_linkedin_rate_window ON linkedin_rate_limits(window_end);
CREATE INDEX idx_linkedin_rate_action ON linkedin_rate_limits(action_type);

-- 4. Post Analytics Table
CREATE TABLE IF NOT EXISTS linkedin_post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_post_id VARCHAR(255) NOT NULL,
    queue_id UUID REFERENCES linkedin_publishing_queue(id) ON DELETE CASCADE,
    
    -- Engagement metrics
    impressions INTEGER DEFAULT 0,
    unique_impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    
    -- Calculated metrics
    engagement_rate DECIMAL(5,2),
    click_through_rate DECIMAL(5,2),
    
    -- Demographic data (if available)
    demographics JSONB DEFAULT '{}'::jsonb,
    
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_post_analytics UNIQUE(linkedin_post_id, fetched_at)
);

-- Indexes for analytics
CREATE INDEX idx_linkedin_analytics_user ON linkedin_post_analytics(user_id);
CREATE INDEX idx_linkedin_analytics_post ON linkedin_post_analytics(linkedin_post_id);
CREATE INDEX idx_linkedin_analytics_queue ON linkedin_post_analytics(queue_id);
CREATE INDEX idx_linkedin_analytics_fetched ON linkedin_post_analytics(fetched_at);

-- 5. Compliance Audit Log
CREATE TABLE IF NOT EXISTS linkedin_compliance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_compliance_action CHECK (action_type IN (
        'oauth_connected', 'oauth_disconnected', 'oauth_refreshed',
        'post_submitted', 'post_approved', 'post_rejected', 'post_published',
        'post_deleted', 'analytics_fetched', 'data_exported', 'data_deleted'
    ))
);

-- Indexes for compliance log
CREATE INDEX idx_linkedin_compliance_user ON linkedin_compliance_log(user_id);
CREATE INDEX idx_linkedin_compliance_action ON linkedin_compliance_log(action_type);
CREATE INDEX idx_linkedin_compliance_created ON linkedin_compliance_log(created_at);

-- 6. Content Safety Check Results
CREATE TABLE IF NOT EXISTS linkedin_content_safety_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES linkedin_publishing_queue(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL,
    passed BOOLEAN NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_check_type CHECK (check_type IN (
        'profanity', 'spam', 'duplicate', 'sensitive_info', 'url_safety',
        'rate_limit', 'content_policy', 'hashtag_limit'
    ))
);

-- Indexes for safety checks
CREATE INDEX idx_linkedin_safety_queue ON linkedin_content_safety_checks(queue_id);
CREATE INDEX idx_linkedin_safety_type ON linkedin_content_safety_checks(check_type);
CREATE INDEX idx_linkedin_safety_passed ON linkedin_content_safety_checks(passed);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_linkedin_oauth_tokens_updated_at BEFORE UPDATE ON linkedin_oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_publishing_queue_updated_at BEFORE UPDATE ON linkedin_publishing_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_rate_limits_updated_at BEFORE UPDATE ON linkedin_rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_post_analytics_updated_at BEFORE UPDATE ON linkedin_post_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for easier querying

-- User's publishing summary
CREATE VIEW linkedin_user_publishing_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT lpq.id) FILTER (WHERE lpq.status = 'published') as total_published,
    COUNT(DISTINCT lpq.id) FILTER (WHERE lpq.status = 'pending') as pending_posts,
    COUNT(DISTINCT lpq.id) FILTER (WHERE lpq.status = 'scheduled') as scheduled_posts,
    AVG(lpa.engagement_rate) as avg_engagement_rate,
    SUM(lpa.impressions) as total_impressions,
    MAX(lpq.published_at) as last_published_at
FROM users u
LEFT JOIN linkedin_publishing_queue lpq ON u.id = lpq.user_id
LEFT JOIN linkedin_post_analytics lpa ON lpq.id = lpa.queue_id
GROUP BY u.id, u.email;

-- Rate limit status view
CREATE VIEW linkedin_rate_limit_status AS
SELECT 
    user_id,
    action_type,
    SUM(count) as current_count,
    MAX(window_end) as window_expires_at,
    CASE 
        WHEN action_type = 'post' AND SUM(count) >= 10 THEN 'daily_limit_reached'
        WHEN action_type = 'post' AND SUM(count) >= 3 AND 
             window_end > NOW() AND window_end < NOW() + INTERVAL '1 hour' THEN 'hourly_limit_reached'
        ELSE 'within_limits'
    END as limit_status
FROM linkedin_rate_limits
WHERE window_end > NOW()
GROUP BY user_id, action_type;

-- Compliance summary view
CREATE VIEW linkedin_compliance_summary AS
SELECT 
    user_id,
    COUNT(*) FILTER (WHERE action_type LIKE 'post_%') as total_post_actions,
    COUNT(*) FILTER (WHERE action_type = 'post_published') as posts_published,
    COUNT(*) FILTER (WHERE action_type = 'post_rejected') as posts_rejected,
    COUNT(*) FILTER (WHERE action_type IN ('data_exported', 'data_deleted')) as privacy_actions,
    MAX(created_at) as last_action_at
FROM linkedin_compliance_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id;

-- Add comments for documentation
COMMENT ON TABLE linkedin_oauth_tokens IS 'Stores encrypted LinkedIn OAuth tokens for users';
COMMENT ON TABLE linkedin_publishing_queue IS 'Queue for LinkedIn posts with approval workflow';
COMMENT ON TABLE linkedin_rate_limits IS 'Tracks API rate limits per user and action type';
COMMENT ON TABLE linkedin_post_analytics IS 'Stores engagement metrics for published LinkedIn posts';
COMMENT ON TABLE linkedin_compliance_log IS 'Audit log for all LinkedIn-related actions for compliance';
COMMENT ON TABLE linkedin_content_safety_checks IS 'Results of content safety checks before publishing';

COMMENT ON COLUMN linkedin_oauth_tokens.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN linkedin_oauth_tokens.refresh_token IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN linkedin_publishing_queue.approval_status IS 'Manual approval workflow status';
COMMENT ON COLUMN linkedin_rate_limits.window_start IS 'Start of the rate limit time window';
COMMENT ON COLUMN linkedin_post_analytics.engagement_rate IS 'Calculated as (likes + comments + shares) / impressions * 100';