const fs = require('fs');
const path = require('path');

/**
 * Performance Monitoring Script for Serverless Functions
 * Tracks key metrics including cold starts, response times, and error rates
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      coldStarts: [],
      responseTimes: {},
      errorRates: {},
      throughput: {},
      concurrentConnections: [],
      memoryUsage: []
    };
    
    this.thresholds = {
      p50: 500,  // 50th percentile target: 500ms
      p95: 1000, // 95th percentile target: 1000ms
      p99: 2000, // 99th percentile target: 2000ms
      errorRate: 0.01, // 1% error rate threshold
      coldStartTarget: 1500 // Cold start target: 1500ms
    };
  }

  /**
   * Parse Artillery report and extract metrics
   */
  parseArtilleryReport(reportPath) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      
      // Extract aggregate metrics
      const aggregate = report.aggregate;
      
      // Process response times by scenario
      if (aggregate.scenariosCompleted) {
        Object.keys(aggregate.scenariosCompleted).forEach(scenario => {
          this.metrics.responseTimes[scenario] = {
            min: aggregate.scenarioLatency?.[scenario]?.min || 0,
            max: aggregate.scenarioLatency?.[scenario]?.max || 0,
            median: aggregate.scenarioLatency?.[scenario]?.median || 0,
            p95: aggregate.scenarioLatency?.[scenario]?.p95 || 0,
            p99: aggregate.scenarioLatency?.[scenario]?.p99 || 0
          };
        });
      }
      
      // Extract error rates
      this.metrics.errorRates = {
        total: aggregate.errors || 0,
        rate: (aggregate.errors || 0) / (aggregate.requestsCompleted || 1)
      };
      
      // Extract throughput
      this.metrics.throughput = {
        rps: aggregate.rps?.mean || 0,
        requests: aggregate.requestsCompleted || 0,
        duration: aggregate.duration || 0
      };
      
      // Extract concurrent connections
      this.metrics.concurrentConnections = aggregate.concurrency || [];
      
      // Process intermediate results for cold starts
      if (report.intermediate) {
        report.intermediate.forEach(interval => {
          if (interval.customStats && interval.customStats.coldStartDuration) {
            this.metrics.coldStarts.push(...interval.customStats.coldStartDuration);
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error parsing Artillery report:', error);
      return false;
    }
  }

  /**
   * Calculate percentiles for an array of values
   */
  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Analyze cold start performance
   */
  analyzeColdStarts() {
    if (this.metrics.coldStarts.length === 0) {
      return {
        count: 0,
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        belowTarget: 0
      };
    }

    const sorted = this.metrics.coldStarts.sort((a, b) => a - b);
    const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const belowTarget = sorted.filter(time => time <= this.thresholds.coldStartTarget).length;

    return {
      count: sorted.length,
      average: Math.round(average),
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      belowTarget: (belowTarget / sorted.length * 100).toFixed(2) + '%'
    };
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    const coldStartAnalysis = this.analyzeColdStarts();
    
    const summary = {
      testRunId: this.testRunId || 'Unknown',
      timestamp: new Date().toISOString(),
      duration: this.metrics.throughput.duration,
      totalRequests: this.metrics.throughput.requests,
      averageRPS: this.metrics.throughput.rps.toFixed(2),
      
      errorAnalysis: {
        totalErrors: this.metrics.errorRates.total,
        errorRate: (this.metrics.errorRates.rate * 100).toFixed(2) + '%',
        passThreshold: this.metrics.errorRates.rate <= this.thresholds.errorRate
      },
      
      responseTimeAnalysis: this.analyzeResponseTimes(),
      coldStartAnalysis,
      
      scenarioBreakdown: this.getScenarioBreakdown(),
      
      recommendations: this.generateRecommendations()
    };
    
    return summary;
  }

  /**
   * Analyze response times against thresholds
   */
  analyzeResponseTimes() {
    const allResponseTimes = [];
    const analysis = {
      byScenario: {},
      overall: {}
    };

    Object.entries(this.metrics.responseTimes).forEach(([scenario, times]) => {
      analysis.byScenario[scenario] = {
        median: times.median,
        p95: times.p95,
        p99: times.p99,
        p95Pass: times.p95 <= this.thresholds.p95,
        p99Pass: times.p99 <= this.thresholds.p99
      };
      
      // Collect all times for overall analysis
      if (times.median) allResponseTimes.push(times.median);
    });

    if (allResponseTimes.length > 0) {
      analysis.overall = {
        p50: this.calculatePercentile(allResponseTimes, 50),
        p95: this.calculatePercentile(allResponseTimes, 95),
        p99: this.calculatePercentile(allResponseTimes, 99),
        p50Pass: this.calculatePercentile(allResponseTimes, 50) <= this.thresholds.p50,
        p95Pass: this.calculatePercentile(allResponseTimes, 95) <= this.thresholds.p95,
        p99Pass: this.calculatePercentile(allResponseTimes, 99) <= this.thresholds.p99
      };
    }

    return analysis;
  }

  /**
   * Get breakdown by scenario
   */
  getScenarioBreakdown() {
    const breakdown = {};
    
    Object.entries(this.metrics.responseTimes).forEach(([scenario, times]) => {
      breakdown[scenario] = {
        responseTimes: times,
        performance: this.ratePerformance(times)
      };
    });
    
    return breakdown;
  }

  /**
   * Rate performance for a scenario
   */
  ratePerformance(times) {
    if (times.p95 <= 500) return 'Excellent';
    if (times.p95 <= 1000) return 'Good';
    if (times.p95 <= 2000) return 'Acceptable';
    return 'Needs Improvement';
  }

  /**
   * Generate recommendations based on performance data
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check error rate
    if (this.metrics.errorRates.rate > this.thresholds.errorRate) {
      recommendations.push({
        severity: 'HIGH',
        category: 'Reliability',
        message: `Error rate (${(this.metrics.errorRates.rate * 100).toFixed(2)}%) exceeds threshold (${this.thresholds.errorRate * 100}%)`,
        action: 'Investigate error logs and implement retry mechanisms'
      });
    }
    
    // Check cold starts
    const coldStartAnalysis = this.analyzeColdStarts();
    if (coldStartAnalysis.average > this.thresholds.coldStartTarget) {
      recommendations.push({
        severity: 'MEDIUM',
        category: 'Cold Starts',
        message: `Average cold start time (${coldStartAnalysis.average}ms) exceeds target (${this.thresholds.coldStartTarget}ms)`,
        action: 'Consider implementing warm-up strategies or optimizing function initialization'
      });
    }
    
    // Check response times
    Object.entries(this.metrics.responseTimes).forEach(([scenario, times]) => {
      if (times.p95 > this.thresholds.p95) {
        recommendations.push({
          severity: 'MEDIUM',
          category: 'Response Time',
          message: `${scenario} p95 response time (${times.p95}ms) exceeds threshold (${this.thresholds.p95}ms)`,
          action: 'Optimize database queries, implement caching, or increase function memory'
        });
      }
    });
    
    // Check for specific serverless optimizations
    if (this.metrics.throughput.rps > 50) {
      recommendations.push({
        severity: 'LOW',
        category: 'Scaling',
        message: 'High request rate detected',
        action: 'Consider implementing connection pooling and caching strategies for better resource utilization'
      });
    }
    
    return recommendations;
  }

  /**
   * Save performance report
   */
  saveReport(outputPath) {
    const summary = this.generateSummary();
    const reportPath = outputPath || path.join(__dirname, `performance-report-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`Performance report saved to: ${reportPath}`);
    
    return summary;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const summary = this.generateSummary();
    
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\nTest Duration: ${summary.duration}s`);
    console.log(`Total Requests: ${summary.totalRequests}`);
    console.log(`Average RPS: ${summary.averageRPS}`);
    
    console.log('\n📊 ERROR ANALYSIS:');
    console.log(`   Total Errors: ${summary.errorAnalysis.totalErrors}`);
    console.log(`   Error Rate: ${summary.errorAnalysis.errorRate}`);
    console.log(`   Pass Threshold: ${summary.errorAnalysis.passThreshold ? '✅' : '❌'}`);
    
    console.log('\n⏱️  RESPONSE TIME ANALYSIS:');
    if (summary.responseTimeAnalysis.overall.p50) {
      console.log(`   Overall p50: ${summary.responseTimeAnalysis.overall.p50}ms ${summary.responseTimeAnalysis.overall.p50Pass ? '✅' : '❌'}`);
      console.log(`   Overall p95: ${summary.responseTimeAnalysis.overall.p95}ms ${summary.responseTimeAnalysis.overall.p95Pass ? '✅' : '❌'}`);
      console.log(`   Overall p99: ${summary.responseTimeAnalysis.overall.p99}ms ${summary.responseTimeAnalysis.overall.p99Pass ? '✅' : '❌'}`);
    }
    
    console.log('\n🚀 COLD START ANALYSIS:');
    console.log(`   Total Cold Starts: ${summary.coldStartAnalysis.count}`);
    if (summary.coldStartAnalysis.count > 0) {
      console.log(`   Average: ${summary.coldStartAnalysis.average}ms`);
      console.log(`   p95: ${summary.coldStartAnalysis.p95}ms`);
      console.log(`   Below Target: ${summary.coldStartAnalysis.belowTarget}`);
    }
    
    console.log('\n📋 SCENARIO BREAKDOWN:');
    Object.entries(summary.scenarioBreakdown).forEach(([scenario, data]) => {
      console.log(`\n   ${scenario}:`);
      console.log(`     Performance: ${data.performance}`);
      console.log(`     Median: ${data.responseTimes.median}ms`);
      console.log(`     p95: ${data.responseTimes.p95}ms`);
    });
    
    if (summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      summary.recommendations.forEach((rec, index) => {
        console.log(`\n   ${index + 1}. [${rec.severity}] ${rec.category}`);
        console.log(`      ${rec.message}`);
        console.log(`      Action: ${rec.action}`);
      });
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Export for use in other scripts
module.exports = PerformanceMonitor;

// Run if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  // Check for report file argument
  const reportFile = process.argv[2];
  if (reportFile && fs.existsSync(reportFile)) {
    monitor.parseArtilleryReport(reportFile);
    monitor.printSummary();
    monitor.saveReport();
  } else {
    console.log('Usage: node monitor-performance.js <artillery-report.json>');
    console.log('Or use the generate-report.js script for automated reporting');
  }
}