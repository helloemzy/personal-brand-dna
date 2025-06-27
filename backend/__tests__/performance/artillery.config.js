// Artillery configuration for serverless function testing
module.exports = {
  // Base configuration
  environments: {
    local: {
      target: 'http://localhost:3001',
      phases: [
        { duration: 60, arrivalRate: 10 } // Default baseline
      ]
    },
    staging: {
      target: process.env.STAGING_URL || 'https://staging.personal-brand-dna.com',
      phases: [
        { duration: 60, arrivalRate: 10 }
      ]
    },
    production: {
      target: process.env.PRODUCTION_URL || 'https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app',
      phases: [
        { duration: 60, arrivalRate: 10 }
      ]
    }
  },

  // Processor functions for custom logic
  processor: './artillery-processor.js',

  // Default headers
  defaults: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  },

  // Plugins configuration
  plugins: {
    expect: {
      outputFormat: 'pretty'
    },
    'metrics-by-endpoint': {
      includePathInName: true
    }
  },

  // Ensure we capture serverless cold starts
  ensure: {
    p95: 1000, // 95th percentile should be under 1 second
    p99: 2000, // 99th percentile should be under 2 seconds
    maxErrorRate: 1 // Max 1% error rate
  }
};