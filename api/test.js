export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'Personal Brand DNA API is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasRedis: !!process.env.REDIS_URL,
      hasOpenAI: !!process.env.OPENAI_API_KEY
    }
  });
}