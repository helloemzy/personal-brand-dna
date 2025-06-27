-- Token Encryption and Security Tables Migration
-- This migration adds comprehensive token security infrastructure

-- Table for storing encrypted tokens
CREATE TABLE IF NOT EXISTS encrypted_tokens (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    encrypted_data TEXT NOT NULL, -- JSON containing encrypted token package
    token_type VARCHAR(50) NOT NULL, -- jwt, oauth, session, refresh
    purpose VARCHAR(100), -- authentication, password_reset, email_verification, etc.
    expires_at TIMESTAMP NOT NULL,
    device_info JSONB, -- Device fingerprint and info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revocation_reason VARCHAR(255),
    
    -- Indexes for performance
    INDEX idx_encrypted_tokens_user_id (user_id),
    INDEX idx_encrypted_tokens_expires_at (expires_at),
    INDEX idx_encrypted_tokens_token_type (token_type),
    INDEX idx_encrypted_tokens_revoked (revoked)
);

-- Table for token revocation list
CREATE TABLE IF NOT EXISTS token_revocation_list (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(255) NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Unique constraint to prevent duplicate revocations
    UNIQUE(token_id),
    
    -- Index for fast lookups
    INDEX idx_revocation_list_token_id (token_id),
    INDEX idx_revocation_list_user_id (user_id),
    INDEX idx_revocation_list_revoked_at (revoked_at)
);

-- Table for JWT-specific revocation (for backward compatibility)
CREATE TABLE IF NOT EXISTS jwt_revocation_list (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    
    INDEX idx_jwt_revocation_jti (jti)
);

-- Table for tracking token metadata
CREATE TABLE IF NOT EXISTS token_metadata (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    
    INDEX idx_token_metadata_user_id (user_id),
    INDEX idx_token_metadata_expires_at (expires_at),
    INDEX idx_token_metadata_last_used (last_used_at)
);

-- Table for token usage metrics
CREATE TABLE IF NOT EXISTS token_usage_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(255),
    request_count INTEGER NOT NULL,
    unique_ips INTEGER,
    unique_user_agents INTEGER,
    duration_ms BIGINT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_usage_metrics_user_id (user_id),
    INDEX idx_usage_metrics_logged_at (logged_at)
);

-- Table for JWT key rotation tracking
CREATE TABLE IF NOT EXISTS jwt_key_rotation (
    id SERIAL PRIMARY KEY,
    old_secret_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of old secret
    new_secret_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of new secret
    rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_by INTEGER REFERENCES users(id),
    grace_period_end TIMESTAMP,
    notes TEXT,
    
    INDEX idx_key_rotation_rotated_at (rotated_at)
);

-- Add token_hash column to user_sessions if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_sessions' 
        AND column_name = 'token_hash'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN token_hash VARCHAR(64);
        CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
    END IF;
END $$;

-- Add security event types for token operations
INSERT INTO security_events (event_type, event_data)
VALUES 
    ('token_encryption_enabled', '{"description": "Token encryption system activated"}'),
    ('key_rotation', '{"description": "Encryption key rotation performed"}')
ON CONFLICT DO NOTHING;

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Delete expired encrypted tokens
    DELETE FROM encrypted_tokens 
    WHERE expires_at < NOW() - INTERVAL '30 days'
    AND revoked = false;
    
    -- Delete old revocation entries
    DELETE FROM token_revocation_list 
    WHERE revoked_at < NOW() - INTERVAL '90 days';
    
    -- Delete old JWT revocations
    DELETE FROM jwt_revocation_list 
    WHERE revoked_at < NOW() - INTERVAL '90 days';
    
    -- Delete old token metadata
    DELETE FROM token_metadata 
    WHERE expires_at < NOW() - INTERVAL '30 days';
    
    -- Delete old usage metrics
    DELETE FROM token_usage_metrics 
    WHERE logged_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- Note: This is commented out as pg_cron may not be available
-- Uncomment if pg_cron is installed
/*
SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens()');
*/

-- Create view for token security dashboard
CREATE OR REPLACE VIEW token_security_overview AS
SELECT 
    (SELECT COUNT(*) FROM encrypted_tokens WHERE expires_at > NOW()) as active_tokens,
    (SELECT COUNT(*) FROM encrypted_tokens WHERE revoked = true) as revoked_tokens,
    (SELECT COUNT(*) FROM encrypted_tokens WHERE expires_at < NOW() AND revoked = false) as expired_tokens,
    (SELECT COUNT(DISTINCT user_id) FROM encrypted_tokens WHERE expires_at > NOW()) as unique_users,
    (SELECT AVG(usage_count) FROM token_metadata WHERE last_used_at > NOW() - INTERVAL '24 hours') as avg_daily_usage,
    (SELECT MAX(rotated_at) FROM jwt_key_rotation) as last_key_rotation,
    (SELECT COUNT(*) FROM token_revocation_list WHERE revoked_at > NOW() - INTERVAL '24 hours') as daily_revocations;

-- Grant appropriate permissions
GRANT SELECT ON token_security_overview TO authenticated;
GRANT SELECT, INSERT, UPDATE ON encrypted_tokens TO authenticated;
GRANT SELECT, INSERT ON token_revocation_list TO authenticated;
GRANT SELECT ON jwt_revocation_list TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE encrypted_tokens IS 'Stores all encrypted tokens with metadata for security tracking';
COMMENT ON TABLE token_revocation_list IS 'Central revocation list for all token types';
COMMENT ON TABLE jwt_revocation_list IS 'JWT-specific revocation list for backward compatibility';
COMMENT ON TABLE token_metadata IS 'Tracks token usage patterns and metadata';
COMMENT ON TABLE token_usage_metrics IS 'Aggregated token usage metrics for security monitoring';
COMMENT ON TABLE jwt_key_rotation IS 'Tracks JWT signing key rotation history';