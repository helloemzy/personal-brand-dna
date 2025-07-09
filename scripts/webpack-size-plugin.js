const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class WebpackSizePlugin {
  constructor(options = {}) {
    this.options = {
      outputPath: path.join(process.cwd(), 'build-size-report.json'),
      sizeLimit: 2 * 1024 * 1024, // 2MB default
      chunkSizeLimit: 300 * 1024, // 300KB per chunk
      warnOnly: false,
      ...options
    };
    
    this.previousSizes = this.loadPreviousSizes();
  }

  loadPreviousSizes() {
    try {
      if (fs.existsSync(this.options.outputPath)) {
        return JSON.parse(fs.readFileSync(this.options.outputPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load previous build sizes:', error.message);
    }
    return null;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('WebpackSizePlugin', (compilation, callback) => {
      const stats = compilation.getStats().toJson({
        all: false,
        assets: true,
        chunks: true,
        modules: true,
      });

      const report = this.generateReport(stats);
      this.printReport(report);
      this.saveReport(report);

      if (!this.options.warnOnly && report.violations.length > 0) {
        callback(new Error('Build size limits exceeded!'));
      } else {
        callback();
      }
    });
  }

  generateReport(stats) {
    const report = {
      timestamp: new Date().toISOString(),
      totalSize: 0,
      assets: [],
      chunks: [],
      violations: [],
      changes: [],
    };

    // Process assets
    stats.assets.forEach(asset => {
      const size = asset.size;
      report.totalSize += size;

      const assetInfo = {
        name: asset.name,
        size: size,
        sizeKB: (size / 1024).toFixed(2),
        sizeMB: (size / 1024 / 1024).toFixed(2),
      };

      report.assets.push(assetInfo);

      // Check for violations
      if (asset.name.endsWith('.js') || asset.name.endsWith('.css')) {
        if (size > this.options.chunkSizeLimit) {
          report.violations.push({
            type: 'chunk',
            name: asset.name,
            size: size,
            limit: this.options.chunkSizeLimit,
            excess: size - this.options.chunkSizeLimit,
          });
        }
      }
    });

    // Process chunks
    stats.chunks.forEach(chunk => {
      const chunkSize = chunk.files.reduce((total, file) => {
        const asset = stats.assets.find(a => a.name === file);
        return total + (asset ? asset.size : 0);
      }, 0);

      report.chunks.push({
        id: chunk.id,
        names: chunk.names,
        files: chunk.files,
        size: chunkSize,
        sizeKB: (chunkSize / 1024).toFixed(2),
        initial: chunk.initial,
        entry: chunk.entry,
      });
    });

    // Check total size violation
    if (report.totalSize > this.options.sizeLimit) {
      report.violations.push({
        type: 'total',
        size: report.totalSize,
        limit: this.options.sizeLimit,
        excess: report.totalSize - this.options.sizeLimit,
      });
    }

    // Compare with previous build
    if (this.previousSizes) {
      report.assets.forEach(asset => {
        const prevAsset = this.previousSizes.assets.find(a => a.name === asset.name);
        if (prevAsset) {
          const diff = asset.size - prevAsset.size;
          if (Math.abs(diff) > 1024) { // Only report changes > 1KB
            report.changes.push({
              name: asset.name,
              previousSize: prevAsset.size,
              currentSize: asset.size,
              diff: diff,
              percentChange: ((diff / prevAsset.size) * 100).toFixed(2),
            });
          }
        } else {
          report.changes.push({
            name: asset.name,
            previousSize: 0,
            currentSize: asset.size,
            diff: asset.size,
            percentChange: 'new',
          });
        }
      });
    }

    return report;
  }

  printReport(report) {
    console.log('\n' + chalk.bold.blue('📊 Bundle Size Report'));
    console.log(chalk.gray('─'.repeat(60)));

    // Total size
    console.log(chalk.bold(`Total Size: ${(report.totalSize / 1024 / 1024).toFixed(2)}MB`));
    
    // Size limit status
    const totalSizeOk = report.totalSize <= this.options.sizeLimit;
    console.log(
      chalk.bold('Size Limit: ') +
      (totalSizeOk ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')) +
      ` (limit: ${(this.options.sizeLimit / 1024 / 1024).toFixed(2)}MB)`
    );

    // Top 10 largest assets
    console.log('\n' + chalk.bold('Top 10 Largest Assets:'));
    const sortedAssets = [...report.assets].sort((a, b) => b.size - a.size).slice(0, 10);
    sortedAssets.forEach((asset, index) => {
      const sizeColor = asset.size > this.options.chunkSizeLimit ? chalk.red : chalk.white;
      console.log(
        `  ${index + 1}. ${asset.name.padEnd(40)} ${sizeColor(asset.sizeKB + 'KB')}`
      );
    });

    // Violations
    if (report.violations.length > 0) {
      console.log('\n' + chalk.bold.red('⚠️  Size Violations:'));
      report.violations.forEach(violation => {
        if (violation.type === 'total') {
          console.log(
            chalk.red(`  • Total bundle size exceeds limit by ${(violation.excess / 1024 / 1024).toFixed(2)}MB`)
          );
        } else {
          console.log(
            chalk.red(`  • ${violation.name} exceeds chunk limit by ${(violation.excess / 1024).toFixed(2)}KB`)
          );
        }
      });
    }

    // Changes from previous build
    if (report.changes.length > 0) {
      console.log('\n' + chalk.bold('📈 Size Changes:'));
      const significantChanges = report.changes
        .filter(change => Math.abs(change.diff) > 5 * 1024) // > 5KB
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 10);

      significantChanges.forEach(change => {
        const emoji = change.diff > 0 ? '📈' : '📉';
        const color = change.diff > 0 ? chalk.yellow : chalk.green;
        const sign = change.diff > 0 ? '+' : '';
        
        if (change.percentChange === 'new') {
          console.log(
            `  ${emoji} ${change.name.padEnd(35)} ${chalk.green('NEW')} (${(change.currentSize / 1024).toFixed(2)}KB)`
          );
        } else {
          console.log(
            `  ${emoji} ${change.name.padEnd(35)} ${color(sign + (change.diff / 1024).toFixed(2) + 'KB')} (${change.percentChange}%)`
          );
        }
      });
    }

    console.log(chalk.gray('─'.repeat(60)) + '\n');
  }

  saveReport(report) {
    try {
      fs.writeFileSync(
        this.options.outputPath,
        JSON.stringify(report, null, 2)
      );
    } catch (error) {
      console.error('Failed to save build size report:', error.message);
    }
  }
}

module.exports = WebpackSizePlugin;