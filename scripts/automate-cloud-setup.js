#!/usr/bin/env node

/**
 * Automated Cloud Services Setup Script
 * Minimizes manual configuration using service APIs where possible
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 BrandPillar AI Agents - Automated Cloud Setup\n');

// Helper function for API requests
function apiRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`API Error: ${res.statusCode} - ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Railway CLI automation
async function setupRailway() {
  console.log('🚂 Setting up Railway...\n');
  
  try {
    // Check if Railway CLI is installed
    execSync('railway --version', { stdio: 'ignore' });
    console.log('✅ Railway CLI installed');
  } catch {
    console.log('📦 Installing Railway CLI...');
    execSync('npm install -g @railway/cli', { stdio: 'inherit' });
  }
  
  // Check if logged in
  try {
    execSync('railway whoami', { stdio: 'ignore' });
    console.log('✅ Logged into Railway');
  } catch {
    console.log('🔐 Please login to Railway:');
    execSync('railway login', { stdio: 'inherit' });
  }
  
  // Initialize project if needed
  try {
    execSync('railway status', { stdio: 'ignore' });
    console.log('✅ Railway project exists');
  } catch {
    console.log('📁 Creating Railway project...');
    execSync('railway init --name brandpillar-agents', { stdio: 'inherit' });
  }
  
  return true;
}

// Generate connection URLs for local development
function generateLocalUrls() {
  return {
    CLOUDAMQP_URL: 'amqp://brandpillar:secret@localhost:5672',
    REDIS_URL: 'redis://:secret@localhost:6380'
  };
}

// Create docker-based development environment
async function setupLocalEnvironment() {
  console.log('🐳 Setting up local development environment...\n');
  
  const localEnvPath = path.join(__dirname, '..', 'docker-compose.local.yml');
  
  // Check if already exists to avoid overwriting custom ports
  if (fs.existsSync(localEnvPath)) {
    console.log('📝 Using existing docker-compose.local.yml');
  } else {
    const dockerComposeContent = `version: '3.8'

services:
  # CloudAMQP Alternative - Local RabbitMQ
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: brandpillar-rabbitmq-local
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: brandpillar
      RABBITMQ_DEFAULT_PASS: secret
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cloud Alternative - Local Redis
  redis:
    image: redis:7-alpine
    container_name: brandpillar-redis-local
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass secret
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  rabbitmq_data:
  redis_data:
`;

    fs.writeFileSync(localEnvPath, dockerComposeContent);
    console.log('📝 Created docker-compose.local.yml');
  }
  console.log('🚀 Starting local services...');
  
  try {
    execSync('docker-compose -f docker-compose.local.yml up -d', { 
      cwd: path.dirname(localEnvPath),
      stdio: 'inherit' 
    });
    
    console.log('\n✅ Local services started successfully!');
    console.log('   - RabbitMQ: http://localhost:15672 (brandpillar/secret)');
    console.log('   - Redis: redis://localhost:6380 (password: secret)\n');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error.message);
    console.log('\nMake sure Docker is installed and running.');
    return false;
  }
}

// Create environment configuration
async function createEnvConfig(useLocal = false) {
  console.log('\n📋 Creating environment configuration...\n');
  
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  // Read existing env
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }
  
  if (useLocal) {
    // Use local URLs
    const localUrls = generateLocalUrls();
    
    // Update or add URLs
    for (const [key, value] of Object.entries(localUrls)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
    
    console.log('✅ Configured for local development');
  } else {
    console.log('📝 For production deployment, you need to:');
    console.log('   1. Sign up at https://www.cloudamqp.com (free tier)');
    console.log('   2. Sign up at https://redis.com/try-free/ (30MB free)');
    console.log('   3. Add the connection URLs to .env\n');
    
    // Create template
    const template = `
# Cloud Service URLs (Production)
CLOUDAMQP_URL=amqp://user:pass@host.cloudamqp.com/vhost
REDIS_URL=redis://default:password@host.redis.com:6379

# Existing Supabase Config (keep these)
SUPABASE_URL=${process.env.SUPABASE_URL || 'your_supabase_url'}
SUPABASE_SERVICE_KEY=${process.env.SUPABASE_SERVICE_KEY || 'your_service_key'}

# OpenAI (keep this)
OPENAI_API_KEY=${process.env.OPENAI_API_KEY || 'your_openai_key'}
`;
    
    fs.writeFileSync(path.join(__dirname, '..', 'cloud-urls-template.txt'), template);
    console.log('📄 Template saved to: cloud-urls-template.txt');
  }
  
  // Save .env
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env file\n');
}

// Main setup flow
async function main() {
  console.log('Choose your setup option:\n');
  console.log('1. Local Development (Docker-based, no accounts needed)');
  console.log('2. Production Deployment (requires cloud accounts)\n');
  
  const args = process.argv.slice(2);
  const choice = args[0] || '1';
  
  if (choice === '1' || choice === 'local') {
    console.log('\n🏠 Setting up LOCAL development environment...\n');
    
    const localSuccess = await setupLocalEnvironment();
    if (localSuccess) {
      await createEnvConfig(true);
      
      console.log('🎉 Local setup complete!\n');
      console.log('Next steps:');
      console.log('1. npm run build:agents');
      console.log('2. npm run agents:dev');
      console.log('3. Visit http://localhost:3003/health\n');
      
      // Create a local start script
      const startScript = `#!/bin/bash
echo "🚀 Starting BrandPillar AI Agents (Local Mode)..."
docker-compose -f docker-compose.local.yml up -d
echo "⏳ Waiting for services to be ready..."
sleep 5
npm run build:agents && npm run agents:dev
`;
      
      const startScriptPath = path.join(__dirname, 'start-local-agents.sh');
      fs.writeFileSync(startScriptPath, startScript);
      fs.chmodSync(startScriptPath, '755');
      
      console.log('💡 Quick start: npm run start:local-agents');
    }
    
  } else if (choice === '2' || choice === 'production') {
    console.log('\n☁️  Setting up PRODUCTION deployment...\n');
    
    await setupRailway();
    await createEnvConfig(false);
    
    console.log('\n📋 Production Setup Checklist:\n');
    console.log('[ ] 1. Create CloudAMQP account at https://www.cloudamqp.com');
    console.log('[ ] 2. Create Redis Cloud account at https://redis.com/try-free/');
    console.log('[ ] 3. Add connection URLs to .env');
    console.log('[ ] 4. Run: npm run deploy:agents\n');
    
    // Create production deployment script
    const deployScript = `#!/bin/bash
source .env
echo "🚀 Deploying to Railway..."

# Set Railway environment variables
railway variables set CLOUDAMQP_URL="$CLOUDAMQP_URL"
railway variables set REDIS_URL="$REDIS_URL"
railway variables set SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
railway variables set NODE_ENV="production"

# Deploy
railway up

echo "✅ Deployment initiated!"
echo "📊 Monitor: railway logs -f"
`;
    
    const deployPath = path.join(__dirname, 'deploy-production.sh');
    fs.writeFileSync(deployPath, deployScript);
    fs.chmodSync(deployPath, '755');
    
    console.log('🚀 Production deploy script: scripts/deploy-production.sh');
  }
  
  console.log('\n📚 Documentation:');
  console.log('   - Architecture: AI_AGENTS_ARCHITECTURE_DESIGN.md');
  console.log('   - Deployment: AI_AGENTS_DEPLOYMENT_GUIDE.md');
  console.log('   - README: apps/agents/README.md\n');
}

// Run setup
main().catch(console.error);