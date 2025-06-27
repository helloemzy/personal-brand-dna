-- General performance indexes for core application functionality
-- These indexes optimize the most common queries across the application

-- User authentication and lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, email_verified);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status) WHERE subscription_status != 'free';

-- Voice profiles and signatures
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_active ON voice_profiles(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_voice_signatures_profile_id ON voice_signatures(voice_profile_id);

-- Content generation and history
CREATE INDEX IF NOT EXISTS idx_content_generated_user_id ON content_generated(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_generated_status ON content_generated(user_id, status) WHERE status IN ('draft', 'published');
CREATE INDEX IF NOT EXISTS idx_content_generated_type ON content_generated(content_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_generated_search ON content_generated USING gin(to_tsvector('english', content));

-- User sessions and authentication
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens ON password_reset_tokens(token, expires_at) WHERE used = false;

-- Payments and subscriptions
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC) WHERE status IN ('pending', 'processing');

-- Analytics and usage tracking
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_feature ON usage_logs(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id, event_type, created_at DESC);

-- Email verification and OTP
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token) WHERE verified = false;
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email, created_at DESC) WHERE used = false AND expires_at > NOW();

-- Performance optimization for JOINs
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_user ON voice_transcriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type, is_active) WHERE is_active = true;

-- Partial indexes for common WHERE clauses
CREATE INDEX IF NOT EXISTS idx_users_active_subscribers ON users(id, email) WHERE subscription_status IN ('professional', 'executive', 'enterprise');
CREATE INDEX IF NOT EXISTS idx_content_recent ON content_generated(user_id, created_at) WHERE created_at > NOW() - INTERVAL '30 days';

-- Update table statistics after creating indexes
ANALYZE users;
ANALYZE voice_profiles;
ANALYZE voice_signatures;
ANALYZE content_generated;
ANALYZE user_sessions;
ANALYZE payments;
ANALYZE usage_logs;

-- Add comments to explain index purpose
COMMENT ON INDEX idx_users_email IS 'Primary lookup for user authentication';
COMMENT ON INDEX idx_content_generated_search IS 'Full-text search on generated content';
COMMENT ON INDEX idx_users_active_subscribers IS 'Quick lookup for paid subscribers';
COMMENT ON INDEX idx_content_recent IS 'Optimize dashboard queries for recent content';