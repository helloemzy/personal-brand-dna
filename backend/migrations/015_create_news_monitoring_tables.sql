-- BrandPillar AI - News Monitoring Database Schema
-- Migration: 015_create_news_monitoring_tables.sql
-- Description: Production-ready schema for news monitoring, feed management, and content opportunities

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. RSS Feed Sources Table
-- Stores all RSS feed sources with metadata
CREATE TABLE IF NOT EXISTS rss_feed_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    language VARCHAR(10) DEFAULT 'en',
    update_frequency INTEGER DEFAULT 3600, -- seconds between updates
    is_active BOOLEAN DEFAULT true,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    last_successful_fetch TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    average_items_per_fetch NUMERIC(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Feed Subscriptions
-- Links users to their subscribed feeds with preferences
CREATE TABLE IF NOT EXISTS user_feed_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_id UUID NOT NULL REFERENCES rss_feed_sources(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    keywords TEXT[], -- Additional keywords to boost relevance
    excluded_keywords TEXT[], -- Keywords to reduce relevance
    min_relevance_score NUMERIC(3,2) DEFAULT 0.50,
    settings JSONB DEFAULT '{}',
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, feed_id)
);

-- 3. News Articles Table
-- Stores parsed articles from feeds
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feed_id UUID NOT NULL REFERENCES rss_feed_sources(id) ON DELETE CASCADE,
    guid TEXT NOT NULL, -- RSS GUID for deduplication
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    author TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    categories TEXT[],
    keywords TEXT[],
    image_url TEXT,
    metadata JSONB DEFAULT '{}',
    content_hash TEXT, -- For duplicate detection
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_id, guid)
);

-- 4. News Opportunities Table
-- Stores analyzed opportunities for users
CREATE TABLE IF NOT EXISTS news_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    virality_score NUMERIC(3,2) CHECK (virality_score >= 0 AND virality_score <= 1),
    competitive_score NUMERIC(3,2) CHECK (competitive_score >= 0 AND competitive_score <= 1),
    timing_score NUMERIC(3,2) CHECK (timing_score >= 0 AND timing_score <= 1),
    overall_score NUMERIC(3,2) GENERATED ALWAYS AS (
        (relevance_score * 0.4 + virality_score * 0.2 + competitive_score * 0.2 + timing_score * 0.2)
    ) STORED,
    content_pillars TEXT[],
    suggested_angles JSONB DEFAULT '[]',
    suggested_hooks TEXT[],
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'used', 'dismissed', 'expired')),
    used_for_content_id UUID, -- References generated content if used
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    viewed_at TIMESTAMP WITH TIME ZONE,
    actioned_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    UNIQUE(user_id, article_id)
);

-- 5. User Voice Profiles (for relevance scoring)
-- Stores analyzed voice patterns and preferences
CREATE TABLE IF NOT EXISTS user_voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    archetype VARCHAR(50),
    industry VARCHAR(100),
    expertise_keywords TEXT[],
    preferred_topics TEXT[],
    writing_style JSONB DEFAULT '{}',
    content_pillars JSONB DEFAULT '{}',
    audience_demographics JSONB DEFAULT '{}',
    engagement_patterns JSONB DEFAULT '{}',
    last_analysis_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- 6. Virality Patterns Table
-- Tracks viral content patterns for prediction
CREATE TABLE IF NOT EXISTS virality_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES news_articles(id) ON DELETE CASCADE,
    platform VARCHAR(50) DEFAULT 'linkedin',
    initial_engagement INTEGER DEFAULT 0,
    peak_engagement INTEGER DEFAULT 0,
    time_to_peak_hours NUMERIC(10,2),
    total_reach INTEGER DEFAULT 0,
    share_velocity NUMERIC(10,2), -- shares per hour
    pattern_features JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Competitive Analysis Table
-- Tracks competitor coverage of topics
CREATE TABLE IF NOT EXISTS competitive_coverage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES news_articles(id) ON DELETE CASCADE,
    competitor_name TEXT,
    competitor_url TEXT,
    coverage_type VARCHAR(50), -- 'identical', 'similar', 'related'
    coverage_angle TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    engagement_metrics JSONB DEFAULT '{}',
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Feed Performance Analytics
CREATE TABLE IF NOT EXISTS feed_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feed_id UUID NOT NULL REFERENCES rss_feed_sources(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_articles INTEGER DEFAULT 0,
    relevant_articles INTEGER DEFAULT 0,
    opportunities_generated INTEGER DEFAULT 0,
    opportunities_used INTEGER DEFAULT 0,
    average_relevance_score NUMERIC(3,2),
    average_virality_score NUMERIC(3,2),
    fetch_success_rate NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_news_articles_feed_published ON news_articles(feed_id, published_at DESC);
CREATE INDEX idx_news_articles_content_hash ON news_articles(content_hash);
CREATE INDEX idx_news_opportunities_user_status ON news_opportunities(user_id, status, created_at DESC);
CREATE INDEX idx_news_opportunities_overall_score ON news_opportunities(overall_score DESC);
CREATE INDEX idx_user_feed_subscriptions_active ON user_feed_subscriptions(user_id, is_active);
CREATE INDEX idx_virality_patterns_article ON virality_patterns(article_id);
CREATE INDEX idx_competitive_coverage_article ON competitive_coverage(article_id);

-- Full text search indexes
CREATE INDEX idx_news_articles_title_fts ON news_articles USING gin(to_tsvector('english', title));
CREATE INDEX idx_news_articles_summary_fts ON news_articles USING gin(to_tsvector('english', summary));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rss_feed_sources_updated_at BEFORE UPDATE ON rss_feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_voice_profiles_updated_at BEFORE UPDATE ON user_voice_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create materialized view for user opportunity dashboard
CREATE MATERIALIZED VIEW user_opportunity_summary AS
SELECT 
    u.id as user_id,
    COUNT(DISTINCT no.id) FILTER (WHERE no.status = 'new') as new_opportunities,
    COUNT(DISTINCT no.id) FILTER (WHERE no.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as opportunities_24h,
    COUNT(DISTINCT no.id) FILTER (WHERE no.status = 'used') as opportunities_used,
    AVG(no.overall_score) FILTER (WHERE no.status = 'new') as avg_opportunity_score,
    MAX(no.created_at) as last_opportunity_at
FROM users u
LEFT JOIN news_opportunities no ON u.id = no.user_id
GROUP BY u.id;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_user_opportunity_summary_user ON user_opportunity_summary(user_id);

-- Add comments for documentation
COMMENT ON TABLE rss_feed_sources IS 'Master list of RSS feed sources with health monitoring';
COMMENT ON TABLE user_feed_subscriptions IS 'User subscriptions to feeds with personalized settings';
COMMENT ON TABLE news_articles IS 'Parsed and stored articles from RSS feeds';
COMMENT ON TABLE news_opportunities IS 'AI-analyzed content opportunities for users';
COMMENT ON TABLE user_voice_profiles IS 'User voice and content preferences for relevance scoring';
COMMENT ON TABLE virality_patterns IS 'Historical viral content patterns for prediction';
COMMENT ON TABLE competitive_coverage IS 'Tracking of competitor coverage for advantage analysis';
COMMENT ON TABLE feed_analytics IS 'Daily analytics for feed performance monitoring';

-- Insert default high-quality feeds
INSERT INTO rss_feed_sources (url, name, category, subcategory, update_frequency) VALUES
-- Technology
('https://techcrunch.com/feed/', 'TechCrunch', 'technology', 'startups', 1800),
('https://www.theverge.com/rss/index.xml', 'The Verge', 'technology', 'consumer_tech', 3600),
('https://feeds.arstechnica.com/arstechnica/index', 'Ars Technica', 'technology', 'deep_tech', 3600),
('https://www.wired.com/feed/rss', 'Wired', 'technology', 'innovation', 3600),
('https://feeds.feedburner.com/venturebeat/SZYF', 'VentureBeat', 'technology', 'enterprise', 1800),

-- Business
('https://feeds.hbr.org/harvardbusiness', 'Harvard Business Review', 'business', 'leadership', 7200),
('https://www.ft.com/rss/home', 'Financial Times', 'business', 'finance', 1800),
('https://feeds.bloomberg.com/markets/news.rss', 'Bloomberg Markets', 'business', 'markets', 900),
('https://www.wsj.com/xml/rss/3_7014.xml', 'WSJ Business', 'business', 'general', 1800),
('https://fortune.com/feed/', 'Fortune', 'business', 'corporate', 3600),

-- Marketing
('https://contentmarketinginstitute.com/feed/', 'Content Marketing Institute', 'marketing', 'content', 7200),
('https://feeds.feedburner.com/Marketingland', 'Marketing Land', 'marketing', 'digital', 3600),
('https://blog.hubspot.com/marketing/rss.xml', 'HubSpot Marketing', 'marketing', 'inbound', 3600),

-- AI/ML
('https://blogs.nvidia.com/feed/', 'NVIDIA Blog', 'ai', 'hardware', 7200),
('https://openai.com/blog/rss/', 'OpenAI Blog', 'ai', 'research', 14400),
('https://www.technologyreview.com/feed/', 'MIT Technology Review', 'ai', 'analysis', 3600),

-- Leadership
('https://www.inc.com/rss', 'Inc.com', 'leadership', 'entrepreneurship', 3600),
('https://www.fastcompany.com/rss', 'Fast Company', 'leadership', 'innovation', 3600),
('https://feeds.feedburner.com/typepad/sethsmainblog', 'Seth Godin', 'leadership', 'thought_leadership', 86400)
ON CONFLICT (url) DO NOTHING;