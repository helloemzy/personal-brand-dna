#!/usr/bin/env node

/**
 * Query Performance Analysis Script
 * Analyzes PostgreSQL query performance and provides optimization recommendations
 */

const { Pool } = require('pg');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class QueryAnalyzer {
  constructor() {
    this.slowQueryThreshold = 100; // milliseconds
    this.recommendations = [];
  }

  async analyze() {
    console.log(chalk.blue.bold('\n🔍 PostgreSQL Query Performance Analysis\n'));

    try {
      // Check if pg_stat_statements is enabled
      await this.checkPgStatStatements();

      // Analyze slow queries
      await this.analyzeSlowQueries();

      // Analyze table statistics
      await this.analyzeTableStats();

      // Analyze index usage
      await this.analyzeIndexUsage();

      // Analyze missing indexes
      await this.analyzeMissingIndexes();

      // Analyze query plans for common operations
      await this.analyzeCommonQueryPlans();

      // Generate recommendations report
      await this.generateReport();

    } catch (error) {
      console.error(chalk.red('Error during analysis:'), error.message);
    } finally {
      await pool.end();
    }
  }

  async checkPgStatStatements() {
    try {
      const result = await pool.query(`
        SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements'
      `);
      
      if (result.rows.length === 0) {
        console.log(chalk.yellow('⚠️  pg_stat_statements extension not enabled'));
        console.log(chalk.gray('   Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'));
      } else {
        console.log(chalk.green('✓ pg_stat_statements extension is enabled'));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not check pg_stat_statements'));
    }
  }

  async analyzeSlowQueries() {
    console.log(chalk.cyan('\n📊 Analyzing Slow Queries...'));

    try {
      // Try to use pg_stat_statements if available
      const slowQueries = await pool.query(`
        SELECT 
          query,
          calls,
          mean_exec_time as avg_time_ms,
          max_exec_time as max_time_ms,
          total_exec_time as total_time_ms,
          rows / NULLIF(calls, 0) as avg_rows
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `, [this.slowQueryThreshold]);

      if (slowQueries.rows.length > 0) {
        const table = new Table({
          head: ['Query', 'Calls', 'Avg Time (ms)', 'Max Time (ms)', 'Avg Rows'],
          colWidths: [50, 10, 15, 15, 12]
        });

        slowQueries.rows.forEach(row => {
          table.push([
            row.query.substring(0, 47) + '...',
            row.calls,
            parseFloat(row.avg_time_ms).toFixed(2),
            parseFloat(row.max_time_ms).toFixed(2),
            row.avg_rows ? row.avg_rows.toFixed(0) : '0'
          ]);
        });

        console.log(table.toString());
        
        // Add recommendations for slow queries
        slowQueries.rows.forEach(row => {
          if (row.avg_time_ms > 500) {
            this.recommendations.push({
              type: 'SLOW_QUERY',
              severity: 'HIGH',
              query: row.query.substring(0, 100),
              message: `Query averages ${row.avg_time_ms.toFixed(2)}ms. Consider optimizing with indexes or query restructuring.`
            });
          }
        });
      }
    } catch (error) {
      // Fallback to basic slow query analysis
      console.log(chalk.yellow('Using basic query analysis (pg_stat_statements not available)'));
      
      const activeQueries = await pool.query(`
        SELECT 
          pid,
          now() - pg_stat_activity.query_start AS duration,
          query,
          state
        FROM pg_stat_activity
        WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
          AND state = 'active'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY duration DESC
      `);

      if (activeQueries.rows.length > 0) {
        console.log(chalk.yellow('\n⚠️  Currently running slow queries:'));
        activeQueries.rows.forEach(row => {
          console.log(`  - PID ${row.pid}: ${row.query.substring(0, 80)}...`);
        });
      }
    }
  }

  async analyzeTableStats() {
    console.log(chalk.cyan('\n📊 Analyzing Table Statistics...'));

    const tableStats = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        CASE 
          WHEN n_live_tup > 0 
          THEN ROUND(100.0 * n_dead_tup / n_live_tup, 2)
          ELSE 0
        END as dead_row_percent,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `);

    const table = new Table({
      head: ['Table', 'Live Rows', 'Dead Rows', 'Dead %', 'Last Vacuum', 'Last Analyze'],
      colWidths: [25, 12, 12, 10, 20, 20]
    });

    tableStats.rows.forEach(row => {
      table.push([
        row.tablename,
        row.live_rows || 0,
        row.dead_rows || 0,
        row.dead_row_percent + '%',
        row.last_autovacuum ? new Date(row.last_autovacuum).toLocaleDateString() : 'Never',
        row.last_autoanalyze ? new Date(row.last_autoanalyze).toLocaleDateString() : 'Never'
      ]);

      // Add recommendations for table maintenance
      if (row.dead_row_percent > 20) {
        this.recommendations.push({
          type: 'TABLE_MAINTENANCE',
          severity: 'MEDIUM',
          table: row.tablename,
          message: `Table has ${row.dead_row_percent}% dead rows. Consider running VACUUM ANALYZE.`
        });
      }

      if (!row.last_analyze && row.live_rows > 1000) {
        this.recommendations.push({
          type: 'TABLE_STATISTICS',
          severity: 'HIGH',
          table: row.tablename,
          message: `Table has never been analyzed. Run ANALYZE ${row.tablename} for better query plans.`
        });
      }
    });

    console.log(table.toString());
  }

  async analyzeIndexUsage() {
    console.log(chalk.cyan('\n📊 Analyzing Index Usage...'));

    const indexUsage = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan ASC
      LIMIT 20
    `);

    const table = new Table({
      head: ['Table', 'Index', 'Scans', 'Size'],
      colWidths: [25, 35, 12, 12]
    });

    indexUsage.rows.forEach(row => {
      table.push([
        row.tablename,
        row.indexname,
        row.index_scans || 0,
        row.index_size
      ]);

      // Identify unused indexes
      if (row.index_scans === 0 && !row.indexname.includes('pkey')) {
        this.recommendations.push({
          type: 'UNUSED_INDEX',
          severity: 'LOW',
          index: row.indexname,
          message: `Index ${row.indexname} has never been used. Consider dropping it to save space.`
        });
      }
    });

    console.log(table.toString());
  }

  async analyzeMissingIndexes() {
    console.log(chalk.cyan('\n📊 Analyzing Missing Indexes...'));

    // Check for common query patterns that might benefit from indexes
    const missingIndexChecks = [
      {
        name: 'User Authentication Lookups',
        query: `
          SELECT 
            'users' as table_name,
            'email' as column_name,
            COUNT(*) as frequency
          FROM pg_stat_user_tables t
          WHERE tablename = 'users'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE tablename = 'users' 
                AND indexdef LIKE '%email%'
            )
        `,
        recommendation: 'CREATE INDEX idx_users_email ON users(email);'
      },
      {
        name: 'Workshop Session Lookups',
        query: `
          SELECT 
            'workshop_sessions' as table_name,
            'user_id, status' as columns,
            COUNT(*) as frequency
          FROM pg_stat_user_tables t
          WHERE tablename = 'workshop_sessions'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE tablename = 'workshop_sessions' 
                AND indexdef LIKE '%user_id%'
                AND indexdef LIKE '%status%'
            )
        `,
        recommendation: 'CREATE INDEX idx_workshop_sessions_user_status ON workshop_sessions(user_id, status);'
      },
      {
        name: 'News Article Relevance',
        query: `
          SELECT 
            'news_articles' as table_name,
            'user_id, relevance_score' as columns,
            COUNT(*) as frequency
          FROM pg_stat_user_tables t
          WHERE tablename = 'news_articles'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE tablename = 'news_articles' 
                AND indexdef LIKE '%relevance_score%'
            )
        `,
        recommendation: 'CREATE INDEX idx_news_articles_relevance ON news_articles(user_id, relevance_score DESC);'
      },
      {
        name: 'Calendar Event Retrieval',
        query: `
          SELECT 
            'calendar_events' as table_name,
            'user_id, scheduled_for' as columns,
            COUNT(*) as frequency
          FROM pg_stat_user_tables t
          WHERE tablename = 'calendar_events'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE tablename = 'calendar_events' 
                AND indexdef LIKE '%scheduled_for%'
            )
        `,
        recommendation: 'CREATE INDEX idx_calendar_events_schedule ON calendar_events(user_id, scheduled_for);'
      },
      {
        name: 'LinkedIn Queue Management',
        query: `
          SELECT 
            'linkedin_posts' as table_name,
            'status, scheduled_at' as columns,
            COUNT(*) as frequency
          FROM pg_stat_user_tables t
          WHERE tablename = 'linkedin_posts'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE tablename = 'linkedin_posts' 
                AND indexdef LIKE '%status%'
                AND indexdef LIKE '%scheduled_at%'
            )
        `,
        recommendation: 'CREATE INDEX idx_linkedin_posts_queue ON linkedin_posts(status, scheduled_at) WHERE status IN (\'pending\', \'scheduled\');'
      }
    ];

    const missingIndexes = [];
    
    for (const check of missingIndexChecks) {
      try {
        const result = await pool.query(check.query);
        if (result.rows.length > 0 && result.rows[0].frequency !== null) {
          missingIndexes.push({
            name: check.name,
            recommendation: check.recommendation
          });
          
          this.recommendations.push({
            type: 'MISSING_INDEX',
            severity: 'HIGH',
            context: check.name,
            message: check.recommendation
          });
        }
      } catch (error) {
        // Table might not exist yet
      }
    }

    if (missingIndexes.length > 0) {
      console.log(chalk.yellow('\n⚠️  Recommended indexes for common queries:'));
      missingIndexes.forEach(idx => {
        console.log(`\n  ${chalk.bold(idx.name)}:`);
        console.log(`  ${chalk.gray(idx.recommendation)}`);
      });
    } else {
      console.log(chalk.green('✓ All recommended indexes are present'));
    }
  }

  async analyzeCommonQueryPlans() {
    console.log(chalk.cyan('\n📊 Analyzing Query Execution Plans...'));

    const commonQueries = [
      {
        name: 'User Authentication',
        query: 'SELECT * FROM users WHERE email = $1',
        params: ['test@example.com']
      },
      {
        name: 'Workshop Session Retrieval',
        query: 'SELECT * FROM workshop_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        params: [1]
      },
      {
        name: 'News Article Ranking',
        query: `
          SELECT * FROM news_articles 
          WHERE user_id = $1 
            AND relevance_score > 0.7 
          ORDER BY relevance_score DESC, published_at DESC 
          LIMIT 20
        `,
        params: [1]
      },
      {
        name: 'Calendar Events',
        query: `
          SELECT * FROM calendar_events 
          WHERE user_id = $1 
            AND scheduled_for BETWEEN $2 AND $3 
          ORDER BY scheduled_for
        `,
        params: [1, '2024-01-01', '2024-12-31']
      },
      {
        name: 'LinkedIn Queue',
        query: `
          SELECT * FROM linkedin_posts 
          WHERE status = 'pending' 
            AND scheduled_at <= NOW() 
          ORDER BY scheduled_at 
          LIMIT 10
        `,
        params: []
      }
    ];

    for (const queryInfo of commonQueries) {
      console.log(chalk.bold(`\n${queryInfo.name}:`));
      
      try {
        const explainResult = await pool.query(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryInfo.query}`,
          queryInfo.params
        );
        
        const plan = explainResult.rows[0]['QUERY PLAN'][0];
        const executionTime = plan['Execution Time'];
        const planningTime = plan['Planning Time'];
        
        console.log(`  Planning Time: ${planningTime.toFixed(2)}ms`);
        console.log(`  Execution Time: ${executionTime.toFixed(2)}ms`);
        
        // Analyze plan for issues
        const planNode = plan['Plan'];
        this.analyzePlanNode(planNode, queryInfo.name);
        
      } catch (error) {
        console.log(chalk.gray(`  Skipped (table may not exist): ${error.message}`));
      }
    }
  }

  analyzePlanNode(node, queryName, depth = 0) {
    const indent = '  '.repeat(depth + 1);
    
    // Check for sequential scans on large tables
    if (node['Node Type'] === 'Seq Scan' && node['Actual Rows'] > 1000) {
      console.log(chalk.yellow(`${indent}⚠️  Sequential scan on ${node['Relation Name']} (${node['Actual Rows']} rows)`));
      
      this.recommendations.push({
        type: 'SEQUENTIAL_SCAN',
        severity: 'HIGH',
        query: queryName,
        message: `Sequential scan detected on ${node['Relation Name']}. Consider adding an index.`
      });
    }
    
    // Check for missing index conditions
    if (node['Filter'] && node['Rows Removed by Filter'] > node['Actual Rows']) {
      console.log(chalk.yellow(`${indent}⚠️  High filter ratio: ${node['Rows Removed by Filter']} rows removed`));
    }
    
    // Recursively analyze child nodes
    if (node['Plans']) {
      node['Plans'].forEach(childNode => {
        this.analyzePlanNode(childNode, queryName, depth + 1);
      });
    }
  }

  async generateReport() {
    console.log(chalk.blue.bold('\n📋 Optimization Recommendations Summary\n'));

    // Group recommendations by severity
    const highSeverity = this.recommendations.filter(r => r.severity === 'HIGH');
    const mediumSeverity = this.recommendations.filter(r => r.severity === 'MEDIUM');
    const lowSeverity = this.recommendations.filter(r => r.severity === 'LOW');

    if (highSeverity.length > 0) {
      console.log(chalk.red.bold('🔴 HIGH Priority:'));
      highSeverity.forEach(rec => {
        console.log(`  - ${rec.message}`);
      });
    }

    if (mediumSeverity.length > 0) {
      console.log(chalk.yellow.bold('\n🟡 MEDIUM Priority:'));
      mediumSeverity.forEach(rec => {
        console.log(`  - ${rec.message}`);
      });
    }

    if (lowSeverity.length > 0) {
      console.log(chalk.gray.bold('\n⚪ LOW Priority:'));
      lowSeverity.forEach(rec => {
        console.log(`  - ${rec.message}`);
      });
    }

    // Generate SQL migration file
    await this.generateMigrationFile();

    console.log(chalk.green.bold('\n✅ Analysis complete!'));
    console.log(chalk.gray(`Generated migration file: migrations/performance_indexes_${Date.now()}.sql`));
  }

  async generateMigrationFile() {
    const indexRecommendations = this.recommendations
      .filter(r => r.type === 'MISSING_INDEX')
      .map(r => r.message);

    if (indexRecommendations.length === 0) return;

    const migrationContent = `-- Performance optimization indexes generated on ${new Date().toISOString()}
-- Generated by analyze-queries.js

${indexRecommendations.join('\n\n')}

-- Additional optimizations
ANALYZE; -- Update table statistics after creating indexes
`;

    const fileName = path.join(__dirname, '..', '..', 'migrations', `performance_indexes_${Date.now()}.sql`);
    await fs.writeFile(fileName, migrationContent);
  }
}

// Run the analyzer
const analyzer = new QueryAnalyzer();
analyzer.analyze().catch(console.error);