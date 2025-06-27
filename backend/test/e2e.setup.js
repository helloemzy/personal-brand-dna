// Global setup for e2e tests
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = async () => {
  console.log('\n🚀 Starting E2E test setup...\n');

  try {
    // Start test database if using Docker
    if (process.env.USE_DOCKER_DB === 'true') {
      console.log('Starting test database container...');
      await execAsync('docker-compose -f docker-compose.test.yml up -d postgres-test redis-test');
      
      // Wait for database to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Run test database migrations
    console.log('Running test database migrations...');
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/pbdna_test';
    
    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret-e2e';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.OPENAI_API_KEY = 'sk-test-mock';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/mock-google-creds.json';
    
    console.log('✅ E2E test setup complete\n');
  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    throw error;
  }
};