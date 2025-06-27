-- Personal Brand DNA Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    reset_token_hash VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    industry VARCHAR(100),
    role VARCHAR(100),
    company VARCHAR(200),
    linkedin_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_content_generated INTEGER DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE,
    last_voice_analysis TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    analytics_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Voice transcriptions table
CREATE TABLE IF NOT EXISTS voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transcript TEXT NOT NULL,
    audio_duration INTEGER,
    characteristics JSONB,
    voice_signature JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Generated content table
CREATE TABLE IF NOT EXISTS generated_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(500) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    template_used VARCHAR(100),
    content TEXT NOT NULL,
    voice_signature_used JSONB,
    status VARCHAR(50) DEFAULT 'generated',
    engagement_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscription history table
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255),
    plan_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content templates table
CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    structure TEXT NOT NULL,
    prompt_template TEXT NOT NULL,
    industry_tags TEXT[],
    content_types TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_user_id ON voice_transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_user_id ON generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON generated_content(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Create updated_at triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_transcriptions_updated_at 
    BEFORE UPDATE ON voice_transcriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_content_updated_at 
    BEFORE UPDATE ON generated_content 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_templates_updated_at 
    BEFORE UPDATE ON content_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample content templates
INSERT INTO content_templates (name, category, structure, prompt_template, industry_tags, content_types) VALUES
('Career Milestone Achievement', 'Professional Growth', 'Hook → Achievement → Impact → Lesson → CTA', 'Create a LinkedIn post about a career milestone that shows professional growth and inspires others.', ARRAY['General', 'Technology', 'Business'], ARRAY['Post', 'Story']),
('Industry Trend Analysis', 'Thought Leadership', 'Trend → Analysis → Personal Take → Future Implications → Engagement', 'Write a LinkedIn post analyzing an industry trend with your unique perspective and insights.', ARRAY['Technology', 'Business', 'Marketing'], ARRAY['Post', 'Article']),
('Personal Learning Story', 'Professional Development', 'Challenge → Process → Learning → Application → Takeaway', 'Share a personal learning experience that provides value to your professional network.', ARRAY['General'], ARRAY['Post', 'Story']),
('Company News Announcement', 'Corporate Communication', 'News → Context → Impact → Personal Connection → CTA', 'Announce company news in a way that reflects your voice and engages your network.', ARRAY['General'], ARRAY['Post']),
('Networking Connection', 'Relationship Building', 'Context → Value → Personal Touch → CTA → Gratitude', 'Create a networking post that builds meaningful professional relationships.', ARRAY['General'], ARRAY['Post']),
('Thought Leadership Opinion', 'Industry Insights', 'Controversial Take → Evidence → Personal Experience → Nuanced View → Discussion', 'Share a thought-provoking opinion that establishes thought leadership in your field.', ARRAY['Technology', 'Business', 'Marketing'], ARRAY['Post', 'Article']),
('Professional Quick Tips', 'Value Creation', 'Problem → Solution → Steps → Example → CTA', 'Share a quick professional tip that provides immediate value to your audience.', ARRAY['General'], ARRAY['Post']),
('Achievement Celebration', 'Success Stories', 'Achievement → Journey → Team Recognition → Gratitude → Future', 'Celebrate a professional achievement while staying humble and inspiring others.', ARRAY['General'], ARRAY['Post']),
('Learning & Development', 'Continuous Learning', 'Skill → Why Important → Learning Process → Application → Encouragement', 'Share insights about professional development and continuous learning.', ARRAY['General'], ARRAY['Post', 'Article']),
('Problem-Solution Case Study', 'Case Studies', 'Problem → Analysis → Solution → Results → Lessons', 'Present a professional challenge and how you solved it, providing value to others.', ARRAY['Technology', 'Business'], ARRAY['Post', 'Article'])
ON CONFLICT DO NOTHING;

-- Create a sample user for testing (optional)
-- INSERT INTO users (email, password_hash, first_name, last_name, email_verified) 
-- VALUES ('demo@personalbranddna.com', crypt('password123', gen_salt('bf')), 'Demo', 'User', true)
-- ON CONFLICT (email) DO NOTHING;

-- Success message
SELECT 'Database schema setup complete! 🎉' as message;