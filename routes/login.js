console.log('🔍 ATTEMPTING TO LOAD LOGIN ROUTES');
const express = require('express');
console.log('✅ Express loaded');
const router = express.Router();
console.log('✅ Router created');
const jwt = require('jsonwebtoken');
console.log('✅ JWT loaded');
const bcrypt = require('bcryptjs');
console.log('✅ bcrypt loaded');
const { models } = require('../config/database');
console.log('✅ Models loaded');
const logger = require('../utils/logger');
console.log('✅ Logger loaded');
const { authenticateToken } = require('../middleware/auth');
console.log('✅ Auth middleware loaded');

/*
console.log('🔍 ATTEMPTING TO LOAD LOGIN ROUTES');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
*/

console.log('🔍 About to define Swagger schemas and functions'); // ADD THIS LINE

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         PKID:
 *           type: integer
 *           description: Primary key ID
 *         UserName:
 *           type: string
 *           format: email
 *           description: User's email address
 *         admin:
 *           type: integer
 *           enum: [0, 1]
 *           description: Admin status (0 = regular user, 1 = admin)
 *       example:
 *         PKID: 1
 *         UserName: michaeldoe@gmail.com
 *         admin: 1
 *     
 *     LoginRequest:
 *       type: object
 *       required:
 *         - UserName
 *         - Password
 *       properties:
 *         UserName:
 *           type: string
 *           format: email
 *           description: User's email address
 *         Password:
 *           type: string
 *           minLength: 6
 *           description: User's password
 *       example:
 *         UserName: michaeldoe@gmail.com
 *         Password: test
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - UserName
 *         - Password
 *       properties:
 *         UserName:
 *           type: string
 *           format: email
 *           description: User's email address
 *         Password:
 *           type: string
 *           minLength: 6
 *           description: User's password
 *         admin:
 *           type: integer
 *           enum: [0, 1]
 *           default: 0
 *           description: Admin status (0 = regular user, 1 = admin)
 *       example:
 *         UserName: newuser@gmail.com
 *         Password: newpassword
 *         admin: 0
 *     
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: Current password
 *         newPassword:
 *           type: string
 *           minLength: 6
 *           description: New password
 *       example:
 *         currentPassword: oldpassword
 *         newPassword: newpassword
 *     
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               description: JWT access token
 *             user:
 *               $ref: '#/components/schemas/User'
 *       example:
 *         success: true
 *         message: Login successful
 *         data:
 *           token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *           user:
 *             PKID: 1
 *             UserName: michaeldoe@gmail.com
 *             admin: 1
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *         details:
 *           type: array
 *           items:
 *             type: string
 *           description: Additional error details (optional)
 *   
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Login controller
const login = async (req, res) => {
  try {
    const { UserName, Password } = req.body;

    // Validate input
    if (!UserName || !Password) {
      return res.status(400).json({
        success: false,
        error: 'UserName and Password are required'
      });
    }

    // Find user by username (email)
    const user = await models.User.findByUserName(UserName);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(Password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.PKID, 
        UserName: user.UserName, 
        admin: user.admin 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.toSafeObject()
      }
    });

    logger.info(`User logged in: ${user.UserName}`);

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

// Register controller (if you want to allow user registration)
const register = async (req, res) => {
  try {
    const { UserName, Password, admin = 0 } = req.body;

    // Validate input
    if (!UserName || !Password) {
      return res.status(400).json({
        success: false,
        error: 'UserName and Password are required'
      });
    }

    // Check if user already exists
    const existingUser = await models.User.findByUserName(UserName);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create new user (password will be hashed by the model hook)
    const newUser = await models.User.create({
      UserName,
      Password,
      admin: admin ? 1 : 0
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.PKID, 
        UserName: newUser.UserName, 
        admin: newUser.admin 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: newUser.toSafeObject()
      }
    });

    logger.info(`New user registered: ${newUser.UserName}`);

  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => err.message)
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
};

// Logout controller (for token blacklisting if needed)
const logout = async (req, res) => {
  // Since JWTs are stateless, logout is typically handled client-side
  // by removing the token. If you need server-side logout, you'd need
  // to implement a token blacklist
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
  
  logger.info(`User logged out: ${req.user?.UserName}`);
};

// Get current user info
const getMe = async (req, res) => {
  try {
    const user = await models.User.findByPk(req.user.PKID, {
      attributes: ['PKID', 'UserName', 'admin']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    const user = await models.User.findByPk(req.user.PKID);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by the model hook)
    await user.update({ Password: newPassword });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

    logger.info(`Password changed for user: ${user.UserName}`);

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

/**
 * @swagger
 * /api/v1/login/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', login);

/**
 * @swagger
 * /api/v1/login/register:
 *   post:
 *     summary: User registration
 *     description: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request - validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', register);

/**
 * @swagger
 * /api/v1/login/logout:
 *   post:
 *     summary: User logout
 *     description: Logout user (client-side token removal)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticateToken, logout);

/**
 * @swagger
 * /api/v1/login/me:
 *   get:
 *     summary: Get current user info
 *     description: Get the authenticated user's information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authenticateToken, getMe);

/**
 * @swagger
 * /api/v1/login/change-password:
 *   put:
 *     summary: Change user password
 *     description: Change the authenticated user's password
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password changed successfully
 *       400:
 *         description: Bad request - invalid current password or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/change-password', authenticateToken, changePassword);
console.log('✅ Login routes defined');
console.log('🔍 Router stack:', router.stack.map(layer => `${layer.route.path} [${Object.keys(layer.route.methods).join(',')}]`));

module.exports = router;