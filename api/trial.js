// BrandPillar AI Trial Management API
const jwt = require('jsonwebtoken');

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    return null;
  }
};

// Helper to create trial end date (7 days from now)
const getTrialEndDate = () => {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);
  return trialEnd.toISOString();
};

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        // Start a new trial
        if (req.url === '/api/trial/start') {
          const { tier } = req.body;
          
          if (!tier || !['starter', 'professional', 'executive'].includes(tier)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid tier specified'
            });
          }

          // In production, this would update the database
          // For now, we'll return mock data
          const trialData = {
            userId: decoded.userId,
            tier: tier,
            isTrialActive: true,
            trialStartedAt: new Date().toISOString(),
            trialEndsAt: getTrialEndDate(),
            features: {
              starter: {
                postsPerWeek: 3,
                newsSources: 5,
                brandHouseAccess: true,
                approvalWindow: '24 hours'
              },
              professional: {
                postsPerWeek: 5,
                articlesPerMonth: 1,
                newsSources: 25,
                trendDetection: true,
                customSchedule: true,
                analyticsAccess: true
              },
              executive: {
                postsPerDay: 1,
                articlesPerMonth: 2,
                newsSources: 'unlimited',
                successManager: true,
                apiAccess: true,
                whiteGloveOnboarding: true
              }
            }[tier]
          };

          return res.status(200).json({
            success: true,
            data: trialData,
            message: `Started 7-day free trial for ${tier} plan`
          });
        }

        // Check trial status
        if (req.url === '/api/trial/status') {
          // In production, fetch from database
          // Mock response for now
          const mockStatus = {
            isTrialActive: true,
            trialEndsAt: getTrialEndDate(),
            currentTier: 'professional',
            daysRemaining: 5,
            postsUsedThisWeek: 2,
            postsAllowedThisWeek: 5
          };

          return res.status(200).json({
            success: true,
            data: mockStatus
          });
        }

        // End trial early
        if (req.url === '/api/trial/end') {
          return res.status(200).json({
            success: true,
            message: 'Trial ended successfully'
          });
        }

        // Convert trial to paid subscription
        if (req.url === '/api/trial/convert') {
          const { paymentMethodId, billingCycle } = req.body;
          
          // In production, this would integrate with Stripe
          // Mock response for now
          return res.status(200).json({
            success: true,
            data: {
              subscriptionId: 'sub_' + Math.random().toString(36).substr(2, 9),
              status: 'active',
              currentTier: req.body.tier || 'professional',
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              amount: {
                starter: billingCycle === 'yearly' ? 374 : 39,
                professional: billingCycle === 'yearly' ? 758 : 79,
                executive: billingCycle === 'yearly' ? 1430 : 149
              }[req.body.tier || 'professional']
            },
            message: 'Successfully converted to paid subscription'
          });
        }

        break;

      case 'GET':
        // Get trial information
        if (req.url === '/api/trial/info') {
          return res.status(200).json({
            success: true,
            data: {
              tiers: [
                {
                  id: 'starter',
                  name: 'Starter',
                  price: { monthly: 39, yearly: 374 },
                  features: [
                    '7-day free trial',
                    '3 posts per week',
                    '5 news sources',
                    'Brand House assessment',
                    '24-hour approval window'
                  ]
                },
                {
                  id: 'professional',
                  name: 'Professional',
                  price: { monthly: 79, yearly: 758 },
                  features: [
                    '7-day free trial',
                    '5 posts per week + 1 article/month',
                    '25 news sources',
                    'Trend detection',
                    'Custom scheduling',
                    'Analytics dashboard'
                  ],
                  recommended: true
                },
                {
                  id: 'executive',
                  name: 'Executive',
                  price: { monthly: 149, yearly: 1430 },
                  features: [
                    '7-day free trial',
                    'Daily posts + 2 articles/month',
                    'Unlimited news sources',
                    'Success manager',
                    'API access',
                    'White-glove onboarding'
                  ]
                }
              ]
            }
          });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        });
    }
  } catch (error) {
    console.error('Trial API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};