module.exports = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.js'],
  setupFilesAfterEnv: ['./test/setup.js'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 1, // Run integration tests sequentially
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/scripts/**',
    '!node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  globalSetup: './test/integration.setup.js',
  globalTeardown: './test/integration.teardown.js'
};