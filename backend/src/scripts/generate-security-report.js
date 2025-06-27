#!/usr/bin/env node

/**
 * Security Vulnerability Report Generator
 * Generates comprehensive security reports with remediation steps
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Security standards compliance
const complianceStandards = {
  OWASP: {
    'A01:2021': 'Broken Access Control',
    'A02:2021': 'Cryptographic Failures',
    'A03:2021': 'Injection',
    'A04:2021': 'Insecure Design',
    'A05:2021': 'Security Misconfiguration',
    'A06:2021': 'Vulnerable and Outdated Components',
    'A07:2021': 'Identification and Authentication Failures',
    'A08:2021': 'Software and Data Integrity Failures',
    'A09:2021': 'Security Logging and Monitoring Failures',
    'A10:2021': 'Server-Side Request Forgery'
  },
  PCI_DSS: {
    '2.3': 'Encrypt all non-console administrative access',
    '6.5': 'Address common coding vulnerabilities',
    '8.2': 'Ensure proper user authentication',
    '10.1': 'Implement audit trails'
  },
  GDPR: {
    'Art.25': 'Data protection by design and by default',
    'Art.32': 'Security of processing',
    'Art.33': 'Notification of data breach'
  }
};

/**
 * Run security tests and collect results
 */
async function runSecurityTests() {
  console.log(`${colors.blue}Running security tests...${colors.reset}`);
  
  const results = {
    tests: {
      passed: 0,
      failed: 0,
      vulnerabilities: []
    },
    scan: null,
    audit: null,
    compliance: {}
  };

  // Run Jest security tests
  try {
    const testOutput = execSync('npm run test:security -- --json --silent', { encoding: 'utf8' });
    const testResults = JSON.parse(testOutput);
    
    results.tests.passed = testResults.numPassedTests;
    results.tests.failed = testResults.numFailedTests;
    
    // Extract vulnerability information from failed tests
    testResults.testResults.forEach(file => {
      file.assertionResults.forEach(test => {
        if (test.status === 'failed') {
          results.tests.vulnerabilities.push({
            test: test.title,
            file: path.basename(file.name),
            message: test.failureMessages[0]
          });
        }
      });
    });
  } catch (error) {
    console.error(`${colors.red}Failed to run security tests${colors.reset}`);
  }

  // Run security scanner
  try {
    console.log(`${colors.blue}Running security scanner...${colors.reset}`);
    const scanOutput = execSync('node src/scripts/security-scan.js', { encoding: 'utf8' });
    results.scan = parseScanOutput(scanOutput);
  } catch (error) {
    results.scan = { error: 'Security scan failed' };
  }

  // Run npm audit
  try {
    console.log(`${colors.blue}Running dependency audit...${colors.reset}`);
    const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
    results.audit = JSON.parse(auditOutput);
  } catch (error) {
    // npm audit returns non-zero exit code when vulnerabilities found
    try {
      results.audit = JSON.parse(error.stdout);
    } catch (e) {
      results.audit = { error: 'Dependency audit failed' };
    }
  }

  // Check compliance
  results.compliance = checkCompliance(results);

  return results;
}

/**
 * Parse security scan output
 */
function parseScanOutput(output) {
  const lines = output.split('\n');
  const findings = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  lines.forEach(line => {
    if (line.includes('Critical:')) {
      findings.critical = parseInt(line.match(/Critical:\s*(\d+)/)?.[1] || 0);
    } else if (line.includes('High:')) {
      findings.high = parseInt(line.match(/High:\s*(\d+)/)?.[1] || 0);
    } else if (line.includes('Medium:')) {
      findings.medium = parseInt(line.match(/Medium:\s*(\d+)/)?.[1] || 0);
    } else if (line.includes('Low:')) {
      findings.low = parseInt(line.match(/Low:\s*(\d+)/)?.[1] || 0);
    } else if (line.includes('Info:')) {
      findings.info = parseInt(line.match(/Info:\s*(\d+)/)?.[1] || 0);
    }
  });

  return findings;
}

/**
 * Check compliance with security standards
 */
function checkCompliance(results) {
  const compliance = {
    OWASP: {},
    PCI_DSS: {},
    GDPR: {}
  };

  // OWASP compliance checks
  compliance.OWASP['A01:2021'] = {
    status: results.tests.vulnerabilities.some(v => v.test.includes('unauthorized access')) ? 'FAIL' : 'PASS',
    details: 'Access control testing'
  };

  compliance.OWASP['A02:2021'] = {
    status: results.scan?.critical > 0 && results.tests.vulnerabilities.some(v => v.test.includes('encryption')) ? 'FAIL' : 'PASS',
    details: 'Cryptographic implementation'
  };

  compliance.OWASP['A03:2021'] = {
    status: results.tests.vulnerabilities.some(v => v.test.includes('injection')) ? 'FAIL' : 'PASS',
    details: 'Injection prevention'
  };

  compliance.OWASP['A06:2021'] = {
    status: results.audit?.metadata?.vulnerabilities?.critical > 0 ? 'FAIL' : 'PASS',
    details: 'Dependency vulnerabilities'
  };

  // Add more compliance checks as needed

  return compliance;
}

/**
 * Generate remediation recommendations
 */
function generateRemediations(results) {
  const remediations = [];

  // Test vulnerabilities
  results.tests.vulnerabilities.forEach(vuln => {
    let remediation = {
      issue: vuln.test,
      severity: 'HIGH',
      steps: []
    };

    if (vuln.test.includes('SQL injection')) {
      remediation.steps = [
        'Use parameterized queries for all database operations',
        'Implement input validation and sanitization',
        'Use an ORM with built-in SQL injection protection',
        'Review and update all dynamic SQL queries'
      ];
    } else if (vuln.test.includes('XSS')) {
      remediation.steps = [
        'Sanitize all user input before rendering',
        'Use Content Security Policy (CSP) headers',
        'Escape HTML entities in output',
        'Implement input validation on both client and server'
      ];
    } else if (vuln.test.includes('authentication')) {
      remediation.steps = [
        'Implement proper session management',
        'Use secure token generation and storage',
        'Enable multi-factor authentication',
        'Implement account lockout policies'
      ];
    }

    if (remediation.steps.length > 0) {
      remediations.push(remediation);
    }
  });

  // Dependency vulnerabilities
  if (results.audit?.metadata?.vulnerabilities?.total > 0) {
    remediations.push({
      issue: 'Vulnerable Dependencies',
      severity: 'CRITICAL',
      steps: [
        'Run "npm audit fix" to automatically fix vulnerabilities',
        'Update dependencies to latest secure versions',
        'Review and replace deprecated packages',
        'Implement automated dependency scanning in CI/CD'
      ]
    });
  }

  return remediations;
}

/**
 * Generate HTML report
 */
async function generateHTMLReport(results) {
  const timestamp = new Date().toISOString();
  const remediations = generateRemediations(results);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Vulnerability Report - ${timestamp}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .metric h3 {
            margin: 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .metric .value {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .critical { color: #e74c3c; }
        .high { color: #e67e22; }
        .medium { color: #f39c12; }
        .low { color: #3498db; }
        .pass { color: #27ae60; }
        .fail { color: #e74c3c; }
        .section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin-top: 0;
            color: #2c3e50;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .remediation {
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .remediation h4 {
            margin-top: 0;
            color: #2c3e50;
        }
        .remediation ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .compliance-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .compliance-pass {
            background: #d4edda;
            color: #155724;
        }
        .compliance-fail {
            background: #f8d7da;
            color: #721c24;
        }
        .footer {
            text-align: center;
            color: #666;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ecf0f1;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Vulnerability Report</h1>
        <p>Generated: ${new Date(timestamp).toLocaleString()}</p>
        <p>Personal Brand DNA Backend Security Assessment</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Security Score</h3>
            <div class="value ${calculateScore(results) >= 80 ? 'pass' : 'fail'}">
                ${calculateScore(results)}/100
            </div>
        </div>
        <div class="metric">
            <h3>Critical Issues</h3>
            <div class="value critical">
                ${results.scan?.critical || 0}
            </div>
        </div>
        <div class="metric">
            <h3>High Risk</h3>
            <div class="value high">
                ${results.scan?.high || 0}
            </div>
        </div>
        <div class="metric">
            <h3>Test Coverage</h3>
            <div class="value">
                ${Math.round((results.tests.passed / (results.tests.passed + results.tests.failed)) * 100)}%
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <p>This security assessment identified ${getTotalVulnerabilities(results)} total vulnerabilities across the Personal Brand DNA backend application.</p>
        <ul>
            <li><strong>Critical Issues:</strong> ${results.scan?.critical || 0} - Require immediate attention</li>
            <li><strong>High Risk:</strong> ${results.scan?.high || 0} - Should be addressed within 7 days</li>
            <li><strong>Medium Risk:</strong> ${results.scan?.medium || 0} - Plan for next release</li>
            <li><strong>Low Risk:</strong> ${results.scan?.low || 0} - Track and monitor</li>
        </ul>
    </div>

    <div class="section">
        <h2>Compliance Status</h2>
        <table>
            <thead>
                <tr>
                    <th>Standard</th>
                    <th>Requirement</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(results.compliance.OWASP || {}).map(([key, value]) => `
                    <tr>
                        <td>OWASP</td>
                        <td>${key}: ${complianceStandards.OWASP[key]}</td>
                        <td>
                            <span class="compliance-badge compliance-${value.status.toLowerCase()}">
                                ${value.status}
                            </span>
                        </td>
                        <td>${value.details}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Vulnerability Details</h2>
        ${results.tests.vulnerabilities.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Test</th>
                        <th>File</th>
                        <th>Severity</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.tests.vulnerabilities.map(vuln => `
                        <tr>
                            <td>${vuln.test}</td>
                            <td>${vuln.file}</td>
                            <td><span class="high">HIGH</span></td>
                            <td>${vuln.message.substring(0, 100)}...</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>No vulnerabilities detected in security tests.</p>'}
    </div>

    <div class="section">
        <h2>Dependency Vulnerabilities</h2>
        ${results.audit?.metadata?.vulnerabilities?.total > 0 ? `
            <p>Found ${results.audit.metadata.vulnerabilities.total} vulnerable dependencies:</p>
            <ul>
                <li><span class="critical">Critical:</span> ${results.audit.metadata.vulnerabilities.critical || 0}</li>
                <li><span class="high">High:</span> ${results.audit.metadata.vulnerabilities.high || 0}</li>
                <li><span class="medium">Moderate:</span> ${results.audit.metadata.vulnerabilities.moderate || 0}</li>
                <li><span class="low">Low:</span> ${results.audit.metadata.vulnerabilities.low || 0}</li>
            </ul>
            <p>Run <code>npm audit fix</code> to automatically fix ${results.audit.metadata.vulnerabilities.fixable || 0} vulnerabilities.</p>
        ` : '<p>All dependencies are up to date with no known vulnerabilities.</p>'}
    </div>

    <div class="section">
        <h2>Remediation Recommendations</h2>
        ${remediations.map(rem => `
            <div class="remediation">
                <h4>${rem.issue} - <span class="${rem.severity.toLowerCase()}">${rem.severity}</span></h4>
                <ul>
                    ${rem.steps.map(step => `<li>${step}</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Next Steps</h2>
        <ol>
            <li><strong>Immediate Actions:</strong> Address all critical vulnerabilities within 24 hours</li>
            <li><strong>Short Term:</strong> Fix high-risk issues within 7 days</li>
            <li><strong>Medium Term:</strong> Plan remediation for medium-risk issues in next sprint</li>
            <li><strong>Ongoing:</strong> 
                <ul>
                    <li>Implement automated security scanning in CI/CD pipeline</li>
                    <li>Schedule weekly dependency updates</li>
                    <li>Conduct quarterly security audits</li>
                    <li>Maintain security documentation and training</li>
                </ul>
            </li>
        </ol>
    </div>

    <div class="footer">
        <p>Generated by Personal Brand DNA Security Scanner v1.0</p>
        <p>For questions or concerns, contact: security@personalbranddna.com</p>
    </div>
</body>
</html>
`;

  const reportPath = path.join(process.cwd(), 'security-report.html');
  await fs.writeFile(reportPath, html);
  
  return reportPath;
}

/**
 * Calculate security score
 */
function calculateScore(results) {
  let score = 100;
  
  // Deduct for vulnerabilities
  score -= (results.scan?.critical || 0) * 20;
  score -= (results.scan?.high || 0) * 10;
  score -= (results.scan?.medium || 0) * 5;
  score -= (results.scan?.low || 0) * 2;
  
  // Deduct for failed tests
  score -= results.tests.failed * 5;
  
  // Deduct for dependency vulnerabilities
  if (results.audit?.metadata?.vulnerabilities) {
    score -= (results.audit.metadata.vulnerabilities.critical || 0) * 15;
    score -= (results.audit.metadata.vulnerabilities.high || 0) * 8;
  }
  
  return Math.max(0, Math.round(score));
}

/**
 * Get total vulnerabilities count
 */
function getTotalVulnerabilities(results) {
  const scan = (results.scan?.critical || 0) + 
               (results.scan?.high || 0) + 
               (results.scan?.medium || 0) + 
               (results.scan?.low || 0);
  
  const deps = results.audit?.metadata?.vulnerabilities?.total || 0;
  const tests = results.tests.vulnerabilities.length;
  
  return scan + deps + tests;
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.cyan}🔒 Generating Security Report...${colors.reset}\n`);
  
  try {
    const results = await runSecurityTests();
    const reportPath = await generateHTMLReport(results);
    
    console.log(`\n${colors.green}✅ Security report generated successfully!${colors.reset}`);
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`\n${colors.blue}Summary:${colors.reset}`);
    console.log(`  Security Score: ${calculateScore(results)}/100`);
    console.log(`  Total Vulnerabilities: ${getTotalVulnerabilities(results)}`);
    console.log(`  Critical Issues: ${results.scan?.critical || 0}`);
    console.log(`  Test Coverage: ${Math.round((results.tests.passed / (results.tests.passed + results.tests.failed)) * 100)}%`);
    
    if (calculateScore(results) < 80) {
      console.log(`\n${colors.red}⚠️  Security score is below acceptable threshold (80)${colors.reset}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}Error generating security report:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the report generator
main();