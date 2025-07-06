-- =====================================================
-- BRANDPILLAR AI DATABASE SCHEMA - CLEAN VERSION
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- STEP 1: Update existing users table
-- =====================================================

-- Add phone_number column
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;

-- Add phone_verified column
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add posting_tier column
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_tier VARCHAR(20) DEFAULT 'starter';

-- Add brand_framework column
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_framework JSONB;

-- Add missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

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
-- STEP 3: Brand Framework Tables
-- =====================================================

-- Brand frameworks table (simplified from voice discovery)
CREATE TABLE IF NOT EXISTS brand_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    framework_type VARCHAR(50) NOT NULL DEFAULT 'questionnaire',
    brand_archetype VARCHAR(50),
    communication_style JSONB,
    value_proposition TEXT,
    target_audience JSONB,
    content_pillars JSONB,
    personality_traits JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_frameworks_user ON brand_frameworks(user_id);

-- =====================================================
-- STEP 4: Posting Tiers Configuration
-- =====================================================

-- Posting tiers table (updated for BrandPillar AI)
CREATE TABLE IF NOT EXISTS posting_tiers (
    tier_name VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    posts_per_week INTEGER NOT NULL,
    max_rss_feeds INTEGER NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    features JSONB NOT NULL
);

-- Insert BrandPillar AI tiers
INSERT INTO posting_tiers (tier_name, display_name, posts_per_week, max_rss_feeds, price_monthly, price_yearly, features)
VALUES 
    ('starter', 'Starter', 3, 5, 39, 390, 
     '{"analytics": "basic", "support": "email", "approval_window": "24 hours", "trial_days": 7}'),
    ('professional', 'Professional', 5, 25, 79, 790, 
     '{"analytics": "advanced", "support": "priority", "approval_window": "1 hour", "trial_days": 7, "features": ["trend_detection", "custom_schedule"]}'),
    ('executive', 'Executive', 7, 999, 149, 1490, 
     '{"analytics": "premium", "support": "dedicated", "approval_window": "instant", "trial_days": 7, "features": ["api_access", "white_label", "team_seats"]}')
ON CONFLICT (tier_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    posts_per_week = EXCLUDED.posts_per_week,
    max_rss_feeds = EXCLUDED.max_rss_feeds,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features;

-- =====================================================
-- STEP 5: RSS Feed Management
-- =====================================================

-- RSS feeds table
CREATE TABLE IF NOT EXISTS rss_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_url TEXT NOT NULL,
    feed_name VARCHAR(200) NOT NULL,
    keywords TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
    relevance_score FLOAT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_url)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_feed ON news_articles(rss_feed_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_relevance ON news_articles(relevance_score DESC);

-- =====================================================
-- STEP 6: Content Generation & Scheduling
-- =====================================================

-- Generated posts table
CREATE TABLE IF NOT EXISTS generated_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_article_id UUID REFERENCES news_articles(id),
    content_type VARCHAR(50) NOT NULL,
    headline TEXT NOT NULL,
    body_content TEXT NOT NULL,
    hashtags TEXT[],
    approval_status VARCHAR(50) DEFAULT 'pending',
    approved_at TIMESTAMP WITH TIME ZONE,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_generated_posts_user ON generated_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON generated_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_user ON posting_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_time ON posting_schedule(scheduled_time);

-- =====================================================
-- STEP 7: Subscription Management
-- =====================================================

-- Subscription management table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL REFERENCES posting_tiers(tier_name),
    status VARCHAR(50) DEFAULT 'trial',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- STEP 8: LinkedIn Integration
-- =====================================================

-- LinkedIn connections table
CREATE TABLE IF NOT EXISTS linkedin_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user ON linkedin_connections(user_id);

-- =====================================================
-- STEP 9: Create Update Timestamp Function
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 10: Apply Update Triggers
-- =====================================================

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_brand_frameworks_updated_at ON brand_frameworks;
CREATE TRIGGER update_brand_frameworks_updated_at 
BEFORE UPDATE ON brand_frameworks 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generated_posts_updated_at ON generated_posts;
CREATE TRIGGER update_generated_posts_updated_at 
BEFORE UPDATE ON generated_posts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
BEFORE UPDATE ON subscriptions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_linkedin_connections_updated_at ON linkedin_connections;
CREATE TRIGGER update_linkedin_connections_updated_at 
BEFORE UPDATE ON linkedin_connections 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- After running this script, run these queries to verify:

-- 1. Check all tables:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Check posting tiers:
-- SELECT * FROM posting_tiers;

-- 3. Check users table columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;

-- =====================================================
-- SUCCESS! BrandPillar AI schema is ready!
-- =====================================================