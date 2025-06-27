#!/usr/bin/env node

const { query } = require('../config/database');
const tokenEncryptionService = require('../services/tokenEncryptionService');
const logger = require('../utils/logger');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Token Security Audit Script
 * Scans database for unencrypted tokens and verifies security compliance
 */
class TokenAuditScript {
  constructor() {
    this.auditResults = {
      timestamp: new Date(),
      totalTokens: 0,
      unencryptedTokens: [],
      weakTokens: [],
      expiredTokens: [],
      suspiciousActivity: [],
      complianceIssues: [],
      recommendations: []
    };
  }

  /**
   * Run complete token security audit
   */
  async runAudit() {
    console.log('Starting Token Security Audit...\n');

    try {
      // 1. Scan for unencrypted tokens
      await this.scanUnencryptedTokens();

      // 2. Verify encryption standards
      await this.verifyEncryptionStandards();

      // 3. Check token expiration policies
      await this.checkTokenExpiration();

      // 4. Audit token usage patterns
      await this.auditTokenUsagePatterns();

      // 5. Check for suspicious activity
      await this.detectSuspiciousActivity();

      // 6. Verify token storage compliance
      await this.verifyStorageCompliance();

      // 7. Generate security report
      await this.generateSecurityReport();

      console.log('\nAudit completed successfully!');
    } catch (error) {
      console.error('Audit failed:', error);
      process.exit(1);
    }
  }

  /**
   * Scan database for unencrypted tokens
   */
  async scanUnencryptedTokens() {
    console.log('1. Scanning for unencrypted tokens...');

    // Check user_sessions table
    const sessionTokens = await query(`
      SELECT id, user_id, token_hash, created_at
      FROM user_sessions
      WHERE is_active = true
      LIMIT 1000
    `);

    // Check for patterns indicating unencrypted tokens
    for (const session of sessionTokens.rows) {
      // Check if token_hash looks like a plain JWT (starts with eyJ)
      if (session.token_hash && session.token_hash.startsWith('eyJ')) {
        this.auditResults.unencryptedTokens.push({
          table: 'user_sessions',
          id: session.id,
          userId: session.user_id,
          type: 'jwt',
          issue: 'Token stored in plain text'
        });
      }

      // Check hash length (should be 64 chars for SHA-256)
      if (session.token_hash && session.token_hash.length !== 64) {
        this.auditResults.complianceIssues.push({
          table: 'user_sessions',
          id: session.id,
          issue: 'Invalid token hash format'
        });
      }
    }

    // Check linkedin_oauth_tokens table
    const oauthTokens = await query(`
      SELECT id, user_id, access_token, refresh_token, created_at
      FROM linkedin_oauth_tokens
      WHERE is_active = true
      LIMIT 1000
    `);

    for (const oauth of oauthTokens.rows) {
      // Check if tokens are properly encrypted (should be JSON with encryption metadata)
      try {
        const accessData = JSON.parse(oauth.access_token);
        if (!accessData.v || !accessData.i || !accessData.a) {
          throw new Error('Missing encryption metadata');
        }
      } catch (error) {
        this.auditResults.unencryptedTokens.push({
          table: 'linkedin_oauth_tokens',
          id: oauth.id,
          userId: oauth.user_id,
          type: 'oauth_access',
          issue: 'Access token not properly encrypted'
        });
      }

      if (oauth.refresh_token) {
        try {
          const refreshData = JSON.parse(oauth.refresh_token);
          if (!refreshData.v || !refreshData.i || !refreshData.a) {
            throw new Error('Missing encryption metadata');
          }
        } catch (error) {
          this.auditResults.unencryptedTokens.push({
            table: 'linkedin_oauth_tokens',
            id: oauth.id,
            userId: oauth.user_id,
            type: 'oauth_refresh',
            issue: 'Refresh token not properly encrypted'
          });
        }
      }
    }

    // Check encrypted_tokens table
    const encryptedTokens = await query(`
      SELECT COUNT(*) as count
      FROM encrypted_tokens
      WHERE expires_at > NOW()
    `);

    this.auditResults.totalTokens = encryptedTokens.rows[0].count;

    console.log(`  - Found ${this.auditResults.unencryptedTokens.length} unencrypted tokens`);
    console.log(`  - Total active encrypted tokens: ${this.auditResults.totalTokens}`);
  }

  /**
   * Verify encryption standards compliance
   */
  async verifyEncryptionStandards() {
    console.log('2. Verifying encryption standards...');

    // Sample encrypted tokens for verification
    const sampleTokens = await query(`
      SELECT id, user_id, encrypted_data, token_type
      FROM encrypted_tokens
      WHERE expires_at > NOW()
      ORDER BY RANDOM()
      LIMIT 100
    `);

    let aes256Count = 0;
    let properIvLength = 0;
    let properAuthTag = 0;

    for (const token of sampleTokens.rows) {
      try {
        const encryptedData = JSON.parse(token.encrypted_data);

        // Check version
        if (!encryptedData.v || encryptedData.v < 1) {
          this.auditResults.weakTokens.push({
            id: token.id,
            issue: 'Missing or invalid encryption version'
          });
        }

        // Check IV length (should be 16 bytes = 24 base64 chars with padding)
        const ivBuffer = Buffer.from(encryptedData.i, 'base64');
        if (ivBuffer.length === 16) {
          properIvLength++;
        } else {
          this.auditResults.weakTokens.push({
            id: token.id,
            issue: `Invalid IV length: ${ivBuffer.length} bytes`
          });
        }

        // Check auth tag presence
        if (encryptedData.a) {
          const authTagBuffer = Buffer.from(encryptedData.a, 'base64');
          if (authTagBuffer.length === 16) {
            properAuthTag++;
          }
        } else {
          this.auditResults.weakTokens.push({
            id: token.id,
            issue: 'Missing authentication tag'
          });
        }

        // Verify can decrypt (indicates proper encryption)
        try {
          tokenEncryptionService.decryptToken(encryptedData, token.token_type);
          aes256Count++;
        } catch (decryptError) {
          this.auditResults.weakTokens.push({
            id: token.id,
            issue: 'Failed decryption test',
            error: decryptError.message
          });
        }
      } catch (error) {
        this.auditResults.complianceIssues.push({
          id: token.id,
          issue: 'Invalid encrypted data format',
          error: error.message
        });
      }
    }

    const sampleSize = sampleTokens.rows.length;
    console.log(`  - AES-256-GCM compliance: ${aes256Count}/${sampleSize} (${(aes256Count/sampleSize*100).toFixed(1)}%)`);
    console.log(`  - Proper IV length: ${properIvLength}/${sampleSize} (${(properIvLength/sampleSize*100).toFixed(1)}%)`);
    console.log(`  - Auth tag present: ${properAuthTag}/${sampleSize} (${(properAuthTag/sampleSize*100).toFixed(1)}%)`);
  }

  /**
   * Check token expiration policies
   */
  async checkTokenExpiration() {
    console.log('3. Checking token expiration policies...');

    // Check expired tokens that haven't been cleaned up
    const expiredSessions = await query(`
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE expires_at < NOW() AND is_active = true
    `);

    const expiredOAuth = await query(`
      SELECT COUNT(*) as count
      FROM linkedin_oauth_tokens
      WHERE expires_at < NOW() AND is_active = true
    `);

    const expiredEncrypted = await query(`
      SELECT COUNT(*) as count, token_type,
             AVG(EXTRACT(EPOCH FROM (NOW() - expires_at)) / 3600)::numeric(10,2) as avg_hours_expired
      FROM encrypted_tokens
      WHERE expires_at < NOW() AND revoked = false
      GROUP BY token_type
    `);

    this.auditResults.expiredTokens = {
      sessions: expiredSessions.rows[0].count,
      oauth: expiredOAuth.rows[0].count,
      encrypted: expiredEncrypted.rows
    };

    // Check token lifetimes
    const tokenLifetimes = await query(`
      SELECT token_type,
             AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600)::numeric(10,2) as avg_lifetime_hours,
             MAX(EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600)::numeric(10,2) as max_lifetime_hours,
             MIN(EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600)::numeric(10,2) as min_lifetime_hours
      FROM encrypted_tokens
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY token_type
    `);

    // Check against policy
    for (const lifetime of tokenLifetimes.rows) {
      const expectedMax = {
        jwt: 7 * 24, // 7 days
        oauth: 365 * 24, // 1 year
        session: 24, // 24 hours
        refresh: 30 * 24 // 30 days
      };

      if (lifetime.max_lifetime_hours > expectedMax[lifetime.token_type] * 1.1) {
        this.auditResults.complianceIssues.push({
          tokenType: lifetime.token_type,
          issue: 'Token lifetime exceeds policy',
          maxLifetime: `${lifetime.max_lifetime_hours} hours`,
          policyMax: `${expectedMax[lifetime.token_type]} hours`
        });
      }
    }

    console.log(`  - Expired sessions: ${this.auditResults.expiredTokens.sessions}`);
    console.log(`  - Expired OAuth tokens: ${this.auditResults.expiredTokens.oauth}`);
    console.log(`  - Token lifetime compliance checked`);
  }

  /**
   * Audit token usage patterns
   */
  async auditTokenUsagePatterns() {
    console.log('4. Auditing token usage patterns...');

    // Check for unusual token creation patterns
    const tokenCreationPatterns = await query(`
      SELECT user_id, 
             COUNT(*) as token_count,
             COUNT(DISTINCT token_type) as token_types,
             MAX(created_at) as last_created
      FROM encrypted_tokens
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY user_id
      HAVING COUNT(*) > 50
      ORDER BY token_count DESC
    `);

    for (const pattern of tokenCreationPatterns.rows) {
      this.auditResults.suspiciousActivity.push({
        userId: pattern.user_id,
        type: 'excessive_token_creation',
        details: {
          tokenCount: pattern.token_count,
          tokenTypes: pattern.token_types,
          period: '24 hours'
        }
      });
    }

    // Check for tokens used from multiple IPs
    const multiIpUsage = await query(`
      SELECT et.user_id, et.token_id, COUNT(DISTINCT us.ip_address) as ip_count
      FROM encrypted_tokens et
      JOIN user_sessions us ON et.user_id = us.user_id
      WHERE et.created_at > NOW() - INTERVAL '7 days'
        AND us.created_at > NOW() - INTERVAL '7 days'
      GROUP BY et.user_id, et.token_id
      HAVING COUNT(DISTINCT us.ip_address) > 5
    `);

    for (const usage of multiIpUsage.rows) {
      this.auditResults.suspiciousActivity.push({
        userId: usage.user_id,
        tokenId: usage.token_id,
        type: 'multi_ip_usage',
        details: {
          ipCount: usage.ip_count,
          concern: 'Possible token sharing or compromise'
        }
      });
    }

    // Check refresh token usage
    const refreshPatterns = await query(`
      SELECT user_id,
             COUNT(*) as refresh_count,
             AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600)::numeric(10,2) as avg_token_life
      FROM encrypted_tokens
      WHERE token_type = 'refresh'
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY user_id
      HAVING COUNT(*) > 10
    `);

    for (const refresh of refreshPatterns.rows) {
      this.auditResults.suspiciousActivity.push({
        userId: refresh.user_id,
        type: 'excessive_refresh',
        details: {
          refreshCount: refresh.refresh_count,
          avgTokenLife: `${refresh.avg_token_life} hours`,
          concern: 'Unusual refresh pattern'
        }
      });
    }

    console.log(`  - Found ${tokenCreationPatterns.rows.length} users with excessive token creation`);
    console.log(`  - Found ${multiIpUsage.rows.length} tokens used from multiple IPs`);
    console.log(`  - Found ${refreshPatterns.rows.length} users with unusual refresh patterns`);
  }

  /**
   * Detect suspicious token activity
   */
  async detectSuspiciousActivity() {
    console.log('5. Detecting suspicious activity...');

    // Check for revoked tokens still being used
    const revokedUsage = await query(`
      SELECT trl.token_id, trl.user_id, trl.revoked_at,
             COUNT(us.id) as usage_attempts
      FROM token_revocation_list trl
      JOIN user_sessions us ON us.user_id = trl.user_id
      WHERE us.created_at > trl.revoked_at
      GROUP BY trl.token_id, trl.user_id, trl.revoked_at
    `);

    for (const revoked of revokedUsage.rows) {
      this.auditResults.suspiciousActivity.push({
        tokenId: revoked.token_id,
        userId: revoked.user_id,
        type: 'revoked_token_usage',
        details: {
          revokedAt: revoked.revoked_at,
          usageAttempts: revoked.usage_attempts,
          severity: 'HIGH'
        }
      });
    }

    // Check for tokens with future expiration dates (possible tampering)
    const futureTokens = await query(`
      SELECT id, user_id, token_type, expires_at
      FROM encrypted_tokens
      WHERE expires_at > NOW() + INTERVAL '1 year'
        AND token_type != 'oauth'
    `);

    for (const future of futureTokens.rows) {
      this.auditResults.suspiciousActivity.push({
        tokenId: future.id,
        userId: future.user_id,
        type: 'suspicious_expiration',
        details: {
          tokenType: future.token_type,
          expiresAt: future.expires_at,
          concern: 'Unusually long expiration'
        }
      });
    }

    // Check for rapid token rotation
    const rapidRotation = await query(`
      SELECT user_id,
             COUNT(*) as rotation_count,
             MIN(created_at) as first_token,
             MAX(created_at) as last_token
      FROM encrypted_tokens
      WHERE created_at > NOW() - INTERVAL '1 hour'
        AND token_type = 'jwt'
      GROUP BY user_id
      HAVING COUNT(*) > 20
    `);

    for (const rotation of rapidRotation.rows) {
      this.auditResults.suspiciousActivity.push({
        userId: rotation.user_id,
        type: 'rapid_token_rotation',
        details: {
          rotationCount: rotation.rotation_count,
          timeWindow: '1 hour',
          firstToken: rotation.first_token,
          lastToken: rotation.last_token
        }
      });
    }

    console.log(`  - Detected ${this.auditResults.suspiciousActivity.length} suspicious activities`);
  }

  /**
   * Verify token storage compliance
   */
  async verifyStorageCompliance() {
    console.log('6. Verifying token storage compliance...');

    // Check for plain text storage in logs
    const logCheck = await query(`
      SELECT COUNT(*) as count
      FROM security_events
      WHERE event_data::text LIKE '%eyJ%'
         OR event_data::text ~ '[a-zA-Z0-9_-]{20,}\\.[a-zA-Z0-9_-]{20,}\\.[a-zA-Z0-9_-]{20,}'
    `);

    if (logCheck.rows[0].count > 0) {
      this.auditResults.complianceIssues.push({
        area: 'security_logs',
        issue: 'Possible token leakage in logs',
        count: logCheck.rows[0].count,
        severity: 'HIGH'
      });
    }

    // Check for proper token cleanup
    const oldTokens = await query(`
      SELECT token_type, COUNT(*) as count
      FROM encrypted_tokens
      WHERE created_at < NOW() - INTERVAL '90 days'
        AND revoked = false
      GROUP BY token_type
    `);

    for (const old of oldTokens.rows) {
      if (old.count > 0) {
        this.auditResults.complianceIssues.push({
          area: 'token_retention',
          tokenType: old.token_type,
          issue: 'Old tokens not cleaned up',
          count: old.count,
          recommendation: 'Implement automated cleanup policy'
        });
      }
    }

    // Check encryption key rotation
    const keyRotationEvents = await query(`
      SELECT COUNT(*) as count, MAX(created_at) as last_rotation
      FROM security_events
      WHERE event_type = 'key_rotation'
        AND created_at > NOW() - INTERVAL '90 days'
    `);

    if (keyRotationEvents.rows[0].count === 0) {
      this.auditResults.recommendations.push({
        category: 'key_management',
        recommendation: 'No key rotation detected in last 90 days',
        priority: 'HIGH',
        action: 'Implement regular key rotation schedule'
      });
    }

    console.log(`  - Storage compliance checks completed`);
  }

  /**
   * Generate comprehensive security report
   */
  async generateSecurityReport() {
    console.log('\n7. Generating security report...');

    // Calculate security score
    let securityScore = 100;
    
    // Deductions
    securityScore -= this.auditResults.unencryptedTokens.length * 5;
    securityScore -= this.auditResults.weakTokens.length * 2;
    securityScore -= this.auditResults.complianceIssues.length * 3;
    securityScore -= this.auditResults.suspiciousActivity.filter(a => a.details.severity === 'HIGH').length * 10;
    
    securityScore = Math.max(0, securityScore);

    // Add recommendations based on findings
    if (this.auditResults.unencryptedTokens.length > 0) {
      this.auditResults.recommendations.push({
        category: 'encryption',
        recommendation: 'Migrate all tokens to encrypted storage',
        priority: 'CRITICAL',
        affectedTokens: this.auditResults.unencryptedTokens.length
      });
    }

    if (this.auditResults.expiredTokens.sessions > 0 || this.auditResults.expiredTokens.oauth > 0) {
      this.auditResults.recommendations.push({
        category: 'token_lifecycle',
        recommendation: 'Implement automated token cleanup job',
        priority: 'HIGH',
        details: 'Run cleanup daily to remove expired tokens'
      });
    }

    if (this.auditResults.suspiciousActivity.length > 5) {
      this.auditResults.recommendations.push({
        category: 'monitoring',
        recommendation: 'Enhance token usage monitoring',
        priority: 'HIGH',
        details: 'Implement real-time alerting for suspicious patterns'
      });
    }

    // Generate report
    const report = {
      auditId: crypto.randomUUID(),
      timestamp: this.auditResults.timestamp,
      securityScore,
      summary: {
        totalTokensAudited: this.auditResults.totalTokens,
        unencryptedTokens: this.auditResults.unencryptedTokens.length,
        weakEncryption: this.auditResults.weakTokens.length,
        expiredTokens: {
          sessions: this.auditResults.expiredTokens.sessions,
          oauth: this.auditResults.expiredTokens.oauth
        },
        suspiciousActivities: this.auditResults.suspiciousActivity.length,
        complianceIssues: this.auditResults.complianceIssues.length
      },
      criticalFindings: [
        ...this.auditResults.unencryptedTokens.slice(0, 10),
        ...this.auditResults.suspiciousActivity
          .filter(a => a.details.severity === 'HIGH')
          .slice(0, 10)
      ],
      recommendations: this.auditResults.recommendations,
      nextSteps: this.generateNextSteps()
    };

    // Save report
    const reportPath = path.join(__dirname, '../../reports', `token-audit-${new Date().toISOString().split('T')[0]}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Log to database
    await query(
      'INSERT INTO security_events (event_type, event_data) VALUES ($1, $2)',
      ['token_security_audit', JSON.stringify(report)]
    );

    // Display summary
    console.log('\n====== TOKEN SECURITY AUDIT REPORT ======');
    console.log(`Audit ID: ${report.auditId}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`\nSECURITY SCORE: ${securityScore}/100`);
    console.log('\nSUMMARY:');
    console.log(`  Total Tokens Audited: ${report.summary.totalTokensAudited}`);
    console.log(`  Unencrypted Tokens: ${report.summary.unencryptedTokens}`);
    console.log(`  Weak Encryption: ${report.summary.weakEncryption}`);
    console.log(`  Expired Sessions: ${report.summary.expiredTokens.sessions}`);
    console.log(`  Expired OAuth: ${report.summary.expiredTokens.oauth}`);
    console.log(`  Suspicious Activities: ${report.summary.suspiciousActivities}`);
    console.log(`  Compliance Issues: ${report.summary.complianceIssues}`);
    
    if (report.criticalFindings.length > 0) {
      console.log('\nCRITICAL FINDINGS:');
      report.criticalFindings.slice(0, 5).forEach((finding, i) => {
        console.log(`  ${i + 1}. ${finding.type || finding.issue}`);
      });
    }

    console.log('\nTOP RECOMMENDATIONS:');
    report.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`  ${i + 1}. [${rec.priority}] ${rec.recommendation}`);
    });

    console.log(`\nFull report saved to: ${reportPath}`);
    console.log('========================================\n');

    return report;
  }

  /**
   * Generate actionable next steps
   */
  generateNextSteps() {
    const steps = [];

    if (this.auditResults.unencryptedTokens.length > 0) {
      steps.push({
        step: 1,
        action: 'Encrypt all plain text tokens',
        command: 'npm run migrate-tokens',
        urgency: 'IMMEDIATE'
      });
    }

    if (this.auditResults.expiredTokens.sessions > 100) {
      steps.push({
        step: steps.length + 1,
        action: 'Run token cleanup',
        command: 'npm run cleanup-tokens',
        urgency: 'HIGH'
      });
    }

    steps.push({
      step: steps.length + 1,
      action: 'Review suspicious activities',
      command: 'npm run security-review',
      urgency: 'MEDIUM'
    });

    steps.push({
      step: steps.length + 1,
      action: 'Schedule next audit',
      command: 'npm run schedule-audit',
      frequency: 'WEEKLY'
    });

    return steps;
  }
}

// Run the audit
if (require.main === module) {
  const audit = new TokenAuditScript();
  audit.runAudit().catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
  });
}

module.exports = TokenAuditScript;