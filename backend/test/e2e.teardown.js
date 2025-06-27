// Global teardown for e2e tests
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = async () => {
  console.log('\n🧹 Starting E2E test cleanup...\n');

  try {
    // Stop test containers if using Docker
    if (process.env.USE_DOCKER_DB === 'true') {
      console.log('Stopping test database containers...');
      await execAsync('docker-compose -f docker-compose.test.yml down');
    }

    // Clean up any test files
    if (process.env.CLEANUP_TEST_FILES === 'true') {
      console.log('Cleaning up test files...');
      await execAsync('rm -rf /tmp/test-uploads-*');
    }

    console.log('✅ E2E test cleanup complete\n');
  } catch (error) {
    console.error('❌ E2E test cleanup failed:', error);
    // Don't throw - cleanup errors shouldn't fail the test run
  }
};