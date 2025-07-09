module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@brandpillar/shared$': '<rootDir>/../../packages/shared/src',
    '^@brandpillar/queue$': '<rootDir>/../../packages/queue/src',
    '^@brandpillar/db$': '<rootDir>/../../packages/db/src'
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000
};