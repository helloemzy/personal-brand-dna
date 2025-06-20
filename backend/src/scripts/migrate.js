const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database migration script
async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://pbdna_user:pbdna_password@localhost:5432/pbdna_dev'
  });

  try {
    const client = await pool.connect();
    
    // Check if we need to run initial schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('📋 Running initial database schema...');
      
      // Read and execute init.sql
      const initSqlPath = path.join(__dirname, '../../../infrastructure/init.sql');
      
      if (fs.existsSync(initSqlPath)) {
        const initSql = fs.readFileSync(initSqlPath, 'utf8');
        await client.query(initSql);
        console.log('✅ Initial schema created successfully');
      } else {
        console.error('❌ init.sql file not found at:', initSqlPath);
        process.exit(1);
      }
    } else {
      console.log('✅ Database schema already exists');
    }
    
    // Check for any additional migrations needed
    // This is where you would add version-specific migrations
    
    // Check for email verification fields in users table
    const verificationFieldsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'verification_token_hash'
    `);
    
    if (verificationFieldsCheck.rows.length === 0) {
      console.log('📋 Adding email verification fields to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
      `);
      console.log('✅ Email verification fields added to users table');
    }
    
    // Check for voice_transcriptions table
    const voiceTranscriptionsCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'voice_transcriptions'
    `);
    
    if (voiceTranscriptionsCheck.rows.length === 0) {
      console.log('📋 Adding voice_transcriptions table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS voice_transcriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          conversation_id UUID NOT NULL,
          question_id VARCHAR(50) NOT NULL,
          audio_url VARCHAR(500),
          transcription TEXT NOT NULL,
          confidence DECIMAL(4,3),
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_user_id ON voice_transcriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_conversation_id ON voice_transcriptions(conversation_id);
        
        CREATE TRIGGER update_voice_transcriptions_updated_at 
        BEFORE UPDATE ON voice_transcriptions 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
      console.log('✅ voice_transcriptions table added');
    }
    
    client.release();
    console.log('🎉 All migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };