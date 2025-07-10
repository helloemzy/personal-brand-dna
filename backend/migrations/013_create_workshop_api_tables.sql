-- Create workshop results table for storing processed results
CREATE TABLE IF NOT EXISTS workshop_results (
  id VARCHAR(255) PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add indexes for performance
  INDEX idx_workshop_results_user_id (user_id),
  INDEX idx_workshop_results_session_id (session_id),
  INDEX idx_workshop_results_created_at (created_at DESC)
);

-- Create shared results table for public sharing
CREATE TABLE IF NOT EXISTS shared_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_code VARCHAR(8) UNIQUE NOT NULL,
  result_id VARCHAR(255) NOT NULL REFERENCES workshop_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  results JSONB NOT NULL, -- Cached subset of results for public viewing
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add indexes
  INDEX idx_shared_results_share_code (share_code),
  INDEX idx_shared_results_user_id (user_id),
  INDEX idx_shared_results_expires_at (expires_at)
);

-- Create workshop checkpoints table for recovery
CREATE TABLE IF NOT EXISTS workshop_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkpoint_data JSONB NOT NULL,
  step_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Keep only last 5 checkpoints per session
  INDEX idx_workshop_checkpoints_session (session_id, created_at DESC)
);

-- Add columns to workshop_sessions if they don't exist
ALTER TABLE workshop_sessions 
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS local_changes JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS conflict_resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS result_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Create function to clean old checkpoints
CREATE OR REPLACE FUNCTION clean_old_checkpoints()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep only the 5 most recent checkpoints per session
  DELETE FROM workshop_checkpoints
  WHERE session_id = NEW.session_id
  AND id NOT IN (
    SELECT id FROM workshop_checkpoints
    WHERE session_id = NEW.session_id
    ORDER BY created_at DESC
    LIMIT 5
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for checkpoint cleanup
CREATE TRIGGER clean_checkpoints_trigger
  AFTER INSERT ON workshop_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION clean_old_checkpoints();

-- Create function to expire old shared results
CREATE OR REPLACE FUNCTION expire_shared_results()
RETURNS void AS $$
BEGIN
  DELETE FROM shared_results
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create view for workshop analytics
CREATE VIEW workshop_analytics AS
SELECT 
  ws.user_id,
  ws.id as session_id,
  ws.status,
  ws.progress_percentage,
  ws.created_at as started_at,
  ws.completed_at,
  ws.current_step,
  array_length(ws.completed_steps, 1) as steps_completed,
  wr.id as result_id,
  EXTRACT(EPOCH FROM (ws.completed_at - ws.created_at))/60 as completion_time_minutes,
  COUNT(wc.id) as checkpoint_count
FROM workshop_sessions ws
LEFT JOIN workshop_results wr ON ws.id = wr.session_id
LEFT JOIN workshop_checkpoints wc ON ws.id = wc.session_id
GROUP BY ws.id, wr.id;

-- Add RLS policies
ALTER TABLE workshop_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_checkpoints ENABLE ROW LEVEL SECURITY;

-- Users can only see their own workshop results
CREATE POLICY "Users can view own workshop results" ON workshop_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workshop results" ON workshop_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workshop results" ON workshop_results
  FOR UPDATE USING (auth.uid() = user_id);

-- Shared results are public but can only be created by owner
CREATE POLICY "Anyone can view shared results" ON shared_results
  FOR SELECT USING (true);

CREATE POLICY "Users can create own shared results" ON shared_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared results" ON shared_results
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared results" ON shared_results
  FOR DELETE USING (auth.uid() = user_id);

-- Checkpoints are private to users
CREATE POLICY "Users can view own checkpoints" ON workshop_checkpoints
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checkpoints" ON workshop_checkpoints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_status ON workshop_sessions(status);
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_user_status ON workshop_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workshop_results_archetype ON workshop_results((results->>'archetype'));

-- Add sample data for development (remove in production)
-- INSERT INTO workshop_results (id, session_id, user_id, results) 
-- SELECT ... (sample data here)