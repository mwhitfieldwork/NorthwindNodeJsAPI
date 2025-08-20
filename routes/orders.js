const express = require('express');
const { Op } = require('sequelize');
const { body, query, param, validationResult } = require('express-validator');
const { models, sequelize } = require('../config/database');
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
 *     Order:
 *       type: object
 *       properties:
 *         orderId:
 *           type: integer
 *         custId:
 *           type: integer
 *         employeeId:
 *           type: integer
 *         orderDate:
 *           type: string
 *           format: date-time
 *         requiredDate:
 *           type: string
 *           format: date-time
 *         shippedDate:
 *           type: string
 *           format: date-time
 *         shipperId:
 *           type: integer
 *         freight:
 *           type: number
 *           format: decimal
 *         shipName:
 *           type: string
 *         shipAddress:
 *           type: string
 *         shipCity:
 *           type: string
 *         shipRegion:
 *           type: string
 *         shipPostalCode:
 *           type: string
 *         shipCountry:
 *           type: string
 *         orderStatus:
 *           type: string
 *           enum: [Pending, Processing, Shipped]
 *         isOverdue:
 *           type: boolean
 *         orderTotal:
 *           type: number
 *         subtotal:
 *           type: number
 *     OrderDetail:
 *       type: object
 *       properties:
 *         orderDetailId:
 *           type: integer
 *         orderId:
 *           type: integer
 *         productId:
 *           type: integer
 *         unitPrice:
 *           type: number
 *           format: decimal
 *         quantity:
 *           type: integer
 *         discount:
 *           type: number
 *           format: decimal
 *         lineTotal:
 *           type: number
 *         discountAmount:
 *           type: number
 */

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders with filtering, sorting, and pagination
 *     tags: [Orders]
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
 *           enum: [orderId, orderDate, shippedDate, freight, custId, employeeId]
 *           default: orderDate
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: custId
 *         schema:
 *           type: integer
 *         description: Filter by customer ID
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: integer
 *         description: Filter by employee ID
 *       - in: query
 *         name: shipperId
 *         schema:
 *           type: integer
 *         description: Filter by shipper ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, shipped, overdue]
 *         description: Filter by order status
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders from date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders to date
 *       - in: query
 *         name: minFreight
 *         schema:
 *           type: number
 *         description: Minimum freight amount
 *       - in: query
 *         name: maxFreight
 *         schema:
 *           type: number
 *         description: Maximum freight amount
 *       - in: query
 *         name: shipCountry
 *         schema:
 *           type: string
 *         description: Filter by ship country
 *       - in: query
 *         name: shipCity
 *         schema:
 *           type: string
 *         description: Filter by ship city
 *       - in: query
 *         name: includeCustomer
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeEmployee
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeShipper
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['orderId', 'orderDate', 'shippedDate', 'freight', 'custId', 'employeeId']),
  query('order').optional().isIn(['ASC', 'DESC']),
  query('custId').optional().isInt({ min: 1 }),
  query('employeeId').optional().isInt({ min: 1 }),
  query('shipperId').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['pending', 'processing', 'shipped', 'overdue']),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('minFreight').optional().isFloat({ min: 0 }),
  query('maxFreight').optional().isFloat({ min: 0 }),
  query('shipCountry').optional().isString(),
  query('shipCity').optional().isString(),
  query('includeCustomer').optional().isBoolean(),
  query('includeEmployee').optional().isBoolean(),
  query('includeShipper').optional().isBoolean(),
  query('includeDetails').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'orderDate';
    const order = req.query.order || 'DESC';
    const custId = req.query.custId;
    const employeeId = req.query.employeeId;
    const shipperId = req.query.shipperId;
    const status = req.query.status;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const minFreight = req.query.minFreight;
    const maxFreight = req.query.maxFreight;
    const shipCountry = req.query.shipCountry;
    const shipCity = req.query.shipCity;
    const includeCustomer = req.query.includeCustomer === 'true';
    const includeEmployee = req.query.includeEmployee === 'true';
    const includeShipper = req.query.includeShipper === 'true';
    const includeDetails = req.query.includeDetails === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    if (custId) where.custId = custId;
    if (employeeId) where.employeeId = employeeId;
    if (shipperId) where.shipperId = shipperId;
    if (shipCountry) where.shipCountry = { [Op.like]: `%${shipCountry}%` };
    if (shipCity) where.shipCity = { [Op.like]: `%${shipCity}%` };
    
    // Date filtering
    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) where.orderDate[Op.gte] = new Date(fromDate);
      if (toDate) where.orderDate[Op.lte] = new Date(toDate);
    }
    
    // Freight filtering
    if (minFreight || maxFreight) {
      where.freight = {};
      if (minFreight) where.freight[Op.gte] = parseFloat(minFreight);
      if (maxFreight) where.freight[Op.lte] = parseFloat(maxFreight);
    }
    
    // Status filtering
    if (status) {
      const currentDate = new Date();
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
        case 'overdue':
          where[Op.and] = [
            { shippedDate: null },
            { requiredDate: { [Op.lt]: currentDate } }
          ];
          break;
      }
    }
    
    // Build include array
    const include = [];
    if (includeCustomer) {
      include.push({
        model: models.Customer,
        as: 'customer',
        attributes: ['custId', 'companyName', 'contactName', 'phone']
      });
    }
    if (includeEmployee) {
      include.push({
        model: models.Employee,
        as: 'employee',
        attributes: ['employeeId', 'firstName', 'lastName', 'title']
      });
    }
    if (includeShipper) {
      include.push({
        model: models.Shipper,
        as: 'shipper',
        attributes: ['shipperId', 'companyName', 'phone']
      });
    }
    if (includeDetails) {
      include.push({
        model: models.OrderDetail,
        as: 'orderDetails',
        include: [{
          model: models.Product,
          as: 'product',
          attributes: ['productId', 'productName', 'unitPrice', 'quantityPerUnit']
        }]
      });
    }
    
    const { count, rows } = await models.Order.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [[sort, order]],
      distinct: true
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
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeCustomer
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeEmployee
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeShipper
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  query('includeCustomer').optional().isBoolean(),
  query('includeEmployee').optional().isBoolean(),
  query('includeShipper').optional().isBoolean(),
  query('includeDetails').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeCustomer = req.query.includeCustomer === 'true';
    const includeEmployee = req.query.includeEmployee === 'true';
    const includeShipper = req.query.includeShipper === 'true';
    const includeDetails = req.query.includeDetails !== 'false'; // Default true
    
    const include = [];
    if (includeCustomer) {
      include.push({
        model: models.Customer,
        as: 'customer'
      });
    }
    if (includeEmployee) {
      include.push({
        model: models.Employee,
        as: 'employee'
      });
    }
    if (includeShipper) {
      include.push({
        model: models.Shipper,
        as: 'shipper'
      });
    }
    if (includeDetails) {
      include.push({
        model: models.OrderDetail,
        as: 'orderDetails',
        include: [{
          model: models.Product,
          as: 'product',
          include: [{
            model: models.Category,
            as: 'category',
            attributes: ['categoryId', 'categoryName']
          }]
        }]
      });
    }
    
    const order = await models.Order.findByPk(id, { include });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create new order with order details
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - custId
 *               - shipperId
 *               - orderDetails
 *             properties:
 *               custId:
 *                 type: integer
 *               employeeId:
 *                 type: integer
 *               orderDate:
 *                 type: string
 *                 format: date-time
 *               requiredDate:
 *                 type: string
 *                 format: date-time
 *               shippedDate:
 *                 type: string
 *                 format: date-time
 *               shipperId:
 *                 type: integer
 *               freight:
 *                 type: number
 *                 format: decimal
 *               shipName:
 *                 type: string
 *               shipAddress:
 *                 type: string
 *               shipCity:
 *                 type: string
 *               shipRegion:
 *                 type: string
 *               shipPostalCode:
 *                 type: string
 *               shipCountry:
 *                 type: string
 *               orderDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                     - unitPrice
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     unitPrice:
 *                       type: number
 *                       format: decimal
 *                       minimum: 0
 *                     discount:
 *                       type: number
 *                       format: decimal
 *                       minimum: 0
 *                       maximum: 1
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', [
  body('custId').isInt({ min: 1 }).withMessage('Customer ID is required'),
  body('employeeId').optional().isInt({ min: 1 }),
  body('orderDate').optional().isISO8601().withMessage('Order date must be a valid date'),
  body('requiredDate').optional().isISO8601().withMessage('Required date must be a valid date'),
  body('shippedDate').optional().isISO8601().withMessage('Shipped date must be a valid date'),
  body('shipperId').isInt({ min: 1 }).withMessage('Shipper ID is required'),
  body('freight').optional().isFloat({ min: 0 }).withMessage('Freight must be non-negative'),
  body('shipName').optional().isString().isLength({ max: 40 }),
  body('shipAddress').optional().isString().isLength({ max: 60 }),
  body('shipCity').optional().isString().isLength({ max: 15 }),
  body('shipRegion').optional().isString().isLength({ max: 15 }),
  body('shipPostalCode').optional().isString().isLength({ max: 10 }),
  body('shipCountry').optional().isString().isLength({ max: 15 }),
  body('orderDetails').isArray({ min: 1 }).withMessage('Order must have at least one detail'),
  body('orderDetails.*.productId').isInt({ min: 1 }).withMessage('Product ID is required for each detail'),
  body('orderDetails.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('orderDetails.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('orderDetails.*.discount').optional().isFloat({ min: 0, max: 1 }).withMessage('Discount must be between 0 and 1')
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { orderDetails, ...orderData } = req.body;
    
    // Validate customer exists
    const customer = await models.Customer.findByPk(orderData.custId);
    if (!customer) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Customer not found',
          field: 'custId',
          statusCode: 400
        }
      });
    }
    
    // Validate employee exists if provided
    if (orderData.employeeId) {
      const employee = await models.Employee.findByPk(orderData.employeeId);
      if (!employee) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Employee not found',
            field: 'employeeId',
            statusCode: 400
          }
        });
      }
    }
    
    // Validate shipper exists
    const shipper = await models.Shipper.findByPk(orderData.shipperId);
    if (!shipper) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Shipper not found',
          field: 'shipperId',
          statusCode: 400
        }
      });
    }
    
    // Validate all products exist and are not discontinued
    const productIds = orderDetails.map(detail => detail.productId);
    const products = await models.Product.findAll({
      where: {
        productId: { [Op.in]: productIds }
      }
    });
    
    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'One or more products not found',
          statusCode: 400
        }
      });
    }
    
    const discontinuedProducts = products.filter(p => p.discontinued);
    if (discontinuedProducts.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot order discontinued products: ${discontinuedProducts.map(p => p.productName).join(', ')}`,
          statusCode: 400
        }
      });
    }
    
    // Set default order date if not provided
    if (!orderData.orderDate) {
      orderData.orderDate = new Date();
    }
    
    // Create order
    const order = await models.Order.create(orderData, { transaction });
    
    // Create order details with validation
    const detailsWithOrderId = orderDetails.map(detail => ({
      ...detail,
      orderId: order.orderId,
      discount: detail.discount || 0
    }));
    
    await models.OrderDetail.bulkCreate(detailsWithOrderId, { transaction });
    
    await transaction.commit();
    
    // Fetch complete order with details
    const completeOrder = await models.Order.findByPk(order.orderId, {
      include: [
        {
          model: models.Customer,
          as: 'customer',
          attributes: ['custId', 'companyName', 'contactName']
        },
        {
          model: models.Employee,
          as: 'employee',
          attributes: ['employeeId', 'firstName', 'lastName']
        },
        {
          model: models.Shipper,
          as: 'shipper',
          attributes: ['shipperId', 'companyName']
        },
        {
          model: models.OrderDetail,
          as: 'orderDetails',
          include: [{
            model: models.Product,
            as: 'product',
            attributes: ['productId', 'productName', 'quantityPerUnit']
          }]
        }
      ]
    });
    
    res.status(201).json({
      success: true,
      data: completeOrder,
      message: 'Order created successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   put:
 *     summary: Update order
 *     tags: [Orders]
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
 *               employeeId:
 *                 type: integer
 *               requiredDate:
 *                 type: string
 *                 format: date-time
 *               shippedDate:
 *                 type: string
 *                 format: date-time
 *               shipperId:
 *                 type: integer
 *               freight:
 *                 type: number
 *                 format: decimal
 *               shipName:
 *                 type: string
 *               shipAddress:
 *                 type: string
 *               shipCity:
 *                 type: string
 *               shipRegion:
 *                 type: string
 *               shipPostalCode:
 *                 type: string
 *               shipCountry:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order updated successfully
 *       404:
 *         description: Order not found
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('employeeId').optional().isInt({ min: 1 }),
  body('requiredDate').optional().isISO8601(),
  body('shippedDate').optional().isISO8601(),
  body('shipperId').optional().isInt({ min: 1 }),
  body('freight').optional().isFloat({ min: 0 }),
  body('shipName').optional().isString().isLength({ max: 40 }),
  body('shipAddress').optional().isString().isLength({ max: 60 }),
  body('shipCity').optional().isString().isLength({ max: 15 }),
  body('shipRegion').optional().isString().isLength({ max: 15 }),
  body('shipPostalCode').optional().isString().isLength({ max: 10 }),
  body('shipCountry').optional().isString().isLength({ max: 15 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const existingOrder = await models.Order.findByPk(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          statusCode: 404
        }
      });
    }
    
    // Prevent modification of shipped orders
    if (existingOrder.shippedDate && req.body.shippedDate !== existingOrder.shippedDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cannot modify shipped orders',
          statusCode: 400
        }
      });
    }
    
    // Validate employee exists if provided
    if (req.body.employeeId) {
      const employee = await models.Employee.findByPk(req.body.employeeId);
      if (!employee) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Employee not found',
            field: 'employeeId',
            statusCode: 400
          }
        });
      }
    }
    
    // Validate shipper exists if provided
    if (req.body.shipperId) {
      const shipper = await models.Shipper.findByPk(req.body.shipperId);
      if (!shipper) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Shipper not found',
            field: 'shipperId',
            statusCode: 400
          }
        });
      }
    }
    
    const [updatedRows] = await models.Order.update(req.body, {
      where: { orderId: id }
    });
    
    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          statusCode: 404
        }
      });
    }
    
    const updatedOrder = await models.Order.findByPk(id, {
      include: [
        { model: models.Customer, as: 'customer' },
        { model: models.Employee, as: 'employee' },
        { model: models.Shipper, as: 'shipper' }
      ]
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Delete order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order deleted successfully
 *       404:
 *         description: Order not found
 *       400:
 *         description: Cannot delete shipped orders
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Check if order exists and is not shipped
    const order = await models.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          statusCode: 404
        }
      });
    }
    
    if (order.shippedDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete shipped orders',
          statusCode: 400
        }
      });
    }
    
    // Delete order details first
    await models.OrderDetail.destroy({
      where: { orderId: id },
      transaction
    });
    
    // Delete order
    await models.Order.destroy({
      where: { orderId: id },
      transaction
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @swagger
 * /orders/{id}/details:
 *   get:
 *     summary: Get order details
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get('/:id/details', [
  param('id').isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const orderDetails = await models.OrderDetail.findAll({
      where: { orderId: id },
      include: [{
        model: models.Product,
        as: 'product',
        include: [
          {
            model: models.Category,
            as: 'category',
            attributes: ['categoryId', 'categoryName']
          },
          {
            model: models.Supplier,
            as: 'supplier',
            attributes: ['supplierId', 'companyName']
          }
        ]
      }],
      order: [['orderDetailId', 'ASC']]
    });
    
    if (orderDetails.length === 0) {
      // Check if order exists
      const order = await models.Order.findByPk(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Order not found',
            statusCode: 404
          }
        });
      }
    }
    
    res.json({
      success: true,
      data: orderDetails
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /orders/{id}/ship:
 *   patch:
 *     summary: Mark order as shipped
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shippedDate:
 *                 type: string
 *                 format: date-time
 *               shipperId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Order shipped successfully
 *       404:
 *         description: Order not found
 *       400:
 *         description: Order already shipped or invalid data
 */
router.patch('/:id/ship', [
  param('id').isInt({ min: 1 }),
  body('shippedDate').optional().isISO8601(),
  body('shipperId').optional().isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const shippedDate = req.body.shippedDate || new Date();
    const shipperId = req.body.shipperId;
    
    const order = await models.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          statusCode: 404
        }
      });
    }
    
    if (order.shippedDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Order is already shipped',
          statusCode: 400
        }
      });
    }
    
    const updateData = { shippedDate };
    if (shipperId) updateData.shipperId = shipperId;
    
    await models.Order.update(updateData, {
      where: { orderId: id }
    });
    
    const updatedOrder = await models.Order.findByPk(id, {
      include: [
        { model: models.Customer, as: 'customer' },
        { model: models.Shipper, as: 'shipper' }
      ]
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order shipped successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /orders/statistics:
 *   get:
 *     summary: Get order statistics
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Order statistics
 */
router.get('/statistics', [
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
], handleValidationErrors, async (req, res, next) => {
  try {
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    
    let where = {};
    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) where.orderDate[Op.gte] = new Date(fromDate);
      if (toDate) where.orderDate[Op.lte] = new Date(toDate);
    }
    
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      overdueOrders,
      totalRevenue
    ] = await Promise.all([
      models.Order.count({ where }),
      models.Order.count({ where: { ...where, orderDate: null } }),
      models.Order.count({ 
        where: { 
          ...where, 
          [Op.and]: [
            { orderDate: { [Op.ne]: null } },
            { shippedDate: null }
          ]
        }
      }),
      models.Order.count({ where: { ...where, shippedDate: { [Op.ne]: null } } }),
      models.Order.count({ 
        where: { 
          ...where,
          [Op.and]: [
            { shippedDate: null },
            { requiredDate: { [Op.lt]: new Date() } }
          ]
        }
      }),
      models.Order.sum('freight', { where })
    ]);
    
    // Get top customers
    const topCustomers = await models.Order.findAll({
      where,
      attributes: [
        'custId',
        [sequelize.fn('COUNT', sequelize.col('orderId')), 'orderCount'],
        [sequelize.fn('SUM', sequelize.col('freight')), 'totalFreight']
      ],
      include: [{
        model: models.Customer,
        as: 'customer',
        attributes: ['companyName']
      }],
      group: ['custId', 'customer.custId'],
      order: [[sequelize.literal('orderCount'), 'DESC']],
      limit: 5
    });
    
    res.json({
      success: true,
      data: {
        totalOrders,
        ordersByStatus: {
          pending: pendingOrders,
          processing: processingOrders,
          shipped: shippedOrders,
          overdue: overdueOrders
        },
        totalRevenue: totalRevenue || 0,
        topCustomers
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;