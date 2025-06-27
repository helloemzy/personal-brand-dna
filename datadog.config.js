// DataDog APM and Monitoring Configuration
const tracer = require('dd-trace');

// Initialize DataDog APM
if (process.env.DD_API_KEY && process.env.NODE_ENV === 'production') {
  tracer.init({
    // Service name
    service: 'personal-brand-dna',
    
    // Environment
    env: process.env.NODE_ENV || 'development',
    
    // Version tracking
    version: process.env.npm_package_version || '1.0.0',
    
    // APM configuration
    analytics: true,
    
    // Log injection
    logInjection: true,
    
    // Runtime metrics
    runtimeMetrics: true,
    
    // Profiling
    profiling: true,
    
    // Tags for all traces
    tags: {
      'service.team': 'platform',
      'service.tier': 'api',
      'deployment.environment': process.env.VERCEL_ENV || 'local',
    },
    
    // Sampling rules
    sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Service mapping
    serviceMapping: {
      'postgres': 'personal-brand-dna-db',
      'redis': 'personal-brand-dna-cache',
    },
  });
}

// Custom metrics client
const StatsD = require('node-statsd');
const metrics = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'personal_brand_dna.',
  globalTags: {
    env: process.env.NODE_ENV || 'development',
    service: 'api',
  },
});

// Business metrics tracking
class BusinessMetrics {
  // User engagement metrics
  static trackUserAction(action, userId, metadata = {}) {
    metrics.increment(`user.action.${action}`, 1, {
      user_id: userId,
      ...metadata,
    });
  }
  
  // Content generation metrics
  static trackContentGeneration(contentType, duration, success) {
    metrics.histogram('content.generation.duration', duration, {
      content_type: contentType,
      success: success.toString(),
    });
    
    if (success) {
      metrics.increment('content.generation.success', 1, { content_type: contentType });
    } else {
      metrics.increment('content.generation.failure', 1, { content_type: contentType });
    }
  }
  
  // Voice analysis metrics
  static trackVoiceAnalysis(duration, wordCount, success) {
    metrics.histogram('voice.analysis.duration', duration);
    metrics.histogram('voice.analysis.word_count', wordCount);
    
    if (success) {
      metrics.increment('voice.analysis.success');
    } else {
      metrics.increment('voice.analysis.failure');
    }
  }
  
  // LinkedIn metrics
  static trackLinkedInPost(status, queueSize) {
    metrics.increment(`linkedin.post.${status}`);
    metrics.gauge('linkedin.queue.size', queueSize);
  }
  
  // Workshop metrics
  static trackWorkshopProgress(step, completed) {
    metrics.increment(`workshop.step.${step}.${completed ? 'completed' : 'started'}`);
  }
  
  // Revenue metrics
  static trackSubscription(action, tier, amount) {
    metrics.increment(`subscription.${action}`, 1, { tier });
    
    if (action === 'created' || action === 'upgraded') {
      metrics.gauge('revenue.mrr', amount, { tier });
    }
  }
  
  // API performance metrics
  static trackApiLatency(endpoint, method, duration, statusCode) {
    metrics.histogram('api.latency', duration, {
      endpoint,
      method,
      status_code: statusCode.toString(),
      status_category: statusCode < 400 ? 'success' : statusCode < 500 ? 'client_error' : 'server_error',
    });
  }
  
  // Database performance
  static trackDatabaseQuery(operation, table, duration, success) {
    metrics.histogram('database.query.duration', duration, {
      operation,
      table,
      success: success.toString(),
    });
  }
  
  // Cache performance
  static trackCacheOperation(operation, hit, duration) {
    metrics.histogram('cache.operation.duration', duration, {
      operation,
      hit: hit.toString(),
    });
    
    if (operation === 'get') {
      metrics.increment(`cache.${hit ? 'hit' : 'miss'}`);
    }
  }
  
  // News relevance metrics
  static trackNewsRelevance(sourceId, relevanceScore, processed) {
    metrics.histogram('news.relevance.score', relevanceScore, {
      source_id: sourceId,
    });
    
    if (processed) {
      metrics.increment('news.articles.processed');
    }
  }
  
  // System health metrics
  static reportHealthMetrics() {
    const usage = process.memoryUsage();
    
    metrics.gauge('system.memory.heap_used', usage.heapUsed);
    metrics.gauge('system.memory.heap_total', usage.heapTotal);
    metrics.gauge('system.memory.rss', usage.rss);
    metrics.gauge('system.memory.external', usage.external);
    
    metrics.gauge('system.uptime', process.uptime());
    
    if (process.cpuUsage) {
      const cpu = process.cpuUsage();
      metrics.gauge('system.cpu.user', cpu.user);
      metrics.gauge('system.cpu.system', cpu.system);
    }
  }
}

// Middleware for Express/API routes
const datadogMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    // Track API metrics
    BusinessMetrics.trackApiLatency(
      req.path,
      req.method,
      duration,
      res.statusCode
    );
    
    // Track specific business events
    if (req.path.includes('/api/content/generate') && res.statusCode === 200) {
      metrics.increment('business.content_generated');
    } else if (req.path.includes('/api/auth/register') && res.statusCode === 201) {
      metrics.increment('business.user_registered');
    } else if (req.path.includes('/api/workshop/complete') && res.statusCode === 200) {
      metrics.increment('business.workshop_completed');
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Log integration
const winston = require('winston');
const { datadog } = require('winston-datadog');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Add DataDog transport in production
if (process.env.DD_API_KEY && process.env.NODE_ENV === 'production') {
  logger.add(
    new datadog({
      apiKey: process.env.DD_API_KEY,
      hostname: process.env.HOSTNAME || 'vercel',
      service: 'personal-brand-dna',
      ddsource: 'nodejs',
      tags: [`env:${process.env.NODE_ENV}`, 'service:api'],
    })
  );
}

// Health check endpoint data for DataDog
const getHealthCheckData = () => ({
  service: 'personal-brand-dna',
  version: process.env.npm_package_version || '1.0.0',
  status: 'healthy',
  timestamp: new Date().toISOString(),
  checks: {
    database: 'healthy', // Should be actual check
    redis: 'healthy', // Should be actual check
    external_apis: 'healthy', // Should be actual check
  },
  metrics: {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeRequests: process._getActiveRequests?.().length || 0,
    activeHandles: process._getActiveHandles?.().length || 0,
  },
});

// Start periodic health reporting
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    BusinessMetrics.reportHealthMetrics();
  }, 60000); // Every minute
}

module.exports = {
  tracer,
  metrics,
  BusinessMetrics,
  datadogMiddleware,
  logger,
  getHealthCheckData,
};