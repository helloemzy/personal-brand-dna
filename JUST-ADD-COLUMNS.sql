-- Just add ALL the missing columns one by one
-- Run each line separately if needed

ALTER TABLE users ADD COLUMN company VARCHAR(200);
ALTER TABLE users ADD COLUMN industry VARCHAR(100);
ALTER TABLE users ADD COLUMN role VARCHAR(100);
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN linkedin_url VARCHAR(500);
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verification_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP WITH TIME ZONE;