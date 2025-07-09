#!/bin/bash

# BrandPillar AI Agents - Railway Deployment Script
# This script handles the deployment of AI agents to Railway.app

set -e  # Exit on error

echo "🤖 BrandPillar AI Agents - Railway Deployment"
echo "============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display colored output
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running from project root
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Check for required tools
log_info "Checking required tools..."
command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed."; exit 1; }
command -v railway >/dev/null 2>&1 || { log_error "Railway CLI is required. Install with: npm i -g @railway/cli"; exit 1; }

# Check if logged into Railway
log_info "Checking Railway authentication..."
railway whoami >/dev/null 2>&1 || {
    log_warn "Not logged into Railway. Please login..."
    railway login
}

# Environment setup
log_step "1/7: Setting up environment variables"
echo
echo "Please ensure you have the following services set up:"
echo "  ✓ CloudAMQP account (free tier)"
echo "  ✓ Redis Cloud account (free tier)"
echo "  ✓ Supabase project"
echo "  ✓ OpenAI API key"
echo
read -p "Do you have all required services ready? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_error "Please set up required services before continuing."
    echo
    echo "Quick setup links:"
    echo "  - CloudAMQP: https://www.cloudamqp.com/"
    echo "  - Redis Cloud: https://redis.com/try-free/"
    echo "  - Supabase: https://supabase.com/"
    echo "  - OpenAI: https://platform.openai.com/"
    exit 1
fi

# Check if railway.json exists
if [ ! -f "railway.json" ]; then
    log_error "railway.json not found. Creating from template..."
    exit 1
fi

# Build check
log_step "2/7: Building AI agents locally"
npm run build:agents || {
    log_error "Agent build failed. Fix issues before deploying."
    exit 1
}

# Test agents locally
log_step "3/7: Running agent tests"
npm run test:agents -- --passWithNoTests || {
    log_error "Agent tests failed. Fix issues before deploying."
    exit 1
}

# Railway project setup
log_step "4/7: Setting up Railway project"
echo
echo "Railway project options:"
echo "1) Create new Railway project"
echo "2) Use existing Railway project"
read -p "Select option (1 or 2): " project_option

case $project_option in
    1)
        log_info "Creating new Railway project..."
        project_name="brandpillar-agents-$(date +%Y%m%d)"
        railway init -n "$project_name" || {
            log_error "Failed to create Railway project"
            exit 1
        }
        log_info "Created project: $project_name"
        ;;
    2)
        log_info "Linking to existing Railway project..."
        railway link || {
            log_error "Failed to link Railway project"
            exit 1
        }
        ;;
    *)
        log_error "Invalid option selected."
        exit 1
        ;;
esac

# Environment variables
log_step "5/7: Configuring environment variables"
echo
echo "Enter your service credentials:"
echo

# Function to set Railway environment variable
set_railway_var() {
    local var_name=$1
    local var_prompt=$2
    local is_secret=${3:-true}
    
    if [ "$is_secret" = true ]; then
        read -sp "$var_prompt: " var_value
        echo
    else
        read -p "$var_prompt: " var_value
    fi
    
    if [ -n "$var_value" ]; then
        railway variables set "$var_name=$var_value" >/dev/null 2>&1
        log_info "Set $var_name"
    else
        log_warn "Skipped $var_name (empty value)"
    fi
}

# Set required environment variables
set_railway_var "CLOUDAMQP_URL" "CloudAMQP URL (amqps://...)"
set_railway_var "REDIS_URL" "Redis Cloud URL (redis://...)"
set_railway_var "SUPABASE_URL" "Supabase URL" false
set_railway_var "SUPABASE_SERVICE_KEY" "Supabase Service Key"
set_railway_var "OPENAI_API_KEY" "OpenAI API Key"

# Set additional variables
railway variables set NODE_ENV=production >/dev/null 2>&1
railway variables set LOG_LEVEL=info >/dev/null 2>&1
railway variables set AGENT_HEALTH_PORT=3002 >/dev/null 2>&1
railway variables set AGENT_HEALTH_CHECK_INTERVAL=30000 >/dev/null 2>&1
railway variables set AGENT_TASK_TIMEOUT=300000 >/dev/null 2>&1
railway variables set AGENT_MAX_RETRIES=3 >/dev/null 2>&1

log_info "Environment variables configured"

# Deploy to Railway
log_step "6/7: Deploying to Railway"
echo
log_warn "You are about to deploy AI agents to Railway production!"
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Deployment cancelled"
    exit 0
fi

log_info "Starting deployment..."
railway up || {
    log_error "Deployment failed"
    exit 1
}

# Get deployment info
log_step "7/7: Verifying deployment"
echo
log_info "Waiting for deployment to complete..."
sleep 10

# Get deployment URL
DEPLOYMENT_URL=$(railway status --json 2>/dev/null | jq -r '.url' || echo "")

if [ -z "$DEPLOYMENT_URL" ]; then
    log_warn "Could not get deployment URL automatically"
    log_info "Check your Railway dashboard for the deployment URL"
else
    log_info "Deployment URL: https://$DEPLOYMENT_URL"
    
    # Health check
    log_info "Running health check..."
    sleep 5
    curl -s "https://$DEPLOYMENT_URL/health" | jq . 2>/dev/null || {
        log_warn "Health check failed or service still starting"
        log_info "Try again in a few moments: curl https://$DEPLOYMENT_URL/health"
    }
fi

# Post-deployment information
echo
echo "============================================="
log_info "🎉 AI Agents deployment initiated!"
echo
echo "Next steps:"
echo "1. Monitor deployment logs: railway logs -f"
echo "2. Check Railway dashboard for deployment status"
echo "3. Verify health endpoints:"
echo "   - /health - Overall health"
echo "   - /health/ready - All agents ready"
echo "   - /health/agents - Individual agent status"
echo "4. Check CloudAMQP dashboard for connections"
echo "5. Check Redis Cloud dashboard for cache activity"
echo
echo "Useful commands:"
echo "  railway logs              - View logs"
echo "  railway status           - Check status"
echo "  railway variables        - List variables"
echo "  railway restart          - Restart service"
echo "  railway down             - Stop deployment"
echo
echo "Monitoring:"
echo "  - CloudAMQP: Check message rates and queue depths"
echo "  - Redis Cloud: Monitor memory usage and hit rates"
echo "  - Railway: Watch for restart loops or errors"
echo
echo "============================================="

# Optional: Open Railway dashboard
read -p "Open Railway dashboard in browser? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    railway open
fi

log_info "Deployment script completed!"