#!/bin/bash

# Personal Brand DNA - Production Deployment Script
# This script handles the complete production deployment process

set -e  # Exit on error

echo "🚀 Personal Brand DNA - Production Deployment"
echo "============================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if running from project root
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Check for required tools
log_info "Checking required tools..."
command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed."; exit 1; }
command -v vercel >/dev/null 2>&1 || { log_error "Vercel CLI is required. Install with: npm i -g vercel"; exit 1; }

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Run pre-deployment checks
log_info "Running pre-deployment checks..."

# 1. Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    log_warn "You have uncommitted changes. Consider committing before deployment."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 2. Run tests
log_info "Running tests..."
npm test -- --passWithNoTests || {
    log_error "Tests failed. Fix issues before deploying."
    exit 1
}

# 3. Build the application
log_info "Building the application..."
npm run build || {
    log_error "Build failed. Fix issues before deploying."
    exit 1
}

# 4. Check environment variables
log_info "Checking environment variables..."
REQUIRED_VARS=(
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
    "OPENAI_API_KEY"
)

log_warn "Ensure these environment variables are set in Vercel:"
for var in "${REQUIRED_VARS[@]}"; do
    echo "  - $var"
done

read -p "Have you configured all required environment variables in Vercel? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_error "Please configure environment variables in Vercel dashboard before deploying."
    exit 1
fi

# 5. Deploy to Vercel
log_info "Deploying to Vercel..."
echo "Choose deployment type:"
echo "1) Preview deployment (recommended for testing)"
echo "2) Production deployment"
read -p "Select option (1 or 2): " deployment_type

case $deployment_type in
    1)
        log_info "Creating preview deployment..."
        vercel || {
            log_error "Preview deployment failed."
            exit 1
        }
        ;;
    2)
        log_warn "⚠️  You are about to deploy to PRODUCTION!"
        read -p "Are you absolutely sure? Type 'DEPLOY' to confirm: " confirm
        if [ "$confirm" = "DEPLOY" ]; then
            log_info "Creating production deployment..."
            vercel --prod || {
                log_error "Production deployment failed."
                exit 1
            }
        else
            log_info "Production deployment cancelled."
            exit 0
        fi
        ;;
    *)
        log_error "Invalid option selected."
        exit 1
        ;;
esac

# 6. Post-deployment tasks
log_info "Running post-deployment tasks..."

# Get deployment URL
DEPLOYMENT_URL=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "Check Vercel dashboard")

echo
echo "============================================"
log_info "🎉 Deployment completed successfully!"
echo
echo "Deployment URL: https://$DEPLOYMENT_URL"
echo
echo "Next steps:"
echo "1. Test the deployment thoroughly"
echo "2. Run health check: curl https://$DEPLOYMENT_URL/api/monitoring/health"
echo "3. Check monitoring dashboards"
echo "4. Update DNS if this is a production deployment"
echo
echo "To rollback if needed: vercel rollback"
echo "============================================"

# 7. Run post-deployment tests
read -p "Run post-deployment health check? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    log_info "Running health check..."
    curl -s "https://$DEPLOYMENT_URL/api/monitoring/health" | jq . || {
        log_warn "Health check failed or jq not installed for formatting"
    }
fi

log_info "Deployment script completed!"