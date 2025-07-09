#!/bin/bash

# Deployment verification script for AI Agents
# Usage: ./verify-agents-deployment.sh [environment]

set -e

ENVIRONMENT=${1:-production}
BASE_URL=${PRODUCTION_URL:-http://localhost:3001}
MAX_RETRIES=10
RETRY_DELAY=5

echo "Verifying AI Agents deployment in $ENVIRONMENT environment..."
echo "Base URL: $BASE_URL"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to wait for service to be ready
wait_for_service() {
  local retry_count=0
  
  echo -n "Waiting for service to be ready"
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    if curl -s -f "$BASE_URL/ready" > /dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      return 0
    fi
    
    echo -n "."
    sleep $RETRY_DELAY
    ((retry_count++))
  done
  
  echo -e " ${RED}✗${NC}"
  echo "Service failed to become ready after $((MAX_RETRIES * RETRY_DELAY)) seconds"
  return 1
}

# Function to verify agent status
verify_agent() {
  local agent=$1
  
  response=$(curl -s "$BASE_URL/health/$agent")
  status=$(echo $response | jq -r '.status' 2>/dev/null || echo "error")
  version=$(echo $response | jq -r '.version' 2>/dev/null || echo "unknown")
  
  if [ "$status" == "healthy" ]; then
    echo -e "  $agent: ${GREEN}✓ HEALTHY${NC} (version: $version)"
    return 0
  else
    echo -e "  $agent: ${RED}✗ UNHEALTHY${NC} (status: $status)"
    return 1
  fi
}

# Function to check critical dependencies
check_dependencies() {
  echo "Checking critical dependencies..."
  
  deps=$(curl -s "$BASE_URL/health/dependencies")
  
  # Check RabbitMQ
  rabbitmq_connected=$(echo $deps | jq -r '.rabbitmq.connected' 2>/dev/null || echo "false")
  rabbitmq_version=$(echo $deps | jq -r '.rabbitmq.version' 2>/dev/null || echo "unknown")
  
  if [ "$rabbitmq_connected" == "true" ]; then
    echo -e "  RabbitMQ: ${GREEN}✓ CONNECTED${NC} (version: $rabbitmq_version)"
  else
    echo -e "  RabbitMQ: ${RED}✗ DISCONNECTED${NC}"
    return 1
  fi
  
  # Check Redis
  redis_connected=$(echo $deps | jq -r '.redis.connected' 2>/dev/null || echo "false")
  redis_version=$(echo $deps | jq -r '.redis.version' 2>/dev/null || echo "unknown")
  
  if [ "$redis_connected" == "true" ]; then
    echo -e "  Redis: ${GREEN}✓ CONNECTED${NC} (version: $redis_version)"
  else
    echo -e "  Redis: ${RED}✗ DISCONNECTED${NC}"
    return 1
  fi
  
  # Check Database
  db_connected=$(echo $deps | jq -r '.database.connected' 2>/dev/null || echo "false")
  
  if [ "$db_connected" == "true" ]; then
    echo -e "  Database: ${GREEN}✓ CONNECTED${NC}"
  else
    echo -e "  Database: ${RED}✗ DISCONNECTED${NC}"
    return 1
  fi
  
  return 0
}

# Function to run integration test
run_integration_test() {
  echo "Running integration test..."
  
  # Create test workflow
  test_response=$(curl -s -X POST "$BASE_URL/test/workflow" \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "deployment-test-user",
      "testType": "full-workflow"
    }')
  
  workflow_id=$(echo $test_response | jq -r '.workflowId' 2>/dev/null || echo "")
  
  if [ -z "$workflow_id" ]; then
    echo -e "  ${RED}✗ Failed to create test workflow${NC}"
    return 1
  fi
  
  echo "  Created test workflow: $workflow_id"
  
  # Wait for workflow completion
  echo -n "  Waiting for workflow completion"
  local wait_count=0
  local max_wait=30
  
  while [ $wait_count -lt $max_wait ]; do
    status_response=$(curl -s "$BASE_URL/test/workflow/$workflow_id")
    workflow_status=$(echo $status_response | jq -r '.status' 2>/dev/null || echo "pending")
    
    if [ "$workflow_status" == "completed" ]; then
      echo -e " ${GREEN}✓${NC}"
      
      # Check results
      success_rate=$(echo $status_response | jq -r '.results.successRate' 2>/dev/null || echo "0")
      
      if (( $(echo "$success_rate > 0.9" | bc -l) )); then
        echo -e "  Success rate: ${GREEN}${success_rate}${NC}"
        return 0
      else
        echo -e "  Success rate: ${YELLOW}${success_rate}${NC}"
        return 1
      fi
    elif [ "$workflow_status" == "failed" ]; then
      echo -e " ${RED}✗${NC}"
      echo "  Workflow failed"
      return 1
    fi
    
    echo -n "."
    sleep 1
    ((wait_count++))
  done
  
  echo -e " ${RED}✗${NC}"
  echo "  Workflow timed out"
  return 1
}

# Main verification flow
echo ""
echo "=== Starting Deployment Verification ==="
echo ""

# Wait for service
if ! wait_for_service; then
  exit 1
fi

echo ""
echo "=== Verifying Agent Status ==="
AGENT_FAILURES=0

for agent in "orchestrator" "news-monitor" "content-generator" "quality-control" "publisher" "learning"; do
  verify_agent "$agent" || ((AGENT_FAILURES++))
done

echo ""
if ! check_dependencies; then
  echo -e "${RED}Critical dependencies check failed!${NC}"
  exit 1
fi

echo ""
if ! run_integration_test; then
  echo -e "${YELLOW}Integration test failed or had low success rate${NC}"
fi

# Check metrics
echo ""
echo "=== Checking Metrics ==="
metrics=$(curl -s "$BASE_URL/metrics")

if [ -n "$metrics" ]; then
  echo -e "  Metrics endpoint: ${GREEN}✓ AVAILABLE${NC}"
  
  # Extract key metrics
  up_metric=$(echo "$metrics" | grep "^up " | awk '{print $2}' || echo "0")
  if [ "$up_metric" == "1" ]; then
    echo -e "  Service status: ${GREEN}✓ UP${NC}"
  else
    echo -e "  Service status: ${RED}✗ DOWN${NC}"
  fi
else
  echo -e "  Metrics endpoint: ${RED}✗ UNAVAILABLE${NC}"
fi

# Summary
echo ""
echo "================================"

if [ $AGENT_FAILURES -eq 0 ]; then
  echo -e "${GREEN}Deployment verification PASSED!${NC}"
  echo "All agents are healthy and dependencies are connected."
  
  # Log deployment info
  deployment_info=$(curl -s "$BASE_URL/info")
  echo ""
  echo "Deployment Info:"
  echo "  Version: $(echo $deployment_info | jq -r '.version' 2>/dev/null || echo 'unknown')"
  echo "  Build: $(echo $deployment_info | jq -r '.build' 2>/dev/null || echo 'unknown')"
  echo "  Environment: $ENVIRONMENT"
  echo "  Timestamp: $(date)"
  
  exit 0
else
  echo -e "${RED}Deployment verification FAILED!${NC}"
  echo "$AGENT_FAILURES agents are unhealthy."
  exit 1
fi