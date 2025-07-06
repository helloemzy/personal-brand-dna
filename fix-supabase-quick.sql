-- Quick fix for Supabase users table
-- Run this SQL in the Supabase SQL Editor

-- 1. First, add the missing company column
ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(200);

-- 2. Add other professional info columns if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100);

-- 3. Add the verification fields that the code expects
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 4. Verify the structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;