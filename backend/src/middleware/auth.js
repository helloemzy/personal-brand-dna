const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'pbdna-api',
    audience: 'pbdna-frontend'
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: 'pbdna-api',
    audience: 'pbdna-frontend'
  });
};

// Verify JWT token
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  return jwt.verify(token, secret, {
    issuer: 'pbdna-api',
    audience: 'pbdna-frontend'
  });
};

// Extract token from request
const extractToken = (req) => {
  let token = null;

  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  
  // Check cookies (for web app)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  return token;
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from request
    const token = extractToken(req);

    if (!token) {
      return next(new AppError('Access token required', 401));
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Token expired', 401));
      } else if (error.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token', 401));
      } else {
        return next(new AppError('Token verification failed', 401));
      }
    }

    // Check if token exists in sessions table (for logout functionality)
    const sessionResult = await query(
      'SELECT * FROM user_sessions WHERE user_id = $1 AND token_hash = $2 AND is_active = true AND expires_at > NOW()',
      [decoded.userId, require('crypto').createHash('sha256').update(token).digest('hex')]
    );

    if (sessionResult.rows.length === 0) {
      return next(new AppError('Session expired or invalid', 401));
    }

    // Get user details
    const userResult = await query(
      'SELECT id, email, first_name, last_name, industry, role, subscription_tier, subscription_status, is_verified FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return next(new AppError('User not found', 401));
    }

    const user = userResult.rows[0];

    // Check if user account is active
    if (user.subscription_status === 'suspended') {
      return next(new AppError('Account suspended', 403));
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    req.sessionId = sessionResult.rows[0].id;

    // Log successful authentication for audit
    logger.debug(`User authenticated: ${user.email}`, {
      userId: user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      
      const userResult = await query(
        'SELECT id, email, first_name, last_name, industry, role, subscription_tier, subscription_status, is_verified FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Don't fail for optional auth, just continue without user
    next();
  }
};

// Authorization middleware - check subscription tier
const requireSubscription = (minTier = 'free') => {
  const tierHierarchy = {
    'free': 0,
    'professional': 1,
    'executive': 2,
    'enterprise': 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userTier = req.user.subscription_tier || 'free';
    const requiredTierLevel = tierHierarchy[minTier] || 0;
    const userTierLevel = tierHierarchy[userTier] || 0;

    if (userTierLevel < requiredTierLevel) {
      return next(new AppError(`${minTier} subscription required`, 403));
    }

    next();
  };
};

// Admin authorization middleware
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (you might store this differently)
    const adminResult = await query(
      'SELECT * FROM users WHERE id = $1 AND (email = ANY($2) OR role = $3)',
      [req.user.id, process.env.ADMIN_EMAILS?.split(',') || [], 'admin']
    );

    if (adminResult.rows.length === 0) {
      logger.logSecurityEvent('unauthorized_admin_access', {
        userId: req.user.id,
        email: req.user.email,
        endpoint: req.originalUrl
      }, req);
      
      return next(new AppError('Admin access required', 403));
    }

    next();
  } catch (error) {
    logger.error('Admin authorization error:', error);
    next(new AppError('Authorization failed', 500));
  }
};

// Email verification middleware
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (!req.user.is_verified) {
    return next(new AppError('Email verification required', 403));
  }

  next();
};

// Active subscription middleware
const requireActiveSubscription = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (req.user.subscription_status !== 'active') {
    return next(new AppError('Active subscription required', 403));
  }

  next();
};

// Create user session
const createSession = async (userId, token, req) => {
  const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

  await query(
    'INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
    [userId, tokenHash, expiresAt, req.ip, req.get('User-Agent')]
  );
};

// Invalidate user session
const invalidateSession = async (userId, token) => {
  const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
  
  await query(
    'UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND token_hash = $2',
    [userId, tokenHash]
  );
};

// Invalidate all user sessions
const invalidateAllSessions = async (userId) => {
  await query(
    'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
    [userId]
  );
};

// Clean expired sessions
const cleanExpiredSessions = async () => {
  await query(
    'DELETE FROM user_sessions WHERE expires_at < NOW() OR is_active = false'
  );
};

// Schedule session cleanup (run daily)
setInterval(cleanExpiredSessions, 24 * 60 * 60 * 1000);

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticate,
  optionalAuth,
  requireSubscription,
  requireAdmin,
  requireVerifiedEmail,
  requireActiveSubscription,
  createSession,
  invalidateSession,
  invalidateAllSessions,
  cleanExpiredSessions
};