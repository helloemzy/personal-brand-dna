# AI Agents Production Deployment Guide

**Created**: January 9, 2025
**Status**: Ready for deployment

## Overview

This guide provides step-by-step instructions for deploying the BrandPillar AI agents to production using Railway.app with CloudAMQP for message queuing and Redis Cloud for caching.

## Prerequisites

- Railway.app account
- CloudAMQP account (free tier available)
- Redis Cloud account (free tier available)
- GitHub repository with the code
- Environment variables ready

## Step 1: Set up CloudAMQP

1. **Create CloudAMQP Account**
   - Go to https://www.cloudamqp.com/
   - Sign up for a free account
   - Verify your email

2. **Create RabbitMQ Instance**
   - Click "Create New Instance"
   - Choose "Little Lemur" (Free tier)
   - Name: `brandpillar-production`
   - Region: Choose closest to your users (e.g., US-East-1)
   - Click "Create Instance"

3. **Get Connection URL**
   - Click on your instance name
   - Copy the AMQP URL (starts with `amqps://`)
   - Save this as `CLOUDAMQP_URL`

4. **Configure Instance Settings**
   - Go to "RabbitMQ Manager" in your instance
   - Create exchanges:
     - `agent.tasks` (topic exchange)
     - `agent.dlx` (dead letter exchange)
   - Create queues:
     - `news-monitor`
     - `content-generator`
     - `quality-control`
     - `publisher`
     - `learning`

## Step 2: Set up Redis Cloud

1. **Create Redis Cloud Account**
   - Go to https://redis.com/try-free/
   - Sign up for a free account
   - Verify your email

2. **Create Database**
   - Click "New Database"
   - Choose "Redis Stack" (30MB free)
   - Name: `brandpillar-cache`
   - Region: Same as CloudAMQP
   - Click "Create Database"

3. **Get Connection Details**
   - Go to "Configuration" tab
   - Copy the Redis URL
   - Format: `redis://default:password@host:port`
   - Save this as `REDIS_URL`

4. **Configure Database**
   - Enable persistence
   - Set eviction policy to `allkeys-lru`
   - Set maxmemory to 25MB (leaving buffer)

## Step 3: Prepare Railway Deployment

1. **Create Railway Account**
   - Go to https://railway.app/
   - Sign up with GitHub
   - Create new project

2. **Connect GitHub Repository**
   - Click "Deploy from GitHub repo"
   - Select your BrandPillar repository
   - Choose `main` branch

3. **Configure Environment Variables**
   ```bash
   # Required for AI Agents
   CLOUDAMQP_URL=amqps://user:pass@host/vhost
   REDIS_URL=redis://default:password@host:port
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   OPENAI_API_KEY=sk-proj-your-key
   NODE_ENV=production
   LOG_LEVEL=info
   
   # Agent Configuration
   AGENT_HEALTH_PORT=3002
   AGENT_HEALTH_CHECK_INTERVAL=30000
   AGENT_TASK_TIMEOUT=300000
   AGENT_MAX_RETRIES=3
   
   # Performance Settings
   CONTENT_GENERATION_CONCURRENCY=5
   NEWS_MONITOR_INTERVAL=300000
   PUBLISHER_BATCH_SIZE=10
   ```

4. **Update Railway Configuration**
   - Ensure `railway.json` is in repository root
   - Verify build command: `npm install && npm run build:agents`
   - Verify start command: `npm run start:agents`

## Step 4: Deploy to Railway

1. **Initial Deployment**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Link to your project
   railway link
   
   # Deploy
   railway up
   ```

2. **Monitor Deployment**
   - Go to Railway dashboard
   - Check deployment logs
   - Wait for "Agents started successfully" message

3. **Verify Health Checks**
   - Railway will automatically check `/health`
   - Check `/health/ready` for all agents ready
   - Monitor `/health/agents` for individual status

## Step 5: Post-Deployment Verification

1. **Check CloudAMQP Dashboard**
   - Verify connections are established
   - Check message rates
   - Monitor queue depths

2. **Check Redis Cloud Dashboard**
   - Verify connection
   - Check memory usage
   - Monitor cache hit rates

3. **Test Agent Communication**
   ```bash
   # Use the test script
   npm run test:agents:production
   ```

4. **Monitor Logs**
   ```bash
   # View Railway logs
   railway logs
   
   # Filter by agent
   railway logs | grep "NewsMonitorAgent"
   ```

## Step 6: Configure Monitoring

1. **Set up Datadog (Optional)**
   - Add Datadog buildpack to Railway
   - Configure API key
   - Import dashboard templates from `/monitoring`

2. **Configure Alerts**
   - CloudAMQP: Set up connection alerts
   - Redis Cloud: Set up memory alerts
   - Railway: Set up deployment failure alerts

3. **Set up PagerDuty (Optional)**
   - Connect to Railway incidents
   - Configure escalation policies

## Production Checklist

- [ ] CloudAMQP instance created and configured
- [ ] Redis Cloud database created and configured
- [ ] Railway project created and linked
- [ ] Environment variables set in Railway
- [ ] Initial deployment successful
- [ ] Health checks passing
- [ ] Message bus communication verified
- [ ] Redis caching verified
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Documentation updated

## Troubleshooting

### CloudAMQP Connection Issues
```bash
# Test connection
curl -i -u user:pass https://host/api/health
```

### Redis Connection Issues
```bash
# Test with redis-cli
redis-cli -h host -p port -a password ping
```

### Agent Not Starting
1. Check Railway logs for errors
2. Verify all environment variables
3. Check health endpoint manually
4. Review agent-specific logs

### Performance Issues
1. Check CloudAMQP dashboard for queue buildup
2. Monitor Redis memory usage
3. Review Railway metrics
4. Scale horizontally if needed

## Scaling Considerations

### Horizontal Scaling
- Railway supports multiple instances
- Agents are designed to work in parallel
- Use Railway's scaling controls

### Vertical Scaling
- Upgrade CloudAMQP plan if needed
- Upgrade Redis Cloud plan if needed
- Adjust Railway resource limits

## Cost Optimization

### Free Tier Limits
- CloudAMQP: 1M messages/month
- Redis Cloud: 30MB storage
- Railway: $5 free credits/month

### When to Upgrade
- CloudAMQP: >1000 active users
- Redis Cloud: >10000 cached items
- Railway: >1GB memory usage

## Security Best Practices

1. **Rotate Credentials Regularly**
   - Update CloudAMQP password monthly
   - Rotate Redis password monthly
   - Update API keys quarterly

2. **Network Security**
   - Use Railway's private networking
   - Enable CloudAMQP IP whitelist
   - Configure Redis Cloud security groups

3. **Data Protection**
   - Enable encryption in transit
   - Use secure environment variables
   - Regular security audits

## Support Resources

- Railway Discord: https://discord.gg/railway
- CloudAMQP Support: support@cloudamqp.com
- Redis Cloud Docs: https://docs.redis.com/latest/
- Our GitHub Issues: https://github.com/yourusername/brandpillar/issues