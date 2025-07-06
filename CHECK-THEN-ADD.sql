-- First, let's see what columns already exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY column_name;

-- Based on the errors, you likely need to add these specific ones
-- Run only the ones that are missing from the above query:

-- If 'status' is missing (this was mentioned in your error):
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- If 'verification_token' is missing:
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);

-- If 'is_verified' is missing:
ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- If 'industry' is missing:
ALTER TABLE users ADD COLUMN industry VARCHAR(100);

-- If 'role' is missing:
ALTER TABLE users ADD COLUMN role VARCHAR(100);