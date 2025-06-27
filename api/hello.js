// Simple hello world endpoint for Vercel
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Hello from Personal Brand DNA API!',
    timestamp: new Date().toISOString(),
    success: true
  });
}