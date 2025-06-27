const { Pool } = require('pg');
const Redis = require('redis');

// Test database connections before deployment
async function testConnections() {
  console.log('🧪 Testing database connections...\n');

  // Test PostgreSQL (Supabase)
  console.log('📊 Testing PostgreSQL (Supabase)...');
  try {
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pgPool.connect();
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ PostgreSQL connected successfully!');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   Version: ${result.rows[0].postgres_version.split(' ')[0]}\n`);
    
    // Test schema exists
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`📋 Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    console.log('');
    
    client.release();
    await pgPool.end();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.log('');
  }

  // Test Redis (Upstash)
  console.log('🔄 Testing Redis (Upstash)...');
  try {
    const redisClient = Redis.createClient({
      url: process.env.REDIS_URL
    });

    await redisClient.connect();
    
    // Test basic operations
    await redisClient.set('test_key', 'test_value');
    const value = await redisClient.get('test_key');
    await redisClient.del('test_key');
    
    console.log('✅ Redis connected successfully!');
    console.log(`   Test value: ${value}`);
    
    // Test Redis info
    const info = await redisClient.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`   Version: ${version}\n`);
    
    await redisClient.disconnect();
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('');
  }

  console.log('🎉 Connection testing complete!');
}

// Check environment variables
function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...\n');
  
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'JWT_SECRET'
  ];
  
  const optionalVars = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SENDGRID_API_KEY',
    'STRIPE_SECRET_KEY'
  ];
  
  console.log('📋 Required variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${varName}: Missing`);
    }
  });
  
  console.log('\n📋 Optional variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ⚠️  ${varName}: Not set`);
    }
  });
  
  console.log('');
}

// Main execution
async function main() {
  console.log('🚀 Personal Brand DNA - Connection Test\n');
  
  // Load environment variables
  require('dotenv').config();
  
  checkEnvironmentVariables();
  await testConnections();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testConnections, checkEnvironmentVariables };