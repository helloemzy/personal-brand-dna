#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to process
const patterns = [
  'src/**/*.ts',
  'src/**/*.tsx'
];

// Files to exclude
const excludePatterns = [
  'src/utils/logger.ts',
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'node_modules/**',
  'build/**',
  'dist/**'
];

// Function to add logger import if not present
function addLoggerImport(content, filePath) {
  const hasLoggerImport = content.includes("from '../utils/logger'") || 
                         content.includes('from "../../utils/logger"') ||
                         content.includes("from './utils/logger'") ||
                         content.includes("from '../../../utils/logger'");
  
  if (hasLoggerImport) {
    return content;
  }
  
  // Calculate relative path to logger
  const fileDir = path.dirname(filePath);
  const loggerPath = path.relative(fileDir, 'src/utils/logger');
  const importPath = loggerPath.startsWith('.') ? loggerPath : `./${loggerPath}`;
  
  // Add import after the last import statement
  const importRegex = /^import .* from .*;?\s*$/gm;
  const imports = content.match(importRegex);
  
  if (imports && imports.length > 0) {
    const lastImportIndex = content.lastIndexOf(imports[imports.length - 1]);
    const insertPosition = lastImportIndex + imports[imports.length - 1].length;
    
    return content.slice(0, insertPosition) + 
           `\nimport { logger } from '${importPath.replace(/\\/g, '/')}';` + 
           content.slice(insertPosition);
  } else {
    // No imports found, add at the beginning
    return `import { logger } from '${importPath.replace(/\\/g, '/')}';\n\n` + content;
  }
}

// Function to replace console statements
function replaceConsoleStatements(content) {
  // Replace console.log with logger.debug
  content = content.replace(/console\.log\(/g, 'logger.debug(');
  
  // Replace console.info with logger.info
  content = content.replace(/console\.info\(/g, 'logger.info(');
  
  // Replace console.warn with logger.warn
  content = content.replace(/console\.warn\(/g, 'logger.warn(');
  
  // Replace console.error with logger.error
  content = content.replace(/console\.error\(/g, 'logger.error(');
  
  // Replace console.debug with logger.debug
  content = content.replace(/console\.debug\(/g, 'logger.debug(');
  
  // Handle console.group, console.groupEnd, console.table
  content = content.replace(/console\.group\(/g, '// logger.debug(');
  content = content.replace(/console\.groupEnd\(\)/g, '// logger.debug("Group end")');
  content = content.replace(/console\.table\(/g, 'logger.debug(');
  
  return content;
}

// Main processing function
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Check if file has console statements
    if (!content.match(/console\./)) {
      return { filePath, changed: false };
    }
    
    // Skip if it's the logger file itself
    if (filePath.includes('logger.ts')) {
      return { filePath, changed: false };
    }
    
    // Add logger import if needed
    content = addLoggerImport(content, filePath);
    
    // Replace console statements
    content = replaceConsoleStatements(content);
    
    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return { filePath, changed: true };
    }
    
    return { filePath, changed: false };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { filePath, changed: false, error: error.message };
  }
}

// Get all files matching patterns
const files = patterns.flatMap(pattern => 
  glob.sync(pattern, { ignore: excludePatterns })
);

console.log(`Found ${files.length} files to process`);

// Process all files
const results = files.map(processFile);

// Report results
const changedFiles = results.filter(r => r.changed);
const errorFiles = results.filter(r => r.error);

console.log(`\nProcessed ${files.length} files:`);
console.log(`- Changed: ${changedFiles.length}`);
console.log(`- Errors: ${errorFiles.length}`);

if (changedFiles.length > 0) {
  console.log('\nChanged files:');
  changedFiles.forEach(r => console.log(`  - ${r.filePath}`));
}

if (errorFiles.length > 0) {
  console.log('\nErrors:');
  errorFiles.forEach(r => console.log(`  - ${r.filePath}: ${r.error}`));
}

console.log('\nDone!');