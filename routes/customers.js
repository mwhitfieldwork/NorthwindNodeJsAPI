const express = require('express');
const { Op } = require('sequelize');
const { body, query, param, validationResult } = require('express-validator');
const { models } = require('../config/database');
const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        errors: errors.array()
      }
    });
  }
  next();
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         custId:
 *           type: integer
 *         companyName:
 *           type: string
 *           maxLength: 40
 *         contactName:
 *           type: string
 *           maxLength: 30
 *         contactTitle:
 *           type: string
 *           maxLength: 30
 *         address:
 *           type: string
 *           maxLength: 60
 *         city:
 *           type: string
 *           maxLength: 15
 *         region:
 *           type: string
 *           maxLength: 15
 *         postalCode:
 *           type: string
 *           maxLength: 10
 *         country:
 *           type: string
 *           maxLength: 15
 *         phone:
 *           type: string
 *           maxLength: 24
 *         mobile:
 *           type: string
 *           maxLength: 24
 *         email:
 *           type: string
 *           format: email
 *         fax:
 *           type: string
 *           maxLength: 24
 *         orderCount:
 *           type: integer
 *         fullAddress:
 *           type: string
 */

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get all customers with filtering, sorting, and pagination
 *     tags: [Customers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [custId, companyName, contactName, city, country]
 *           default: companyName
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in company name, contact name, city, country
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: includeOrders
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of customers
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['custId', 'companyName', 'contactName', 'city', 'country']),
  query('order').optional().isIn(['ASC', 'DESC']),
  query('search').optional().isLength({ min: 1 }),
  query('country').optional().isString(),
  query('city').optional().isString(),
  query('includeOrders').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'companyName';
    const order = req.query.order || 'ASC';
    const search = req.query.search;
    const country = req.query.country;
    const city = req.query.city;
    const includeOrders = req.query.includeOrders === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { contactName: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { country: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (country) {
      where.country = { [Op.like]: `%${country}%` };
    }
    
    if (city) {
      where.city = { [Op.like]: `%${city}%` };
    }
    
    // Build include array
    const include = [];
    if (includeOrders) {
      include.push({
        model: models.Order,
        as: 'orders',
        attributes: ['orderId', 'orderDate', 'shippedDate', 'freight'],
        include: [{
          model: models.Employee,
          as: 'employee',
          attributes: ['employeeId', 'firstName', 'lastName']
        }]
      });
    }
    
    const { count, rows } = await models.Customer.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [[sort, order]]
    });
    
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: totalPages
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeOrders
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Customer details
 *       404:
 *         description: Customer not found
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  query('includeOrders').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeOrders = req.query.includeOrders === 'true';
    
    const include = [];
    if (includeOrders) {
      include.push({
        model: models.Order,
        as: 'orders',
        include: [
          {
            model: models.Employee,
            as: 'employee',
            attributes: ['employeeId', 'firstName', 'lastName']
          },
          {
            model: models.Shipper,
            as: 'shipper',
            attributes: ['shipperId', 'companyName']
          }
        ]
      });
    }
    
    const customer = await models.Customer.findByPk(id, { include });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create new customer
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *             properties:
 *               companyName:
 *                 type: string
 *                 maxLength: 40
 *               contactName:
 *                 type: string
 *                 maxLength: 30
 *               contactTitle:
 *                 type: string
 *                 maxLength: 30
 *               address:
 *                 type: string
 *                 maxLength: 60
 *               city:
 *                 type: string
 *                 maxLength: 15
 *               region:
 *                 type: string
 *                 maxLength: 15
 *               postalCode:
 *                 type: string
 *                 maxLength: 10
 *               country:
 *                 type: string
 *                 maxLength: 15
 *               phone:
 *                 type: string
 *                 maxLength: 24
 *               mobile:
 *                 type: string
 *                 maxLength: 24
 *               email:
 *                 type: string
 *                 format: email
 *               fax:
 *                 type: string
 *                 maxLength: 24
 *     responses:
 *       201:
 *         description: Customer created successfully
 */
router.post('/', [
  body('companyName')
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ min: 1, max: 40 })
    .withMessage('Company name must be between 1 and 40 characters'),
  body('contactName').optional().isLength({ max: 30 }),
  body('contactTitle').optional().isLength({ max: 30 }),
  body('address').optional().isLength({ max: 60 }),
  body('city').optional().isLength({ max: 15 }),
  body('region').optional().isLength({ max: 15 }),
  body('postalCode').optional().isLength({ max: 10 }),
  body('country').optional().isLength({ max: 15 }),
  body('phone').optional().isLength({ max: 24 }),
  body('mobile').optional().isLength({ max: 24 }),
  body('email').optional().isEmail().withMessage('Must be a valid email'),
  body('fax').optional().isLength({ max: 24 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const customer = await models.Customer.create(req.body);
    
    res.status(201).json({
      success: true,
      data: customer,
      message: 'Customer created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('companyName').optional().notEmpty().isLength({ min: 1, max: 40 }),
  body('contactName').optional().isLength({ max: 30 }),
  body('contactTitle').optional().isLength({ max: 30 }),
  body('address').optional().isLength({ max: 60 }),
  body('city').optional().isLength({ max: 15 }),
  body('region').optional().isLength({ max: 15 }),
  body('postalCode').optional().isLength({ max: 10 }),
  body('country').optional().isLength({ max: 15 }),
  body('phone').optional().isLength({ max: 24 }),
  body('mobile').optional().isLength({ max: 24 }),
  body('email').optional().isEmail(),
  body('fax').optional().isLength({ max: 24 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [updatedRows] = await models.Customer.update(req.body, {
      where: { custId: id }
    });
    
    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          statusCode: 404
        }
      });
    }
    
    const updatedCustomer = await models.Customer.findByPk(id);
    
    res.json({
      success: true,
      data: updatedCustomer,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /customers/{id}:
 *   delete:
 *     summary: Delete customer
 *     tags: [Customers]
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if customer has orders
    const orderCount = await models.Order.count({
      where: { custId: id }
    });
    
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot delete customer with ${orderCount} orders. Remove or reassign orders first.`,
          statusCode: 400
        }
      });
    }
    
    const deletedRows = await models.Customer.destroy({
      where: { custId: id }
    });
    
    if (deletedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;