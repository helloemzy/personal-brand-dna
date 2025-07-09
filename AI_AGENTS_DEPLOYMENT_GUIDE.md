# BrandPillar AI Agents - Deployment Guide

## Overview

This guide covers the deployment and operation of the BrandPillar AI Agents system, which implements a distributed agent architecture for autonomous content generation and management.

## Architecture Components

### 1. **Message Bus (RabbitMQ)**
- Handles inter-agent communication
- Provides reliable message delivery with retries
- Dead letter queue for failed messages
- CloudAMQP for production (free tier available)

### 2. **State Management (Redis)**
- Stores agent registry and health status
- Caches task results and metrics
- Session and temporary data storage
- Redis Cloud for production (free tier: 30MB)

### 3. **AI Agents**
- **Orchestrator Agent**: Coordinates all other agents
- **News Monitor Agent**: Scans RSS feeds for opportunities
- **Content Generator Agent**: Creates voice-matched content (pending)
- **Quality Control Agent**: Validates content safety (pending)
- **Publisher Agent**: Distributes content to platforms (pending)
- **Learning Agent**: Optimizes system performance (pending)

### 4. **Monitoring Stack**
- Prometheus for metrics collection
- Grafana for visualization
- Health check endpoints
- Performance tracking

## Local Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 20+
- npm 9+

### Quick Start

1. **Clone and install dependencies**:
```bash
cd personal-brand-dna
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Add your API keys:
# - OPENAI_API_KEY
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
```

3. **Start infrastructure**:
```bash
docker-compose -f docker-compose.agents.yml up -d
```

4. **Build packages**:
```bash
npm run build:shared
npm run build:queue
npm run build:agents
```

5. **Start agents in development**:
```bash
cd apps/agents
npm run dev
```

### Access Points
- RabbitMQ Management: http://localhost:15672 (brandpillar/secret)
- Redis Commander: redis-cli (password: secret)
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3002 (admin/secret)
- Agent Health: http://localhost:3003/health

## Production Deployment (Railway.app)

### 1. **Set up CloudAMQP (Message Bus)**

1. Create free account at https://www.cloudamqp.com
2. Create new instance (Little Lemur - Free)
3. Copy the AMQP URL from instance details

### 2. **Set up Redis Cloud**

1. Create free account at https://redis.com/try-free/
2. Create new database (30MB free tier)
3. Copy the Redis URL with password

### 3. **Deploy to Railway**

1. **Install Railway CLI**:
```bash
npm install -g @railway/cli
railway login
```

2. **Create new project**:
```bash
railway init
# Select "Empty Project"
```

3. **Set environment variables**:
```bash
railway variables set CLOUDAMQP_URL="amqp://..."
railway variables set REDIS_URL="redis://..."
railway variables set SUPABASE_URL="https://..."
railway variables set SUPABASE_SERVICE_KEY="eyJ..."
railway variables set OPENAI_API_KEY="sk-..."
railway variables set NODE_ENV="production"
railway variables set LOG_LEVEL="info"
```

4. **Deploy agents**:
```bash
railway up
```

5. **Monitor deployment**:
```bash
railway logs -f
```

### Railway Configuration

The `railway.json` file is already configured with:
- Build commands for monorepo
- Health check endpoint
- Restart policies
- Environment variable mapping

## Environment Variables

### Required for All Environments

| Variable | Description | Example |
|----------|-------------|---------|
| `CLOUDAMQP_URL` | RabbitMQ connection URL | `amqp://user:pass@host:5672` |
| `REDIS_URL` | Redis connection URL | `redis://:password@host:6379` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `PORT` | Health server port | `3000` |
| `AGENT_MAX_TASKS` | Max concurrent tasks | `10` |

## Monitoring and Operations

### Health Checks

**Basic health check**:
```bash
curl http://localhost:3003/health
```

**Readiness check**:
```bash
curl http://localhost:3003/health/ready
```

**Detailed metrics**:
```bash
curl http://localhost:3003/metrics
```

### Grafana Dashboards

1. **Agent Overview**: System health, active agents, task throughput
2. **Task Performance**: Processing times, success rates, queue depths
3. **Resource Usage**: CPU, memory, network per agent
4. **Error Tracking**: Failed tasks, error rates, retry statistics

### Common Operations

**Scale agents horizontally**:
```bash
# Railway: Increase instances
railway scale --count 3
```

**View agent logs**:
```bash
# Local
docker-compose -f docker-compose.agents.yml logs -f agents

# Railway
railway logs -f
```

**Restart agents**:
```bash
# Local
docker-compose -f docker-compose.agents.yml restart agents

# Railway
railway restart
```

## Troubleshooting

### Agent won't start

1. Check RabbitMQ connection:
```bash
# Test connection
npm install -g amqp-connection-manager
node -e "require('amqp-connection-manager').connect('$CLOUDAMQP_URL').on('connect', () => console.log('Connected!'))"
```

2. Check Redis connection:
```bash
# Test connection
redis-cli -u $REDIS_URL ping
```

### High memory usage

1. Check for memory leaks:
```bash
# View heap snapshot
kill -USR2 <pid>
```

2. Adjust task limits:
```bash
AGENT_MAX_TASKS=5 npm start
```

### Message processing failures

1. Check dead letter queue:
```bash
# RabbitMQ Management UI
# Queues > brandpillar.agents.dlq
```

2. Retry failed messages:
```bash
# Move messages back to main queue
# Use RabbitMQ Management UI
```

## Security Considerations

1. **Network Security**:
   - Use TLS for all connections
   - Restrict Redis/RabbitMQ access by IP
   - Enable authentication on all services

2. **API Keys**:
   - Rotate keys regularly
   - Use Railway's secret management
   - Never commit keys to repository

3. **Data Protection**:
   - Encrypt sensitive data in Redis
   - Set TTL on cached data
   - Regular backups of state

## Performance Tuning

### RabbitMQ Optimization
```javascript
// Adjust prefetch for throughput
prefetchCount: 10, // Increase for better throughput

// Connection pooling
connectionOptions: {
  heartbeatIntervalInSeconds: 60,
  reconnectTimeInSeconds: 5
}
```

### Redis Optimization
```javascript
// Use pipelining for batch operations
const pipeline = redis.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
await pipeline.exec();
```

### Agent Optimization
```javascript
// Increase concurrent tasks for I/O bound work
maxConcurrentTasks: 20,

// Decrease for CPU bound work
maxConcurrentTasks: 5
```

## Costs Estimation

### Development/Testing
- **Total**: $0/month (all local)

### Production (Minimal)
- **Railway**: $5-20/month
- **CloudAMQP**: $0 (free tier)
- **Redis Cloud**: $0 (free tier)
- **Total**: $5-20/month

### Production (Scaled)
- **Railway**: $20-50/month (multiple instances)
- **CloudAMQP**: $19/month (Tough Tiger)
- **Redis Cloud**: $15/month (250MB)
- **Monitoring**: $10/month (Grafana Cloud)
- **Total**: $64-94/month

## Next Steps

1. **Complete remaining agents**:
   - Content Generator Agent
   - Quality Control Agent
   - Publisher Agent
   - Learning Agent

2. **Add agent-specific features**:
   - Voice profile integration
   - Content template system
   - Platform-specific formatters
   - ML model integration

3. **Production hardening**:
   - Kubernetes deployment option
   - Auto-scaling policies
   - Disaster recovery plan
   - Performance benchmarks

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/personal-brand-dna/issues
- Documentation: See AI_AGENTS_ARCHITECTURE_DESIGN.md
- Logs: Check Railway logs or local Docker logs