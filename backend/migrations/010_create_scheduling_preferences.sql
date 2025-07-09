-- Migration: Create Scheduling Preferences Table
-- Version: 010
-- Description: User preferences for content scheduling and automation

-- Create user preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Scheduling preferences as JSONB for flexibility
    scheduling_preferences JSONB DEFAULT '{
        "postingFrequency": "weekdays",
        "postsPerDay": 1,
        "postsPerWeek": 5,
        "preferredTimes": ["09:00", "12:00", "17:00"],
        "excludeWeekends": true,
        "timezone": "America/New_York",
        "contentDistribution": {
            "expertise": 40,
            "experience": 35,
            "evolution": 25
        }
    }'::jsonb,
    
    -- Other preferences can be added here
    notification_preferences JSONB DEFAULT '{}'::jsonb,
    display_preferences JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_preferences UNIQUE(user_id)
);

-- Create index for user lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Create update trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add scheduling stats to content_slots table (if not exists)
ALTER TABLE content_slots 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2) DEFAULT 0;

-- Create scheduling history table for analytics
CREATE TABLE IF NOT EXISTS scheduling_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Scheduling details
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_by VARCHAR(50) NOT NULL CHECK (scheduled_by IN ('manual', 'auto', 'bulk', 'recurring')),
    content_count INTEGER NOT NULL,
    
    -- Preferences snapshot at time of scheduling
    preferences_snapshot JSONB NOT NULL,
    
    -- Results
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for analytics queries
CREATE INDEX idx_scheduling_history_user_id ON scheduling_history(user_id);
CREATE INDEX idx_scheduling_history_scheduled_at ON scheduling_history(scheduled_at);
CREATE INDEX idx_scheduling_history_scheduled_by ON scheduling_history(scheduled_by);

-- Create view for user scheduling stats
CREATE OR REPLACE VIEW user_scheduling_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT ce.id) as total_scheduled_posts,
    COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'published') as published_posts,
    COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'scheduled' AND ce.scheduled_for > NOW()) as upcoming_posts,
    COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'failed') as failed_posts,
    AVG(CASE WHEN ce.status = 'published' THEN 1 ELSE 0 END) * 100 as success_rate,
    MAX(ce.scheduled_for) as last_scheduled_for
FROM users u
LEFT JOIN calendar_events ce ON u.id = ce.user_id
WHERE ce.scheduled_for IS NOT NULL
GROUP BY u.id, u.email;

-- Add comments for documentation
COMMENT ON TABLE user_preferences IS 'Stores user preferences for scheduling, notifications, and display settings';
COMMENT ON TABLE scheduling_history IS 'Tracks scheduling actions for analytics and optimization';
COMMENT ON COLUMN user_preferences.scheduling_preferences IS 'JSON object containing all scheduling-related preferences';
COMMENT ON COLUMN scheduling_history.preferences_snapshot IS 'Snapshot of user preferences at the time of scheduling';