#!/bin/bash

# Smoke test script for AI Agents
# Usage: ./smoke-test-agents.sh [environment]

set -e

ENVIRONMENT=${1:-staging}
BASE_URL=${STAGING_URL:-http://localhost:3001}

if [ "$ENVIRONMENT" == "production" ]; then
  BASE_URL=${PRODUCTION_URL}
fi

echo "Running smoke tests for AI Agents in $ENVIRONMENT environment..."
echo "Base URL: $BASE_URL"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
  local endpoint=$1
  local expected_status=$2
  local description=$3
  
  echo -n "Testing $description... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  
  if [ "$response" == "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Status: $response)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
    return 1
  fi
}

# Function to check agent health
check_agent_health() {
  local agent=$1
  
  echo -n "Checking $agent agent health... "
  
  response=$(curl -s "$BASE_URL/health/$agent")
  status=$(echo $response | jq -r '.status' 2>/dev/null || echo "error")
  
  if [ "$status" == "healthy" ]; then
    echo -e "${GREEN}✓ HEALTHY${NC}"
    return 0
  else
    echo -e "${RED}✗ UNHEALTHY${NC} (Status: $status)"
    return 1
  fi
}

# Track failures
FAILURES=0

echo ""
echo "=== Basic Connectivity Tests ==="

# Test health endpoint
check_endpoint "/health" "200" "Health endpoint" || ((FAILURES++))

# Test readiness endpoint
check_endpoint "/ready" "200" "Readiness endpoint" || ((FAILURES++))

# Test metrics endpoint
check_endpoint "/metrics" "200" "Metrics endpoint" || ((FAILURES++))

echo ""
echo "=== Agent Health Checks ==="

# Check individual agent health
for agent in "orchestrator" "news-monitor" "content-generator" "quality-control" "publisher" "learning"; do
  check_agent_health "$agent" || ((FAILURES++))
done

echo ""
echo "=== Message Bus Connectivity ==="

# Test RabbitMQ connection
echo -n "Checking RabbitMQ connection... "
rabbitmq_status=$(curl -s "$BASE_URL/health/dependencies" | jq -r '.rabbitmq.connected' 2>/dev/null || echo "false")
if [ "$rabbitmq_status" == "true" ]; then
  echo -e "${GREEN}✓ CONNECTED${NC}"
else
  echo -e "${RED}✗ DISCONNECTED${NC}"
  ((FAILURES++))
fi

# Test Redis connection
echo -n "Checking Redis connection... "
redis_status=$(curl -s "$BASE_URL/health/dependencies" | jq -r '.redis.connected' 2>/dev/null || echo "false")
if [ "$redis_status" == "true" ]; then
  echo -e "${GREEN}✓ CONNECTED${NC}"
else
  echo -e "${RED}✗ DISCONNECTED${NC}"
  ((FAILURES++))
fi

echo ""
echo "=== Functional Tests ==="

# Test content generation endpoint
echo -n "Testing content generation... "
content_response=$(curl -s -X POST "$BASE_URL/test/content-generation" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "prompt": "Test content generation",
    "pillar": "Digital Innovation"
  }')

content_status=$(echo $content_response | jq -r '.success' 2>/dev/null || echo "false")
if [ "$content_status" == "true" ]; then
  echo -e "${GREEN}✓ WORKING${NC}"
else
  echo -e "${YELLOW}⚠ WARNING${NC} (May need API keys configured)"
fi

# Test quality check endpoint
echo -n "Testing quality control... "
quality_response=$(curl -s -X POST "$BASE_URL/test/quality-check" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "text": "This is a test content for quality checking.",
      "metadata": {
        "userId": "test-user",
        "pillar": "Digital Innovation"
      }
    }
  }')

quality_status=$(echo $quality_response | jq -r '.success' 2>/dev/null || echo "false")
if [ "$quality_status" == "true" ]; then
  echo -e "${GREEN}✓ WORKING${NC}"
else
  echo -e "${YELLOW}⚠ WARNING${NC} (May need configuration)"
fi

echo ""
echo "=== Performance Checks ==="

# Check response times
echo -n "Checking health endpoint response time... "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health")
response_time_ms=$(echo "$response_time * 1000" | bc)

if (( $(echo "$response_time_ms < 100" | bc -l) )); then
  echo -e "${GREEN}✓ FAST${NC} (${response_time_ms}ms)"
else
  echo -e "${YELLOW}⚠ SLOW${NC} (${response_time_ms}ms)"
fi

echo ""
echo "================================"
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES smoke tests failed!${NC}"
  exit 1
fi