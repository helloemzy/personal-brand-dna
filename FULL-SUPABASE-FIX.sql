-- ============================================
-- COMPLETE SUPABASE DATABASE FIX FOR PERSONAL BRAND DNA
-- Run this entire script in your Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- STEP 1: Fix the users table structure
-- ============================================

-- First, let's see what columns already exist
DO $$
BEGIN
    -- Add missing columns that the auth.js code expects
    
    -- Add company column (required by registration)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'company') THEN
        ALTER TABLE users ADD COLUMN company VARCHAR(200);
        RAISE NOTICE 'Added company column';
    END IF;

    -- Add industry column (required by registration)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'industry') THEN
        ALTER TABLE users ADD COLUMN industry VARCHAR(100);
        RAISE NOTICE 'Added industry column';
    END IF;

    -- Add role column (required by registration)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(100);
        RAISE NOTICE 'Added role column';
    END IF;

    -- Add verification_token column (used in auth.js)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'verification_token') THEN
        ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
        RAISE NOTICE 'Added verification_token column';
    END IF;

    -- Add is_verified column (used in auth.js)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'is_verified') THEN
        ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_verified column';
    END IF;

    -- Add other essential columns if missing
    
    -- password_hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        RAISE NOTICE 'Added password_hash column';
    END IF;

    -- first_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
        RAISE NOTICE 'Added first_name column';
    END IF;

    -- last_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'last_name') THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
        RAISE NOTICE 'Added last_name column';
    END IF;

    -- subscription_tier
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'subscription_tier') THEN
        ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free';
        RAISE NOTICE 'Added subscription_tier column';
    END IF;

    -- subscription_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'subscription_status') THEN
        ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'active';
        RAISE NOTICE 'Added subscription_status column';
    END IF;

    -- created_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added created_at column';
    END IF;

    -- updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column';
    END IF;

END $$;

-- ============================================
-- STEP 2: Create other essential tables if they don't exist
-- ============================================

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_content_generated INTEGER DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE,
    last_voice_analysis TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    analytics_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create voice_profiles table (referenced in APIs)
CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    characteristics JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create content_history table (referenced in APIs)
CREATE TABLE IF NOT EXISTS content_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(500),
    content_type VARCHAR(50),
    generated_content TEXT,
    edited_content TEXT,
    voice_profile_id UUID REFERENCES voice_profiles(id),
    template_used VARCHAR(255),
    tone VARCHAR(100),
    length INTEGER,
    status VARCHAR(50) DEFAULT 'generated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create workshop_sessions table (referenced in workshop API)
CREATE TABLE IF NOT EXISTS workshop_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'in_progress',
    current_step INTEGER DEFAULT 1,
    data JSONB DEFAULT '{}',
    voice_profile_id UUID REFERENCES voice_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STEP 3: Create update trigger function
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- STEP 4: Add triggers to auto-update timestamps
-- ============================================

-- Add trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for user_profiles table
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for voice_profiles table
DROP TRIGGER IF EXISTS update_voice_profiles_updated_at ON voice_profiles;
CREATE TRIGGER update_voice_profiles_updated_at 
    BEFORE UPDATE ON voice_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for content_history table
DROP TRIGGER IF EXISTS update_content_history_updated_at ON content_history;
CREATE TRIGGER update_content_history_updated_at 
    BEFORE UPDATE ON content_history 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for workshop_sessions table
DROP TRIGGER IF EXISTS update_workshop_sessions_updated_at ON workshop_sessions;
CREATE TRIGGER update_workshop_sessions_updated_at 
    BEFORE UPDATE ON workshop_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 5: Create indexes for better performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_content_history_user_id ON content_history(user_id);
CREATE INDEX IF NOT EXISTS idx_content_history_created_at ON content_history(created_at);
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_user_id ON workshop_sessions(user_id);

-- ============================================
-- STEP 6: Verify the final structure
-- ============================================

-- Show all columns in the users table
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'users'
ORDER BY 
    ordinal_position;

-- Show all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Database setup completed successfully!';
    RAISE NOTICE 'All required tables and columns are ready.';
    RAISE NOTICE 'You can now test user registration.';
    RAISE NOTICE '===========================================';
END $$;