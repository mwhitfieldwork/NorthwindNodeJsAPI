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
 *     Employee:
 *       type: object
 *       properties:
 *         employeeId:
 *           type: integer
 *         lastName:
 *           type: string
 *           maxLength: 20
 *         firstName:
 *           type: string
 *           maxLength: 10
 *         title:
 *           type: string
 *           maxLength: 30
 *         titleOfCourtesy:
 *           type: string
 *           maxLength: 25
 *         birthDate:
 *           type: string
 *           format: date
 *         hireDate:
 *           type: string
 *           format: date
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
 *         extension:
 *           type: string
 *           maxLength: 4
 *         mobile:
 *           type: string
 *           maxLength: 24
 *         email:
 *           type: string
 *           format: email
 *         mgrId:
 *           type: integer
 *         photoPath:
 *           type: string
 *         fullName:
 *           type: string
 *         age:
 *           type: integer
 *         yearsOfService:
 *           type: integer
 *         orderCount:
 *           type: integer
 */

/**
 * @swagger
 * /employees:
 *   get:
 *     summary: Get all employees with filtering, sorting, and pagination
 *     tags: [Employees]
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
 *           enum: [employeeId, lastName, firstName, hireDate, birthDate, title]
 *           default: lastName
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
 *         description: Search in first name, last name, title
 *       - in: query
 *         name: managerId
 *         schema:
 *           type: integer
 *         description: Filter by manager ID
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         description: Filter by job title
 *       - in: query
 *         name: minAge
 *         schema:
 *           type: integer
 *         description: Minimum age filter
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *         description: Maximum age filter
 *       - in: query
 *         name: includeManager
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeSubordinates
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeTerritories
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeOrders
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of employees
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['employeeId', 'lastName', 'firstName', 'hireDate', 'birthDate', 'title']),
  query('order').optional().isIn(['ASC', 'DESC']),
  query('search').optional().isLength({ min: 1 }),
  query('managerId').optional().isInt({ min: 1 }),
  query('city').optional().isString(),
  query('country').optional().isString(),
  query('title').optional().isString(),
  query('minAge').optional().isInt({ min: 0 }),
  query('maxAge').optional().isInt({ min: 0 }),
  query('includeManager').optional().isBoolean(),
  query('includeSubordinates').optional().isBoolean(),
  query('includeTerritories').optional().isBoolean(),
  query('includeOrders').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'lastName';
    const order = req.query.order || 'ASC';
    const search = req.query.search;
    const managerId = req.query.managerId;
    const city = req.query.city;
    const country = req.query.country;
    const title = req.query.title;
    const minAge = req.query.minAge;
    const maxAge = req.query.maxAge;
    const includeManager = req.query.includeManager === 'true';
    const includeSubordinates = req.query.includeSubordinates === 'true';
    const includeTerritories = req.query.includeTerritories === 'true';
    const includeOrders = req.query.includeOrders === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (managerId) where.mgrId = managerId;
    if (city) where.city = { [Op.like]: `%${city}%` };
    if (country) where.country = { [Op.like]: `%${country}%` };
    if (title) where.title = { [Op.like]: `%${title}%` };
    
    // Age filtering requires raw SQL for birthDate calculation
    if (minAge || maxAge) {
      const currentDate = new Date();
      if (maxAge) {
        const minBirthDate = new Date(currentDate.getFullYear() - maxAge, currentDate.getMonth(), currentDate.getDate());
        where.birthDate = where.birthDate || {};
        where.birthDate[Op.gte] = minBirthDate;
      }
      if (minAge) {
        const maxBirthDate = new Date(currentDate.getFullYear() - minAge, currentDate.getMonth(), currentDate.getDate());
        where.birthDate = where.birthDate || {};
        where.birthDate[Op.lte] = maxBirthDate;
      }
    }
    
    // Build include array
    const include = [];
    if (includeManager) {
      include.push({
        model: models.Employee,
        as: 'manager',
        attributes: ['employeeId', 'firstName', 'lastName', 'title']
      });
    }
    if (includeSubordinates) {
      include.push({
        model: models.Employee,
        as: 'subordinates',
        attributes: ['employeeId', 'firstName', 'lastName', 'title']
      });
    }
    if (includeTerritories) {
      include.push({
        model: models.Territory,
        as: 'territories',
        attributes: ['territoryId', 'territoryDescription'],
        include: [{
          model: models.Region,
          as: 'region',
          attributes: ['regionId', 'regionDescription']
        }]
      });
    }
    if (includeOrders) {
      include.push({
        model: models.Order,
        as: 'orders',
        attributes: ['orderId', 'orderDate', 'shippedDate', 'freight'],
        limit: 10, // Limit orders to prevent excessive data
        order: [['orderDate', 'DESC']]
      });
    }
    
    const { count, rows } = await models.Employee.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [[sort, order]],
      distinct: true // Important when using includes to avoid count issues
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
 * /employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeManager
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeSubordinates
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeTerritories
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeOrders
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Employee details
 *       404:
 *         description: Employee not found
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  query('includeManager').optional().isBoolean(),
  query('includeSubordinates').optional().isBoolean(),
  query('includeTerritories').optional().isBoolean(),
  query('includeOrders').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeManager = req.query.includeManager === 'true';
    const includeSubordinates = req.query.includeSubordinates === 'true';
    const includeTerritories = req.query.includeTerritories === 'true';
    const includeOrders = req.query.includeOrders === 'true';
    
    const include = [];
    if (includeManager) {
      include.push({
        model: models.Employee,
        as: 'manager',
        attributes: ['employeeId', 'firstName', 'lastName', 'title']
      });
    }
    if (includeSubordinates) {
      include.push({
        model: models.Employee,
        as: 'subordinates',
        attributes: ['employeeId', 'firstName', 'lastName', 'title', 'hireDate']
      });
    }
    if (includeTerritories) {
      include.push({
        model: models.Territory,
        as: 'territories',
        include: [{
          model: models.Region,
          as: 'region'
        }]
      });
    }
    if (includeOrders) {
      include.push({
        model: models.Order,
        as: 'orders',
        include: [{
          model: models.Customer,
          as: 'customer',
          attributes: ['custId', 'companyName']
        }],
        order: [['orderDate', 'DESC']],
        limit: 20
      });
    }
    
    const employee = await models.Employee.findByPk(id, { include });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /employees:
 *   post:
 *     summary: Create new employee
 *     tags: [Employees]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lastName
 *               - firstName
 *             properties:
 *               lastName:
 *                 type: string
 *                 maxLength: 20
 *               firstName:
 *                 type: string
 *                 maxLength: 10
 *               title:
 *                 type: string
 *                 maxLength: 30
 *               titleOfCourtesy:
 *                 type: string
 *                 maxLength: 25
 *               birthDate:
 *                 type: string
 *                 format: date
 *               hireDate:
 *                 type: string
 *                 format: date
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
 *               extension:
 *                 type: string
 *                 maxLength: 4
 *               mobile:
 *                 type: string
 *                 maxLength: 24
 *               email:
 *                 type: string
 *                 format: email
 *               mgrId:
 *                 type: integer
 *               photoPath:
 *                 type: string
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', [
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('Last name must be between 1 and 20 characters'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('First name must be between 1 and 10 characters'),
  body('title').optional().isLength({ max: 30 }),
  body('titleOfCourtesy').optional().isLength({ max: 25 }),
  body('birthDate').optional().isISO8601().withMessage('Birth date must be a valid date'),
  body('hireDate').optional().isISO8601().withMessage('Hire date must be a valid date'),
  body('address').optional().isLength({ max: 60 }),
  body('city').optional().isLength({ max: 15 }),
  body('region').optional().isLength({ max: 15 }),
  body('postalCode').optional().isLength({ max: 10 }),
  body('country').optional().isLength({ max: 15 }),
  body('phone').optional().isLength({ max: 24 }),
  body('extension').optional().isLength({ max: 4 }),
  body('mobile').optional().isLength({ max: 24 }),
  body('email').optional().isEmail().withMessage('Must be a valid email'),
  body('mgrId').optional().isInt({ min: 1 }),
  body('photoPath').optional().isString()
], handleValidationErrors, async (req, res, next) => {
  try {
    // Validate manager exists if provided
    if (req.body.mgrId) {
      const manager = await models.Employee.findByPk(req.body.mgrId);
      if (!manager) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Manager not found',
            field: 'mgrId',
            statusCode: 400
          }
        });
      }
    }
    
    // Validate dates
    if (req.body.birthDate && req.body.hireDate) {
      const birthDate = new Date(req.body.birthDate);
      const hireDate = new Date(req.body.hireDate);
      const age = hireDate.getFullYear() - birthDate.getFullYear();
      
      if (age < 16) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Employee must be at least 16 years old at hire date',
            statusCode: 400
          }
        });
      }
    }
    
    const employee = await models.Employee.create(req.body);
    
    res.status(201).json({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /employees/{id}:
 *   put:
 *     summary: Update employee
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lastName:
 *                 type: string
 *                 maxLength: 20
 *               firstName:
 *                 type: string
 *                 maxLength: 10
 *               title:
 *                 type: string
 *                 maxLength: 30
 *               titleOfCourtesy:
 *                 type: string
 *                 maxLength: 25
 *               birthDate:
 *                 type: string
 *                 format: date
 *               hireDate:
 *                 type: string
 *                 format: date
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
 *               extension:
 *                 type: string
 *                 maxLength: 4
 *               mobile:
 *                 type: string
 *                 maxLength: 24
 *               email:
 *                 type: string
 *                 format: email
 *               mgrId:
 *                 type: integer
 *               photoPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *       404:
 *         description: Employee not found
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('lastName').optional().notEmpty().isLength({ min: 1, max: 20 }),
  body('firstName').optional().notEmpty().isLength({ min: 1, max: 10 }),
  body('title').optional().isLength({ max: 30 }),
  body('titleOfCourtesy').optional().isLength({ max: 25 }),
  body('birthDate').optional().isISO8601(),
  body('hireDate').optional().isISO8601(),
  body('address').optional().isLength({ max: 60 }),
  body('city').optional().isLength({ max: 15 }),
  body('region').optional().isLength({ max: 15 }),
  body('postalCode').optional().isLength({ max: 10 }),
  body('country').optional().isLength({ max: 15 }),
  body('phone').optional().isLength({ max: 24 }),
  body('extension').optional().isLength({ max: 4 }),
  body('mobile').optional().isLength({ max: 24 }),
  body('email').optional().isEmail(),
  body('mgrId').optional().isInt({ min: 1 }),
  body('photoPath').optional().isString()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if employee exists
    const existingEmployee = await models.Employee.findByPk(id);
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          statusCode: 404
        }
      });
    }
    
    // Validate manager exists and prevent circular reference
    if (req.body.mgrId) {
      if (req.body.mgrId == id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Employee cannot be their own manager',
            field: 'mgrId',
            statusCode: 400
          }
        });
      }
      
      const manager = await models.Employee.findByPk(req.body.mgrId);
      if (!manager) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Manager not found',
            field: 'mgrId',
            statusCode: 400
          }
        });
      }
    }
    
    const [updatedRows] = await models.Employee.update(req.body, {
      where: { employeeId: id }
    });
    
    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          statusCode: 404
        }
      });
    }
    
    const updatedEmployee = await models.Employee.findByPk(id);
    
    res.json({
      success: true,
      data: updatedEmployee,
      message: 'Employee updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /employees/{id}:
 *   delete:
 *     summary: Delete employee
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *       404:
 *         description: Employee not found
 *       400:
 *         description: Cannot delete employee with dependencies
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if employee has orders
    const orderCount = await models.Order.count({
      where: { employeeId: id }
    });
    
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot delete employee with ${orderCount} orders. Reassign orders first.`,
          statusCode: 400
        }
      });
    }
    
    // Check if employee has subordinates
    const subordinateCount = await models.Employee.count({
      where: { mgrId: id }
    });
    
    if (subordinateCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot delete employee with ${subordinateCount} subordinates. Reassign subordinates first.`,
          statusCode: 400
        }
      });
    }
    
    const deletedRows = await models.Employee.destroy({
      where: { employeeId: id }
    });
    
    if (deletedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /employees/{id}/territories:
 *   get:
 *     summary: Get employee territories
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee territories
 */
router.get('/:id/territories', [
  param('id').isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const employee = await models.Employee.findByPk(id, {
      include: [{
        model: models.Territory,
        as: 'territories',
        include: [{
          model: models.Region,
          as: 'region'
        }]
      }]
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      data: employee.territories || []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /employees/{id}/orders:
 *   get:
 *     summary: Get employee orders
 *     tags: [Employees]
 */
router.get('/:id/orders', [
  param('id').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'processing', 'shipped'])
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const offset = (page - 1) * limit;
    
    // Check if employee exists
    const employee = await models.Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Employee not found',
          statusCode: 404
        }
      });
    }
    
    const where = { employeeId: id };
    
    if (status) {
      switch (status) {
        case 'pending':
          where.orderDate = null;
          break;
        case 'processing':
          where[Op.and] = [
            { orderDate: { [Op.ne]: null } },
            { shippedDate: null }
          ];
          break;
        case 'shipped':
          where.shippedDate = { [Op.ne]: null };
          break;
      }
    }
    
    const { count, rows } = await models.Order.findAndCountAll({
      where,
      include: [{
        model: models.Customer,
        as: 'customer',
        attributes: ['custId', 'companyName']
      }],
      limit,
      offset,
      order: [['orderDate', 'DESC']]
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
 * /employees/hierarchy:
 *   get:
 *     summary: Get employee hierarchy tree
 *     tags: [Employees]
 *     responses:
 *       200:
 *         description: Employee hierarchy
 */
router.get('/hierarchy', async (req, res, next) => {
  try {
    // Get all employees with their managers and subordinates
    const employees = await models.Employee.findAll({
      include: [
        {
          model: models.Employee,
          as: 'manager',
          attributes: ['employeeId', 'firstName', 'lastName', 'title']
        },
        {
          model: models.Employee,
          as: 'subordinates',
          attributes: ['employeeId', 'firstName', 'lastName', 'title']
        }
      ],
      order: [['lastName', 'ASC']]
    });
    
    // Build hierarchy tree
    const buildHierarchy = (employees, managerId = null) => {
      return employees
        .filter(emp => emp.mgrId === managerId)
        .map(emp => ({
          ...emp.toJSON(),
          subordinates: buildHierarchy(employees, emp.employeeId)
        }));
    };
    
    const hierarchy = buildHierarchy(employees);
    
    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;