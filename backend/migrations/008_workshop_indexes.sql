-- Workshop-specific performance indexes
-- Optimizes the brand workshop flow and data retrieval

-- Workshop sessions management
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_user_status ON workshop_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_current ON workshop_sessions(user_id, current_step) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_completed ON workshop_sessions(user_id, completed_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_updated ON workshop_sessions(updated_at DESC);

-- Values audit optimization
CREATE INDEX IF NOT EXISTS idx_workshop_values_session ON workshop_values(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_values_user ON workshop_values(session_id, is_core) WHERE is_core = true;
CREATE INDEX IF NOT EXISTS idx_workshop_values_ranking ON workshop_values(session_id, rank) WHERE rank IS NOT NULL;

-- Tone preferences
CREATE INDEX IF NOT EXISTS idx_workshop_tone_session ON workshop_tone_preferences(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_tone_dimension ON workshop_tone_preferences(session_id, dimension);

-- Audience personas
CREATE INDEX IF NOT EXISTS idx_workshop_audiences_session ON workshop_audience_personas(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_audiences_primary ON workshop_audience_personas(session_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_workshop_audiences_user ON workshop_audience_personas(session_id, created_at DESC);

-- Writing samples
CREATE INDEX IF NOT EXISTS idx_workshop_writing_session ON workshop_writing_samples(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_writing_analysis ON workshop_writing_samples(session_id, analysis_completed) WHERE analysis_completed = true;
CREATE INDEX IF NOT EXISTS idx_workshop_writing_search ON workshop_writing_samples USING gin(to_tsvector('english', sample_text));

-- Personality quiz
CREATE INDEX IF NOT EXISTS idx_workshop_personality_session ON workshop_personality_quiz(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_personality_traits ON workshop_personality_quiz(session_id, primary_trait);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_workshop_progress ON workshop_sessions(user_id, status, current_step) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_workshop_recent_activity ON workshop_sessions(user_id, updated_at DESC) WHERE updated_at > NOW() - INTERVAL '7 days';

-- Workshop analytics
CREATE INDEX IF NOT EXISTS idx_workshop_completion_time ON workshop_sessions(user_id, (completed_at - created_at)) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_workshop_step_duration ON workshop_sessions(current_step, updated_at) WHERE status = 'in_progress';

-- Optimize workshop data retrieval for dashboard
CREATE INDEX IF NOT EXISTS idx_workshop_dashboard ON workshop_sessions(user_id, status, completed_at DESC NULLS LAST);

-- Full-text search for workshop content
CREATE INDEX IF NOT EXISTS idx_workshop_personas_search ON workshop_audience_personas USING gin(to_tsvector('english', description || ' ' || pain_points || ' ' || goals));

-- Update statistics
ANALYZE workshop_sessions;
ANALYZE workshop_values;
ANALYZE workshop_tone_preferences;
ANALYZE workshop_audience_personas;
ANALYZE workshop_writing_samples;
ANALYZE workshop_personality_quiz;

-- Add helpful comments
COMMENT ON INDEX idx_workshop_sessions_current IS 'Quick lookup for active workshop sessions';
COMMENT ON INDEX idx_workshop_values_ranking IS 'Optimizes value ranking queries';
COMMENT ON INDEX idx_workshop_audiences_primary IS 'Fast retrieval of primary audience personas';
COMMENT ON INDEX idx_workshop_completion_time IS 'Analytics on workshop completion duration';