-- MINIMAL FIX: Just add the missing columns for registration

-- 1. Add company column
ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(200);

-- 2. Add industry column  
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);

-- 3. Add role column
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100);

-- 4. Add verification_token column
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);

-- 5. Add is_verified column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 6. Check what columns we have now
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;