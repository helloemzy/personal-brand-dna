# AI Agents - Local Development Status

## ✅ Services Running

### RabbitMQ (Message Queue)
- **Status**: ✅ Running and healthy
- **Management UI**: http://localhost:15672
- **Credentials**: brandpillar / secret
- **AMQP Port**: 5672
- **Connection URL**: `amqp://brandpillar:secret@localhost:5672`

### Redis (State Management)
- **Status**: ✅ Running and healthy
- **Port**: 6380 (custom to avoid conflicts)
- **Password**: secret
- **Connection URL**: `redis://:secret@localhost:6380`
- **CLI Access**: `docker exec -it brandpillar-redis-local redis-cli -a secret`

## 🚀 Next Steps

### 1. Build the AI Agents
```bash
npm run build:agents
```

### 2. Start the Agents
```bash
npm run agents:dev
```

Or use the all-in-one script:
```bash
npm run start:local-agents
```

### 3. Access Health Endpoint
```bash
curl http://localhost:3003/health
```

## ⚠️ Required Keys

Before running the agents, you need to add these to your `.env` file:
- `SUPABASE_SERVICE_KEY` - Get from Supabase dashboard
- `OPENAI_API_KEY` - Get from OpenAI platform

## 📊 Monitoring

### Prometheus
- Will be available at: http://localhost:9090
- Configured to scrape agent metrics

### Grafana
- Will be available at: http://localhost:3002
- Credentials: admin / secret
- Pre-configured dashboards for agent monitoring

## 🔧 Useful Commands

```bash
# View all containers
docker ps --filter "name=brandpillar"

# View agent logs
npm run agents:logs

# Stop all services
docker-compose -f docker-compose.local.yml down

# Reset everything
docker-compose -f docker-compose.local.yml down -v
```

## 💡 Tips

1. **Port Conflicts**: If you have port conflicts, edit `docker-compose.local.yml` to change ports
2. **Memory Usage**: Docker Desktop should have at least 4GB RAM allocated
3. **Development**: The agents will auto-reload on code changes in dev mode

## 🏗️ Current Agent Status

- **Orchestrator Agent**: ✅ Ready to deploy
- **News Monitor Agent**: ✅ Ready to deploy
- **Content Generator Agent**: 🚧 Week 5-6 (In progress)
- **Quality Control Agent**: 🚧 Week 7 (In progress)
- **Publisher Agent**: 📅 Week 8 (Planned)
- **Learning Agent**: 📅 Week 9 (Planned)