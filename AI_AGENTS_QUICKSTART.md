# AI Agents Quick Start Guide

## 🚀 Fastest Way to Start (No Cloud Accounts Needed!)

### Option 1: Local Development Mode

Run AI Agents locally using Docker - no cloud accounts required:

```bash
# 1. Set up local environment (one-time setup)
npm run setup:agents:local

# 2. Start agents locally
npm run start:local-agents

# 3. Check health
curl http://localhost:3003/health
```

**Access Points:**
- Agent Health: http://localhost:3003/health
- RabbitMQ UI: http://localhost:15672 (brandpillar/secret)
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3002 (admin/secret)

### Option 2: Production Deployment

For production deployment with cloud services:

```bash
# 1. Set up production environment
npm run setup:agents:prod

# 2. Follow the checklist to create accounts:
#    - CloudAMQP (free tier)
#    - Redis Cloud (free tier)

# 3. Add URLs to .env file

# 4. Deploy to Railway
npm run deploy:agents
```

## 🏗️ What Gets Deployed

### Current Agents (2 of 5 Complete):
1. **Orchestrator Agent** ✅ - Coordinates all other agents
2. **News Monitor Agent** ✅ - Scans RSS feeds for opportunities
3. **Content Generator Agent** ⏳ - In progress (Week 5-6)
4. **Quality Control Agent** 📅 - Planned (Week 7)
5. **Publisher Agent** 📅 - Planned (Week 8)

## 💰 Cost Comparison

### Local Development
- **Total Cost**: $0/month
- **Requirements**: Docker Desktop
- **Best For**: Development, testing, demos

### Production (Minimal)
- **Total Cost**: $5-20/month
- **Railway**: $5-20/month
- **CloudAMQP**: $0 (free tier)
- **Redis Cloud**: $0 (free tier)
- **Best For**: Small scale production

## 🔧 Common Commands

```bash
# Local development
npm run agents:dev          # Start agents in dev mode
npm run agents:logs         # View agent logs
docker-compose -f docker-compose.local.yml down  # Stop local services

# Production
railway logs -f             # View production logs
railway status             # Check deployment status
railway variables          # View environment variables
```

## 🐛 Troubleshooting

### Local Setup Issues

**Docker not running:**
```bash
# Start Docker Desktop first, then:
docker-compose -f docker-compose.local.yml up -d
```

**Port conflicts:**
```bash
# Check what's using the ports:
lsof -i :5672   # RabbitMQ
lsof -i :6379   # Redis
lsof -i :3003   # Agent health

# Stop conflicting services or change ports in docker-compose.local.yml
```

### Production Issues

**Railway deployment fails:**
```bash
# Check environment variables
railway variables

# Check build logs
railway logs --build

# Redeploy
railway up --detach
```

## 📚 Next Steps

1. **Explore the agents:**
   - Check health endpoint: http://localhost:3003/health
   - View RabbitMQ queues: http://localhost:15672
   - Monitor with Grafana: http://localhost:3002

2. **Test News Monitor:**
   - Add RSS feeds via API
   - Watch opportunities get generated
   - See relevance scoring in action

3. **Contribute:**
   - Help implement remaining agents
   - Improve monitoring dashboards
   - Add more RSS feed sources

## 🆘 Need Help?

- **Documentation**: See `AI_AGENTS_ARCHITECTURE_DESIGN.md`
- **Deployment Guide**: See `AI_AGENTS_DEPLOYMENT_GUIDE.md`
- **Agent README**: See `apps/agents/README.md`