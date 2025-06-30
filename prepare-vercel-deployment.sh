#!/bin/bash

echo "🚀 Preparing for Vercel deployment with consolidated API functions..."

# Step 1: Clean up old individual API files
echo "📦 Cleaning up old API structure..."
rm -rf api/auth/
rm -rf api/calendar/events.js
rm -rf api/content/generate.js
rm -rf api/linkedin/auth.js api/linkedin/callback.js api/linkedin/queue.js api/linkedin/status.js
rm -rf api/monitoring/error.js api/monitoring/health.js
rm -rf api/news/articles.js api/news/sources.js
rm -rf api/workshop/

# Keep the consolidated files and necessary files
echo "✅ Keeping consolidated API files:"
ls -la api/*.js | grep -E "(auth|content|workshop|news|calendar|linkedin|monitoring|hello|test)\.js"

# Step 2: Update the frontend to use consolidated API
echo "📝 Next steps for frontend updates:"
echo "1. Update src/services/authAPI.ts to use authAPI-consolidated.ts patterns"
echo "2. Update other API services to use query parameters for actions"
echo "3. Test locally with: npm start"

# Step 3: Count final functions
echo ""
echo "📊 Function count:"
find api -name "*.js" -type f | grep -v "_lib" | grep -v "test.js" | wc -l
echo "functions (should be under 12)"

# Step 4: List final API structure
echo ""
echo "📁 Final API structure:"
find api -name "*.js" -type f | grep -v "_lib" | sort

echo ""
echo "✅ Ready for deployment!"
echo ""
echo "Next commands:"
echo "1. vercel --prod"
echo "2. Test endpoints with the URLs in VERCEL_12_FUNCTION_SOLUTION.md"