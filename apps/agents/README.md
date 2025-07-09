# BrandPillar AI Agents

## Overview

The AI Agents system implements a distributed agent architecture for autonomous content generation and management. This system uses a message bus pattern for inter-agent communication and can scale horizontally.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                        │
│                 (Coordinates all agents)                     │
└──────────────────────┬─────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │      RabbitMQ Message Bus   │
        └──────────────┬──────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼────────┐ ┌──────▼───────┐ ┌────────▼──────┐
│   News     │ │   Content    │ │   Quality     │
│  Monitor   │ │  Generator   │ │   Control     │
│   Agent    │ │    Agent     │ │    Agent      │
└────────────┘ └──────────────┘ └───────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm 9+

### Local Development

1. **Install dependencies**:
```bash
npm install
```

2. **Start infrastructure**:
```bash
docker-compose -f docker-compose.agents.yml up -d
```

3. **Build packages**:
```bash
npm run build:shared
npm run build:queue
npm run build:agents
```

4. **Start agents**:
```bash
npm run agents:dev
```

5. **Check health**:
```bash
curl http://localhost:3003/health
```

### Access Points
- **RabbitMQ Management**: http://localhost:15672 (brandpillar/secret)
- **Redis CLI**: `docker exec -it brandpillar-redis redis-cli -a secret`
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (admin/secret)
- **Agent Health**: http://localhost:3003/health

## Production Deployment

### 1. Setup Cloud Services

Run the setup script to get started:
```bash
npm run setup:agents
```

This will guide you through setting up:
- CloudAMQP (free tier)
- Redis Cloud (free tier)
- Railway.app account

### 2. Configure Environment

Add your cloud service URLs to `.env`:
```env
CLOUDAMQP_URL=amqp://user:pass@host.cloudamqp.com/vhost
REDIS_URL=redis://default:password@host.redis.com:6379
```

### 3. Deploy to Railway

```bash
npm run deploy:agents
```

Or manually:
```bash
railway init
railway variables set CLOUDAMQP_URL="..."
railway variables set REDIS_URL="..."
railway up
```

## Agent Types

### 1. Orchestrator Agent
- Coordinates all other agents
- Manages task distribution
- Monitors agent health
- Handles failover

### 2. News Monitor Agent (Implemented)
- Scans RSS feeds for relevant content
- Scores opportunities by relevance
- Generates content ideas
- Triggers content generation

### 3. Content Generator Agent (Pending)
- Creates voice-matched content
- Multiple angle generation
- Humanization layer
- A/B variation creation

### 4. Quality Control Agent (Pending)
- Grammar and quality checks
- Risk assessment
- Fact verification
- Compliance validation

### 5. Publisher Agent (Pending)
- Optimal time scheduling
- Platform formatting
- Performance tracking
- Cross-platform distribution

### 6. Learning Agent (Pending)
- Performance analysis
- Model optimization
- Insight generation
- System improvement

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:3003/health

# Readiness check
curl http://localhost:3003/health/ready

# Detailed metrics
curl http://localhost:3003/metrics
```

### Grafana Dashboards

1. **Agent Overview**: System health, task throughput
2. **Task Performance**: Processing times, success rates
3. **Resource Usage**: CPU, memory, network
4. **Error Tracking**: Failed tasks, error types

### Logs

```bash
# Local logs
npm run agents:logs

# Railway logs
railway logs -f
```

## Development

### Project Structure

```
apps/agents/
├── src/
│   ├── agents/          # Agent implementations
│   ├── core/           # Base classes and utilities
│   ├── services/       # Shared services
│   └── index.ts        # Entry point
├── tests/              # Test files
└── Dockerfile          # Production container
```

### Adding a New Agent

1. Create agent class extending `BaseAgent`:
```typescript
export class MyAgent extends BaseAgent {
  constructor() {
    super('my-agent', 'My Agent');
  }

  protected async processTask(task: AgentTask): Promise<any> {
    // Implementation
  }
}
```

2. Register in `OrchestratorAgent`:
```typescript
this.registerAgent(new MyAgent());
```

3. Add message handlers as needed

### Testing

```bash
# Run tests
npm test

# Run specific test
npm test -- NewsMonitorAgent
```

## Troubleshooting

### Agent won't start
- Check RabbitMQ connection: `docker logs brandpillar-rabbitmq`
- Check Redis connection: `docker exec -it brandpillar-redis redis-cli -a secret ping`
- Check environment variables: `npm run setup:agents`

### High memory usage
- Adjust `AGENT_MAX_TASKS` environment variable
- Check for memory leaks in agent implementations
- Monitor with Grafana dashboards

### Messages not processing
- Check RabbitMQ Management UI for queue status
- Look for messages in dead letter queue
- Check agent logs for errors

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLOUDAMQP_URL` | RabbitMQ connection URL | Required |
| `REDIS_URL` | Redis connection URL | Required |
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_SERVICE_KEY` | Supabase service key | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `NODE_ENV` | Environment mode | development |
| `LOG_LEVEL` | Log verbosity | info |
| `PORT` | Health server port | 3000 |
| `AGENT_MAX_TASKS` | Max concurrent tasks | 10 |

## Costs

### Development
- **Total**: $0/month (all local)

### Production (Minimal)
- **Railway**: $5-20/month
- **CloudAMQP**: $0 (free tier)
- **Redis Cloud**: $0 (free tier)
- **Total**: $5-20/month

### Production (Scaled)
- **Railway**: $20-50/month
- **CloudAMQP**: $19/month
- **Redis Cloud**: $15/month
- **Total**: $54-84/month

## Support

- Documentation: `AI_AGENTS_ARCHITECTURE_DESIGN.md`
- Deployment Guide: `AI_AGENTS_DEPLOYMENT_GUIDE.md`
- Issues: Create GitHub issue with `ai-agents` label