-- Workshop Sessions Table
CREATE TABLE IF NOT EXISTS workshop_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_saved_at TIMESTAMP WITH TIME ZONE,
    current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 5),
    completed_steps INTEGER[] DEFAULT '{}',
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Values Table
CREATE TABLE IF NOT EXISTS workshop_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
    value_id VARCHAR(255) NOT NULL,
    value_name VARCHAR(255) NOT NULL,
    value_category VARCHAR(100) NOT NULL,
    value_description TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    ranking INTEGER CHECK (ranking >= 1 AND ranking <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Tone Preferences Table
CREATE TABLE IF NOT EXISTS workshop_tone_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
    formal_casual INTEGER NOT NULL CHECK (formal_casual >= -50 AND formal_casual <= 50),
    concise_detailed INTEGER NOT NULL CHECK (concise_detailed >= -50 AND concise_detailed <= 50),
    analytical_creative INTEGER NOT NULL CHECK (analytical_creative >= -50 AND analytical_creative <= 50),
    serious_playful INTEGER NOT NULL CHECK (serious_playful >= -50 AND serious_playful <= 50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Audience Personas Table
CREATE TABLE IF NOT EXISTS workshop_audience_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
    persona_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    industry VARCHAR(255) NOT NULL,
    pain_points TEXT[] DEFAULT '{}',
    goals TEXT[] DEFAULT '{}',
    communication_style VARCHAR(50) CHECK (communication_style IN ('formal', 'casual', 'technical', 'conversational')),
    age_range VARCHAR(50),
    experience_level VARCHAR(100),
    company_size VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Writing Samples Table
CREATE TABLE IF NOT EXISTS workshop_writing_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
    sample_text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    readability_score DECIMAL(5,2),
    sentiment_scores JSONB,
    style_metrics JSONB,
    analysis_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Quiz Responses Table
CREATE TABLE IF NOT EXISTS workshop_quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    answer VARCHAR(10) NOT NULL,
    dimension VARCHAR(50) NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Analysis Results Table (consolidated results)
CREATE TABLE IF NOT EXISTS workshop_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_voice_profile JSONB NOT NULL,
    content_pillars TEXT[] DEFAULT '{}',
    communication_style JSONB,
    personality_traits JSONB,
    recommended_content_types TEXT[] DEFAULT '{}',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_workshop_sessions_user_id ON workshop_sessions(user_id);
CREATE INDEX idx_workshop_sessions_session_id ON workshop_sessions(session_id);
CREATE INDEX idx_workshop_sessions_completed ON workshop_sessions(is_completed);
CREATE INDEX idx_workshop_values_session_id ON workshop_values(session_id);
CREATE INDEX idx_workshop_tone_preferences_session_id ON workshop_tone_preferences(session_id);
CREATE INDEX idx_workshop_audience_personas_session_id ON workshop_audience_personas(session_id);
CREATE INDEX idx_workshop_writing_samples_session_id ON workshop_writing_samples(session_id);
CREATE INDEX idx_workshop_quiz_responses_session_id ON workshop_quiz_responses(session_id);
CREATE INDEX idx_workshop_analysis_results_user_id ON workshop_analysis_results(user_id);
CREATE INDEX idx_workshop_analysis_results_session_id ON workshop_analysis_results(session_id);

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_workshop_sessions_updated_at BEFORE UPDATE ON workshop_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workshop_tone_preferences_updated_at BEFORE UPDATE ON workshop_tone_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workshop_audience_personas_updated_at BEFORE UPDATE ON workshop_audience_personas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workshop_analysis_results_updated_at BEFORE UPDATE ON workshop_analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE workshop_sessions IS 'Main workshop session tracking table';
COMMENT ON TABLE workshop_values IS 'User selected professional values from workshop step 1';
COMMENT ON TABLE workshop_tone_preferences IS 'Communication tone preferences from workshop step 2';
COMMENT ON TABLE workshop_audience_personas IS 'Target audience personas from workshop step 3';
COMMENT ON TABLE workshop_writing_samples IS 'User writing samples and analysis from workshop step 4';
COMMENT ON TABLE workshop_quiz_responses IS 'Personality quiz responses from workshop step 5';
COMMENT ON TABLE workshop_analysis_results IS 'Consolidated analysis results after workshop completion';