#!/bin/bash

echo "🔍 Verifying Personal Brand DNA Deployment Status..."
echo "=================================================="
echo ""

BASE_URL="https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app"

# Function to test endpoint
test_endpoint() {
    local path=$1
    local method=${2:-GET}
    local expected_status=${3:-200}
    
    echo -n "Testing $method $path... "
    
    if [ "$method" = "POST" ]; then
        status=$(curl -X POST -H "Content-Type: application/json" -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
    fi
    
    if [ "$status" = "$expected_status" ]; then
        echo "✅ Success ($status)"
        return 0
    else
        echo "❌ Failed (got $status, expected $expected_status)"
        return 1
    fi
}

echo "🌐 Testing Core Endpoints:"
echo "--------------------------"
test_endpoint "/api/hello" "GET" "200"

echo ""
echo "🔐 Testing Consolidated Auth Endpoints:"
echo "--------------------------------------"
test_endpoint "/api/auth?action=demo-login" "POST" "200"
test_endpoint "/api/auth?action=send-otp" "POST" "200"

echo ""
echo "📝 Testing Other Consolidated Endpoints:"
echo "---------------------------------------"
test_endpoint "/api/content?action=templates" "GET" "200"
test_endpoint "/api/workshop?action=sessions" "GET" "401"  # Expects auth
test_endpoint "/api/news?action=articles" "GET" "401"      # Expects auth
test_endpoint "/api/calendar" "GET" "401"                  # Expects auth
test_endpoint "/api/monitoring?action=health" "GET" "200"

echo ""
echo "📊 Deployment Summary:"
echo "--------------------"
echo "• Vercel should auto-deploy from GitHub push"
echo "• Deployment usually takes 1-3 minutes"
echo "• If endpoints return 404, deployment may still be in progress"
echo "• Check https://vercel.com for deployment status"

echo ""
echo "🔗 Important URLs:"
echo "-----------------"
echo "• Live App: $BASE_URL"
echo "• GitHub: https://github.com/helloemzy/personal-brand-dna"
echo "• Test Demo Login: $BASE_URL/?demo=true"

echo ""
echo "✅ Verification complete!"
echo "========================"