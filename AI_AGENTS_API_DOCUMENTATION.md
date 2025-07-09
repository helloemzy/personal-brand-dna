# AI Agents API Documentation

## 📖 Overview

The BrandPillar AI Agents system provides a distributed, event-driven architecture for automated content creation and publishing. This document details the internal APIs, message formats, and integration points.

## 🔌 Service Endpoints

### Base URL
```
Production: https://agents.brandpillar.ai
Staging: https://agents-staging.brandpillar.ai
Local: http://localhost:3001
```

### Health & Monitoring

#### GET /health
Overall system health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-09T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "agents": {
    "orchestrator": "healthy",
    "newsMonitor": "healthy",
    "contentGenerator": "healthy",
    "qualityControl": "healthy",
    "publisher": "healthy",
    "learning": "healthy"
  }
}
```

#### GET /health/{agentName}
Individual agent health check.

**Parameters:**
- `agentName`: One of `orchestrator`, `news-monitor`, `content-generator`, `quality-control`, `publisher`, `learning`

**Response:**
```json
{
  "agent": "content-generator",
  "status": "healthy",
  "lastActivity": "2025-01-09T10:29:45Z",
  "metrics": {
    "processed": 1234,
    "failed": 2,
    "avgProcessingTime": 3.45
  }
}
```

#### GET /health/dependencies
External dependencies status.

**Response:**
```json
{
  "rabbitmq": {
    "connected": true,
    "version": "3.12.0",
    "queues": 6
  },
  "redis": {
    "connected": true,
    "version": "7.0.5",
    "memory": "45MB/100MB"
  },
  "database": {
    "connected": true,
    "latency": 12
  },
  "openai": {
    "available": true,
    "rateLimit": "2500/3000"
  }
}
```

#### GET /metrics
Prometheus-compatible metrics endpoint.

**Response:** Plain text Prometheus format
```
# HELP agents_messages_processed_total Total number of messages processed
# TYPE agents_messages_processed_total counter
agents_messages_processed_total{agent="content-generator",status="success"} 1234
agents_messages_processed_total{agent="content-generator",status="failure"} 12

# HELP agents_processing_duration_seconds Message processing duration
# TYPE agents_processing_duration_seconds histogram
agents_processing_duration_seconds_bucket{agent="content-generator",le="1"} 850
agents_processing_duration_seconds_bucket{agent="content-generator",le="5"} 1200
```

## 📨 Message Bus Events

All agents communicate via RabbitMQ using the following message format:

### Base Message Structure
```typescript
interface AgentMessage {
  type: string;           // Event type
  agentId: string;        // Originating agent
  timestamp: Date;        // Event timestamp
  correlationId?: string; // Workflow tracking ID
  data: any;             // Event-specific payload
  metadata?: {
    retry?: number;
    priority?: 'low' | 'normal' | 'high';
    ttl?: number;
  };
}
```

### Event Types and Channels

#### News Discovery Events

**Channel:** `news:discovered`
```typescript
{
  type: "news:discovered",
  agentId: "news-monitor",
  timestamp: "2025-01-09T10:30:00Z",
  data: {
    news: {
      title: "AI Breakthrough in Healthcare",
      description: "New model achieves 95% accuracy...",
      link: "https://example.com/article",
      pubDate: "2025-01-09T09:00:00Z",
      source: "TechNews Daily",
      categories: ["AI", "Healthcare"]
    },
    userId: "user-123",
    relevanceScore: 0.92,
    suggestedPillars: ["Digital Innovation"]
  }
}
```

**Channel:** `news:batch:discovered`
```typescript
{
  type: "news:batch:discovered",
  agentId: "news-monitor",
  timestamp: "2025-01-09T10:30:00Z",
  data: {
    userId: "user-123",
    items: [
      {
        news: { /* news item */ },
        relevanceScore: 0.92
      }
      // ... more items
    ]
  }
}
```

#### Content Generation Events

**Channel:** `content:generate`
```typescript
{
  type: "content:requested",
  agentId: "orchestrator",
  timestamp: "2025-01-09T10:30:00Z",
  correlationId: "workflow-123",
  data: {
    userId: "user-123",
    sourceType: "news" | "idea" | "manual",
    sourceContent: {
      // For news
      title: "Article Title",
      description: "Article description",
      link: "https://..."
      
      // For idea
      title: "Content Idea",
      description: "Idea description",
      pillar: "Leadership Excellence"
      
      // For manual
      prompt: "Write about..."
    },
    angle?: "thought-leader" | "educator" | "storyteller" | "contrarian",
    pillar?: "Digital Innovation",
    variations?: 3,
    options?: {
      tone?: "professional" | "casual" | "inspirational",
      length?: "short" | "medium" | "long",
      includeHashtags?: boolean,
      includeCTA?: boolean
    }
  }
}
```

**Channel:** `content:generated`
```typescript
{
  type: "content:generated",
  agentId: "content-generator",
  timestamp: "2025-01-09T10:31:00Z",
  correlationId: "workflow-123",
  data: {
    content: {
      text: "Generated LinkedIn post content...",
      variations?: [
        { text: "Variation 1...", focus: "expertise" },
        { text: "Variation 2...", focus: "experience" }
      ],
      metadata: {
        userId: "user-123",
        sourceType: "news",
        pillar: "Digital Innovation",
        angle: "thought-leader",
        generatedAt: "2025-01-09T10:31:00Z",
        voiceMatchScore: 0.92,
        estimatedEngagement: 0.78
      },
      hashtags?: ["#Innovation", "#Leadership"],
      cta?: "What's your take on this?"
    },
    processingTime: 3.45
  }
}
```

#### Quality Control Events

**Channel:** `quality:check`
```typescript
{
  type: "quality:check:requested",
  agentId: "content-generator",
  timestamp: "2025-01-09T10:31:00Z",
  correlationId: "workflow-123",
  data: {
    content: {
      text: "Content to check...",
      metadata: {
        userId: "user-123",
        pillar: "Digital Innovation",
        sourceType: "news"
      }
    },
    checks?: ["grammar", "safety", "plagiarism", "brand", "engagement"]
  }
}
```

**Channel:** `quality:check:completed`
```typescript
{
  type: "quality:check:completed",
  agentId: "quality-control",
  timestamp: "2025-01-09T10:31:30Z",
  correlationId: "workflow-123",
  data: {
    passed: true,
    scores: {
      grammar: 0.95,
      readability: 0.88,
      engagement: 0.82,
      brandAlignment: 0.90,
      safety: 0.99,
      originality: 0.94
    },
    overallScore: 0.91,
    issues: [],
    improvements: [
      "Consider adding a question to increase engagement",
      "Could benefit from a stronger opening hook"
    ],
    risks: {
      controversial: 0.1,
      misleading: 0.05,
      offensive: 0.01
    }
  }
}
```

#### Publishing Events

**Channel:** `content:publish`
```typescript
{
  type: "content:publish:requested",
  agentId: "orchestrator",
  timestamp: "2025-01-09T10:32:00Z",
  correlationId: "workflow-123",
  data: {
    content: {
      text: "Final content to publish...",
      hashtags: ["#Innovation"],
      media?: {
        type: "image",
        url: "https://..."
      }
    },
    platform: "linkedin",
    userId: "user-123",
    scheduling: {
      type: "immediate" | "scheduled" | "optimal",
      scheduledTime?: "2025-01-09T14:00:00Z"
    },
    options?: {
      notifyOnPublish: true,
      trackEngagement: true
    }
  }
}
```

**Channel:** `content:published`
```typescript
{
  type: "content:published",
  agentId: "publisher",
  timestamp: "2025-01-09T14:00:05Z",
  correlationId: "workflow-123",
  data: {
    platform: "linkedin",
    postId: "urn:li:share:123456",
    publishedAt: "2025-01-09T14:00:05Z",
    url: "https://www.linkedin.com/feed/update/...",
    userId: "user-123",
    metrics: {
      reachEstimate: 500,
      optimalTime: true
    }
  }
}
```

#### Learning Events

**Channel:** `learning:feedback`
```typescript
{
  type: "learning:performance:update",
  agentId: "learning",
  timestamp: "2025-01-09T15:00:00Z",
  data: {
    contentId: "content-123",
    userId: "user-123",
    performance: {
      views: 1250,
      likes: 45,
      comments: 12,
      shares: 8,
      engagementRate: 0.052
    },
    insights: {
      performanceLevel: "above-average",
      bestPerformingElements: ["opening-hook", "question-cta"],
      improvementAreas: ["hashtag-relevance"]
    }
  }
}
```

#### Workflow Events

**Channel:** `workflow:events`
```typescript
{
  type: "workflow:started",
  agentId: "orchestrator",
  timestamp: "2025-01-09T10:30:00Z",
  correlationId: "workflow-123",
  data: {
    userId: "user-123",
    trigger: "news-discovery",
    steps: ["content-generation", "quality-check", "publishing"]
  }
}
```

## 🧪 Test Endpoints

These endpoints are available in non-production environments for testing:

### POST /test/content-generation
Test content generation pipeline.

**Request:**
```json
{
  "userId": "test-user",
  "prompt": "Write about AI in healthcare",
  "pillar": "Digital Innovation"
}
```

**Response:**
```json
{
  "success": true,
  "content": {
    "text": "Generated test content...",
    "voiceMatchScore": 0.85
  },
  "processingTime": 3.2
}
```

### POST /test/workflow
Test complete workflow.

**Request:**
```json
{
  "userId": "test-user",
  "testType": "full-workflow" | "content-only" | "quality-only"
}
```

**Response:**
```json
{
  "workflowId": "test-workflow-123",
  "status": "started",
  "steps": ["content", "quality", "publish"]
}
```

### GET /test/workflow/{workflowId}
Check test workflow status.

**Response:**
```json
{
  "workflowId": "test-workflow-123",
  "status": "completed",
  "results": {
    "content": "success",
    "quality": "success",
    "publish": "success",
    "successRate": 1.0
  },
  "duration": 5.4
}
```

## 🔧 Configuration API

### GET /config
Get current configuration (sanitized).

**Response:**
```json
{
  "environment": "production",
  "version": "1.0.0",
  "features": {
    "contentGeneration": true,
    "qualityControl": true,
    "autoPublishing": true,
    "learning": true
  },
  "limits": {
    "maxConcurrentWorkflows": 50,
    "maxContentPerMinute": 100,
    "maxRetries": 3
  }
}
```

### POST /config/reload
Reload configuration (requires admin auth).

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration reloaded",
  "changes": ["rate-limits", "features"]
}
```

## 🔐 Authentication

For production access to test and configuration endpoints:

### Bearer Token Authentication
```
Authorization: Bearer <jwt-token>
```

### API Key Authentication
```
X-API-Key: <api-key>
```

## 📊 Rate Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| /health/* | 100/min | 1 minute |
| /metrics | 10/min | 1 minute |
| /test/* | 10/min | 1 minute |
| /config/* | 5/min | 1 minute |

## 🚨 Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "The requested agent does not exist",
    "details": {
      "agent": "invalid-agent"
    },
    "timestamp": "2025-01-09T10:30:00Z",
    "requestId": "req-123"
  }
}
```

### Common Error Codes
- `AGENT_NOT_FOUND`: Invalid agent name
- `AGENT_UNHEALTHY`: Agent is not operational
- `DEPENDENCY_ERROR`: External service error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_REQUEST`: Malformed request
- `INTERNAL_ERROR`: Server error

## 📚 SDK Examples

### Node.js
```javascript
const { MessageBus } = require('@brandpillar/queue');

const bus = new MessageBus({
  url: process.env.CLOUDAMQP_URL
});

// Subscribe to content generated events
await bus.subscribe('content:generated', async (message) => {
  console.log('New content:', message.data.content.text);
});

// Request content generation
await bus.publish('content:generate', {
  type: 'content:requested',
  agentId: 'my-service',
  timestamp: new Date(),
  data: {
    userId: 'user-123',
    sourceType: 'manual',
    prompt: 'Write about leadership'
  }
});
```

### Python
```python
import pika
import json
from datetime import datetime

# Connect to RabbitMQ
connection = pika.BlockingConnection(
    pika.URLParameters(os.environ['CLOUDAMQP_URL'])
)
channel = connection.channel()

# Publish message
message = {
    'type': 'content:requested',
    'agentId': 'python-client',
    'timestamp': datetime.utcnow().isoformat(),
    'data': {
        'userId': 'user-123',
        'sourceType': 'manual',
        'prompt': 'Write about innovation'
    }
}

channel.basic_publish(
    exchange='',
    routing_key='content:generate',
    body=json.dumps(message)
)
```

---

Last Updated: January 2025
Version: 1.0.0