const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const PerformanceMonitor = require('./monitor-performance');

/**
 * Performance Report Generator
 * Runs performance tests and generates comprehensive reports
 */

class PerformanceReportGenerator {
  constructor() {
    this.testConfigs = {
      baseline: {
        name: 'Baseline Test',
        file: 'baseline.yml',
        description: '10 users/sec for 1 minute - Normal load conditions'
      },
      stress: {
        name: 'Stress Test',
        file: 'stress-test.yml',
        description: 'Ramp up to 100 users/sec - High load conditions'
      },
      spike: {
        name: 'Spike Test',
        file: 'spike-test.yml',
        description: 'Sudden spike to 200 users/sec - Traffic burst simulation'
      },
      soak: {
        name: 'Soak Test',
        file: 'soak-test.yml',
        description: '50 users/sec for 10 minutes - Extended load test'
      }
    };
    
    this.resultsDir = path.join(__dirname, 'results');
    this.setupEnvironment();
  }

  /**
   * Setup test environment
   */
  setupEnvironment() {
    // Create results directory if it doesn't exist
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
    
    // Set default test URL if not provided
    if (!process.env.PERFORMANCE_TEST_URL) {
      process.env.PERFORMANCE_TEST_URL = process.env.NODE_ENV === 'production' 
        ? 'https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app'
        : 'http://localhost:3001';
    }
    
    console.log(`🎯 Performance Test Target: ${process.env.PERFORMANCE_TEST_URL}`);
  }

  /**
   * Run a single performance test
   */
  runTest(testType) {
    return new Promise((resolve, reject) => {
      const config = this.testConfigs[testType];
      if (!config) {
        reject(new Error(`Unknown test type: ${testType}`));
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(this.resultsDir, `${testType}-${timestamp}.json`);
      
      console.log(`\n🚀 Running ${config.name}...`);
      console.log(`   ${config.description}`);
      
      const command = `artillery run ${path.join(__dirname, config.file)} --output ${outputFile}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error && !stdout.includes('Summary report')) {
          console.error(`❌ Error running ${config.name}:`, error);
          reject(error);
          return;
        }
        
        console.log(`✅ ${config.name} completed`);
        
        // Parse and analyze results
        const monitor = new PerformanceMonitor();
        monitor.testRunId = `${testType}-${timestamp}`;
        
        if (monitor.parseArtilleryReport(outputFile)) {
          const report = monitor.saveReport(path.join(this.resultsDir, `${testType}-analysis-${timestamp}.json`));
          resolve({ testType, config, report, outputFile });
        } else {
          reject(new Error('Failed to parse test results'));
        }
      });
    });
  }

  /**
   * Run all performance tests
   */
  async runAllTests() {
    const results = [];
    const testTypes = Object.keys(this.testConfigs);
    
    console.log(`\n🎯 Starting Performance Test Suite`);
    console.log(`   Tests to run: ${testTypes.join(', ')}`);
    
    for (const testType of testTypes) {
      try {
        const result = await this.runTest(testType);
        results.push(result);
        
        // Add delay between tests to allow system recovery
        if (testType !== testTypes[testTypes.length - 1]) {
          console.log('\n⏳ Waiting 30 seconds before next test...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } catch (error) {
        console.error(`Failed to run ${testType} test:`, error);
        results.push({
          testType,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Generate consolidated report
   */
  generateConsolidatedReport(results) {
    const timestamp = new Date().toISOString();
    const consolidatedReport = {
      timestamp,
      environment: process.env.PERFORMANCE_TEST_URL,
      summary: {
        totalTests: results.length,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      testResults: {},
      overallRecommendations: [],
      executiveSummary: ''
    };
    
    // Process each test result
    results.forEach(result => {
      if (result.error) {
        consolidatedReport.summary.failed++;
        consolidatedReport.testResults[result.testType] = {
          status: 'FAILED',
          error: result.error
        };
      } else {
        const { testType, config, report } = result;
        
        // Determine test status
        let status = 'PASSED';
        if (report.errorAnalysis && !report.errorAnalysis.passThreshold) {
          status = 'FAILED';
          consolidatedReport.summary.failed++;
        } else if (report.recommendations && report.recommendations.some(r => r.severity === 'HIGH')) {
          status = 'WARNING';
          consolidatedReport.summary.warnings++;
        } else {
          consolidatedReport.summary.passed++;
        }
        
        consolidatedReport.testResults[testType] = {
          status,
          name: config.name,
          description: config.description,
          metrics: {
            duration: report.duration,
            totalRequests: report.totalRequests,
            averageRPS: report.averageRPS,
            errorRate: report.errorAnalysis.errorRate,
            coldStarts: report.coldStartAnalysis,
            responseTimeP95: report.responseTimeAnalysis.overall.p95 || 'N/A',
            responseTimeP99: report.responseTimeAnalysis.overall.p99 || 'N/A'
          },
          recommendations: report.recommendations
        };
        
        // Collect overall recommendations
        report.recommendations.forEach(rec => {
          if (!consolidatedReport.overallRecommendations.find(r => r.message === rec.message)) {
            consolidatedReport.overallRecommendations.push(rec);
          }
        });
      }
    });
    
    // Generate executive summary
    consolidatedReport.executiveSummary = this.generateExecutiveSummary(consolidatedReport);
    
    // Save consolidated report
    const reportPath = path.join(this.resultsDir, `consolidated-report-${timestamp.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(consolidatedReport, null, 2));
    
    // Generate HTML report
    this.generateHTMLReport(consolidatedReport);
    
    return consolidatedReport;
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(report) {
    const { summary, testResults } = report;
    
    let summary_text = `Performance Test Summary for ${report.environment}\n\n`;
    summary_text += `Total Tests Run: ${summary.totalTests}\n`;
    summary_text += `Passed: ${summary.passed} | Failed: ${summary.failed} | Warnings: ${summary.warnings}\n\n`;
    
    if (summary.failed === 0 && summary.warnings === 0) {
      summary_text += '✅ All performance tests passed successfully. The system is performing within acceptable parameters.\n';
    } else if (summary.failed > 0) {
      summary_text += '❌ Critical performance issues detected. Immediate attention required.\n';
    } else {
      summary_text += '⚠️  Performance warnings detected. Review recommendations for optimization opportunities.\n';
    }
    
    // Key findings
    summary_text += '\nKey Findings:\n';
    
    Object.entries(testResults).forEach(([testType, result]) => {
      if (result.status !== 'FAILED' && result.metrics) {
        summary_text += `- ${result.name}: ${result.metrics.averageRPS} RPS, ${result.metrics.errorRate} errors, p95: ${result.metrics.responseTimeP95}ms\n`;
      }
    });
    
    return summary_text;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - ${new Date(report.timestamp).toLocaleString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #333; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .summary-card { flex: 1; padding: 20px; border-radius: 8px; text-align: center; }
        .passed { background-color: #d4edda; color: #155724; }
        .failed { background-color: #f8d7da; color: #721c24; }
        .warning { background-color: #fff3cd; color: #856404; }
        .test-result { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .metric { padding: 10px; background-color: #f8f9fa; border-radius: 4px; }
        .metric-label { font-size: 12px; color: #666; }
        .metric-value { font-size: 18px; font-weight: bold; color: #333; }
        .recommendations { margin-top: 20px; }
        .recommendation { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .HIGH { background-color: #f8d7da; }
        .MEDIUM { background-color: #fff3cd; }
        .LOW { background-color: #d1ecf1; }
        pre { background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Performance Test Report</h1>
        <p><strong>Environment:</strong> ${report.environment}</p>
        <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        
        <div class="summary">
            <div class="summary-card passed">
                <h2>${report.summary.passed}</h2>
                <p>Passed</p>
            </div>
            <div class="summary-card warning">
                <h2>${report.summary.warnings}</h2>
                <p>Warnings</p>
            </div>
            <div class="summary-card failed">
                <h2>${report.summary.failed}</h2>
                <p>Failed</p>
            </div>
        </div>
        
        <h2>Executive Summary</h2>
        <pre>${report.executiveSummary}</pre>
        
        <h2>Test Results</h2>
        ${Object.entries(report.testResults).map(([testType, result]) => `
            <div class="test-result">
                <h3>${result.name} - <span class="${result.status.toLowerCase()}">${result.status}</span></h3>
                <p>${result.description}</p>
                
                ${result.metrics ? `
                    <div class="metrics">
                        <div class="metric">
                            <div class="metric-label">Duration</div>
                            <div class="metric-value">${result.metrics.duration}s</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Total Requests</div>
                            <div class="metric-value">${result.metrics.totalRequests}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Average RPS</div>
                            <div class="metric-value">${result.metrics.averageRPS}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Error Rate</div>
                            <div class="metric-value">${result.metrics.errorRate}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">P95 Response Time</div>
                            <div class="metric-value">${result.metrics.responseTimeP95}ms</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Cold Starts</div>
                            <div class="metric-value">${result.metrics.coldStarts.count}</div>
                        </div>
                    </div>
                ` : ''}
                
                ${result.recommendations && result.recommendations.length > 0 ? `
                    <div class="recommendations">
                        <h4>Recommendations:</h4>
                        ${result.recommendations.map(rec => `
                            <div class="recommendation ${rec.severity}">
                                <strong>[${rec.severity}] ${rec.category}:</strong> ${rec.message}
                                <br><em>Action: ${rec.action}</em>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('')}
        
        ${report.overallRecommendations.length > 0 ? `
            <h2>Overall Recommendations</h2>
            <div class="recommendations">
                ${report.overallRecommendations.map(rec => `
                    <div class="recommendation ${rec.severity}">
                        <strong>[${rec.severity}] ${rec.category}:</strong> ${rec.message}
                        <br><em>Action: ${rec.action}</em>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    </div>
</body>
</html>`;
    
    const htmlPath = path.join(this.resultsDir, `performance-report-${report.timestamp.replace(/[:.]/g, '-')}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`\n📊 HTML report generated: ${htmlPath}`);
  }

  /**
   * Run specific test type
   */
  async runSpecificTest(testType) {
    try {
      const result = await this.runTest(testType);
      const monitor = new PerformanceMonitor();
      monitor.testRunId = result.report.testRunId;
      monitor.parseArtilleryReport(result.outputFile);
      monitor.printSummary();
      
      return result;
    } catch (error) {
      console.error(`Failed to run ${testType} test:`, error);
      throw error;
    }
  }
}

// Export for use in other scripts
module.exports = PerformanceReportGenerator;

// Run if called directly
if (require.main === module) {
  const generator = new PerformanceReportGenerator();
  
  // Check for specific test type argument
  const testType = process.argv[2];
  
  if (testType && generator.testConfigs[testType]) {
    // Run specific test
    generator.runSpecificTest(testType)
      .then(() => {
        console.log('\n✅ Performance test completed successfully');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n❌ Performance test failed:', error);
        process.exit(1);
      });
  } else if (testType === 'all' || !testType) {
    // Run all tests
    console.log('\n🎯 Running all performance tests...');
    generator.runAllTests()
      .then(results => {
        const report = generator.generateConsolidatedReport(results);
        console.log('\n✅ All performance tests completed');
        console.log(`📊 Reports saved to: ${generator.resultsDir}`);
        process.exit(0);
      })
      .catch(error => {
        console.error('\n❌ Performance test suite failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node generate-report.js [test-type|all]');
    console.log('Available test types:', Object.keys(generator.testConfigs).join(', '));
    process.exit(1);
  }
}