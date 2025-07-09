const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');
const BundleSizePlugin = require('./scripts/bundle-size-plugin');

module.exports = {
  jest: {
    configure: {
      transformIgnorePatterns: [
        'node_modules/(?!(axios)/)'
      ],
      moduleNameMapper: {
        '^axios$': require.resolve('axios'),
      }
    }
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Add polyfills for Node.js modules that Supabase needs
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser.js'),
        util: require.resolve('util/'),
        path: require.resolve('path-browserify'),
        zlib: require.resolve('browserify-zlib'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        assert: require.resolve('assert/'),
        url: require.resolve('url/'),
        fs: false,
        net: false,
        tls: false,
        child_process: false
      };

      // Add ProvidePlugin for global polyfills
      const webpack = require('webpack');
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      // Enable module concatenation for better tree shaking
      webpackConfig.optimization.concatenateModules = true;
      
      // Configure code splitting
      webpackConfig.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]/,
            priority: 20,
            enforce: true,
            reuseExistingChunk: true,
          },
          // Common components chunk
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // React-related libraries
          react: {
            name: 'react',
            test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
            chunks: 'all',
            priority: 30,
            enforce: true,
          },
          // Redux-related libraries
          redux: {
            name: 'redux',
            test: /[\\/]node_modules[\\/](@reduxjs|react-redux|redux-persist|reselect)[\\/]/,
            chunks: 'all',
            priority: 25,
            enforce: true,
          },
          // UI libraries
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](lucide-react|react-icons|recharts|@hello-pangea)[\\/]/,
            chunks: 'all',
            priority: 25,
            enforce: true,
          },
          // Workshop components (heavy)
          workshop: {
            name: 'workshop',
            test: /[\\/]src[\\/]components[\\/]workshop[\\/]/,
            chunks: 'async',
            priority: 15,
            minSize: 0,
            reuseExistingChunk: true,
          },
          // Services and utilities
          services: {
            name: 'services',
            test: /[\\/]src[\\/](services|utils)[\\/]/,
            chunks: 'all',
            priority: 15,
            minSize: 0,
            reuseExistingChunk: true,
          },
          // Analytics and monitoring
          analytics: {
            name: 'analytics',
            test: /[\\/]node_modules[\\/](@sentry)[\\/]/,
            chunks: 'async',
            priority: 20,
            enforce: true,
          },
          // PDF generation (heavy)
          pdf: {
            name: 'pdf',
            test: /[\\/]node_modules[\\/](pdfmake)[\\/]/,
            chunks: 'async',
            priority: 20,
            enforce: true,
          },
        },
      };

      // Configure runtime chunk
      webpackConfig.optimization.runtimeChunk = 'single';

      // Add bundle analyzer in production build with analyze flag
      if (process.env.ANALYZE === 'true') {
        webpackConfig.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: 'bundle-report.html',
            openAnalyzer: true,
            generateStatsFile: true,
            statsFilename: 'bundle-stats.json',
          })
        );
      }

      // Add compression plugin for production
      if (env === 'production') {
        webpackConfig.plugins.push(
          new CompressionPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,
            threshold: 8192,
            minRatio: 0.8,
          }),
          new CompressionPlugin({
            algorithm: 'brotliCompress',
            test: /\.(js|css|html|svg)$/,
            threshold: 8192,
            minRatio: 0.8,
            filename: '[path][base].br',
          })
        );

        // Optimize terser for better minification
        webpackConfig.optimization.minimizer = [
          new TerserPlugin({
            terserOptions: {
              parse: {
                ecma: 8,
              },
              compress: {
                ecma: 5,
                warnings: false,
                comparisons: false,
                inline: 2,
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug'],
              },
              mangle: {
                safari10: true,
              },
              output: {
                ecma: 5,
                comments: false,
                ascii_only: true,
              },
            },
            parallel: true,
          }),
        ];

        // Add service worker for PWA
        webpackConfig.plugins.push(
          new InjectManifest({
            swSrc: './src/service-worker.js',
            swDest: 'service-worker.js',
            exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
          })
        );
      }

      // Configure module resolution for better tree shaking
      webpackConfig.resolve.mainFields = ['module', 'main'];

      // Add performance hints
      webpackConfig.performance = {
        hints: env === 'production' ? 'warning' : false,
        maxEntrypointSize: 512000, // 500KB
        maxAssetSize: 256000, // 250KB
      };

      // Add bundle size tracking plugin
      webpackConfig.plugins.push(
        new BundleSizePlugin({
          maxSizes: {
            'main.js': 250 * 1024, // 250KB
            'vendor.js': 300 * 1024, // 300KB
            'runtime.js': 30 * 1024, // 30KB
            'workshop.js': 200 * 1024, // 200KB for workshop chunk
          },
          warnOnly: true,
          outputFile: 'bundle-sizes.json'
        })
      );

      return webpackConfig;
    },
  },
  babel: {
    plugins: (plugins, { env }) => [
      ...plugins,
      // Remove prop-types in production
      env === 'production' && [
        'transform-react-remove-prop-types',
        {
          removeImport: true,
        },
      ],
      // Optimize lodash imports
      ['babel-plugin-lodash', { id: ['lodash', 'recompose'] }],
    ].filter(Boolean),
  },
  style: {
    postcss: {
      plugins: (plugins, { env }) => [
        require('tailwindcss'),
        require('autoprefixer'),
        // Add CSS optimization
        env === 'production' && require('cssnano')({
          preset: 'default',
        }),
      ].filter(Boolean),
    },
  },
};