#!/usr/bin/env node

/**
 * Security Scanner Script
 * Scans for exposed sensitive data, insecure dependencies, HTTPS enforcement, and OWASP vulnerabilities
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Security findings storage
const findings = {
  critical: [],
  high: [],
  medium: [],
  low: [],
  info: []
};

// Sensitive data patterns
const sensitivePatterns = [
  // API Keys
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, type: 'API Key', severity: 'critical' },
  { pattern: /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, type: 'Secret Key', severity: 'critical' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key', severity: 'critical' },
  { pattern: /aws_secret_access_key\s*=\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi, type: 'AWS Secret Key', severity: 'critical' },
  
  // Database
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/gi, type: 'Password', severity: 'high' },
  { pattern: /(?:database_url|db_url|connection_string)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, type: 'Database URL', severity: 'high' },
  
  // JWT
  { pattern: /jwt[_-]?secret\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, type: 'JWT Secret', severity: 'critical' },
  
  // OAuth
  { pattern: /client[_-]?secret\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, type: 'OAuth Client Secret', severity: 'critical' },
  
  // Stripe
  { pattern: /sk_(?:test|live)_[a-zA-Z0-9]{24,}/g, type: 'Stripe Secret Key', severity: 'critical' },
  { pattern: /rk_(?:test|live)_[a-zA-Z0-9]{24,}/g, type: 'Stripe Restricted Key', severity: 'high' },
  
  // Private Keys
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, type: 'Private Key', severity: 'critical' },
  
  // Generic Secrets
  { pattern: /(?:auth[_-]?token|authtoken)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, type: 'Auth Token', severity: 'high' }
];

// Dangerous code patterns
const dangerousPatterns = [
  // SQL Injection risks
  { pattern: /query\s*\(\s*['"`].*\$\{.*\}.*['"`]/g, type: 'SQL Injection Risk', severity: 'high', message: 'String interpolation in SQL query' },
  { pattern: /query\s*\(\s*['"`].*\+.*['"`]/g, type: 'SQL Injection Risk', severity: 'high', message: 'String concatenation in SQL query' },
  
  // Command Injection risks
  { pattern: /exec(?:Sync)?\s*\([^)]*\$\{.*\}/g, type: 'Command Injection Risk', severity: 'critical', message: 'String interpolation in exec()' },
  { pattern: /spawn\s*\([^,)]*\$\{.*\}/g, type: 'Command Injection Risk', severity: 'critical', message: 'String interpolation in spawn()' },
  
  // XSS risks
  { pattern: /innerHTML\s*=\s*[^'"`]*\$\{.*\}/g, type: 'XSS Risk', severity: 'high', message: 'Unescaped user input in innerHTML' },
  { pattern: /dangerouslySetInnerHTML/g, type: 'XSS Risk', severity: 'medium', message: 'Using dangerouslySetInnerHTML' },
  
  // Insecure Random
  { pattern: /Math\.random\(\)/g, type: 'Weak Randomness', severity: 'medium', message: 'Math.random() is not cryptographically secure' },
  
  // Eval usage
  { pattern: /eval\s*\(/g, type: 'Code Injection Risk', severity: 'critical', message: 'eval() usage detected' },
  { pattern: /new\s+Function\s*\(/g, type: 'Code Injection Risk', severity: 'high', message: 'Dynamic function creation' },
  
  // Hardcoded values
  { pattern: /(?:127\.0\.0\.1|localhost):\d{4,5}/g, type: 'Hardcoded URL', severity: 'low', message: 'Hardcoded localhost URL' },
  
  // Insecure HTTP
  { pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/g, type: 'Insecure Protocol', severity: 'medium', message: 'HTTP protocol usage' }
];

/**
 * Scan a file for sensitive data
 */
async function scanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Skip if file is too large (> 1MB)
    if (content.length > 1024 * 1024) {
      return;
    }

    // Check for sensitive patterns
    for (const { pattern, type, severity } of sensitivePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const line = content.substring(0, match.index).split('\n').length;
        findings[severity].push({
          file: relativePath,
          line,
          type,
          match: match[0].substring(0, 50) + '...',
          severity
        });
      }
    }

    // Check for dangerous code patterns
    for (const { pattern, type, severity, message } of dangerousPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const line = content.substring(0, match.index).split('\n').length;
        findings[severity].push({
          file: relativePath,
          line,
          type,
          message,
          match: match[0].substring(0, 50) + '...',
          severity
        });
      }
    }
  } catch (error) {
    // Ignore files that can't be read
  }
}

/**
 * Scan directory recursively
 */
async function scanDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip certain directories
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
        continue;
      }
      await scanDirectory(fullPath);
    } else if (entry.isFile()) {
      // Only scan text files
      const ext = path.extname(entry.name);
      if (['.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.yml', '.yaml', '.md'].includes(ext)) {
        await scanFile(fullPath);
      }
    }
  }
}

/**
 * Check for vulnerable dependencies
 */
function checkDependencies() {
  console.log(`${colors.blue}🔍 Checking for vulnerable dependencies...${colors.reset}`);
  
  try {
    // Run npm audit
    const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
    const audit = JSON.parse(auditResult);
    
    if (audit.metadata.vulnerabilities.total > 0) {
      const vulns = audit.metadata.vulnerabilities;
      findings.critical.push({
        type: 'Vulnerable Dependencies',
        message: `Found ${vulns.critical || 0} critical, ${vulns.high || 0} high, ${vulns.moderate || 0} moderate vulnerabilities`,
        severity: vulns.critical > 0 ? 'critical' : vulns.high > 0 ? 'high' : 'medium'
      });
    }
  } catch (error) {
    // npm audit returns non-zero exit code if vulnerabilities found
    try {
      const audit = JSON.parse(error.stdout);
      if (audit.metadata?.vulnerabilities?.total > 0) {
        const vulns = audit.metadata.vulnerabilities;
        findings.critical.push({
          type: 'Vulnerable Dependencies',
          message: `Found ${vulns.critical || 0} critical, ${vulns.high || 0} high, ${vulns.moderate || 0} moderate vulnerabilities`,
          severity: vulns.critical > 0 ? 'critical' : vulns.high > 0 ? 'high' : 'medium',
          remediation: 'Run "npm audit fix" to fix vulnerabilities'
        });
      }
    } catch (e) {
      findings.info.push({
        type: 'Dependency Check',
        message: 'Could not run npm audit',
        severity: 'info'
      });
    }
  }
}

/**
 * Check security headers configuration
 */
async function checkSecurityHeaders() {
  console.log(`${colors.blue}🔍 Checking security headers configuration...${colors.reset}`);
  
  const headerFiles = [
    'src/server.js',
    'src/app.js',
    'server.js',
    'app.js'
  ];

  for (const file of headerFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      
      // Check for security headers
      const requiredHeaders = [
        { name: 'X-Frame-Options', pattern: /['"]X-Frame-Options['"]/i },
        { name: 'X-Content-Type-Options', pattern: /['"]X-Content-Type-Options['"]/i },
        { name: 'X-XSS-Protection', pattern: /['"]X-XSS-Protection['"]/i },
        { name: 'Strict-Transport-Security', pattern: /['"]Strict-Transport-Security['"]/i },
        { name: 'Content-Security-Policy', pattern: /['"]Content-Security-Policy['"]/i }
      ];

      for (const { name, pattern } of requiredHeaders) {
        if (!pattern.test(content)) {
          findings.medium.push({
            type: 'Missing Security Header',
            message: `${name} header not configured`,
            file,
            severity: 'medium',
            remediation: `Add ${name} header to improve security`
          });
        }
      }
    } catch (error) {
      // File doesn't exist
    }
  }
}

/**
 * Check for HTTPS enforcement
 */
async function checkHTTPSEnforcement() {
  console.log(`${colors.blue}🔍 Checking HTTPS enforcement...${colors.reset}`);
  
  try {
    // Check if there's HTTPS redirect middleware
    const serverFiles = ['src/server.js', 'src/app.js', 'server.js', 'app.js'];
    let httpsEnforced = false;

    for (const file of serverFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        if (/req\.secure|req\.header\(['"]x-forwarded-proto['"]\)|forceSSL|requireHTTPS/i.test(content)) {
          httpsEnforced = true;
          break;
        }
      } catch (error) {
        // File doesn't exist
      }
    }

    if (!httpsEnforced) {
      findings.high.push({
        type: 'HTTPS Not Enforced',
        message: 'No HTTPS enforcement middleware detected',
        severity: 'high',
        remediation: 'Add middleware to redirect HTTP to HTTPS in production'
      });
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Check for environment variable security
 */
async function checkEnvironmentSecurity() {
  console.log(`${colors.blue}🔍 Checking environment variable security...${colors.reset}`);
  
  // Check if .env files are in .gitignore
  try {
    const gitignore = await fs.readFile('.gitignore', 'utf8');
    const envPatterns = ['.env', '.env.local', '.env.production'];
    
    for (const pattern of envPatterns) {
      if (!gitignore.includes(pattern)) {
        findings.critical.push({
          type: 'Environment File Exposure',
          message: `${pattern} not in .gitignore`,
          severity: 'critical',
          remediation: `Add ${pattern} to .gitignore to prevent credential exposure`
        });
      }
    }
  } catch (error) {
    findings.high.push({
      type: 'Missing .gitignore',
      message: 'No .gitignore file found',
      severity: 'high',
      remediation: 'Create .gitignore file to prevent sensitive file exposure'
    });
  }

  // Check for .env.example
  try {
    await fs.access('.env.example');
  } catch (error) {
    findings.low.push({
      type: 'Missing Documentation',
      message: 'No .env.example file found',
      severity: 'low',
      remediation: 'Create .env.example to document required environment variables'
    });
  }
}

/**
 * Generate security report
 */
function generateReport() {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}                    SECURITY SCAN REPORT                        ${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  const severityColors = {
    critical: colors.red,
    high: colors.red,
    medium: colors.yellow,
    low: colors.blue,
    info: colors.cyan
  };

  const severityEmojis = {
    critical: '🚨',
    high: '❗',
    medium: '⚠️ ',
    low: 'ℹ️ ',
    info: '💡'
  };

  let totalFindings = 0;

  for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
    const severityFindings = findings[severity];
    if (severityFindings.length > 0) {
      console.log(`${severityColors[severity]}${severityEmojis[severity]} ${severity.toUpperCase()} (${severityFindings.length})${colors.reset}`);
      console.log(`${severityColors[severity]}${'─'.repeat(60)}${colors.reset}`);
      
      severityFindings.forEach((finding, index) => {
        console.log(`\n${severityColors[severity]}[${index + 1}] ${finding.type}${colors.reset}`);
        if (finding.file) {
          console.log(`    📁 File: ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
        }
        if (finding.message) {
          console.log(`    💬 ${finding.message}`);
        }
        if (finding.match) {
          console.log(`    📝 Match: ${finding.match}`);
        }
        if (finding.remediation) {
          console.log(`    ✅ Fix: ${finding.remediation}`);
        }
      });
      
      console.log('');
      totalFindings += severityFindings.length;
    }
  }

  // Summary
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}                         SUMMARY                               ${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`Total findings: ${totalFindings}`);
  console.log(`Critical: ${findings.critical.length}`);
  console.log(`High: ${findings.high.length}`);
  console.log(`Medium: ${findings.medium.length}`);
  console.log(`Low: ${findings.low.length}`);
  console.log(`Info: ${findings.info.length}`);

  // Overall security score
  const score = Math.max(0, 100 - (findings.critical.length * 20) - (findings.high.length * 10) - (findings.medium.length * 5) - (findings.low.length * 2));
  const scoreColor = score >= 80 ? colors.green : score >= 60 ? colors.yellow : colors.red;
  
  console.log(`\n${scoreColor}Security Score: ${score}/100${colors.reset}`);

  // Exit code based on critical findings
  if (findings.critical.length > 0) {
    console.log(`\n${colors.red}❌ Critical security issues found!${colors.reset}`);
    process.exit(1);
  } else if (findings.high.length > 0) {
    console.log(`\n${colors.yellow}⚠️  High severity issues found${colors.reset}`);
  } else {
    console.log(`\n${colors.green}✅ No critical security issues found${colors.reset}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.magenta}🔒 Personal Brand DNA Security Scanner${colors.reset}`);
  console.log(`${colors.magenta}${'─'.repeat(40)}${colors.reset}\n`);

  // Scan for sensitive data
  console.log(`${colors.blue}🔍 Scanning for sensitive data...${colors.reset}`);
  await scanDirectory(process.cwd());

  // Check dependencies
  checkDependencies();

  // Check security headers
  await checkSecurityHeaders();

  // Check HTTPS enforcement
  await checkHTTPSEnforcement();

  // Check environment security
  await checkEnvironmentSecurity();

  // Generate report
  generateReport();
}

// Run the scanner
main().catch(console.error);