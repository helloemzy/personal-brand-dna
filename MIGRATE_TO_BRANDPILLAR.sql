-- =====================================================
-- MIGRATION SCRIPT: Add BrandPillar AI Features to Existing Schema
-- This works WITH your existing database structure
-- =====================================================

-- First, let's check what we're working with
DO $$
BEGIN
    RAISE NOTICE 'Starting BrandPillar AI migration...';
END $$;

-- =====================================================
-- STEP 1: Add new columns to existing users table
-- =====================================================

-- Add phone authentication columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_tier VARCHAR(20) DEFAULT 'starter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_framework JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- =====================================================
-- STEP 2: Create new tables (only if they don't exist)
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

-- Brand frameworks table (for questionnaire-based approach)
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

-- Posting tiers table
CREATE TABLE IF NOT EXISTS posting_tiers (
    tier_name VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    posts_per_week INTEGER NOT NULL,
    max_rss_feeds INTEGER NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    features JSONB NOT NULL
);

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
    relevance_score FLOAT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_url)
);

-- Generated posts table (extends your existing generated_content)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
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

-- =====================================================
-- STEP 3: Create indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_phone ON phone_otp_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_brand_frameworks_user ON brand_frameworks(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_feed ON news_articles(rss_feed_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_user ON generated_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_user ON posting_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user ON linkedin_connections(user_id);

-- =====================================================
-- STEP 4: Insert BrandPillar AI tiers
-- =====================================================

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
-- STEP 5: Add triggers to new tables (using existing function)
-- =====================================================

-- The update_updated_at_column() function already exists from your schema
-- Just add triggers for new tables

DROP TRIGGER IF EXISTS update_brand_frameworks_updated_at ON brand_frameworks;
CREATE TRIGGER update_brand_frameworks_updated_at 
    BEFORE UPDATE ON brand_frameworks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rss_feeds_updated_at ON rss_feeds;
CREATE TRIGGER update_rss_feeds_updated_at 
    BEFORE UPDATE ON rss_feeds 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generated_posts_updated_at ON generated_posts;
CREATE TRIGGER update_generated_posts_updated_at 
    BEFORE UPDATE ON generated_posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_posting_schedule_updated_at ON posting_schedule;
CREATE TRIGGER update_posting_schedule_updated_at 
    BEFORE UPDATE ON posting_schedule 
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
-- STEP 6: Update subscription_tier values for existing users
-- =====================================================

-- Map old tiers to new BrandPillar AI tiers
UPDATE users 
SET posting_tier = CASE 
    WHEN subscription_tier = 'free' THEN 'starter'
    WHEN subscription_tier = 'basic' THEN 'starter'
    WHEN subscription_tier = 'pro' THEN 'professional'
    WHEN subscription_tier = 'premium' THEN 'executive'
    ELSE 'starter'
END
WHERE posting_tier IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check migration results
DO $$
DECLARE
    table_count INTEGER;
    tier_count INTEGER;
BEGIN
    -- Count new tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('phone_otp_logs', 'brand_frameworks', 'posting_tiers', 'rss_feeds', 'news_articles', 'generated_posts', 'posting_schedule', 'subscriptions', 'linkedin_connections');
    
    -- Count tiers
    SELECT COUNT(*) INTO tier_count FROM posting_tiers;
    
    RAISE NOTICE 'Migration complete! Created % new tables and % posting tiers', table_count, tier_count;
END $$;

-- =====================================================
-- SUCCESS! BrandPillar AI features added to existing schema
-- =====================================================