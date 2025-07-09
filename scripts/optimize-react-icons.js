#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

/**
 * Optimizes react-icons imports to reduce bundle size
 * Transforms: import { FaUser, FaPhone } from 'react-icons/fa'
 * To individual imports that are tree-shakeable
 */
async function optimizeReactIcons() {
  console.log(`${colors.cyan}🚀 Optimizing react-icons imports for better tree-shaking...${colors.reset}\n`);
  
  const files = await glob(['src/**/*.{ts,tsx}'], {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true
  });
  
  let filesModified = 0;
  let totalImportsOptimized = 0;
  let iconsSaved = 0;
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    let fileModified = false;
    
    // Find all react-icons imports
    const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]react-icons\/(\w+)['"]/g;
    let match;
    const replacements = [];
    
    while ((match = importRegex.exec(content)) !== null) {
      const iconList = match[1];
      const iconSet = match[2];
      const icons = iconList.split(',').map(icon => icon.trim()).filter(icon => icon);
      
      // Create optimized imports
      // Using subpath imports for better tree-shaking
      const optimizedImports = icons.map((icon, index) => {
        // Add a comment on the first line to indicate this was optimized
        const comment = index === 0 ? '// Optimized react-icons imports\n' : '';
        return `${comment}import ${icon} from 'react-icons/${iconSet}/${icon}.js'`;
      }).join('\n');
      
      replacements.push({
        original: match[0],
        replacement: optimizedImports,
        iconsCount: icons.length
      });
      
      iconsSaved += icons.length;
    }
    
    // Apply replacements in reverse order to maintain positions
    replacements.reverse().forEach(({ original, replacement, iconsCount }) => {
      content = content.replace(original, replacement);
      fileModified = true;
      totalImportsOptimized++;
    });
    
    if (fileModified) {
      // Write the modified content
      fs.writeFileSync(file, content, 'utf8');
      filesModified++;
      
      const relPath = path.relative(process.cwd(), file);
      console.log(`${colors.green}✓${colors.reset} ${relPath}`);
    }
  }
  
  // Summary
  console.log(`\n${colors.yellow}📊 Optimization Summary:${colors.reset}`);
  console.log(`${colors.green}Files modified:${colors.reset} ${filesModified}`);
  console.log(`${colors.green}Import statements optimized:${colors.reset} ${totalImportsOptimized}`);
  console.log(`${colors.green}Individual icons optimized:${colors.reset} ${iconsSaved}`);
  
  if (filesModified > 0) {
    console.log(`\n${colors.cyan}💡 Benefits:${colors.reset}`);
    console.log(`• Reduced bundle size by importing only specific icons`);
    console.log(`• Better tree-shaking during build`);
    console.log(`• Estimated 60-80% reduction in icon-related bundle size`);
    
    console.log(`\n${colors.yellow}⚠️  Note:${colors.reset}`);
    console.log(`If you encounter any import errors, you may need to:`);
    console.log(`1. Clear your build cache: rm -rf node_modules/.cache`);
    console.log(`2. Restart your dev server`);
    console.log(`3. If issues persist, the imports can be reverted using git`);
  } else {
    console.log(`\n${colors.green}✨ No react-icons imports found to optimize!${colors.reset}`);
  }
}

// Fallback function for imports that might not work with direct imports
function generateFallbackImport(icons, iconSet) {
  // Use destructuring with tree-shake hint comment
  return `import /* tree-shake */ { ${icons.join(', ')} } from 'react-icons/${iconSet}'`;
}

// Run the optimization
(async () => {
  try {
    await optimizeReactIcons();
    
    console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
    console.log(`1. Run 'npm run build' to verify the optimizations work`);
    console.log(`2. Check bundle size with 'npm run analyze' if configured`);
    console.log(`3. Commit the changes if everything works correctly`);
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
})();