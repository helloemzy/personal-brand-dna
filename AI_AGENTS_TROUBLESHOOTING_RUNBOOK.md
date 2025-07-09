# AI Agents Troubleshooting Runbook

## 🚨 Quick Reference

| Symptom | Likely Cause | First Action |
|---------|--------------|--------------|
| All agents down | Infrastructure issue | Check Railway status |
| Single agent down | Agent crash | Restart specific agent |
| High error rate | API limits or bugs | Check logs and metrics |
| Slow processing | Resource constraints | Scale up or optimize |
| Queue buildup | Processing bottleneck | Check consumer health |

## 📋 Incident Response Checklist

When an issue is reported:

1. **Assess Severity**
   - [ ] Check monitoring dashboard
   - [ ] Verify user impact
   - [ ] Determine scope (single user, partial, full outage)

2. **Initial Response**
   - [ ] Acknowledge incident in Slack
   - [ ] Create incident channel if P1/P2
   - [ ] Assign incident commander

3. **Diagnose**
   - [ ] Check health endpoints
   - [ ] Review recent deployments
   - [ ] Examine error logs

4. **Mitigate**
   - [ ] Apply immediate fix or workaround
   - [ ] Communicate status to stakeholders
   - [ ] Monitor recovery

5. **Post-Incident**
   - [ ] Write incident report
   - [ ] Schedule post-mortem
   - [ ] Create follow-up tasks

## 🔍 Common Issues and Solutions

### 1. Agent Not Starting

**Symptoms:**
- Agent shows as "unhealthy" in health check
- No logs from specific agent
- Restart loop in container logs

**Diagnosis:**
```bash
# Check agent-specific logs
railway logs --service ai-agents | grep "agent-name"

# Check for startup errors
railway logs --service ai-agents | grep -i "error\|fatal\|exception"

# Verify environment variables
railway variables --service ai-agents --environment production
```

**Solutions:**

1. **Missing Environment Variables**
   ```bash
   # List all variables
   railway variables list
   
   # Add missing variable
   railway variables set VARIABLE_NAME="value"
   
   # Redeploy
   railway redeploy
   ```

2. **Connection Issues**
   - Verify RabbitMQ URL is correct
   - Check Redis connection string
   - Ensure database is accessible

3. **Code Issues**
   - Check recent commits for bugs
   - Rollback if necessary
   - Fix and redeploy

### 2. High Memory Usage

**Symptoms:**
- Memory alerts firing
- OOM (Out of Memory) kills
- Degraded performance

**Diagnosis:**
```bash
# Check memory metrics
curl https://agents.brandpillar.ai/metrics | grep memory

# Monitor memory over time
watch -n 5 'railway logs --service ai-agents | grep "Memory usage"'

# Check for memory leaks
railway logs --service ai-agents | grep -i "heap\|leak"
```

**Solutions:**

1. **Immediate Mitigation**
   ```bash
   # Restart agents to free memory
   railway restart --service ai-agents
   
   # Scale horizontally
   railway scale --service ai-agents --replicas 3
   ```

2. **Memory Optimization**
   - Reduce concurrent workflows
   - Implement better garbage collection
   - Fix memory leaks in code

3. **Configuration Changes**
   ```typescript
   // Reduce memory usage
   {
     maxConcurrentWorkflows: 25,  // Reduced from 50
     cacheSize: 1000,             // Reduced from 5000
     batchSize: 10                // Reduced from 25
   }
   ```

### 3. Queue Buildup

**Symptoms:**
- Messages piling up in RabbitMQ
- Increasing processing delays
- Timeout errors

**Diagnosis:**
```bash
# Check queue depths
curl -u admin:password https://cloudamqp-dashboard.com/api/queues

# Monitor processing rate
curl https://agents.brandpillar.ai/metrics | grep queue

# Check consumer status
railway logs --service ai-agents | grep "consumer"
```

**Solutions:**

1. **Scale Consumers**
   ```bash
   # Increase agent replicas
   railway scale --service ai-agents --replicas 5
   
   # Or scale specific agent
   SCALE_CONTENT_GENERATOR=3 railway redeploy
   ```

2. **Clear Stuck Messages**
   ```javascript
   // Emergency queue purge (use with caution!)
   const channel = await rabbitmq.createChannel();
   await channel.purgeQueue('content:generate');
   ```

3. **Optimize Processing**
   - Batch similar requests
   - Implement priority queues
   - Add circuit breakers

### 4. API Rate Limits

**Symptoms:**
- 429 errors from OpenAI
- "Rate limit exceeded" in logs
- Sporadic content generation failures

**Diagnosis:**
```bash
# Check rate limit status
curl https://agents.brandpillar.ai/health/dependencies | jq '.openai'

# Monitor API calls
railway logs --service ai-agents | grep -i "openai\|rate"

# Check current usage
curl https://agents.brandpillar.ai/metrics | grep openai_requests
```

**Solutions:**

1. **Immediate Response**
   ```typescript
   // Implement exponential backoff
   async function callOpenAIWithRetry(prompt, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         return await openai.complete(prompt);
       } catch (error) {
         if (error.status === 429) {
           await sleep(Math.pow(2, i) * 1000);
           continue;
         }
         throw error;
       }
     }
   }
   ```

2. **Rate Limit Management**
   - Implement request queuing
   - Add caching for similar requests
   - Use multiple API keys with rotation

### 5. Content Quality Issues

**Symptoms:**
- Low quality scores
- User complaints about content
- High rejection rate

**Diagnosis:**
```bash
# Check quality metrics
curl https://agents.brandpillar.ai/metrics | grep quality

# Review failed quality checks
railway logs --service ai-agents | grep "quality:failed"

# Analyze patterns
railway logs --service ai-agents | grep "quality" | tail -100 | analysis-script.sh
```

**Solutions:**

1. **Adjust Quality Thresholds**
   ```typescript
   // Temporarily lower thresholds
   const qualityConfig = {
     minGrammarScore: 0.7,    // From 0.8
     minEngagementScore: 0.6, // From 0.7
     minBrandAlignment: 0.7   // From 0.8
   };
   ```

2. **Improve Prompts**
   - Review and update system prompts
   - Add more examples
   - Fine-tune for specific use cases

### 6. Database Connection Issues

**Symptoms:**
- "Connection refused" errors
- Timeouts when fetching workshop data
- Inconsistent agent behavior

**Diagnosis:**
```bash
# Test database connectivity
curl https://agents.brandpillar.ai/health/dependencies | jq '.database'

# Check connection pool
railway logs --service ai-agents | grep -i "database\|supabase\|pool"

# Monitor query performance
railway logs --service ai-agents | grep "query took"
```

**Solutions:**

1. **Connection Pool Tuning**
   ```typescript
   const dbConfig = {
     connectionLimit: 20,      // Increase pool size
     connectTimeout: 30000,    // Increase timeout
     acquireTimeout: 30000,
     idleTimeout: 10000
   };
   ```

2. **Implement Fallbacks**
   ```typescript
   // Cache workshop data in Redis
   async function getWorkshopData(userId) {
     // Try cache first
     const cached = await redis.get(`workshop:${userId}`);
     if (cached) return JSON.parse(cached);
     
     // Fallback to database
     const data = await database.getWorkshopData(userId);
     await redis.setex(`workshop:${userId}`, 3600, JSON.stringify(data));
     return data;
   }
   ```

## 🛠️ Diagnostic Commands

### Health Checks
```bash
# Overall system health
curl https://agents.brandpillar.ai/health | jq

# Specific agent health
curl https://agents.brandpillar.ai/health/content-generator | jq

# Dependencies status
curl https://agents.brandpillar.ai/health/dependencies | jq
```

### Log Analysis
```bash
# Error frequency
railway logs --service ai-agents | grep -i error | wc -l

# Error patterns
railway logs --service ai-agents | grep -i error | cut -d' ' -f5- | sort | uniq -c | sort -rn

# Agent-specific logs
railway logs --service ai-agents | grep "content-generator" | tail -50

# Performance logs
railway logs --service ai-agents | grep "processing_time" | awk '{print $NF}' | stats
```

### Metrics Queries
```bash
# Message processing rate
curl -s https://agents.brandpillar.ai/metrics | grep "messages_processed_total"

# Error rate
curl -s https://agents.brandpillar.ai/metrics | grep "messages_failed_total"

# Queue depth
curl -s https://agents.brandpillar.ai/metrics | grep "queue_depth"

# Response times
curl -s https://agents.brandpillar.ai/metrics | grep "processing_duration"
```

## 🔄 Recovery Procedures

### Full System Restart
```bash
#!/bin/bash
# Full system restart procedure

echo "Starting full system restart..."

# 1. Stop all agents gracefully
railway run --service ai-agents "npm run stop:graceful"

# 2. Clear any stuck locks
railway run --service ai-agents "npm run clear:locks"

# 3. Restart service
railway restart --service ai-agents

# 4. Wait for health
echo "Waiting for system to be healthy..."
for i in {1..30}; do
  if curl -s https://agents.brandpillar.ai/health | grep -q "healthy"; then
    echo "System is healthy!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 10
done

# 5. Verify all agents
for agent in orchestrator news-monitor content-generator quality-control publisher learning; do
  status=$(curl -s https://agents.brandpillar.ai/health/$agent | jq -r '.status')
  echo "$agent: $status"
done
```

### Single Agent Restart
```bash
#!/bin/bash
# Restart specific agent

AGENT=$1
if [ -z "$AGENT" ]; then
  echo "Usage: $0 <agent-name>"
  exit 1
fi

echo "Restarting $AGENT..."

# Send restart signal
railway run --service ai-agents "npm run restart:agent -- $AGENT"

# Wait for healthy status
for i in {1..10}; do
  status=$(curl -s https://agents.brandpillar.ai/health/$AGENT | jq -r '.status')
  if [ "$status" = "healthy" ]; then
    echo "$AGENT is healthy!"
    exit 0
  fi
  echo "Waiting... ($i/10)"
  sleep 5
done

echo "Failed to restart $AGENT"
exit 1
```

## 📞 Escalation Matrix

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| P1 | Complete outage | 15 min | On-call → Lead → CTO |
| P2 | Partial outage | 30 min | On-call → Lead |
| P3 | Degraded performance | 2 hours | On-call |
| P4 | Minor issues | Next business day | Team |

### On-Call Contacts
- **Primary**: +1-XXX-XXX-XXXX
- **Secondary**: +1-XXX-XXX-XXXX
- **Manager**: +1-XXX-XXX-XXXX
- **Slack**: #incidents
- **PagerDuty**: brandpillar.pagerduty.com

## 📊 Monitoring Links

- **Grafana Dashboard**: https://monitoring.brandpillar.ai/d/ai-agents
- **CloudAMQP Console**: https://customer.cloudamqp.com/instance
- **Redis Cloud Console**: https://app.redislabs.com
- **Railway Dashboard**: https://railway.app/project/xxxxx
- **Sentry Errors**: https://sentry.io/organizations/brandpillar/issues

## 🔐 Emergency Access

### Production Database
```bash
# Read-only access
psql "postgresql://readonly:password@db.supabase.co:5432/postgres"

# Admin access (use with extreme caution!)
psql "postgresql://admin:password@db.supabase.co:5432/postgres"
```

### Message Queue Management
```bash
# RabbitMQ Management UI
open https://cloudamqp.com/console

# Emergency queue operations
rabbitmqadmin -H cloudamqp.com -u admin -p password list queues
rabbitmqadmin -H cloudamqp.com -u admin -p password purge queue name=content:generate
```

### Redis Cache
```bash
# Connect to Redis
redis-cli -h redis.cloud.com -p 6379 -a password

# Common commands
KEYS *                    # List all keys
FLUSHDB                  # Clear cache (DANGER!)
INFO memory              # Memory usage
CLIENT LIST              # Active connections
```

---

Last Updated: January 2025
Version: 1.0.0
Emergency Contact: ops@brandpillar.ai