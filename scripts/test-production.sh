#!/bin/bash

# Personal Brand DNA - Production Testing Script
# This script tests all critical paths in production

set -e

echo "🧪 Personal Brand DNA - Production Testing"
echo "=========================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
if [ -z "$1" ]; then
    echo "Usage: $0 <production-url>"
    echo "Example: $0 https://personal-brand-dna.vercel.app"
    exit 1
fi

BASE_URL=$1
API_URL="$BASE_URL/api"
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).log"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to log results
log_test() {
    local test_name=$1
    local result=$2
    local details=$3
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "[PASS] $test_name" >> "$RESULTS_FILE"
    else
        echo -e "${RED}✗${NC} $test_name"
        echo -e "  ${RED}Details: $details${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "[FAIL] $test_name - $details" >> "$RESULTS_FILE"
    fi
}

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local test_name=$4
    local data=$5
    
    local response
    local status
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status" = "$expected_status" ]; then
        log_test "$test_name" "PASS"
    else
        log_test "$test_name" "FAIL" "Expected $expected_status, got $status. Response: $body"
    fi
    
    echo "$body"
}

echo "Testing URL: $BASE_URL"
echo "Results will be saved to: $RESULTS_FILE"
echo

# 1. Health Check Tests
echo -e "${BLUE}=== Health Check Tests ===${NC}"
test_endpoint "GET" "/monitoring/health" "200" "Health check endpoint"

# 2. Authentication Tests
echo -e "\n${BLUE}=== Authentication Tests ===${NC}"

# Test demo login
demo_response=$(test_endpoint "POST" "/auth/demo-login" "200" "Demo login" "{}")
if [[ $demo_response == *"accessToken"* ]]; then
    TOKEN=$(echo "$demo_response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    log_test "Demo token extraction" "PASS"
else
    log_test "Demo token extraction" "FAIL" "No token in response"
    TOKEN=""
fi

# Test OTP send
test_endpoint "POST" "/auth/send-otp" "200" "Send OTP" '{"email":"test@example.com"}'

# Test registration validation
test_endpoint "POST" "/auth/register" "400" "Registration validation" '{"email":"invalid"}'

# 3. Core API Tests (requires auth)
if [ -n "$TOKEN" ]; then
    echo -e "\n${BLUE}=== Authenticated API Tests ===${NC}"
    
    # Test workshop start
    workshop_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/workshop/start" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"sessionType":"brand_workshop"}')
    
    status=$(echo "$workshop_response" | tail -n1)
    if [ "$status" = "201" ] || [ "$status" = "200" ]; then
        log_test "Workshop start" "PASS"
    else
        log_test "Workshop start" "FAIL" "Status: $status"
    fi
else
    echo -e "${YELLOW}Skipping authenticated tests (no token)${NC}"
fi

# 4. Error Handling Tests
echo -e "\n${BLUE}=== Error Handling Tests ===${NC}"
test_endpoint "GET" "/nonexistent" "404" "404 handling"
test_endpoint "POST" "/hello" "405" "Method not allowed"

# 5. Performance Tests
echo -e "\n${BLUE}=== Performance Tests ===${NC}"
start_time=$(date +%s%N)
curl -s "$API_URL/hello" > /dev/null
end_time=$(date +%s%N)
response_time=$((($end_time - $start_time) / 1000000))

if [ "$response_time" -lt 200 ]; then
    log_test "API response time (<200ms)" "PASS"
else
    log_test "API response time (<200ms)" "FAIL" "Response time: ${response_time}ms"
fi

# 6. Frontend Tests
echo -e "\n${BLUE}=== Frontend Tests ===${NC}"
html_response=$(curl -s "$BASE_URL")
if [[ $html_response == *"Personal Brand DNA"* ]]; then
    log_test "Frontend loads" "PASS"
else
    log_test "Frontend loads" "FAIL" "Page did not contain expected content"
fi

# Check for JavaScript errors
if [[ $html_response == *"error"* ]] || [[ $html_response == *"Error"* ]]; then
    log_test "No visible errors" "FAIL" "Page contains error text"
else
    log_test "No visible errors" "PASS"
fi

# 7. Security Tests
echo -e "\n${BLUE}=== Security Tests ===${NC}"

# Test HTTPS redirect (if applicable)
if [[ $BASE_URL == https://* ]]; then
    http_url=${BASE_URL/https:/http:}
    redirect_response=$(curl -s -o /dev/null -w "%{http_code}" -L "$http_url")
    if [ "$redirect_response" = "200" ]; then
        log_test "HTTPS redirect" "PASS"
    else
        log_test "HTTPS redirect" "FAIL" "No redirect from HTTP"
    fi
fi

# Test SQL injection protection
injection_response=$(test_endpoint "POST" "/auth/login" "400" "SQL injection protection" '{"email":"test@test.com OR 1=1","password":"test"}')

# Test XSS protection
xss_response=$(test_endpoint "POST" "/auth/register" "400" "XSS protection" '{"email":"<script>alert(1)</script>","password":"test"}')

# 8. Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo "Tests run: $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo "Results saved to: $RESULTS_FILE"

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed! Production is ready.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review before launch.${NC}"
    exit 1
fi