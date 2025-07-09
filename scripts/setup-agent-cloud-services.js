#!/usr/bin/env node

/**
 * Setup script for AI Agents cloud services
 * This script helps configure CloudAMQP and Redis Cloud for production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 BrandPillar AI Agents - Cloud Services Setup\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
}

console.log('📋 Required Cloud Services:\n');

console.log('1. CloudAMQP (Message Queue)');
console.log('   - Go to: https://www.cloudamqp.com');
console.log('   - Sign up for free account');
console.log('   - Create new instance (Little Lemur - Free)');
console.log('   - Copy the AMQP URL from instance details\n');

console.log('2. Redis Cloud (State Management)');
console.log('   - Go to: https://redis.com/try-free/');
console.log('   - Sign up for free account');
console.log('   - Create new database (30MB free tier)');
console.log('   - Copy the Redis URL with password\n');

console.log('3. Railway.app (Deployment Platform)');
console.log('   - Go to: https://railway.app');
console.log('   - Sign up with GitHub');
console.log('   - Install Railway CLI: npm install -g @railway/cli');
console.log('   - Run: railway login\n');

console.log('📝 Environment Variables Needed:\n');

const requiredVars = [
  { name: 'CLOUDAMQP_URL', example: 'amqp://user:pass@host.cloudamqp.com/vhost' },
  { name: 'REDIS_URL', example: 'redis://default:password@host.redis.com:6379' },
  { name: 'SUPABASE_URL', example: 'https://xxxxx.supabase.co' },
  { name: 'SUPABASE_SERVICE_KEY', example: 'eyJ...' },
  { name: 'OPENAI_API_KEY', example: 'sk-...' }
];

// Read current .env
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const envVars = {};

envLines.forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// Check which vars are missing
const missingVars = [];
requiredVars.forEach(({ name, example }) => {
  if (!envVars[name] || envVars[name] === '' || envVars[name].includes('your_')) {
    missingVars.push({ name, example });
    console.log(`❌ ${name} - Missing`);
    console.log(`   Example: ${example}\n`);
  } else {
    console.log(`✅ ${name} - Configured\n`);
  }
});

if (missingVars.length > 0) {
  console.log('\n⚠️  Missing Variables Detected!\n');
  console.log('Please add the missing variables to your .env file.\n');
  
  // Create a template for missing vars
  const templatePath = path.join(__dirname, '..', 'agent-env-template.txt');
  const template = missingVars.map(({ name, example }) => 
    `${name}=${example}`
  ).join('\n');
  
  fs.writeFileSync(templatePath, template);
  console.log(`📄 Template saved to: agent-env-template.txt`);
  console.log('   Copy the values from this file to your .env after setting them up.\n');
} else {
  console.log('\n✅ All required environment variables are configured!\n');
  console.log('Next steps:');
  console.log('1. Run: npm run build:agents');
  console.log('2. Run: railway init (if not already done)');
  console.log('3. Run: npm run deploy:agents\n');
}

console.log('📚 Documentation:');
console.log('   - Deployment Guide: AI_AGENTS_DEPLOYMENT_GUIDE.md');
console.log('   - Architecture: AI_AGENTS_ARCHITECTURE_DESIGN.md\n');

// Create deployment helper script
const deployScript = `#!/bin/bash
# AI Agents Deployment Script

echo "🚀 Deploying AI Agents to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway:"
    railway login
fi

# Set environment variables
echo "📝 Setting environment variables..."
railway variables set CLOUDAMQP_URL="$CLOUDAMQP_URL"
railway variables set REDIS_URL="$REDIS_URL"
railway variables set SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
railway variables set NODE_ENV="production"
railway variables set LOG_LEVEL="info"

# Deploy
echo "🚂 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "📊 View logs: railway logs -f"
echo "🌐 View app: railway open"
`;

const deployScriptPath = path.join(__dirname, 'deploy-agents.sh');
fs.writeFileSync(deployScriptPath, deployScript);
fs.chmodSync(deployScriptPath, '755');

console.log('🚀 Deployment script created: scripts/deploy-agents.sh');
console.log('   Run it after configuring all environment variables.\n');