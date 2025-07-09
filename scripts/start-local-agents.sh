#!/bin/bash

echo "🚀 Starting BrandPillar AI Agents (Local Mode)..."

# Make sure Docker services are running
echo "🐳 Checking Docker services..."
docker-compose -f docker-compose.local.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo "🏥 Checking service health..."
docker ps --filter "name=brandpillar" --format "table {{.Names}}\t{{.Status}}"

# Build and start agents
echo "🔨 Building agents..."
npm run build:agents

echo "🚀 Starting agents in development mode..."
npm run agents:dev