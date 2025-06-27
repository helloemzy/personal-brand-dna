-- Content Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'article', 'carousel', 'video', 'story', 'poll')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'cancelled')),
    
    -- Content data
    content_body TEXT,
    content_data JSONB DEFAULT '{}', -- Structured content (carousel slides, poll options, etc.)
    media_urls TEXT[] DEFAULT '{}',
    hashtags TEXT[] DEFAULT '{}',
    mentions TEXT[] DEFAULT '{}',
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    time_zone VARCHAR(50) DEFAULT 'UTC',
    
    -- Platform targeting
    platforms JSONB DEFAULT '{"linkedin": true}', -- Can expand to other platforms
    platform_specific_data JSONB DEFAULT '{}',
    
    -- Source tracking
    source_type VARCHAR(50) CHECK (source_type IN ('manual', 'idea', 'template', 'recurring')),
    source_id UUID, -- References content_ideas, templates, or recurring_templates
    
    -- Performance tracking
    performance_data JSONB DEFAULT '{}',
    engagement_score DECIMAL(5,2),
    
    -- Calendar display
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for calendar display
    all_day BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER DEFAULT 30,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recurring Content Templates Table
CREATE TABLE IF NOT EXISTS recurring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL,
    template_data JSONB NOT NULL, -- Template structure with variables
    
    -- Recurrence pattern
    recurrence_rule VARCHAR(255) NOT NULL, -- RRULE format
    recurrence_start_date DATE NOT NULL,
    recurrence_end_date DATE,
    next_occurrence_date DATE,
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    auto_schedule BOOLEAN DEFAULT FALSE,
    advance_days INTEGER DEFAULT 7, -- How many days in advance to create events
    
    -- Content variations
    variations JSONB DEFAULT '[]', -- Array of content variations to cycle through
    current_variation_index INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content Series Table (for multi-part content)
CREATE TABLE IF NOT EXISTS content_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    series_type VARCHAR(50) CHECK (series_type IN ('sequential', 'thematic', 'campaign')),
    total_parts INTEGER NOT NULL,
    current_part INTEGER DEFAULT 0,
    
    -- Series metadata
    series_data JSONB DEFAULT '{}',
    hashtag VARCHAR(100), -- Unique series hashtag
    
    -- Scheduling preferences
    parts_interval_days INTEGER DEFAULT 1,
    preferred_time TIME,
    preferred_days_of_week INTEGER[] DEFAULT '{}', -- 0=Sunday, 6=Saturday
    
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planning', 'active', 'completed', 'paused')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Link calendar events to series
CREATE TABLE IF NOT EXISTS calendar_event_series (
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES content_series(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL,
    PRIMARY KEY (event_id, series_id)
);

-- Content Calendar Views Table (saved calendar filters/views)
CREATE TABLE IF NOT EXISTS calendar_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    view_type VARCHAR(50) DEFAULT 'month' CHECK (view_type IN ('month', 'week', 'day', 'list', 'schedule')),
    filters JSONB DEFAULT '{}', -- Content types, statuses, etc.
    is_default BOOLEAN DEFAULT FALSE,
    color_scheme JSONB DEFAULT '{}', -- Custom colors for different content types
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content Slots Table (for optimal posting times)
CREATE TABLE IF NOT EXISTS content_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    time_slot TIME NOT NULL,
    slot_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Performance data for this slot
    avg_engagement_rate DECIMAL(5,2),
    total_posts INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, day_of_week, time_slot)
);

-- Calendar Collaborators Table (for team features)
CREATE TABLE IF NOT EXISTS calendar_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collaborator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) DEFAULT 'viewer' CHECK (permission_level IN ('viewer', 'editor', 'admin')),
    can_publish BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(calendar_owner_id, collaborator_id)
);

-- Content Approval Workflow Table
CREATE TABLE IF NOT EXISTS content_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested')),
    comments TEXT,
    
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(event_id)
);

-- Calendar Analytics Table
CREATE TABLE IF NOT EXISTS calendar_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Daily metrics
    posts_scheduled INTEGER DEFAULT 0,
    posts_published INTEGER DEFAULT 0,
    posts_failed INTEGER DEFAULT 0,
    
    -- Engagement metrics
    total_views INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,2),
    
    -- Content type breakdown
    content_type_stats JSONB DEFAULT '{}',
    
    -- Best performing content
    top_post_id UUID REFERENCES calendar_events(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_scheduled_for ON calendar_events(scheduled_for);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_content_type ON calendar_events(content_type);
CREATE INDEX idx_calendar_events_published_at ON calendar_events(published_at);
CREATE INDEX idx_recurring_templates_user_id ON recurring_templates(user_id);
CREATE INDEX idx_recurring_templates_next_occurrence ON recurring_templates(next_occurrence_date);
CREATE INDEX idx_content_series_user_id ON content_series(user_id);
CREATE INDEX idx_content_series_status ON content_series(status);
CREATE INDEX idx_calendar_analytics_user_date ON calendar_analytics(user_id, date);
CREATE INDEX idx_calendar_collaborators_collaborator ON calendar_collaborators(collaborator_id);

-- Full text search index
CREATE INDEX idx_calendar_events_search ON calendar_events 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(content_body, '')));

-- Update triggers
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_templates_updated_at BEFORE UPDATE ON recurring_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_series_updated_at BEFORE UPDATE ON content_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_views_updated_at BEFORE UPDATE ON calendar_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE calendar_events IS 'Main content calendar events table';
COMMENT ON TABLE recurring_templates IS 'Templates for recurring content generation';
COMMENT ON TABLE content_series IS 'Multi-part content series management';
COMMENT ON TABLE calendar_event_series IS 'Links events to content series';
COMMENT ON TABLE calendar_views IS 'Saved calendar views and filters';
COMMENT ON TABLE content_slots IS 'Optimal posting time slots based on performance';
COMMENT ON TABLE calendar_collaborators IS 'Team collaboration permissions';
COMMENT ON TABLE content_approvals IS 'Content approval workflow tracking';
COMMENT ON TABLE calendar_analytics IS 'Daily calendar and content performance metrics';