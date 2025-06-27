# Performance Testing Infrastructure

This directory contains comprehensive load testing infrastructure for the Personal Brand DNA System's serverless functions deployed on Vercel.

## Overview

The performance testing suite uses Artillery.io to simulate various load scenarios and measure the performance of our serverless endpoints. It includes cold start monitoring, response time analysis, and detailed reporting capabilities.

## Test Scenarios

### 1. Baseline Test (`baseline.yml`)
- **Load**: 10 users/second for 1 minute
- **Purpose**: Establish baseline performance metrics under normal conditions
- **Focus**: All major endpoints with realistic usage patterns

### 2. Stress Test (`stress-test.yml`)
- **Load**: Ramp up from 10 to 100 users/second
- **Duration**: 6 minutes total
- **Purpose**: Identify breaking points and performance degradation under high load
- **Focus**: High-frequency operations like auto-saves and authentication

### 3. Spike Test (`spike-test.yml`)
- **Load**: Sudden spike to 200 users/second
- **Purpose**: Test system resilience to traffic bursts
- **Focus**: Critical paths that must handle sudden load increases

### 4. Soak Test (`soak-test.yml`)
- **Load**: Sustained 50 users/second for 10 minutes
- **Purpose**: Identify memory leaks and performance degradation over time
- **Focus**: Long-running operations and background processes

## Quick Start

### Running Individual Tests

```bash
# Run baseline test
npm run test:perf

# Run stress test
npm run test:perf:stress

# Run spike test
npm run test:perf:spike

# Run soak test
npm run test:perf:soak

# Run all tests sequentially
npm run test:perf:all

# Generate comprehensive report
npm run test:perf:report
```

### Running with Custom Target

```bash
# Test against production
PERFORMANCE_TEST_URL=https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app npm run test:perf

# Test against staging
PERFORMANCE_TEST_URL=https://staging.example.com npm run test:perf

# Test against local development
PERFORMANCE_TEST_URL=http://localhost:3001 npm run test:perf
```

## Test Configuration

### Artillery Configuration (`artillery.config.js`)
- Defines environments (local, staging, production)
- Sets default headers and plugins
- Configures performance thresholds

### Artillery Processor (`artillery-processor.js`)
- Generates test data (emails, usernames, workshop data)
- Handles authentication token management
- Measures cold start performance
- Provides custom logging for errors

## Performance Metrics

### Key Metrics Tracked
1. **Response Times**
   - p50 (median)
   - p95 (95th percentile)
   - p99 (99th percentile)

2. **Error Rates**
   - Total errors
   - Error percentage
   - Error types

3. **Throughput**
   - Requests per second (RPS)
   - Total requests completed
   - Concurrent connections

4. **Cold Starts** (Serverless-specific)
   - Cold start count
   - Cold start duration (p50, p95, p99)
   - Percentage below target threshold

### Performance Thresholds
- **p50**: 500ms
- **p95**: 1000ms
- **p99**: 2000ms
- **Error Rate**: < 1%
- **Cold Start Target**: 1500ms

## Monitoring and Reporting

### Performance Monitor (`monitor-performance.js`)
- Parses Artillery reports
- Analyzes performance against thresholds
- Generates recommendations
- Creates JSON summaries

### Report Generator (`generate-report.js`)
- Runs tests automatically
- Generates consolidated reports
- Creates HTML visualization
- Provides executive summary

### Generated Reports
Reports are saved in the `results/` directory:
- Individual test results (JSON)
- Performance analysis (JSON)
- Consolidated report (JSON)
- HTML visualization

## Test Scenarios Details

### Authentication Flows
- Demo login (instant access)
- OTP authentication (email-based)
- User registration
- Token refresh

### Workshop Operations
- Auto-save functionality
- Bulk updates
- Progress tracking
- Session management

### News Features
- Article analysis
- Relevance scoring
- Feed pagination
- Trending content

### Calendar Functions
- Event creation
- Bulk scheduling
- View rendering
- Conflict detection

### Content Generation
- AI-powered generation
- Template processing
- Caching strategies
- Queue management

## Serverless Considerations

### Cold Start Optimization
- Track first request latency
- Monitor function initialization time
- Identify optimization opportunities

### Connection Management
- Database connection pooling
- Redis connection reuse
- External API rate limiting

### Memory and Timeout
- Function memory allocation
- Timeout configurations
- Resource utilization

## Interpreting Results

### Performance Ratings
- **Excellent**: p95 < 500ms
- **Good**: p95 < 1000ms
- **Acceptable**: p95 < 2000ms
- **Needs Improvement**: p95 > 2000ms

### Common Issues and Solutions

1. **High Cold Start Times**
   - Implement warm-up strategies
   - Optimize function initialization
   - Reduce bundle size

2. **Database Connection Errors**
   - Implement connection pooling
   - Add retry logic
   - Monitor connection limits

3. **Memory Issues**
   - Increase function memory
   - Optimize data processing
   - Implement streaming for large data

4. **Timeout Errors**
   - Increase function timeout
   - Implement async processing
   - Use queue-based architecture

## Best Practices

1. **Test Regularly**
   - Run tests before major deployments
   - Monitor performance trends
   - Set up automated testing

2. **Test Realistically**
   - Use production-like data
   - Simulate real user behavior
   - Include think time between actions

3. **Monitor Production**
   - Set up real-time monitoring
   - Track actual performance metrics
   - Compare with test results

4. **Optimize Iteratively**
   - Focus on bottlenecks
   - Measure impact of changes
   - Document optimizations

## Troubleshooting

### Artillery Not Running
```bash
# Ensure Artillery is installed
npm install --save-dev artillery artillery-plugin-expect artillery-plugin-metrics-by-endpoint

# Check Artillery version
npx artillery --version
```

### Tests Failing
- Check target URL is accessible
- Verify authentication endpoints are working
- Ensure test data is valid
- Check for rate limiting

### Report Generation Issues
- Ensure results directory exists
- Check file permissions
- Verify Node.js version compatibility

## Contributing

When adding new performance tests:
1. Create appropriate test scenarios in YAML
2. Update processor functions if needed
3. Add new metrics to monitor script
4. Document expected performance
5. Update this README

## Resources

- [Artillery Documentation](https://artillery.io/docs/)
- [Vercel Serverless Functions](https://vercel.com/docs/serverless-functions)
- [Performance Testing Best Practices](https://artillery.io/docs/guides/guides/performance-testing-best-practices.html)