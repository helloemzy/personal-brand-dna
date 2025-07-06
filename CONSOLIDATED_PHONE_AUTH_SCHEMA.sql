-- =====================================================
-- CONSOLIDATED PHONE AUTH & AUTO-POSTING DATABASE SCHEMA
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- STEP 1: Update existing users table
-- =====================================================

-- Add new columns to users table if they don't exist
DO $$ 
BEGIN
    -- Add phone_number column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) UNIQUE;
    END IF;
    
    -- Add phone_verified column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'phone_verified') THEN
        ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add posting_tier column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'posting_tier') THEN
        ALTER TABLE users ADD COLUMN posting_tier VARCHAR(20) DEFAULT 'passive';
    END IF;
    
    -- Add brand_framework column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'brand_framework') THEN
        ALTER TABLE users ADD COLUMN brand_framework JSONB;
    END IF;
    
    -- Add missing columns that were causing errors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'company') THEN
        ALTER TABLE users ADD COLUMN company VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'industry') THEN
        ALTER TABLE users ADD COLUMN industry VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'verification_token') THEN
        ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'is_verified') THEN
        ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- =====================================================
-- STEP 2: Phone Authentication Tables
-- =====================================================

-- Phone OTP logs table
CREATE TABLE IF NOT EXISTS phone_otp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_phone ON phone_otp_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_expires ON phone_otp_logs(expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_user ON phone_otp_logs(user_id);

-- =====================================================
-- STEP 3: Voice Discovery Tables
-- =====================================================

-- Voice calls tracking
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_sid VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    call_status VARCHAR(50) DEFAULT 'initiated',
    duration INTEGER,
    recording_url TEXT,
    transcript TEXT,
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Discovery conversation details
CREATE TABLE IF NOT EXISTS discovery_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    user_response TEXT,
    response_duration INTEGER,
    sentiment_score FLOAT,
    keywords JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Personal brand frameworks
CREATE TABLE IF NOT EXISTS personal_brand_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voice_call_id UUID REFERENCES voice_calls(id),
    framework_type VARCHAR(50) NOT NULL,
    brand_archetype VARCHAR(50),
    communication_style JSONB,
    value_proposition TEXT,
    target_audience JSONB,
    content_pillars JSONB,
    personality_traits JSONB,
    fascination_advantages JSONB,
    storybrand_elements JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_voice_calls_user ON voice_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(call_status);
CREATE INDEX IF NOT EXISTS idx_discovery_conversations_call ON discovery_conversations(voice_call_id);
CREATE INDEX IF NOT EXISTS idx_brand_frameworks_user ON personal_brand_frameworks(user_id);

-- =====================================================
-- STEP 4: Posting Tiers Configuration
-- =====================================================

-- Posting tiers table
CREATE TABLE IF NOT EXISTS posting_tiers (
    tier_name VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    posts_per_week_min INTEGER NOT NULL,
    posts_per_week_max INTEGER NOT NULL,
    max_rss_feeds INTEGER NOT NULL,
    content_variations INTEGER NOT NULL,
    approval_window_hours INTEGER NOT NULL,
    features JSONB NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL
);

-- Insert tier configurations (upsert to avoid duplicates)
INSERT INTO posting_tiers (tier_name, display_name, posts_per_week_min, posts_per_week_max, max_rss_feeds, content_variations, approval_window_hours, features, price_monthly, price_yearly)
VALUES 
    ('passive', 'Authority Builder', 2, 3, 5, 3, 24, 
     '{"analytics": "basic", "support": "email", "features": ["basic_scheduling", "manual_approval"]}', 
     49, 470),
    ('regular', 'Influence Accelerator', 5, 7, 15, 5, 2, 
     '{"analytics": "advanced", "support": "weekly_calls", "features": ["trend_detection", "competitor_analysis", "ab_testing", "rapid_approval"]}', 
     149, 1430),
    ('aggressive', 'Market Dominator', 14, 21, 999, 10, 0, 
     '{"analytics": "premium", "support": "dedicated_manager", "features": ["instant_posting", "multimedia", "engagement_pods", "comment_ai", "cross_platform"]}', 
     399, 3830)
ON CONFLICT (tier_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    posts_per_week_min = EXCLUDED.posts_per_week_min,
    posts_per_week_max = EXCLUDED.posts_per_week_max,
    max_rss_feeds = EXCLUDED.max_rss_feeds,
    content_variations = EXCLUDED.content_variations,
    approval_window_hours = EXCLUDED.approval_window_hours,
    features = EXCLUDED.features,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly;

-- =====================================================
-- STEP 5: RSS Feed Management
-- =====================================================

-- RSS feeds table
CREATE TABLE IF NOT EXISTS rss_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_url TEXT NOT NULL,
    feed_name VARCHAR(200) NOT NULL,
    feed_type VARCHAR(50) DEFAULT 'rss',
    keywords TEXT[],
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feed_url)
);

-- News articles table
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rss_feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(200),
    author VARCHAR(200),
    categories TEXT[],
    tags TEXT[],
    relevance_score FLOAT,
    relevance_reasons JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_url)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_active ON rss_feeds(is_active);
CREATE INDEX IF NOT EXISTS idx_news_articles_feed ON news_articles(rss_feed_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_relevance ON news_articles(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_processed ON news_articles(processed);

-- =====================================================
-- STEP 6: Content Generation & Scheduling
-- =====================================================

-- Generated posts table
CREATE TABLE IF NOT EXISTS generated_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_article_id UUID REFERENCES news_articles(id),
    content_type VARCHAR(50) NOT NULL,
    content_angle VARCHAR(50),
    headline TEXT NOT NULL,
    body_content TEXT NOT NULL,
    hashtags TEXT[],
    media_urls TEXT[],
    media_type VARCHAR(50),
    timing_strategy VARCHAR(50),
    optimal_post_time TIMESTAMP WITH TIME ZONE,
    expiry_time TIMESTAMP WITH TIME ZONE,
    predicted_engagement_rate FLOAT,
    content_quality_score FLOAT,
    approval_status VARCHAR(50) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    edit_history JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Posting schedule table
CREATE TABLE IF NOT EXISTS posting_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_post_id UUID NOT NULL REFERENCES generated_posts(id),
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    platform VARCHAR(50) DEFAULT 'linkedin',
    status VARCHAR(50) DEFAULT 'scheduled',
    posted_at TIMESTAMP WITH TIME ZONE,
    platform_post_id VARCHAR(255),
    post_url TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_generated_posts_user ON generated_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON generated_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_generated_posts_article ON generated_posts(news_article_id);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_user ON posting_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_time ON posting_schedule(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status);

-- =====================================================
-- STEP 7: Performance Tracking
-- =====================================================

-- Post performance table
CREATE TABLE IF NOT EXISTS post_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_schedule_id UUID NOT NULL REFERENCES posting_schedule(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    metrics_1_hour JSONB,
    metrics_24_hours JSONB,
    metrics_7_days JSONB,
    metrics_30_days JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_post_performance_schedule ON post_performance(posting_schedule_id);
CREATE INDEX IF NOT EXISTS idx_post_performance_user ON post_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_post_performance_engagement ON post_performance(engagement_rate DESC);

-- =====================================================
-- STEP 8: Subscription Management
-- =====================================================

-- Subscription management table
CREATE TABLE IF NOT EXISTS subscription_management (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL REFERENCES posting_tiers(tier_name),
    billing_cycle VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    posts_used_this_period INTEGER DEFAULT 0,
    posts_limit_this_period INTEGER NOT NULL,
    rss_feeds_count INTEGER DEFAULT 0,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    next_billing_date TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_user ON subscription_management(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON subscription_management(status);
CREATE INDEX IF NOT EXISTS idx_subscription_stripe ON subscription_management(stripe_subscription_id);

-- =====================================================
-- STEP 9: LinkedIn Integration
-- =====================================================

-- LinkedIn connections table
CREATE TABLE IF NOT EXISTS linkedin_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL, -- Should be encrypted in production
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    profile_data JSONB,
    permissions TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user ON linkedin_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_active ON linkedin_connections(is_active);

-- =====================================================
-- STEP 10: Update Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY[
            'personal_brand_frameworks',
            'rss_feeds',
            'generated_posts',
            'posting_schedule',
            'post_performance',
            'subscription_management',
            'linkedin_connections'
        ])
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at 
            BEFORE UPDATE ON %I 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    EXCEPTION
        WHEN duplicate_object THEN
            NULL;  -- Trigger already exists
    END LOOP;
END $$;

-- =====================================================
-- STEP 11: Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE phone_otp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_brand_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (example for user-owned data)
-- Users can only see their own data
CREATE POLICY "Users can view own phone_otp_logs" ON phone_otp_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own voice_calls" ON voice_calls
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own rss_feeds" ON rss_feeds
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own generated_posts" ON generated_posts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own posting_schedule" ON posting_schedule
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription" ON subscription_management
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own linkedin_connection" ON linkedin_connections
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- STEP 12: Initial Data & Cleanup
-- =====================================================

-- Clean up any test data
DELETE FROM phone_otp_logs WHERE expires_at < CURRENT_TIMESTAMP;

-- Create a function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM phone_otp_logs 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify the schema was created successfully:
/*
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check users table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check posting tiers
SELECT * FROM posting_tiers;

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
*/

-- =====================================================
-- SUCCESS! Schema is ready for phone auth & auto-posting
-- =====================================================