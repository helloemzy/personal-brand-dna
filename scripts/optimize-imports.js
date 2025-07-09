#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to process lucide-react imports (skip - already optimized)
function optimizeLucideImports(content) {
  // Lucide-react already supports tree-shaking well, no changes needed
  return content;
}

// Function to process react-icons imports
function optimizeReactIconsImports(content) {
  // Match import statements like: import { FaIcon1, FaIcon2 } from 'react-icons/fa';
  const reactIconsRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]react-icons\/(\w+)['"];?/g;
  
  return content.replace(reactIconsRegex, (match, icons, library) => {
    // Parse the icons
    const iconList = icons.split(',').map(icon => icon.trim()).filter(Boolean);
    
    // Generate individual imports
    const imports = iconList.map(icon => 
      `import ${icon} from 'react-icons/${library}/${icon}';`
    ).join('\n');
    
    return imports;
  });
}

// Function to optimize date-fns imports
function optimizeDateFnsImports(content) {
  // Match import statements like: import { format, parseISO } from 'date-fns';
  const dateFnsRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]date-fns['"];?/g;
  
  return content.replace(dateFnsRegex, (match, functions) => {
    // Parse the functions
    const functionList = functions.split(',').map(fn => fn.trim()).filter(Boolean);
    
    // Generate individual imports
    const imports = functionList.map(fn => 
      `import ${fn} from 'date-fns/${fn}';`
    ).join('\n');
    
    return imports;
  });
}

// Function to process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Apply optimizations
    content = optimizeLucideImports(content);
    content = optimizeReactIconsImports(content);
    content = optimizeDateFnsImports(content);
    
    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Optimized imports in: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('🔍 Searching for files to optimize...\n');
  
  // Find all TypeScript and JavaScript files in src directory
  const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
    absolute: true,
    ignore: ['**/node_modules/**', '**/build/**', '**/dist/**']
  });
  
  console.log(`Found ${files.length} files to process\n`);
  
  let optimizedCount = 0;
  
  files.forEach(file => {
    if (processFile(file)) {
      optimizedCount++;
    }
  });
  
  console.log(`\n✨ Optimization complete!`);
  console.log(`📊 Optimized ${optimizedCount} out of ${files.length} files`);
  
  if (optimizedCount > 0) {
    console.log('\n💡 Tip: Run "npm run build:analyze" to see the bundle size impact');
  }
}

// Check if glob is installed
try {
  require('glob');
} catch (e) {
  console.error('❌ Error: glob package not found. Installing...');
  const { execSync } = require('child_process');
  execSync('npm install --save-dev glob', { stdio: 'inherit' });
  console.log('✅ glob installed. Please run the script again.');
  process.exit(0);
}

// Run the script
main();