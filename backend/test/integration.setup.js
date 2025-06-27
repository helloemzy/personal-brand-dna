const { spawn } = require('child_process');
const { query } = require('../src/config/database');

module.exports = async () => {
  console.log('\n🚀 Setting up integration test environment...\n');

  // Ensure test database exists
  try {
    // Create test database if it doesn't exist
    await query(`
      SELECT 'CREATE DATABASE pbdna_test'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pbdna_test')
    `);
  } catch (error) {
    console.log('Test database already exists or cannot be created');
  }

  // Run migrations on test database
  console.log('Running database migrations...');
  await new Promise((resolve, reject) => {
    const migrate = spawn('npm', ['run', 'migrate:test'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pbdna_test'
      }
    });

    migrate.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Migrations completed successfully\n');
        resolve();
      } else {
        reject(new Error(`Migration process exited with code ${code}`));
      }
    });
  });

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-integration';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/pbdna_test';
  process.env.REDIS_URL = 'redis://localhost:6379/2'; // Use different Redis DB for tests
  
  // Mock external services
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './test/fixtures/test-google-creds.json';
  process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
  process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
  
  console.log('✅ Integration test environment ready\n');
};