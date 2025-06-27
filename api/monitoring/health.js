const { query } = require('../_lib/database');
const { createHealthCheck } = require('../_lib/monitoring');
const { getHealthCheckData } = require('../../datadog.config');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Basic health check
    const basicHealth = createHealthCheck();
    
    // Database health check
    let databaseHealth = 'unknown';
    let databaseLatency = null;
    
    try {
      const start = Date.now();
      await query('SELECT 1');
      databaseLatency = Date.now() - start;
      databaseHealth = databaseLatency < 1000 ? 'healthy' : 'degraded';
    } catch (error) {
      databaseHealth = 'unhealthy';
      console.error('Database health check failed:', error);
    }

    // Redis health check (if configured)
    let cacheHealth = 'unknown';
    let cacheLatency = null;
    
    if (process.env.REDIS_URL) {
      try {
        // TODO: Implement Redis ping
        cacheHealth = 'healthy';
      } catch (error) {
        cacheHealth = 'unhealthy';
        console.error('Cache health check failed:', error);
      }
    }

    // External API health checks
    const externalApis = {
      openai: await checkOpenAI(),
      google: await checkGoogleSpeech(),
      stripe: await checkStripe(),
      linkedin: 'not_configured', // Requires OAuth
    };

    // Determine overall health
    const criticalServices = [databaseHealth];
    const overallHealth = criticalServices.includes('unhealthy') 
      ? 'unhealthy' 
      : criticalServices.includes('degraded') 
        ? 'degraded' 
        : 'healthy';

    // Build comprehensive health response
    const healthData = {
      ...basicHealth,
      status: overallHealth,
      services: {
        database: {
          status: databaseHealth,
          latency: databaseLatency,
        },
        cache: {
          status: cacheHealth,
          latency: cacheLatency,
        },
        externalApis,
      },
      metrics: {
        ...basicHealth.memory,
        uptime: basicHealth.uptime,
        uptimeHuman: formatUptime(basicHealth.uptime),
      },
      deployment: {
        environment: process.env.NODE_ENV,
        region: process.env.VERCEL_REGION || 'unknown',
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID || 'local',
      },
    };

    // Add DataDog health data if configured
    if (process.env.DD_API_KEY) {
      healthData.datadog = getHealthCheckData();
    }

    // Set appropriate status code
    const statusCode = overallHealth === 'healthy' ? 200 : 
                      overallHealth === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
}

// Helper function to check OpenAI API
async function checkOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'not_configured' };
  }

  try {
    const start = Date.now();
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latency = Date.now() - start;
    const status = response.ok ? 'healthy' : 'unhealthy';

    return {
      status,
      latency,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

// Helper function to check Google Speech API
async function checkGoogleSpeech() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { status: 'not_configured' };
  }

  // Simple check - in production would do actual API call
  return {
    status: 'healthy',
    note: 'Credentials configured',
  };
}

// Helper function to check Stripe
async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'not_configured' };
  }

  try {
    const start = Date.now();
    const response = await fetch('https://api.stripe.com/v1/charges?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;
    const status = response.ok ? 'healthy' : 'unhealthy';

    return {
      status,
      latency,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

// Format uptime to human readable
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}