#!/usr/bin/env node

/**
 * Security Scanner for SQL Injection and XSS Vulnerabilities
 * Scans codebase for potential security vulnerabilities
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');

class InjectionScanner {
  constructor() {
    this.vulnerabilities = [];
    this.scannedFiles = 0;
    this.totalIssues = 0;
    
    // SQL Injection patterns
    this.sqlPatterns = [
      {
        name: 'String concatenation in SQL',
        pattern: /query\s*\(\s*['"`].*\+.*['"`]/gi,
        severity: 'HIGH',
        recommendation: 'Use parameterized queries instead of string concatenation'
      },
      {
        name: 'Dynamic SQL construction',
        pattern: /`\s*SELECT.*\$\{.*\}`/gi,
        severity: 'HIGH',
        recommendation: 'Use parameterized queries with placeholders'
      },
      {
        name: 'Direct user input in query',
        pattern: /query\s*\(\s*req\.(body|params|query)/gi,
        severity: 'CRITICAL',
        recommendation: 'Never pass user input directly to queries'
      },
      {
        name: 'Unsafe query building',
        pattern: /query\s*=\s*['"`].*['"`]\s*\+/gi,
        severity: 'HIGH',
        recommendation: 'Use query builders or ORMs with proper escaping'
      },
      {
        name: 'Raw SQL execution',
        pattern: /\.raw\s*\(/gi,
        severity: 'MEDIUM',
        recommendation: 'Avoid raw queries, use ORM methods when possible'
      },
      {
        name: 'Missing input validation',
        pattern: /req\.(body|params|query)\[['"`]\w+['"`]\]\s*[^?&|]/gi,
        severity: 'MEDIUM',
        recommendation: 'Validate and sanitize all user inputs'
      }
    ];

    // XSS patterns
    this.xssPatterns = [
      {
        name: 'Unescaped output in templates',
        pattern: /\{\{\s*[^|}]+\s*\}\}/gi,
        severity: 'HIGH',
        recommendation: 'Use template engine escaping features'
      },
      {
        name: 'innerHTML usage',
        pattern: /\.innerHTML\s*=/gi,
        severity: 'HIGH',
        recommendation: 'Use textContent or proper sanitization'
      },
      {
        name: 'document.write usage',
        pattern: /document\.write/gi,
        severity: 'HIGH',
        recommendation: 'Avoid document.write, use DOM methods'
      },
      {
        name: 'Unsafe jQuery html()',
        pattern: /\$\([^)]+\)\.html\s*\(/gi,
        severity: 'HIGH',
        recommendation: 'Use text() or sanitize HTML content'
      },
      {
        name: 'eval() usage',
        pattern: /eval\s*\(/gi,
        severity: 'CRITICAL',
        recommendation: 'Never use eval(), find alternative approaches'
      },
      {
        name: 'Unvalidated redirect',
        pattern: /res\.redirect\s*\(\s*req\./gi,
        severity: 'MEDIUM',
        recommendation: 'Validate redirect URLs against whitelist'
      },
      {
        name: 'Missing Content-Type',
        pattern: /res\.send\s*\([^)]*\)\s*(?!.*setHeader.*Content-Type)/gi,
        severity: 'LOW',
        recommendation: 'Set appropriate Content-Type headers'
      },
      {
        name: 'Unsafe JSON parsing',
        pattern: /JSON\.parse\s*\(\s*req\./gi,
        severity: 'MEDIUM',
        recommendation: 'Validate JSON input before parsing'
      }
    ];

    // General security patterns
    this.generalPatterns = [
      {
        name: 'Hardcoded credentials',
        pattern: /password\s*[:=]\s*['"`][^'"`]+['"`]/gi,
        severity: 'CRITICAL',
        recommendation: 'Use environment variables for credentials'
      },
      {
        name: 'Missing CSRF protection',
        pattern: /app\.(post|put|delete)\s*\([^)]*\)\s*(?!.*csrf)/gi,
        severity: 'MEDIUM',
        recommendation: 'Implement CSRF protection for state-changing operations'
      },
      {
        name: 'Insecure random number',
        pattern: /Math\.random\s*\(\)/gi,
        severity: 'LOW',
        recommendation: 'Use crypto.randomBytes for security-sensitive operations'
      },
      {
        name: 'Missing authentication check',
        pattern: /app\.(get|post|put|delete)\s*\([^{]*\{(?!.*auth)/gi,
        severity: 'HIGH',
        recommendation: 'Ensure all routes have proper authentication'
      }
    ];
  }

  /**
   * Scan a single file for vulnerabilities
   */
  async scanFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileVulnerabilities = [];

      // Skip node_modules and other irrelevant directories
      if (filePath.includes('node_modules') || 
          filePath.includes('.git') || 
          filePath.includes('build') ||
          filePath.includes('dist')) {
        return;
      }

      this.scannedFiles++;

      // Check for SQL injection patterns
      for (const pattern of this.sqlPatterns) {
        const matches = content.matchAll(pattern.pattern);
        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index);
          fileVulnerabilities.push({
            file: filePath,
            line: lineNumber,
            type: 'SQL Injection',
            pattern: pattern.name,
            severity: pattern.severity,
            code: match[0].trim(),
            recommendation: pattern.recommendation
          });
        }
      }

      // Check for XSS patterns
      for (const pattern of this.xssPatterns) {
        const matches = content.matchAll(pattern.pattern);
        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index);
          fileVulnerabilities.push({
            file: filePath,
            line: lineNumber,
            type: 'XSS',
            pattern: pattern.name,
            severity: pattern.severity,
            code: match[0].trim(),
            recommendation: pattern.recommendation
          });
        }
      }

      // Check for general security patterns
      for (const pattern of this.generalPatterns) {
        const matches = content.matchAll(pattern.pattern);
        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index);
          fileVulnerabilities.push({
            file: filePath,
            line: lineNumber,
            type: 'Security',
            pattern: pattern.name,
            severity: pattern.severity,
            code: match[0].trim(),
            recommendation: pattern.recommendation
          });
        }
      }

      this.vulnerabilities.push(...fileVulnerabilities);
      this.totalIssues += fileVulnerabilities.length;

    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error.message);
    }
  }

  /**
   * Get line number from string index
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Scan directory recursively
   */
  async scanDirectory(directory) {
    return new Promise((resolve, reject) => {
      glob(`${directory}/**/*.{js,jsx,ts,tsx,ejs,html,hbs,pug}`, async (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(chalk.blue(`Scanning ${files.length} files...\n`));

        for (const file of files) {
          await this.scanFile(file);
        }

        resolve();
      });
    });
  }

  /**
   * Generate report
   */
  generateReport() {
    console.log(chalk.bold('\n=== Security Scan Report ===\n'));
    console.log(`Files scanned: ${this.scannedFiles}`);
    console.log(`Total issues found: ${this.totalIssues}\n`);

    if (this.vulnerabilities.length === 0) {
      console.log(chalk.green('✓ No vulnerabilities found!'));
      return;
    }

    // Group by severity
    const critical = this.vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const high = this.vulnerabilities.filter(v => v.severity === 'HIGH');
    const medium = this.vulnerabilities.filter(v => v.severity === 'MEDIUM');
    const low = this.vulnerabilities.filter(v => v.severity === 'LOW');

    // Display summary
    console.log(chalk.bold('Summary by Severity:'));
    if (critical.length > 0) console.log(chalk.red(`  CRITICAL: ${critical.length}`));
    if (high.length > 0) console.log(chalk.magenta(`  HIGH: ${high.length}`));
    if (medium.length > 0) console.log(chalk.yellow(`  MEDIUM: ${medium.length}`));
    if (low.length > 0) console.log(chalk.blue(`  LOW: ${low.length}`));
    console.log('');

    // Display vulnerabilities by severity
    this.displayVulnerabilities('CRITICAL', critical, chalk.red);
    this.displayVulnerabilities('HIGH', high, chalk.magenta);
    this.displayVulnerabilities('MEDIUM', medium, chalk.yellow);
    this.displayVulnerabilities('LOW', low, chalk.blue);

    // Generate remediation report
    this.generateRemediationReport();
  }

  /**
   * Display vulnerabilities by severity
   */
  displayVulnerabilities(severity, vulnerabilities, color) {
    if (vulnerabilities.length === 0) return;

    console.log(color.bold(`\n${severity} SEVERITY ISSUES:\n`));

    vulnerabilities.forEach((vuln, index) => {
      console.log(color(`${index + 1}. ${vuln.pattern}`));
      console.log(`   File: ${vuln.file}:${vuln.line}`);
      console.log(`   Type: ${vuln.type}`);
      console.log(`   Code: ${vuln.code}`);
      console.log(`   Fix: ${vuln.recommendation}`);
      console.log('');
    });
  }

  /**
   * Generate remediation report
   */
  generateRemediationReport() {
    console.log(chalk.bold('\n=== Remediation Guidelines ===\n'));

    const recommendations = new Map();

    // Collect unique recommendations
    this.vulnerabilities.forEach(vuln => {
      if (!recommendations.has(vuln.recommendation)) {
        recommendations.set(vuln.recommendation, []);
      }
      recommendations.get(vuln.recommendation).push(vuln);
    });

    // Display recommendations
    let index = 1;
    recommendations.forEach((vulns, recommendation) => {
      console.log(chalk.bold(`${index}. ${recommendation}`));
      console.log(`   Affects ${vulns.length} location(s)`);
      console.log('');
      index++;
    });

    // Save detailed report
    this.saveDetailedReport();
  }

  /**
   * Save detailed report to file
   */
  async saveDetailedReport() {
    const reportPath = path.join(process.cwd(), 'security-scan-report.json');
    
    const report = {
      scanDate: new Date().toISOString(),
      summary: {
        filesScanned: this.scannedFiles,
        totalIssues: this.totalIssues,
        critical: this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        high: this.vulnerabilities.filter(v => v.severity === 'HIGH').length,
        medium: this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        low: this.vulnerabilities.filter(v => v.severity === 'LOW').length
      },
      vulnerabilities: this.vulnerabilities
    };

    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(chalk.green(`\nDetailed report saved to: ${reportPath}`));
    } catch (error) {
      console.error('Error saving report:', error.message);
    }
  }

  /**
   * Run the scanner
   */
  async run(targetPath) {
    console.log(chalk.bold.blue('Personal Brand DNA Security Scanner\n'));
    
    const scanPath = targetPath || process.cwd();
    console.log(`Scanning directory: ${scanPath}\n`);

    try {
      await this.scanDirectory(scanPath);
      this.generateReport();
      
      // Exit with error code if critical issues found
      const criticalCount = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
      if (criticalCount > 0) {
        console.log(chalk.red(`\n⚠️  ${criticalCount} CRITICAL issue(s) found. Please fix immediately!`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Scanner error:'), error.message);
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const scanner = new InjectionScanner();
  const targetPath = process.argv[2] || '.';
  
  scanner.run(targetPath).catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = InjectionScanner;