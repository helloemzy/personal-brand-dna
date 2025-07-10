-- Create user feedback table for Phase 7: User Feedback System
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('nps', 'satisfaction', 'feature', 'bug', 'general')),
  rating INTEGER,
  feedback TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints for rating based on type
  CONSTRAINT valid_nps_rating CHECK (
    (type != 'nps') OR (rating >= 0 AND rating <= 10)
  ),
  CONSTRAINT valid_satisfaction_rating CHECK (
    (type != 'satisfaction') OR (rating >= 1 AND rating <= 5)
  ),
  CONSTRAINT rating_required CHECK (
    (type NOT IN ('nps', 'satisfaction')) OR (rating IS NOT NULL)
  )
);

-- Create feedback stats table for aggregated metrics
CREATE TABLE IF NOT EXISTS feedback_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  nps_score INTEGER,
  satisfaction_score INTEGER,
  total_feedback INTEGER DEFAULT 0,
  feedback_by_type JSONB DEFAULT '{}',
  average_ratings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique stats per user per period
  CONSTRAINT unique_user_period UNIQUE (user_id, period_start, period_end)
);

-- Create indexes for performance
CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_type ON user_feedback(type);
CREATE INDEX idx_user_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX idx_user_feedback_rating ON user_feedback(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_feedback_stats_user_period ON feedback_stats(user_id, period_start, period_end);

-- Create function to update feedback stats
CREATE OR REPLACE FUNCTION update_feedback_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- This would typically update aggregated stats
  -- For now, just update the timestamp
  UPDATE feedback_stats 
  SET updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND period_start <= DATE(NEW.created_at)
    AND period_end >= DATE(NEW.created_at);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update stats on new feedback
CREATE TRIGGER update_feedback_stats_trigger
  AFTER INSERT ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_stats();

-- Create view for recent feedback
CREATE VIEW recent_feedback AS
SELECT 
  f.*,
  u.email as user_email,
  u.first_name || ' ' || u.last_name as user_name
FROM user_feedback f
JOIN users u ON f.user_id = u.id
WHERE f.created_at >= NOW() - INTERVAL '30 days'
ORDER BY f.created_at DESC;

-- Create view for NPS calculation
CREATE VIEW nps_metrics AS
WITH nps_responses AS (
  SELECT
    DATE_TRUNC('month', created_at) as month,
    rating,
    CASE 
      WHEN rating >= 9 THEN 'promoter'
      WHEN rating >= 7 THEN 'passive'
      ELSE 'detractor'
    END as category
  FROM user_feedback
  WHERE type = 'nps'
    AND rating IS NOT NULL
)
SELECT
  month,
  COUNT(*) FILTER (WHERE category = 'promoter') as promoters,
  COUNT(*) FILTER (WHERE category = 'passive') as passives,
  COUNT(*) FILTER (WHERE category = 'detractor') as detractors,
  COUNT(*) as total,
  ROUND(
    ((COUNT(*) FILTER (WHERE category = 'promoter')::numeric - 
      COUNT(*) FILTER (WHERE category = 'detractor')::numeric) / 
     COUNT(*)::numeric) * 100
  ) as nps_score
FROM nps_responses
GROUP BY month
ORDER BY month DESC;

-- Add RLS policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_stats ENABLE ROW LEVEL SECURITY;

-- Users can only see and create their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own stats
CREATE POLICY "Users can view own stats" ON feedback_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Add sample feedback prompts configuration
CREATE TABLE IF NOT EXISTS feedback_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  context VARCHAR(100) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  questions TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default prompts
INSERT INTO feedback_prompts (context, title, questions) VALUES
  ('workshop_complete', 'How was your Brand House experience?', ARRAY[
    'How satisfied are you with your Brand House results?',
    'Did the workshop help clarify your personal brand?',
    'What could we improve about the workshop experience?'
  ]),
  ('content_generated', 'How''s your content working?', ARRAY[
    'How well does the generated content match your voice?',
    'Are you seeing engagement from your content?',
    'What types of content would you like to see more of?'
  ]),
  ('first_week', 'How''s your first week going?', ARRAY[
    'How likely are you to recommend BrandPillar AI to a colleague?',
    'What''s been most valuable so far?',
    'What challenges have you encountered?'
  ]),
  ('monthly_checkin', 'Monthly check-in', ARRAY[
    'How satisfied are you with BrandPillar AI overall?',
    'What impact has it had on your LinkedIn presence?',
    'What features would you like to see added?'
  ])
ON CONFLICT (context) DO NOTHING;