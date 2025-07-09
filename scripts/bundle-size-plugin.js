/**
 * Webpack plugin to track and report bundle sizes
 */

class BundleSizePlugin {
  constructor(options = {}) {
    this.options = {
      maxSizes: {
        'main.js': 250 * 1024, // 250KB
        'vendor.js': 300 * 1024, // 300KB
        'runtime.js': 30 * 1024, // 30KB
        ...options.maxSizes
      },
      warnOnly: options.warnOnly !== false,
      outputFile: options.outputFile || 'bundle-sizes.json'
    };
  }

  apply(compiler) {
    compiler.hooks.done.tap('BundleSizePlugin', (stats) => {
      const compilation = stats.compilation;
      const assets = compilation.assets;
      const sizes = {};
      let hasErrors = false;

      console.log('\n📊 Bundle Size Report:\n');
      console.log('┌────────────────────────┬──────────────┬──────────────┬─────────┐');
      console.log('│ Asset                  │ Size         │ Gzipped      │ Status  │');
      console.log('├────────────────────────┼──────────────┼──────────────┼─────────┤');

      Object.keys(assets).forEach((assetName) => {
        if (assetName.endsWith('.js') || assetName.endsWith('.css')) {
          const asset = assets[assetName];
          const size = asset.size();
          const sizeInKB = (size / 1024).toFixed(2);
          
          // Estimate gzipped size (roughly 30% of original)
          const gzippedSize = (size * 0.3 / 1024).toFixed(2);
          
          // Check against max size
          let status = '✅';
          const baseName = assetName.split('.')[0] + '.js';
          if (this.options.maxSizes[baseName] && size > this.options.maxSizes[baseName]) {
            status = '⚠️';
            hasErrors = true;
          }
          
          sizes[assetName] = {
            size: size,
            sizeInKB: sizeInKB,
            gzippedSizeInKB: gzippedSize,
            status: status
          };

          const paddedName = assetName.padEnd(22);
          const paddedSize = `${sizeInKB} KB`.padEnd(12);
          const paddedGzip = `${gzippedSize} KB`.padEnd(12);
          
          console.log(`│ ${paddedName} │ ${paddedSize} │ ${paddedGzip} │ ${status}      │`);
        }
      });

      console.log('└────────────────────────┴──────────────┴──────────────┴─────────┘');

      // Calculate totals
      const totalSize = Object.values(sizes).reduce((sum, item) => sum + item.size, 0);
      const totalSizeKB = (totalSize / 1024).toFixed(2);
      const totalGzipKB = (totalSize * 0.3 / 1024).toFixed(2);

      console.log(`\n📦 Total Bundle Size: ${totalSizeKB} KB (${totalGzipKB} KB gzipped)\n`);

      // Performance budget warnings
      if (hasErrors) {
        console.log('⚠️  Performance Budget Exceeded!');
        console.log('   Some bundles are larger than recommended.');
        console.log('   Run "npm run optimize:bundle" for suggestions.\n');
        
        if (!this.options.warnOnly) {
          throw new Error('Bundle size limit exceeded!');
        }
      }

      // Write sizes to file for tracking
      const fs = require('fs');
      const outputPath = require('path').join(compiler.outputPath, this.options.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        sizes: sizes,
        totals: {
          size: totalSize,
          sizeInKB: totalSizeKB,
          gzippedSizeInKB: totalGzipKB
        }
      }, null, 2));
    });
  }
}

module.exports = BundleSizePlugin;