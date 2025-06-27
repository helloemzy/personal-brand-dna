module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage-e2e',
  collectCoverageFrom: [
    'api/**/*.js',
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/__tests__/**'
  ],
  testMatch: [
    '**/__tests__/e2e/**/*.test.js'
  ],
  verbose: true,
  testTimeout: 30000, // 30 seconds for e2e tests
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  // Run tests sequentially for e2e
  maxWorkers: 1,
  // Global setup and teardown
  globalSetup: '<rootDir>/test/e2e.setup.js',
  globalTeardown: '<rootDir>/test/e2e.teardown.js'
};