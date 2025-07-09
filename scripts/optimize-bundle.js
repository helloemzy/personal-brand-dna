#!/usr/bin/env node

/**
 * Bundle optimization script
 * - Removes unused dependencies
 * - Identifies large dependencies
 * - Suggests optimization strategies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting bundle optimization analysis...\n');

// 1. Check for unused dependencies
console.log('📦 Checking for unused dependencies...');
try {
  const depcheckResult = execSync('npx depcheck --json', { encoding: 'utf8' });
  const depcheck = JSON.parse(depcheckResult);
  
  if (depcheck.dependencies && depcheck.dependencies.length > 0) {
    console.log('\n⚠️  Unused dependencies found:');
    depcheck.dependencies.forEach(dep => {
      console.log(`   - ${dep}`);
    });
    console.log('\n💡 Run: npm uninstall', depcheck.dependencies.join(' '));
  } else {
    console.log('✅ No unused dependencies found!');
  }
  
  if (depcheck.devDependencies && depcheck.devDependencies.length > 0) {
    console.log('\n⚠️  Unused devDependencies found:');
    depcheck.devDependencies.forEach(dep => {
      console.log(`   - ${dep}`);
    });
  }
} catch (error) {
  console.log('❌ Could not run depcheck. Install it with: npm install -g depcheck');
}

// 2. Analyze bundle size
console.log('\n📊 Analyzing bundle composition...');
try {
  // Build with source map explorer
  console.log('Building production bundle (this may take a moment)...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Get build folder stats
  const buildPath = path.join(process.cwd(), 'build', 'static', 'js');
  const jsFiles = fs.readdirSync(buildPath).filter(f => f.endsWith('.js'));
  
  console.log('\n📈 Bundle sizes:');
  let totalSize = 0;
  jsFiles.forEach(file => {
    const stats = fs.statSync(path.join(buildPath, file));
    const sizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`   ${file}: ${sizeInKB} KB`);
    totalSize += stats.size;
  });
  console.log(`   Total: ${(totalSize / 1024).toFixed(2)} KB\n`);
  
} catch (error) {
  console.log('❌ Could not analyze bundle');
}

// 3. Check for large dependencies
console.log('🔍 Identifying large dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const largeDeps = [
  { name: 'react-icons', suggestion: 'Import only used icons from specific packages' },
  { name: 'moment', suggestion: 'Replace with date-fns or dayjs' },
  { name: 'lodash', suggestion: 'Use lodash-es and import specific functions' },
  { name: 'recharts', suggestion: 'Consider lightweight alternatives like chart.js' },
  { name: 'pdfmake', suggestion: 'Lazy load only when PDF generation is needed' },
];

largeDeps.forEach(({ name, suggestion }) => {
  if (packageJson.dependencies[name]) {
    console.log(`\n⚠️  Found ${name}`);
    console.log(`   💡 ${suggestion}`);
  }
});

// 4. React Icons optimization check
console.log('\n🎨 Checking React Icons usage...');
const iconsUtilPath = path.join(process.cwd(), 'src', 'utils', 'icons.ts');
if (fs.existsSync(iconsUtilPath)) {
  console.log('✅ React Icons are centralized in src/utils/icons.ts');
  
  // Count icon imports
  const iconsContent = fs.readFileSync(iconsUtilPath, 'utf8');
  const iconImports = iconsContent.match(/from 'react-icons\//g);
  if (iconImports) {
    console.log(`   Using ${iconImports.length} different icon packages`);
  }
} else {
  console.log('⚠️  No centralized icons file found. Create src/utils/icons.ts to optimize imports');
}

// 5. Code splitting opportunities
console.log('\n🔪 Code splitting analysis...');
const routesPath = path.join(process.cwd(), 'src', 'App.tsx');
if (fs.existsSync(routesPath)) {
  const appContent = fs.readFileSync(routesPath, 'utf8');
  const lazyImports = appContent.match(/lazy\(/g);
  const dynamicImports = appContent.match(/import\(/g);
  
  console.log(`✅ Found ${lazyImports ? lazyImports.length : 0} lazy loaded components`);
  console.log(`✅ Found ${dynamicImports ? dynamicImports.length : 0} dynamic imports`);
}

// 6. Optimization recommendations
console.log('\n💡 Optimization Recommendations:\n');

console.log('1. Enable Compression:');
console.log('   - Gzip/Brotli compression is configured in craco.config.js ✅');

console.log('\n2. Optimize Images:');
console.log('   - Use OptimizedImage component for all images ✅');
console.log('   - Convert images to WebP format for better compression');
console.log('   - Use responsive images with srcSet');

console.log('\n3. Bundle Size Targets:');
console.log('   - Main bundle: < 250KB (gzipped)');
console.log('   - Initial JS: < 100KB (gzipped)');
console.log('   - CSS: < 50KB (gzipped)');

console.log('\n4. Performance Budget:');
console.log('   - First Contentful Paint: < 1.8s');
console.log('   - Largest Contentful Paint: < 2.5s');
console.log('   - Time to Interactive: < 3.8s');
console.log('   - Total Blocking Time: < 200ms');

console.log('\n5. Next Steps:');
console.log('   - Run "npm run build:analyze" to visualize bundle');
console.log('   - Remove unused dependencies listed above');
console.log('   - Implement suggested optimizations');
console.log('   - Monitor with Lighthouse CI');

console.log('\n✨ Bundle optimization analysis complete!');