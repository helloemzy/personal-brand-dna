-- ============================================
-- PHONE AUTHENTICATION & VOICE DISCOVERY SCHEMA
-- Personal Brand DNA - AI Voice Call System
-- ============================================

-- 1. Update users table for phone-based auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+1';

-- Make email optional since we're using phone as primary
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add voice discovery status
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_discovery_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_discovery_completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Create voice_calls table for tracking discovery calls
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_sid VARCHAR(255) UNIQUE, -- Twilio/Vapi call ID
    phone_number VARCHAR(20) NOT NULL,
    call_status VARCHAR(50) DEFAULT 'initiated',
    call_duration_seconds INTEGER,
    recording_url TEXT,
    transcript_raw TEXT,
    transcript_processed JSONB,
    ai_analysis JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create discovery_conversations table for structured Q&A
CREATE TABLE IF NOT EXISTS discovery_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_sequence INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(100), -- 'background', 'values', 'goals', 'challenges', 'style'
    user_response TEXT,
    response_duration_seconds INTEGER,
    sentiment_score DECIMAL(3,2), -- -1 to 1
    energy_level VARCHAR(20), -- 'low', 'medium', 'high'
    authenticity_score DECIMAL(3,2), -- 0 to 1
    key_phrases TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create personal_brand_frameworks table
CREATE TABLE IF NOT EXISTS personal_brand_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voice_call_id UUID REFERENCES voice_calls(id),
    framework_version INTEGER DEFAULT 1,
    
    -- Core Brand Elements
    brand_archetype VARCHAR(100), -- 'Expert', 'Innovator', 'Mentor', 'Visionary', etc.
    value_proposition TEXT,
    unique_differentiators TEXT[],
    target_audience JSONB, -- Detailed persona definitions
    
    -- Voice & Tone
    communication_style JSONB, -- formal/casual, analytical/emotional, etc.
    voice_characteristics JSONB, -- pace, energy, vocabulary complexity
    authentic_phrases TEXT[], -- Captured from conversation
    
    -- Messaging Framework
    core_message TEXT,
    supporting_messages TEXT[],
    story_themes TEXT[],
    proof_points JSONB,
    
    -- Content Strategy
    content_pillars JSONB, -- Array of pillar objects with themes
    content_formats TEXT[], -- Preferred content types
    engagement_style VARCHAR(50), -- 'educator', 'storyteller', 'challenger', etc.
    
    -- Personality Insights
    personality_traits JSONB,
    strengths TEXT[],
    passion_indicators TEXT[],
    expertise_areas TEXT[],
    
    -- Metadata
    confidence_score DECIMAL(3,2), -- Overall framework confidence
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create discovery_questions table for dynamic conversation flow
CREATE TABLE IF NOT EXISTS discovery_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    question_category VARCHAR(100) NOT NULL,
    question_order INTEGER NOT NULL,
    follow_up_triggers JSONB, -- Conditions for follow-up questions
    analysis_keywords TEXT[], -- Keywords to look for in response
    min_response_seconds INTEGER DEFAULT 10,
    max_response_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create brand_framework_templates table
CREATE TABLE IF NOT EXISTS brand_framework_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(200) NOT NULL,
    expert_source VARCHAR(200), -- 'Seth Godin', 'Gary Vaynerchuk', etc.
    framework_structure JSONB NOT NULL,
    applicable_industries TEXT[],
    applicable_roles TEXT[],
    matching_criteria JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create voice_analysis_metrics table
CREATE TABLE IF NOT EXISTS voice_analysis_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Speech Patterns
    average_words_per_minute INTEGER,
    pause_frequency DECIMAL(5,2),
    filler_word_count INTEGER,
    vocabulary_complexity_score DECIMAL(3,2),
    
    -- Emotional Indicators
    enthusiasm_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    authenticity_markers JSONB,
    passion_topics TEXT[],
    
    -- Communication Style
    storytelling_tendency DECIMAL(3,2), -- 0 to 1
    data_orientation DECIMAL(3,2), -- 0 to 1
    emotional_expression DECIMAL(3,2), -- 0 to 1
    humor_usage DECIMAL(3,2), -- 0 to 1
    
    -- Linguistic Analysis
    sentence_complexity VARCHAR(20), -- 'simple', 'moderate', 'complex'
    active_vs_passive_ratio DECIMAL(3,2),
    personal_pronoun_usage DECIMAL(3,2),
    industry_jargon_frequency DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create phone_otp_logs table for security
CREATE TABLE IF NOT EXISTS phone_otp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'verified', 'expired', 'failed'
    attempts INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_voice_calls_user_id ON voice_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(call_status);
CREATE INDEX IF NOT EXISTS idx_discovery_conversations_voice_call_id ON discovery_conversations(voice_call_id);
CREATE INDEX IF NOT EXISTS idx_personal_brand_frameworks_user_id ON personal_brand_frameworks(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_brand_frameworks_active ON personal_brand_frameworks(is_active);
CREATE INDEX IF NOT EXISTS idx_phone_otp_logs_phone_expires ON phone_otp_logs(phone_number, expires_at);

-- Insert sample discovery questions
INSERT INTO discovery_questions (question_text, question_category, question_order, min_response_seconds, max_response_seconds) VALUES
('Tell me about yourself and what you do professionally. What gets you excited about your work?', 'background', 1, 20, 90),
('What would you say is your superpower - that thing you do better than most people?', 'strengths', 2, 15, 60),
('Describe a recent professional achievement that made you really proud. Walk me through what happened.', 'achievements', 3, 20, 90),
('What are the biggest challenges your ideal clients or colleagues face that you help solve?', 'value', 4, 15, 75),
('If you could only share one piece of advice with your industry, what would it be and why?', 'expertise', 5, 15, 60),
('Tell me about a time when you had to overcome a significant professional challenge. What did you learn?', 'resilience', 6, 20, 90),
('What values guide your professional decisions? Can you give me an example?', 'values', 7, 15, 75),
('How do you prefer to communicate complex ideas - through stories, data, analogies, or something else?', 'style', 8, 10, 45),
('What legacy do you want to create in your professional field?', 'vision', 9, 15, 60),
('What makes you different from others in your field? What''s your unique perspective?', 'differentiation', 10, 15, 75)
ON CONFLICT DO NOTHING;

-- Insert sample brand framework templates based on expert methodologies
INSERT INTO brand_framework_templates (template_name, expert_source, framework_structure) VALUES
('StoryBrand Framework', 'Donald Miller', '{
    "hero": "target_audience",
    "problem": {"external": "", "internal": "", "philosophical": ""},
    "guide": {"empathy": "", "authority": ""},
    "plan": {"process": [], "agreement": []},
    "call_to_action": {"direct": "", "transitional": ""},
    "success": "",
    "failure": ""
}'::jsonb),
('Personal Brand Pyramid', 'Dorie Clark', '{
    "foundation": {"values": [], "passions": [], "strengths": []},
    "differentiation": {"unique_value": "", "expertise": [], "perspective": ""},
    "visibility": {"content_themes": [], "platforms": [], "frequency": ""},
    "credibility": {"proof_points": [], "testimonials": [], "results": []}
}'::jsonb),
('Fascination Advantage', 'Sally Hogshead', '{
    "primary_advantage": "",
    "secondary_advantage": "",
    "dormant_advantage": "",
    "personality_brand": "",
    "communication_style": "",
    "ideal_scenarios": [],
    "pitfalls_to_avoid": []
}'::jsonb)
ON CONFLICT DO NOTHING;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_voice_calls_updated_at BEFORE UPDATE ON voice_calls
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_brand_frameworks_updated_at BEFORE UPDATE ON personal_brand_frameworks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();