# AI Agents Production Deployment Guide

## 🚀 Overview

This guide provides comprehensive instructions for deploying the BrandPillar AI Agents system to production. The system consists of 5 operational agents that work together to automate content creation and publishing.

## 📋 Prerequisites

Before deploying to production, ensure you have:

1. **Cloud Accounts**:
   - [ ] Railway.app account with production environment
   - [ ] CloudAMQP account (RabbitMQ hosting)
   - [ ] Redis Cloud account
   - [ ] OpenAI API key with sufficient credits
   - [ ] Supabase project for production

2. **Local Tools**:
   - [ ] Docker and Docker Compose installed
   - [ ] Railway CLI installed
   - [ ] Node.js 20+ and npm installed
   - [ ] Git with access to the repository

3. **Environment Variables**:
   ```env
   # Production API Keys
   OPENAI_API_KEY=sk-prod-xxxxx
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=eyJxxxxx
   
   # Production Message Queue
   CLOUDAMQP_URL=amqps://user:pass@host/vhost
   REDIS_CLOUD_URL=redis://user:pass@host:port
   
   # Production Configuration
   NODE_ENV=production
   LOG_LEVEL=info
   ENABLE_METRICS=true
   ENABLE_TRACING=true
   ```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI AGENTS SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ News Monitor│  │  Content    │  │  Quality    │       │
│  │   Agent     │→ │ Generator   │→ │  Control    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                           ↓                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Orchestrator│  │  Publisher  │  │  Learning   │       │
│  │   Agent     │  │   Agent     │← │   Agent     │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE                            │
├──────────────┬──────────────┬──────────────┬──────────────┤
│  CloudAMQP   │  Redis Cloud │   Supabase   │   Railway    │
│  (RabbitMQ)  │   (Cache)    │  (Database)  │  (Compute)   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## 📦 Pre-Deployment Steps

### 1. Set Up CloudAMQP (5 minutes)

1. Sign up at [CloudAMQP](https://www.cloudamqp.com)
2. Create a new instance:
   - Plan: Little Lemur (Free) or Tough Tiger ($19/mo)
   - Region: Same as your Railway deployment
   - Name: `brandpillar-production`
3. Copy the AMQP URL from the instance details

### 2. Set Up Redis Cloud (5 minutes)

1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a new database:
   - Plan: Free (30MB) or Essentials ($5/mo)
   - Region: Same as your Railway deployment
   - Enable persistence
3. Copy the connection string

### 3. Configure Railway Environment

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login to Railway
railway login

# Link to your project
railway link

# Set production environment variables
railway variables set OPENAI_API_KEY="sk-prod-xxxxx" -e production
railway variables set SUPABASE_URL="https://xxxxx.supabase.co" -e production
railway variables set SUPABASE_KEY="eyJxxxxx" -e production
railway variables set CLOUDAMQP_URL="amqps://xxxxx" -e production
railway variables set REDIS_CLOUD_URL="redis://xxxxx" -e production
railway variables set NODE_ENV="production" -e production
railway variables set LOG_LEVEL="info" -e production
railway variables set ENABLE_METRICS="true" -e production
```

## 🚀 Deployment Process

### Step 1: Build and Test Locally

```bash
# Install dependencies
npm install

# Build all packages
npm run build:all

# Run tests
cd apps/agents
npm run test:ci

# Build Docker image locally
docker build -f apps/agents/Dockerfile -t brandpillar-agents:latest .

# Test Docker image
docker run --env-file .env.production brandpillar-agents:latest
```

### Step 2: Deploy to Railway

```bash
# Deploy using Railway CLI
railway up --service ai-agents --environment production

# Or use the deployment script
./scripts/deploy-agents-railway.sh production
```

### Step 3: Verify Deployment

```bash
# Run verification script
./scripts/verify-agents-deployment.sh production

# Check logs
railway logs --service ai-agents --environment production
```

## 📊 Monitoring and Observability

### 1. Health Check Endpoints

- **Overall Health**: `GET /health`
- **Individual Agent Health**: `GET /health/{agent-name}`
- **Dependencies Status**: `GET /health/dependencies`
- **Metrics**: `GET /metrics` (Prometheus format)

### 2. Grafana Dashboard Setup

1. Access Grafana at your monitoring URL
2. Import the dashboard from `monitoring/grafana/dashboards/ai-agents.json`
3. Configure data source to Prometheus

### 3. Key Metrics to Monitor

- **Agent Health**: All agents should report "healthy"
- **Message Processing Rate**: Target >10 msg/sec
- **Error Rate**: Should be <1%
- **Queue Depth**: Should not exceed 1000 messages
- **Response Times**: P95 <5 seconds for content generation

### 4. Alerts Configuration

Critical alerts are configured for:
- Agent down for >2 minutes
- Error rate >5%
- Queue depth >5000
- Memory usage >80%
- API rate limits approaching

## 🔧 Production Configuration

### 1. Scaling Configuration

```yaml
# railway.toml
[deploy]
numReplicas = 2
healthcheckPath = "/health"
healthcheckTimeout = 30

[deploy.scaling]
minReplicas = 1
maxReplicas = 5
targetCPU = 70
targetMemory = 80
```

### 2. Resource Limits

```yaml
# Recommended resource allocation
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

### 3. Environment-Specific Settings

```typescript
// Production settings
const productionConfig = {
  // Concurrency
  maxConcurrentWorkflows: 50,
  maxContentGenerationPerMinute: 100,
  
  // Timeouts
  contentGenerationTimeout: 30000,
  qualityCheckTimeout: 10000,
  publishingTimeout: 20000,
  
  // Retries
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoff: 2,
  
  // Caching
  cacheEnabled: true,
  cacheTTL: 3600,
  
  // Rate Limiting
  openAIRateLimit: 3000, // requests per minute
  linkedInRateLimit: 100, // posts per hour
};
```

## 🚨 Troubleshooting

### Common Issues and Solutions

1. **Agents Not Starting**
   ```bash
   # Check logs
   railway logs --service ai-agents -n 100
   
   # Verify environment variables
   railway variables --service ai-agents --environment production
   
   # Check connectivity
   curl https://your-service.up.railway.app/health
   ```

2. **RabbitMQ Connection Issues**
   - Verify CloudAMQP URL is correct
   - Check firewall rules
   - Ensure connection limit not exceeded

3. **High Memory Usage**
   - Check for memory leaks in logs
   - Reduce concurrent workflows
   - Increase resource limits

4. **Slow Content Generation**
   - Monitor OpenAI API response times
   - Check Redis cache hit rate
   - Verify no rate limiting

### Debug Mode

Enable debug logging temporarily:
```bash
railway variables set LOG_LEVEL="debug" --service ai-agents --environment production
railway redeploy --service ai-agents --environment production
```

## 📝 Maintenance Tasks

### Daily Tasks
- [ ] Check health dashboard
- [ ] Review error logs
- [ ] Monitor queue depths

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Check resource usage trends
- [ ] Update dependencies if needed

### Monthly Tasks
- [ ] Review and optimize costs
- [ ] Update documentation
- [ ] Performance tuning
- [ ] Security patches

## 🔐 Security Considerations

1. **API Key Rotation**
   - Rotate OpenAI keys monthly
   - Update Supabase keys quarterly
   - Use Railway's secret management

2. **Network Security**
   - All services use TLS/SSL
   - Implement IP whitelisting where possible
   - Use private networking between services

3. **Data Protection**
   - PII is not stored in logs
   - User content is encrypted at rest
   - Implement data retention policies

## 📞 Support and Escalation

### Monitoring Alerts
- **Low Priority**: Slack notification
- **Medium Priority**: Email to on-call
- **High Priority**: PagerDuty alert

### Escalation Path
1. On-call engineer (response <15 min)
2. Team lead (response <30 min)
3. CTO (response <1 hour)

### Rollback Procedure
```bash
# List recent deployments
railway deployments list --service ai-agents

# Rollback to previous version
railway deployments rollback <deployment-id> --service ai-agents
```

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [CloudAMQP Best Practices](https://www.cloudamqp.com/docs/index.html)
- [Redis Cloud Operations](https://docs.redis.com/latest/rc/)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

## ✅ Deployment Checklist

Before going live:
- [ ] All environment variables configured
- [ ] Health checks passing
- [ ] Monitoring dashboard set up
- [ ] Alerts configured
- [ ] Backup strategy in place
- [ ] Rollback procedure tested
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Team trained on operations

---

Last Updated: January 2025
Version: 1.0.0