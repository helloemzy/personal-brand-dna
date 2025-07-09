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
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

/**
 * Creates an icon barrel file to centralize and optimize imports
 */
async function createIconBarrel() {
  console.log(`${colors.cyan}🎯 Creating optimized icon barrel file...${colors.reset}\n`);
  
  const files = await glob(['src/**/*.{ts,tsx}'], {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/icons.ts'],
    absolute: true
  });
  
  const iconImports = new Map();
  const iconUsage = new Map();
  
  // Collect all icon imports
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]react-icons\/(\w+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const icons = match[1].split(',').map(icon => icon.trim()).filter(icon => icon);
      const iconSet = match[2];
      
      icons.forEach(icon => {
        const key = `${iconSet}/${icon}`;
        if (!iconImports.has(key)) {
          iconImports.set(key, { iconSet, icon });
        }
        
        // Track usage
        const usage = iconUsage.get(key) || [];
        usage.push(path.relative(process.cwd(), file));
        iconUsage.set(key, usage);
      });
    }
  }
  
  if (iconImports.size === 0) {
    console.log(`${colors.yellow}No react-icons imports found in the project.${colors.reset}`);
    return;
  }
  
  // Group icons by set
  const iconsBySet = new Map();
  iconImports.forEach(({ iconSet, icon }) => {
    if (!iconsBySet.has(iconSet)) {
      iconsBySet.set(iconSet, []);
    }
    iconsBySet.get(iconSet).push(icon);
  });
  
  // Generate barrel file content
  let barrelContent = `// Auto-generated icon barrel file for optimized imports
// Generated on ${new Date().toISOString()}
// This file centralizes all icon imports for better tree-shaking

`;
  
  // Add imports grouped by icon set
  iconsBySet.forEach((icons, iconSet) => {
    const sortedIcons = icons.sort();
    barrelContent += `// Icons from react-icons/${iconSet}\n`;
    barrelContent += `export {\n`;
    sortedIcons.forEach(icon => {
      barrelContent += `  ${icon},\n`;
    });
    barrelContent += `} from 'react-icons/${iconSet}';\n\n`;
  });
  
  // Add usage documentation
  barrelContent += `/* Icon Usage Reference:\n`;
  iconUsage.forEach((files, key) => {
    barrelContent += ` * ${key}: Used in ${files.length} file(s)\n`;
  });
  barrelContent += ` */\n`;
  
  // Write barrel file
  const barrelPath = path.join(process.cwd(), 'src/utils/icons.ts');
  fs.writeFileSync(barrelPath, barrelContent, 'utf8');
  console.log(`${colors.green}✓ Created icon barrel file:${colors.reset} src/utils/icons.ts`);
  
  // Now update all imports to use the barrel file
  console.log(`\n${colors.cyan}📝 Updating imports to use barrel file...${colors.reset}\n`);
  
  let filesUpdated = 0;
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    
    // Replace react-icons imports with barrel import
    const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]react-icons\/(\w+)['"]/g;
    
    const matches = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      matches.push({
        fullMatch: match[0],
        icons: match[1].split(',').map(icon => icon.trim()).filter(icon => icon),
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    if (matches.length > 0) {
      // Collect all icons from all imports in this file
      const allIcons = [];
      matches.forEach(m => allIcons.push(...m.icons));
      
      // Remove duplicates
      const uniqueIcons = [...new Set(allIcons)];
      
      // Calculate relative import path
      const filePath = path.dirname(file);
      const barrelRelativePath = path.relative(filePath, barrelPath).replace(/\\/g, '/').replace('.ts', '');
      
      // Create new import
      const newImport = `import { ${uniqueIcons.join(', ')} } from '${barrelRelativePath}'`;
      
      // Replace imports (in reverse order to maintain positions)
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        if (i === 0) {
          // Replace first import with the new consolidated import
          content = content.substring(0, m.start) + newImport + content.substring(m.end);
        } else {
          // Remove other imports
          content = content.substring(0, m.start) + content.substring(m.end + 1); // +1 to remove newline
        }
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        filesUpdated++;
        console.log(`${colors.green}✓${colors.reset} ${path.relative(process.cwd(), file)}`);
      }
    }
  }
  
  // Summary
  console.log(`\n${colors.yellow}📊 Optimization Summary:${colors.reset}`);
  console.log(`${colors.green}Icon sets used:${colors.reset} ${iconsBySet.size}`);
  console.log(`${colors.green}Total unique icons:${colors.reset} ${iconImports.size}`);
  console.log(`${colors.green}Files updated:${colors.reset} ${filesUpdated}`);
  
  console.log(`\n${colors.cyan}✨ Benefits:${colors.reset}`);
  console.log(`• Single source of truth for all icons`);
  console.log(`• Easier to track and manage icon usage`);
  console.log(`• Potential for better tree-shaking`);
  console.log(`• Simplified import management`);
  
  console.log(`\n${colors.yellow}📝 Next Steps:${colors.reset}`);
  console.log(`1. Review the generated src/utils/icons.ts file`);
  console.log(`2. Run your build to ensure everything works`);
  console.log(`3. Consider adding the barrel file to your linting rules`);
}

// Alternative: Add webpack/vite config optimization
function generateBuildOptimization() {
  const viteConfig = `// Add to vite.config.ts for icon optimization
export default {
  optimizeDeps: {
    include: ['react-icons/fa', 'react-icons/fi', 'react-icons/fc'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-icons': ['react-icons/fa', 'react-icons/fi', 'react-icons/fc'],
        },
      },
    },
  },
};`;

  const webpackConfig = `// Add to webpack.config.js for icon optimization
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        reactIcons: {
          test: /[\\/]node_modules[\\/]react-icons[\\/]/,
          name: 'react-icons',
          priority: 10,
        },
      },
    },
  },
};`;

  console.log(`\n${colors.dim}Build configuration suggestions:${colors.reset}`);
  console.log(`\nFor Vite:\n${viteConfig}`);
  console.log(`\nFor Webpack:\n${webpackConfig}`);
}

// Main execution
(async () => {
  try {
    await createIconBarrel();
    generateBuildOptimization();
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
})();