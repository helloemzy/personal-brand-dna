-- News Sources Table
CREATE TABLE IF NOT EXISTS news_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    feed_url TEXT NOT NULL,
    feed_type VARCHAR(50) DEFAULT 'rss' CHECK (feed_type IN ('rss', 'atom', 'json')),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    fetch_frequency_minutes INTEGER DEFAULT 60,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feed_url)
);

-- News Articles Table
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
    external_id VARCHAR(500), -- RSS guid or unique identifier from source
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    article_url TEXT NOT NULL,
    image_url TEXT,
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    raw_data JSONB, -- Store original feed data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, external_id)
);

-- Article Relevance Scores Table
CREATE TABLE IF NOT EXISTS article_relevance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3,2) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    content_pillar_matches TEXT[] DEFAULT '{}',
    audience_match_score DECIMAL(3,2),
    tone_match_score DECIMAL(3,2),
    topic_similarity_score DECIMAL(3,2),
    scoring_metadata JSONB DEFAULT '{}',
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, user_id)
);

-- User Article Interactions Table
CREATE TABLE IF NOT EXISTS user_article_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('view', 'save', 'dismiss', 'use_idea', 'share')),
    interaction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_article_interactions_user_id (user_id),
    INDEX idx_user_article_interactions_type (interaction_type)
);

-- Content Ideas Table (generated from articles)
CREATE TABLE IF NOT EXISTS content_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES news_articles(id) ON DELETE SET NULL,
    idea_type VARCHAR(50) CHECK (idea_type IN ('response', 'perspective', 'analysis', 'story', 'tips')),
    headline TEXT NOT NULL,
    hook TEXT NOT NULL,
    outline JSONB NOT NULL, -- Structured outline with sections
    key_points TEXT[] DEFAULT '{}',
    target_audience VARCHAR(255),
    estimated_word_count INTEGER,
    content_format VARCHAR(50) CHECK (content_format IN ('post', 'article', 'carousel', 'video_script')),
    status VARCHAR(50) DEFAULT 'suggested' CHECK (status IN ('suggested', 'saved', 'drafted', 'published', 'dismissed')),
    ai_confidence_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- News Fetch History Table (for monitoring)
CREATE TABLE IF NOT EXISTS news_fetch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
    fetch_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    fetch_completed_at TIMESTAMP WITH TIME ZONE,
    articles_found INTEGER DEFAULT 0,
    articles_new INTEGER DEFAULT 0,
    articles_updated INTEGER DEFAULT 0,
    fetch_status VARCHAR(50) CHECK (fetch_status IN ('success', 'partial', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User News Preferences Table
CREATE TABLE IF NOT EXISTS user_news_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keywords TEXT[] DEFAULT '{}',
    excluded_keywords TEXT[] DEFAULT '{}',
    preferred_sources TEXT[] DEFAULT '{}',
    minimum_relevance_score DECIMAL(3,2) DEFAULT 0.6,
    notification_frequency VARCHAR(50) DEFAULT 'daily' CHECK (notification_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'never')),
    idea_generation_enabled BOOLEAN DEFAULT TRUE,
    auto_save_high_relevance BOOLEAN DEFAULT FALSE,
    relevance_threshold_for_auto_save DECIMAL(3,2) DEFAULT 0.85,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_news_sources_user_id ON news_sources(user_id);
CREATE INDEX idx_news_sources_active ON news_sources(is_active);
CREATE INDEX idx_news_sources_last_fetched ON news_sources(last_fetched_at);
CREATE INDEX idx_news_articles_source_id ON news_articles(source_id);
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX idx_news_articles_url ON news_articles(article_url);
CREATE INDEX idx_article_relevance_user_id ON article_relevance_scores(user_id);
CREATE INDEX idx_article_relevance_score ON article_relevance_scores(relevance_score DESC);
CREATE INDEX idx_article_relevance_featured ON article_relevance_scores(is_featured);
CREATE INDEX idx_content_ideas_user_id ON content_ideas(user_id);
CREATE INDEX idx_content_ideas_status ON content_ideas(status);
CREATE INDEX idx_content_ideas_article_id ON content_ideas(article_id);
CREATE INDEX idx_news_fetch_history_source_id ON news_fetch_history(source_id);
CREATE INDEX idx_news_fetch_history_created_at ON news_fetch_history(created_at);

-- Full text search indexes
CREATE INDEX idx_news_articles_title_search ON news_articles USING gin(to_tsvector('english', title));
CREATE INDEX idx_news_articles_content_search ON news_articles USING gin(to_tsvector('english', coalesce(content, '') || ' ' || coalesce(summary, '')));

-- Update triggers
CREATE TRIGGER update_news_sources_updated_at BEFORE UPDATE ON news_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_news_preferences_updated_at BEFORE UPDATE ON user_news_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_ideas_updated_at BEFORE UPDATE ON content_ideas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE news_sources IS 'RSS/JSON feed sources configured by users';
COMMENT ON TABLE news_articles IS 'Articles fetched from news sources';
COMMENT ON TABLE article_relevance_scores IS 'AI-calculated relevance scores for articles per user';
COMMENT ON TABLE user_article_interactions IS 'Track how users interact with articles';
COMMENT ON TABLE content_ideas IS 'AI-generated content ideas based on news articles';
COMMENT ON TABLE news_fetch_history IS 'History of feed fetching for monitoring and debugging';
COMMENT ON TABLE user_news_preferences IS 'User preferences for news aggregation and notifications';