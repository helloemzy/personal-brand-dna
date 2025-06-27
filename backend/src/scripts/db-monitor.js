#!/usr/bin/env node

/**
 * Database Performance Monitoring Dashboard
 * Real-time monitoring of database performance metrics
 */

const { Pool } = require('pg');
const chalk = require('chalk');
const Table = require('cli-table3');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const databasePool = require('../config/database-pool');

require('dotenv').config();

class DatabaseMonitor {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.screen = null;
    this.grid = null;
    this.widgets = {};
    this.updateInterval = 2000; // 2 seconds
    this.metrics = {
      queryTimes: [],
      connectionCounts: [],
      cacheHitRates: [],
      slowQueries: []
    };
  }

  async start() {
    // Initialize the dashboard
    this.initDashboard();
    
    // Start monitoring
    await this.updateMetrics();
    
    // Set up periodic updates
    this.intervalId = setInterval(() => {
      this.updateMetrics().catch(console.error);
    }, this.updateInterval);

    // Handle cleanup
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.cleanup();
    });
  }

  initDashboard() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Personal Brand DNA - Database Monitor'
    });

    // Create grid
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Connection Pool Status (top left)
    this.widgets.poolStatus = this.grid.set(0, 0, 3, 4, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Connection Pool Status',
      width: '30%',
      height: '30%',
      border: { type: "line", fg: "cyan" },
      columnSpacing: 3,
      columnWidth: [20, 10]
    });

    // Query Performance Graph (top middle)
    this.widgets.queryPerf = this.grid.set(0, 4, 3, 4, contrib.line, {
      style: {
        line: "yellow",
        text: "green",
        baseline: "black"
      },
      xLabelPadding: 3,
      xPadding: 5,
      showLegend: true,
      wholeNumbersOnly: false,
      label: 'Query Performance (ms)'
    });

    // Cache Hit Rate (top right)
    this.widgets.cacheHitRate = this.grid.set(0, 8, 3, 4, contrib.gauge, {
      label: 'Cache Hit Rate',
      stroke: 'green',
      fill: 'white',
      width: '30%',
      height: '30%',
      percent: 0
    });

    // Active Queries (middle left)
    this.widgets.activeQueries = this.grid.set(3, 0, 4, 6, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Active Queries',
      width: '50%',
      height: '40%',
      border: { type: "line", fg: "cyan" },
      columnSpacing: 3,
      columnWidth: [8, 40, 15, 10]
    });

    // Database Statistics (middle right)
    this.widgets.dbStats = this.grid.set(3, 6, 4, 6, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Database Statistics',
      width: '50%',
      height: '40%',
      border: { type: "line", fg: "cyan" },
      columnSpacing: 3,
      columnWidth: [30, 20]
    });

    // Slow Query Log (bottom)
    this.widgets.slowQueries = this.grid.set(7, 0, 5, 12, contrib.log, {
      fg: "green",
      selectedFg: "green",
      label: 'Slow Queries (>100ms)',
      height: '40%',
      tags: true,
      border: { type: "line", fg: "cyan" }
    });

    // Render screen
    this.screen.render();
  }

  async updateMetrics() {
    try {
      // Update all metrics in parallel
      await Promise.all([
        this.updatePoolStatus(),
        this.updateQueryPerformance(),
        this.updateCacheStats(),
        this.updateActiveQueries(),
        this.updateDatabaseStats(),
        this.updateSlowQueries()
      ]);

      // Render updates
      this.screen.render();
    } catch (error) {
      this.widgets.slowQueries.log(`{red-fg}Error: ${error.message}{/red-fg}`);
    }
  }

  async updatePoolStatus() {
    try {
      const poolStats = databasePool.getPoolStats();
      
      if (poolStats) {
        const data = [
          ['Total Connections', poolStats.total],
          ['Active', poolStats.active],
          ['Idle', poolStats.idle],
          ['Waiting', poolStats.waiting],
          ['Cache Size', poolStats.cacheSize],
          ['Prepared Stmts', poolStats.preparedStatements],
          ['Mode', poolStats.isServerless ? 'Serverless' : 'Standard']
        ];

        this.widgets.poolStatus.setData({
          headers: ['Metric', 'Value'],
          data: data
        });
      }
    } catch (error) {
      console.error('Pool status error:', error);
    }
  }

  async updateQueryPerformance() {
    try {
      // Get recent query statistics
      const result = await this.pool.query(`
        SELECT 
          AVG(mean_exec_time) as avg_time,
          MAX(max_exec_time) as max_time,
          COUNT(*) as query_count
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
          AND calls > 0
      `);

      const stats = result.rows[0];
      
      // Add to metrics history
      this.metrics.queryTimes.push(parseFloat(stats.avg_time || 0));
      if (this.metrics.queryTimes.length > 60) {
        this.metrics.queryTimes.shift();
      }

      // Update graph
      const x = Array.from({ length: this.metrics.queryTimes.length }, (_, i) => i.toString());
      const y = this.metrics.queryTimes;

      this.widgets.queryPerf.setData([
        {
          title: 'Avg Query Time',
          x: x,
          y: y,
          style: { line: 'yellow' }
        }
      ]);
    } catch (error) {
      // Fallback if pg_stat_statements not available
      this.widgets.queryPerf.setData([{
        title: 'Query Time',
        x: ['0'],
        y: [0]
      }]);
    }
  }

  async updateCacheStats() {
    try {
      // Get cache statistics from PostgreSQL
      const result = await this.pool.query(`
        SELECT 
          sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as cache_hit_ratio
        FROM pg_statio_user_tables
      `);

      const cacheHitRate = parseFloat(result.rows[0].cache_hit_ratio || 0);
      
      // Update gauge
      this.widgets.cacheHitRate.setPercent(Math.round(cacheHitRate));
      
      // Store for history
      this.metrics.cacheHitRates.push(cacheHitRate);
      if (this.metrics.cacheHitRates.length > 60) {
        this.metrics.cacheHitRates.shift();
      }
    } catch (error) {
      this.widgets.cacheHitRate.setPercent(0);
    }
  }

  async updateActiveQueries() {
    try {
      const result = await this.pool.query(`
        SELECT 
          pid,
          usename,
          SUBSTRING(query, 1, 40) as query_short,
          state,
          EXTRACT(EPOCH FROM (now() - query_start))::integer as duration
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start
        LIMIT 10
      `);

      const data = result.rows.map(row => [
        row.pid,
        row.query_short + '...',
        row.state,
        row.duration + 's'
      ]);

      this.widgets.activeQueries.setData({
        headers: ['PID', 'Query', 'State', 'Duration'],
        data: data
      });
    } catch (error) {
      this.widgets.activeQueries.setData({
        headers: ['Error'],
        data: [[error.message]]
      });
    }
  }

  async updateDatabaseStats() {
    try {
      const stats = await this.pool.query(`
        WITH db_stats AS (
          SELECT 
            pg_database_size(current_database()) as db_size,
            (SELECT count(*) FROM pg_stat_activity) as total_connections,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
            (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_queries
        ),
        table_stats AS (
          SELECT 
            count(*) as table_count,
            sum(n_live_tup) as total_rows,
            sum(n_dead_tup) as dead_rows
          FROM pg_stat_user_tables
        ),
        index_stats AS (
          SELECT count(*) as index_count
          FROM pg_stat_user_indexes
        )
        SELECT 
          pg_size_pretty(db_stats.db_size) as database_size,
          db_stats.total_connections,
          db_stats.active_connections,
          db_stats.waiting_queries,
          table_stats.table_count,
          table_stats.total_rows,
          table_stats.dead_rows,
          index_stats.index_count,
          CASE 
            WHEN table_stats.total_rows > 0 
            THEN ROUND(100.0 * table_stats.dead_rows / table_stats.total_rows, 2)
            ELSE 0
          END as dead_row_percent
        FROM db_stats, table_stats, index_stats
      `);

      const s = stats.rows[0];
      const data = [
        ['Database Size', s.database_size],
        ['Total Connections', s.total_connections],
        ['Active Connections', s.active_connections],
        ['Waiting Queries', s.waiting_queries],
        ['Tables', s.table_count],
        ['Total Rows', parseInt(s.total_rows).toLocaleString()],
        ['Dead Rows %', s.dead_row_percent + '%'],
        ['Indexes', s.index_count]
      ];

      this.widgets.dbStats.setData({
        headers: ['Metric', 'Value'],
        data: data
      });
    } catch (error) {
      this.widgets.dbStats.setData({
        headers: ['Error'],
        data: [[error.message]]
      });
    }
  }

  async updateSlowQueries() {
    try {
      const result = await this.pool.query(`
        SELECT 
          SUBSTRING(query, 1, 100) as query_text,
          calls,
          mean_exec_time,
          max_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 5
      `);

      // Add new slow queries to the log
      result.rows.forEach(row => {
        const logEntry = `{yellow-fg}[${new Date().toLocaleTimeString()}]{/yellow-fg} ` +
                        `{red-fg}Slow Query (${row.mean_exec_time.toFixed(2)}ms avg):{/red-fg} ` +
                        `${row.query_text}... {gray-fg}(${row.calls} calls){/gray-fg}`;
        
        // Check if this query was already logged recently
        const isDuplicate = this.metrics.slowQueries.some(q => 
          q.query === row.query_text && 
          Date.now() - q.timestamp < 60000 // Within last minute
        );

        if (!isDuplicate) {
          this.widgets.slowQueries.log(logEntry);
          this.metrics.slowQueries.push({
            query: row.query_text,
            timestamp: Date.now()
          });
          
          // Keep only recent entries
          this.metrics.slowQueries = this.metrics.slowQueries.filter(
            q => Date.now() - q.timestamp < 300000 // Last 5 minutes
          );
        }
      });
    } catch (error) {
      // Fallback for active slow queries
      const fallbackResult = await this.pool.query(`
        SELECT 
          pid,
          now() - pg_stat_activity.query_start AS duration,
          SUBSTRING(query, 1, 100) as query_text
        FROM pg_stat_activity
        WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
          AND state = 'active'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY duration DESC
        LIMIT 5
      `);

      if (fallbackResult.rows.length > 0) {
        this.widgets.slowQueries.log('{yellow-fg}Currently running slow queries:{/yellow-fg}');
        fallbackResult.rows.forEach(row => {
          this.widgets.slowQueries.log(
            `{red-fg}PID ${row.pid}{/red-fg}: ${row.query_text}...`
          );
        });
      }
    }
  }

  cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.pool.end();
    process.exit(0);
  }
}

// CLI mode (when not using dashboard)
async function runCLIMode() {
  console.log(chalk.blue.bold('\n📊 Database Performance Monitor (CLI Mode)\n'));
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Get pool statistics
    const poolStats = databasePool.getPoolStats();
    console.log(chalk.cyan('Connection Pool Status:'));
    console.log(poolStats);

    // Get database statistics
    const dbStats = await pool.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        (SELECT count(*) FROM pg_stat_activity) as connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries
    `);
    
    console.log(chalk.cyan('\nDatabase Statistics:'));
    console.log(dbStats.rows[0]);

    // Get slow queries
    console.log(chalk.cyan('\nRecent Slow Queries:'));
    const slowQueries = await pool.query(`
      SELECT 
        SUBSTRING(query, 1, 80) as query,
        calls,
        mean_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    if (slowQueries.rows.length > 0) {
      const table = new Table({
        head: ['Query', 'Calls', 'Avg Time (ms)'],
        colWidths: [60, 10, 15]
      });

      slowQueries.rows.forEach(row => {
        table.push([
          row.query + '...',
          row.calls,
          row.mean_exec_time.toFixed(2)
        ]);
      });

      console.log(table.toString());
    } else {
      console.log(chalk.green('No slow queries detected'));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  } finally {
    await pool.end();
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--dashboard') || args.includes('-d')) {
    // Run interactive dashboard
    const monitor = new DatabaseMonitor();
    monitor.start().catch(console.error);
  } else {
    // Run CLI mode
    runCLIMode().catch(console.error);
  }
}

module.exports = DatabaseMonitor;