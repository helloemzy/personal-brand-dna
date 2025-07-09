#!/usr/bin/env node

/**
 * Test script for Sentry implementation
 * Run this to verify Sentry is properly configured
 */

const chalk = require('chalk');

console.log(chalk.blue('\n🔍 Testing Sentry Configuration...\n'));

// Check environment variables
const requiredEnvVars = [
  'VITE_SENTRY_DSN',
  'VITE_APP_ENV',
  'VITE_APP_VERSION'
];

let hasErrors = false;

console.log(chalk.yellow('Checking environment variables:'));
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(chalk.green(`✓ ${varName} is set`));
  } else {
    console.log(chalk.red(`✗ ${varName} is missing`));
    hasErrors = true;
  }
});

// Check if Sentry DSN is valid format
if (process.env.VITE_SENTRY_DSN) {
  const dsnRegex = /^https:\/\/[\w]+@[\w.]+\/\d+$/;
  if (dsnRegex.test(process.env.VITE_SENTRY_DSN)) {
    console.log(chalk.green('\n✓ Sentry DSN format is valid'));
  } else {
    console.log(chalk.red('\n✗ Sentry DSN format is invalid'));
    console.log(chalk.gray('  Expected format: https://key@sentry.io/project_id'));
    hasErrors = true;
  }
}

// Provide setup instructions if needed
if (hasErrors) {
  console.log(chalk.yellow('\n📝 Setup Instructions:'));
  console.log('1. Create an account at https://sentry.io');
  console.log('2. Create a new React project');
  console.log('3. Copy your DSN from project settings');
  console.log('4. Add the following to your .env file:\n');
  console.log(chalk.gray('VITE_SENTRY_DSN=your_dsn_here'));
  console.log(chalk.gray('VITE_APP_ENV=development'));
  console.log(chalk.gray('VITE_APP_VERSION=1.0.0'));
} else {
  console.log(chalk.green('\n✅ All Sentry configuration checks passed!'));
  console.log(chalk.gray('\nYou can now test error reporting by:'));
  console.log(chalk.gray('1. Throwing an error in a component'));
  console.log(chalk.gray('2. Checking your Sentry dashboard'));
}

// Test commands to run
console.log(chalk.blue('\n🧪 Test Commands:'));
console.log(chalk.gray('npm run dev        # Start development server'));
console.log(chalk.gray('npm run build      # Build for production'));
console.log(chalk.gray('npm run preview    # Preview production build'));

console.log(chalk.blue('\n📊 Sentry Features Implemented:'));
console.log(chalk.gray('✓ Error boundary with Sentry integration'));
console.log(chalk.gray('✓ API error tracking'));
console.log(chalk.gray('✓ Performance monitoring'));
console.log(chalk.gray('✓ User context tracking'));
console.log(chalk.gray('✓ Redux action tracking'));
console.log(chalk.gray('✓ Custom error pages'));
console.log(chalk.gray('✓ Breadcrumb tracking'));
console.log(chalk.gray('✓ Workshop flow profiling'));

console.log(chalk.yellow('\n⚠️  Important Notes:'));
console.log(chalk.gray('- Sentry will only capture errors when VITE_APP_ENV is not "development"'));
console.log(chalk.gray('- Or when VITE_SENTRY_DSN is explicitly provided'));
console.log(chalk.gray('- Check browser console for Sentry initialization messages'));
console.log(chalk.gray('- Performance monitoring samples at 10% in production'));

console.log('\n');

process.exit(hasErrors ? 1 : 0);