-- Create workshop_results table for storing completed workshop results
CREATE TABLE IF NOT EXISTS workshop_results (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) REFERENCES workshop_sessions(id) ON DELETE SET NULL,
  share_code VARCHAR(8) UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

-- Create indexes for better query performance
CREATE INDEX idx_workshop_results_user_id ON workshop_results(user_id);
CREATE INDEX idx_workshop_results_share_code ON workshop_results(share_code);
CREATE INDEX idx_workshop_results_expires_at ON workshop_results(expires_at);
CREATE INDEX idx_workshop_results_created_at ON workshop_results(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workshop_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workshop_results_updated_at
BEFORE UPDATE ON workshop_results
FOR EACH ROW
EXECUTE FUNCTION update_workshop_results_updated_at();