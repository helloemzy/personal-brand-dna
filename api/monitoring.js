// Consolidated monitoring API router
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Route handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'health':
        return await handleHealthCheck(req, res);
      case 'error':
        return await handleErrorLogging(req, res);
      default:
        return res.status(404).json({ error: 'Invalid monitoring action' });
    }
  } catch (error) {
    console.error('Monitoring error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Health check handler
async function handleHealthCheck(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: 'operational',
      database: 'unknown',
      redis: 'unknown',
    },
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
  };

  try {
    // Check database connection
    const { error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    health.services.database = dbError ? 'error' : 'operational';

    // Overall health status
    const hasErrors = Object.values(health.services).some(status => status === 'error');
    health.status = hasErrors ? 'degraded' : 'healthy';

    return res.status(200).json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    return res.status(503).json(health);
  }
}

// Error logging handler
async function handleErrorLogging(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { error, context, severity = 'error', userId } = req.body;

  if (!error) {
    return res.status(400).json({ error: 'Error details are required' });
  }

  try {
    // Log to console (in production, send to monitoring service)
    console.error(`[${severity.toUpperCase()}]`, {
      error,
      context,
      userId,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    // In production, you would send this to a service like Sentry
    // await sentry.captureException(error, { level: severity, user: { id: userId }, extra: context });

    return res.status(200).json({ message: 'Error logged successfully' });
  } catch (logError) {
    console.error('Failed to log error:', logError);
    return res.status(500).json({ error: 'Failed to log error' });
  }
}