const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./database');
const { AppError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
};

const createSession = async (userId, deviceInfo = null) => {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const refreshToken = generateRefreshToken({ userId, sessionId });
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await query(
    `INSERT INTO user_sessions (id, user_id, refresh_token, expires_at, device_info, created_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       device_info = EXCLUDED.device_info,
       updated_at = CURRENT_TIMESTAMP`,
    [sessionId, userId, refreshToken, expiresAt, deviceInfo]
  );

  return { sessionId, refreshToken };
};

const invalidateSession = async (sessionId) => {
  await query(
    'DELETE FROM user_sessions WHERE id = $1',
    [sessionId]
  );
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Get user details from database
    const userResult = await query(
      'SELECT id, email, first_name, last_name, email_verified, subscription_tier, status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];
    
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

const requireEmailVerification = (req, res, next) => {
  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  createSession,
  invalidateSession,
  authenticate,
  requireEmailVerification,
};