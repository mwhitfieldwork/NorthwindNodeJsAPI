const jwt = require('jsonwebtoken');
const { models } = require('../config/database');
const logger = require('../utils/logger');

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const user = await models.User.findByPk(decoded.id, {
      attributes: ['PKID', 'UserName', 'admin']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await models.User.findByPk(decoded.id, {
        attributes: ['PKID', 'UserName', 'admin']
      });
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Admin role middleware (use after authenticateToken)
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.admin !== 1) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

// Self or admin middleware (user can access own data or admin can access any)
const selfOrAdmin = (req, res, next) => {
  const requestedUserId = parseInt(req.params.id);
  
  if (req.user.PKID === requestedUserId || req.user.admin === 1) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  selfOrAdmin
};