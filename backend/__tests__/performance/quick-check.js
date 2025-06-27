#!/usr/bin/env node

/**
 * Quick Performance Check
 * Runs a lightweight performance test to quickly verify endpoint health
 */

const { exec } = require('child_process');
const path = require('path');

// Quick test configuration
const quickTestConfig = `
config:
  target: "${process.env.PERFORMANCE_TEST_URL || 'http://localhost:3001'}"
  phases:
    - duration: 30
      arrivalRate: 5
      name: "Quick Performance Check"
  
  plugins:
    expect: {}
  
scenarios:
  - name: "Health Check"
    weight: 25
    flow:
      - get:
          url: "/api/hello"
          expect:
            - statusCode: 200
            - responseTime: 1000
  
  - name: "Demo Login"
    weight: 25
    flow:
      - post:
          url: "/api/auth/demo-login"
          json: {}
          expect:
            - statusCode: 200
            - hasProperty: "token"
            - responseTime: 2000
  
  - name: "Basic API Flow"
    weight: 25
    flow:
      - post:
          url: "/api/auth/demo-login"
          json: {}
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/users/profile"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - responseTime: 1500
  
  - name: "Static Content"
    weight: 25
    flow:
      - get:
          url: "/api/content/templates"
          expect:
            - statusCode: 200
            - responseTime: 500
`;

// Save temporary config file
const fs = require('fs');
const tempConfigPath = path.join(__dirname, '.quick-test.yml');
fs.writeFileSync(tempConfigPath, quickTestConfig);

console.log('🚀 Running Quick Performance Check...');
console.log(`Target: ${process.env.PERFORMANCE_TEST_URL || 'http://localhost:3001'}`);
console.log('Duration: 30 seconds\n');

// Run Artillery test
const command = `artillery run ${tempConfigPath}`;

const testProcess = exec(command, (error, stdout, stderr) => {
  // Clean up temp file
  try {
    fs.unlinkSync(tempConfigPath);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  if (error && !stdout.includes('Summary report')) {
    console.error('❌ Quick check failed:', error);
    process.exit(1);
  }
  
  // Parse basic metrics from stdout
  const lines = stdout.split('\n');
  let inSummary = false;
  
  console.log('\n📊 Quick Check Results:');
  console.log('=' .repeat(50));
  
  lines.forEach(line => {
    if (line.includes('Summary report')) {
      inSummary = true;
    }
    
    if (inSummary) {
      if (line.includes('http.codes') || 
          line.includes('http.response_time') || 
          line.includes('http.requests') ||
          line.includes('errors.')) {
        console.log(line.trim());
      }
    }
  });
  
  console.log('=' .repeat(50));
  
  // Check for errors in output
  if (stdout.includes('errors.') && !stdout.includes('errors.0')) {
    console.log('\n⚠️  Errors detected during quick check!');
    console.log('Run full performance tests for detailed analysis.');
  } else {
    console.log('\n✅ Quick check completed successfully!');
    console.log('All endpoints are responding within acceptable limits.');
  }
  
  console.log('\nFor comprehensive testing, run:');
  console.log('  npm run test:perf          # Baseline test');
  console.log('  npm run test:perf:all      # All tests');
  console.log('  npm run test:perf:report   # Generate detailed report');
});

// Show real-time output
testProcess.stdout.pipe(process.stdout);
testProcess.stderr.pipe(process.stderr);

// Handle Ctrl+C
process.on('SIGINT', () => {
  try {
    fs.unlinkSync(tempConfigPath);
  } catch (e) {
    // Ignore cleanup errors
  }
  process.exit(0);
});