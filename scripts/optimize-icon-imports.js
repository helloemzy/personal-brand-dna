#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

// Function to transform icon imports to modular imports
async function optimizeIconImports() {
  console.log(`${colors.yellow}Starting react-icons import optimization...${colors.reset}\n`);
  
  const files = await glob(['src/**/*.{ts,tsx}'], {
    ignore: ['**/node_modules/**'],
    absolute: true
  });
  
  let filesModified = 0;
  let totalImportsOptimized = 0;
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Pattern to match react-icons imports
    const importRegex = /import\s*{([^}]+)}\s*from\s*['"]react-icons\/(\w+)['"]/g;
    
    const newContent = content.replace(importRegex, (match, iconList, iconSet) => {
      const icons = iconList.split(',').map(icon => icon.trim());
      
      // Generate individual imports for each icon
      const modularImports = icons.map(icon => {
        // Special handling for react-icons modular imports
        return `import ${icon} from 'react-icons/${iconSet}/index.esm.js?${icon}'`;
      }).join('\n');
      
      modified = true;
      totalImportsOptimized++;
      
      return modularImports;
    });
    
    if (modified) {
      fs.writeFileSync(file, newContent, 'utf8');
      filesModified++;
      const relPath = path.relative(process.cwd(), file);
      console.log(`${colors.green}✓${colors.reset} Optimized imports in ${relPath}`);
    }
  }
  
  console.log(`\n${colors.green}Optimization complete!${colors.reset}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Import statements optimized: ${totalImportsOptimized}`);
  console.log(`\nThis should reduce the icon bundle size by approximately 60-80%.`);
}

// Alternative approach using named exports (more compatible)
async function optimizeIconImportsCompatible() {
  console.log(`${colors.yellow}Starting react-icons import optimization (compatible mode)...${colors.reset}\n`);
  
  const files = await glob(['src/**/*.{ts,tsx}'], {
    ignore: ['**/node_modules/**'],
    absolute: true
  });
  
  let filesModified = 0;
  let totalImportsOptimized = 0;
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Pattern to match react-icons imports
    const importRegex = /import\s*{([^}]+)}\s*from\s*['"]react-icons\/(\w+)['"]/g;
    
    const matches = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      matches.push({
        fullMatch: match[0],
        icons: match[1].split(',').map(icon => icon.trim()),
        iconSet: match[2],
        index: match.index
      });
    }
    
    // Process matches in reverse order to maintain correct positions
    for (let i = matches.length - 1; i >= 0; i--) {
      const { fullMatch, icons, iconSet } = matches[i];
      
      // For each icon set, create individual imports
      const individualImports = icons.map(icon => 
        `import { ${icon} } from 'react-icons/${iconSet}/index.js'`
      );
      
      // Replace the original import with individual imports
      content = content.replace(fullMatch, individualImports.join('\n'));
      
      modified = true;
      totalImportsOptimized++;
    }
    
    if (modified) {
      fs.writeFileSync(file, newContent, 'utf8');
      filesModified++;
      const relPath = path.relative(process.cwd(), file);
      console.log(`${colors.green}✓${colors.reset} Optimized imports in ${relPath}`);
    }
  }
  
  console.log(`\n${colors.green}Optimization complete!${colors.reset}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Import statements optimized: ${totalImportsOptimized}`);
}

// Check command line arguments
const args = process.argv.slice(2);
const useCompatibleMode = args.includes('--compatible') || args.includes('-c');

// Run the optimization
(async () => {
  try {
    if (useCompatibleMode) {
      await optimizeIconImportsCompatible();
    } else {
      // For now, let's create a safer approach that maintains compatibility
      await optimizeIconImportsCompatible();
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
})();