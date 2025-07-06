-- ============================================
-- AUTO-POSTING TIERS & RSS MANAGEMENT SCHEMA
-- Personal Brand DNA - Automated Content System
-- ============================================

-- 1. Update users table for tier selection
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_tier VARCHAR(20) DEFAULT 'passive';
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_tier_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_goals TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_posting_times JSONB DEFAULT '{"morning": "08:00", "lunch": "12:30", "evening": "17:00"}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_posting_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_approval_required BOOLEAN DEFAULT TRUE;

-- 2. Create posting_tiers table for tier configuration
CREATE TABLE IF NOT EXISTS posting_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_name VARCHAR(20) UNIQUE NOT NULL, -- 'passive', 'regular', 'aggressive'
    display_name VARCHAR(50) NOT NULL,
    tagline VARCHAR(200) NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    
    -- Posting Configuration
    posts_per_week_min INTEGER NOT NULL,
    posts_per_week_max INTEGER NOT NULL,
    posts_per_day_max INTEGER NOT NULL,
    optimal_posting_slots JSONB NOT NULL, -- Array of time slots
    
    -- Feature Limits
    max_rss_feeds INTEGER NOT NULL,
    max_keywords INTEGER NOT NULL,
    content_variations_per_news INTEGER NOT NULL,
    approval_window_hours INTEGER NOT NULL,
    
    -- Features Flags
    has_google_alerts BOOLEAN DEFAULT FALSE,
    has_trend_detection BOOLEAN DEFAULT FALSE,
    has_competitor_analysis BOOLEAN DEFAULT FALSE,
    has_ab_testing BOOLEAN DEFAULT FALSE,
    has_multimedia_content BOOLEAN DEFAULT FALSE,
    has_engagement_pod BOOLEAN DEFAULT FALSE,
    has_success_manager BOOLEAN DEFAULT FALSE,
    has_cross_platform BOOLEAN DEFAULT FALSE,
    
    -- Content Mix Strategy
    content_mix_strategy JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create rss_feeds table for news source management
CREATE TABLE IF NOT EXISTS rss_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_url TEXT NOT NULL,
    feed_name VARCHAR(200) NOT NULL,
    feed_type VARCHAR(50) NOT NULL, -- 'rss', 'google_alerts', 'custom_api'
    
    -- Feed Configuration
    is_active BOOLEAN DEFAULT TRUE,
    check_frequency_minutes INTEGER DEFAULT 60,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_successful_fetch TIMESTAMP WITH TIME ZONE,
    
    -- Content Filtering
    include_keywords TEXT[],
    exclude_keywords TEXT[],
    min_relevance_score DECIMAL(3,2) DEFAULT 0.7,
    
    -- Feed Metadata
    feed_category VARCHAR(100),
    priority_level INTEGER DEFAULT 5, -- 1-10 scale
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, feed_url)
);

-- 4. Create news_articles table for fetched content
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rss_feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Article Data
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    author VARCHAR(200),
    published_at TIMESTAMP WITH TIME ZONE,
    source_name VARCHAR(200),
    
    -- Analysis Data
    relevance_score DECIMAL(3,2),
    sentiment_score DECIMAL(3,2),
    trending_score DECIMAL(3,2),
    keywords_matched TEXT[],
    categories TEXT[],
    
    -- Processing Status
    processing_status VARCHAR(50) DEFAULT 'new', -- 'new', 'analyzed', 'content_generated', 'posted', 'ignored'
    analyzed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(url, user_id)
);

-- 5. Create generated_posts table for AI-generated content
CREATE TABLE IF NOT EXISTS generated_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_article_id UUID REFERENCES news_articles(id) ON DELETE SET NULL,
    
    -- Content Data
    content_type VARCHAR(50) NOT NULL, -- 'newsjack', 'insight', 'opinion', 'analysis', 'story'
    content_angle VARCHAR(100), -- 'contrarian', 'industry_impact', 'personal_story', 'future_prediction', 'actionable_advice'
    headline TEXT NOT NULL,
    body_content TEXT NOT NULL,
    hashtags TEXT[],
    
    -- Media Attachments
    media_urls JSONB, -- Array of media objects
    media_type VARCHAR(50), -- 'image', 'video', 'carousel', 'document'
    
    -- Timing Strategy
    timing_strategy VARCHAR(50), -- 'instant_react', 'deep_dive', 'lessons_learned'
    optimal_post_time TIMESTAMP WITH TIME ZONE,
    expiry_time TIMESTAMP WITH TIME ZONE, -- When content becomes stale
    
    -- Performance Prediction
    predicted_engagement_rate DECIMAL(5,2),
    predicted_reach INTEGER,
    content_quality_score DECIMAL(3,2),
    
    -- Approval Workflow
    approval_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_approved'
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    -- A/B Testing
    is_variant BOOLEAN DEFAULT FALSE,
    variant_group_id UUID,
    variant_type VARCHAR(50), -- 'headline', 'content', 'timing', 'hashtags'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create posting_schedule table
CREATE TABLE IF NOT EXISTS posting_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_post_id UUID NOT NULL REFERENCES generated_posts(id) ON DELETE CASCADE,
    
    -- Scheduling Data
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    posting_slot VARCHAR(20), -- 'morning', 'lunch', 'evening', 'custom'
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'posting', 'posted', 'failed', 'cancelled'
    posted_at TIMESTAMP WITH TIME ZONE,
    
    -- Platform Data
    platform VARCHAR(50) DEFAULT 'linkedin',
    platform_post_id VARCHAR(200), -- External ID from LinkedIn
    post_url TEXT,
    
    -- Error Handling
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create post_performance table
CREATE TABLE IF NOT EXISTS post_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_schedule_id UUID NOT NULL REFERENCES posting_schedule(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Engagement Metrics
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    
    -- Calculated Metrics
    engagement_rate DECIMAL(5,2),
    viral_score DECIMAL(3,2),
    dwell_time_seconds INTEGER,
    
    -- Audience Data
    viewer_demographics JSONB,
    peak_engagement_time TIMESTAMP WITH TIME ZONE,
    
    -- Tracking Periods
    metrics_1_hour JSONB,
    metrics_24_hours JSONB,
    metrics_7_days JSONB,
    metrics_30_days JSONB,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create subscription_management table
CREATE TABLE IF NOT EXISTS subscription_management (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscription Details
    tier VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'active', 'cancelled', 'expired', 'paused'
    billing_cycle VARCHAR(20) NOT NULL, -- 'monthly', 'yearly'
    
    -- Billing Data
    stripe_subscription_id VARCHAR(200),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    price_paid DECIMAL(10,2) NOT NULL,
    
    -- Usage Tracking
    posts_used_this_period INTEGER DEFAULT 0,
    rss_feeds_count INTEGER DEFAULT 0,
    
    -- Tier History
    previous_tier VARCHAR(20),
    upgraded_from_tier_at TIMESTAMP WITH TIME ZONE,
    downgraded_from_tier_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create content_templates table for tier-specific templates
CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier VARCHAR(20) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    
    -- Template Structure
    headline_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    cta_template TEXT,
    hashtag_strategy JSONB,
    
    -- Usage Rules
    min_word_count INTEGER,
    max_word_count INTEGER,
    required_elements TEXT[],
    
    -- Performance Data
    avg_engagement_rate DECIMAL(5,2),
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Create competitor_tracking table (Regular & Aggressive tiers)
CREATE TABLE IF NOT EXISTS competitor_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    competitor_linkedin_url TEXT NOT NULL,
    competitor_name VARCHAR(200),
    
    -- Tracking Configuration
    is_active BOOLEAN DEFAULT TRUE,
    check_frequency_hours INTEGER DEFAULT 24,
    
    -- Analysis Data
    avg_posts_per_week DECIMAL(4,2),
    avg_engagement_rate DECIMAL(5,2),
    top_performing_topics TEXT[],
    posting_patterns JSONB,
    
    last_analyzed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tier configurations
INSERT INTO posting_tiers (
    tier_name, display_name, tagline, 
    price_monthly, price_yearly,
    posts_per_week_min, posts_per_week_max, posts_per_day_max,
    optimal_posting_slots, max_rss_feeds, max_keywords,
    content_variations_per_news, approval_window_hours,
    content_mix_strategy
) VALUES
(
    'passive',
    'Authority Builder',
    'Maintain professional presence without overwhelming your network',
    49.00, 470.00,
    2, 3, 1,
    '["08:00", "17:00"]'::jsonb,
    5, 10, 3, 24,
    '{
        "industry_insights": 40,
        "professional_wins": 30,
        "thought_leadership": 20,
        "engagement_posts": 10
    }'::jsonb
),
(
    'regular',
    'Influence Accelerator', 
    'Build thought leadership and expand professional network',
    149.00, 1430.00,
    5, 7, 2,
    '["08:00", "12:30", "17:00"]'::jsonb,
    15, 25, 5, 2,
    '{
        "newsjacking": 30,
        "educational": 25,
        "personal_stories": 20,
        "industry_analysis": 15,
        "community_engagement": 10
    }'::jsonb
),
(
    'aggressive',
    'Market Dominator',
    'Become the go-to voice in your industry',
    399.00, 3830.00,
    14, 21, 3,
    '["07:00", "09:00", "12:00", "14:00", "17:00", "19:00"]'::jsonb,
    999, 50, 10, 0,
    '{
        "breaking_news": 25,
        "original_insights": 20,
        "engagement_drivers": 20,
        "behind_scenes": 15,
        "curated_content": 10,
        "multimedia": 10
    }'::jsonb
);

-- Update feature flags for tiers
UPDATE posting_tiers SET
    has_google_alerts = TRUE,
    has_trend_detection = TRUE,
    has_competitor_analysis = TRUE,
    has_ab_testing = TRUE
WHERE tier_name = 'regular';

UPDATE posting_tiers SET
    has_google_alerts = TRUE,
    has_trend_detection = TRUE,
    has_competitor_analysis = TRUE,
    has_ab_testing = TRUE,
    has_multimedia_content = TRUE,
    has_engagement_pod = TRUE,
    has_success_manager = TRUE,
    has_cross_platform = TRUE
WHERE tier_name = 'aggressive';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user_active ON rss_feeds(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_news_articles_user_status ON news_articles(user_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_posts_user_approval ON generated_posts(user_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_user_time ON posting_schedule(user_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_post_performance_user ON post_performance(user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_posting_tiers_updated_at BEFORE UPDATE ON posting_tiers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rss_feeds_updated_at BEFORE UPDATE ON rss_feeds
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_posts_updated_at BEFORE UPDATE ON generated_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posting_schedule_updated_at BEFORE UPDATE ON posting_schedule
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_management_updated_at BEFORE UPDATE ON subscription_management
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();