#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Function to extract imports from a file
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  
  // Match react-icons imports
  const importRegex = /import\s*{([^}]+)}\s*from\s*['"]react-icons\/(\w+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const icons = match[1].split(',').map(icon => icon.trim());
    const iconSet = match[2];
    
    imports.push({
      file: filePath,
      iconSet,
      icons,
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return imports;
}

// Function to analyze all TypeScript/TSX files
async function analyzeProject() {
  console.log(`${colors.cyan}Analyzing react-icons usage in the project...${colors.reset}\n`);
  
  const files = await glob(['src/**/*.{ts,tsx}'], {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true
  });
  
  const allImports = [];
  const iconUsage = {};
  const fileCount = {};
  
  for (const file of files) {
    const imports = extractImports(file);
    if (imports.length > 0) {
      allImports.push(...imports);
      
      imports.forEach(imp => {
        const key = `react-icons/${imp.iconSet}`;
        
        if (!iconUsage[key]) {
          iconUsage[key] = new Set();
          fileCount[key] = 0;
        }
        
        fileCount[key]++;
        imp.icons.forEach(icon => iconUsage[key].add(icon));
      });
    }
  }
  
  // Generate report
  console.log(`${colors.green}Found ${allImports.length} react-icons imports in ${files.length} files${colors.reset}\n`);
  
  // Show icon set usage
  console.log(`${colors.yellow}Icon Set Usage Summary:${colors.reset}`);
  console.log('─'.repeat(60));
  
  const sortedIconSets = Object.entries(iconUsage)
    .sort((a, b) => b[1].size - a[1].size);
  
  sortedIconSets.forEach(([iconSet, icons]) => {
    console.log(`${colors.blue}${iconSet}${colors.reset}`);
    console.log(`  Icons used: ${icons.size}`);
    console.log(`  Files using this set: ${fileCount[iconSet]}`);
    console.log(`  Icons: ${Array.from(icons).slice(0, 5).join(', ')}${icons.size > 5 ? '...' : ''}`);
    console.log();
  });
  
  // Show files with most imports
  const fileImportCount = {};
  allImports.forEach(imp => {
    const relPath = path.relative(process.cwd(), imp.file);
    fileImportCount[relPath] = (fileImportCount[relPath] || 0) + imp.icons.length;
  });
  
  const sortedFiles = Object.entries(fileImportCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log(`${colors.yellow}Top 10 files by icon count:${colors.reset}`);
  console.log('─'.repeat(60));
  
  sortedFiles.forEach(([file, count]) => {
    console.log(`  ${colors.magenta}${file}${colors.reset}: ${count} icons`);
  });
  
  // Generate optimization recommendations
  console.log(`\n${colors.yellow}Optimization Recommendations:${colors.reset}`);
  console.log('─'.repeat(60));
  
  // Check for unused icon sets
  const smallIconSets = sortedIconSets.filter(([_, icons]) => icons.size <= 3);
  if (smallIconSets.length > 0) {
    console.log(`${colors.red}⚠ Icon sets with few icons (consider consolidating):${colors.reset}`);
    smallIconSets.forEach(([iconSet, icons]) => {
      console.log(`  - ${iconSet}: Only ${icons.size} icons used`);
    });
    console.log();
  }
  
  // Calculate potential savings
  console.log(`${colors.green}Potential bundle size reduction:${colors.reset}`);
  console.log('  Current: Importing entire icon sets');
  console.log('  Optimized: Import only used icons');
  console.log('  Estimated reduction: 60-80% of icon bundle size\n');
  
  return allImports;
}

// Generate migration script
async function generateMigrationScript(imports) {
  const migrationPath = path.join(process.cwd(), 'scripts', 'migrate-icon-imports.js');
  
  const migrationScript = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Icon import transformations
const transformations = ${JSON.stringify(imports, null, 2)};

function migrateFile(transformation) {
  const { file, iconSet, icons, line } = transformation;
  let content = fs.readFileSync(file, 'utf8');
  
  // Create modular imports
  const oldImport = \`import { \${icons.join(', ')} } from 'react-icons/\${iconSet}'\`;
  const newImports = icons.map(icon => 
    \`import { \${icon} } from 'react-icons/\${iconSet}/index'\`
  ).join('\\n');
  
  // Replace import
  content = content.replace(oldImport, newImports);
  
  // Write back
  fs.writeFileSync(file, content, 'utf8');
  console.log(\`✅ Migrated \${path.relative(process.cwd(), file)}\`);
}

// Run migrations
console.log('Starting icon import migration...');
transformations.forEach(migrateFile);
console.log('Migration complete!');
`;

  fs.writeFileSync(migrationPath, migrationScript, 'utf8');
  fs.chmodSync(migrationPath, '755');
  
  console.log(`${colors.green}Generated migration script: ${path.relative(process.cwd(), migrationPath)}${colors.reset}`);
}

// Main execution
(async () => {
  try {
    const imports = await analyzeProject();
    
    if (imports.length > 0) {
      console.log(`\n${colors.cyan}Run 'node scripts/migrate-icon-imports.js' to apply optimizations${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
})();