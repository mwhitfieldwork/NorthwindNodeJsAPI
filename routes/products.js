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

// Helper functions for business logic (mimicking .NET ProductService patterns)
const calculateProductStatistics = (products) => {
  if (!products || products.length === 0) {
    return {
      totalProducts: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalStockValue: 0,
      inStockProducts: 0,
      outOfStockProducts: 0,
      lowStockProducts: 0,
      discontinuedProducts: 0
    };
  }

  const activeProducts = products.filter(p => !p.discontinued);
  const prices = products.map(p => parseFloat(p.unitPrice || 0)).filter(p => p > 0);
  const stockValues = products.map(p => 
    parseFloat(p.unitPrice || 0) * parseInt(p.unitsInStock || 0)
  );

  return {
    totalProducts: products.length,
    activeProducts: activeProducts.length,
    discontinuedProducts: products.length - activeProducts.length,
    inStockProducts: products.filter(p => p.unitsInStock > 0).length,
    outOfStockProducts: products.filter(p => p.unitsInStock === 0).length,
    lowStockProducts: products.filter(p => p.unitsInStock < 10 && p.unitsInStock > 0).length,
    averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    totalStockValue: stockValues.reduce((a, b) => a + b, 0)
  };
};

const getProductStockStatus = (product) => {
  if (product.discontinued) return 'Discontinued';
  if (product.unitsInStock === 0) return 'Out of Stock';
  if (product.unitsInStock < 10) return 'Low Stock';
  if (product.unitsInStock <= (product.reorderLevel || 0)) return 'Reorder Required';
  return 'In Stock';
};

const getProductHealthScore = (product) => {
  let score = 100;
  if (product.discontinued) return 0;
  if (product.unitsInStock === 0) score -= 50;
  else if (product.unitsInStock < 10) score -= 25;
  if (!product.unitPrice || product.unitPrice <= 0) score -= 20;
  if (!product.categoryId) score -= 15;
  if (!product.supplierId) score -= 10;
  return Math.max(0, score);
};

const validateProductData = (productData) => {
  const errors = [];

  if (!productData.productName || productData.productName.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (productData.productName && productData.productName.length > 40) {
    errors.push('Product name cannot exceed 40 characters');
  }

  if (productData.unitPrice && productData.unitPrice < 0) {
    errors.push('Unit price cannot be negative');
  }

  if (productData.unitsInStock && productData.unitsInStock < 0) {
    errors.push('Units in stock cannot be negative');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         productId:
 *           type: integer
 *         productName:
 *           type: string
 *           maxLength: 40
 *         supplierId:
 *           type: integer
 *         categoryId:
 *           type: integer
 *         quantityPerUnit:
 *           type: string
 *         unitPrice:
 *           type: number
 *           format: decimal
 *         unitsInStock:
 *           type: integer
 *         unitsOnOrder:
 *           type: integer
 *         reorderLevel:
 *           type: integer
 *         discontinued:
 *           type: boolean
 *         stockStatus:
 *           type: string
 *           enum: [In Stock, Low Stock, Out of Stock, Reorder Required, Discontinued]
 *         stockValue:
 *           type: number
 *         healthScore:
 *           type: integer
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products with advanced filtering, sorting, and business logic
 *     tags: [Products]
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
 *           enum: [productId, productName, unitPrice, unitsInStock, categoryId, supplierId]
 *           default: productName
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
 *         description: Search in product name and description
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: integer
 *         description: Filter by supplier
 *       - in: query
 *         name: discontinued
 *         schema:
 *           type: boolean
 *         description: Filter by discontinued status
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Filter by stock availability
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filter low stock products
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: includeCategory
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeSupplier
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of products with business logic applied
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['productId', 'productName', 'unitPrice', 'unitsInStock', 'categoryId', 'supplierId']),
  query('order').optional().isIn(['ASC', 'DESC']),
  query('search').optional().isLength({ min: 1 }),
  query('categoryId').optional().isInt({ min: 1 }),
  query('supplierId').optional().isInt({ min: 1 }),
  query('discontinued').optional().isBoolean(),
  query('inStock').optional().isBoolean(),
  query('lowStock').optional().isBoolean(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('includeCategory').optional().isBoolean(),
  query('includeSupplier').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'productName';
    const order = req.query.order || 'ASC';
    const search = req.query.search;
    const categoryId = req.query.categoryId;
    const supplierId = req.query.supplierId;
    const discontinued = req.query.discontinued;
    const inStock = req.query.inStock;
    const lowStock = req.query.lowStock;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const includeCategory = req.query.includeCategory === 'true';
    const includeSupplier = req.query.includeSupplier === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { productName: { [Op.like]: `%${search}%` } },
        { quantityPerUnit: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    if (discontinued !== undefined) where.discontinued = discontinued === 'true';
    
    if (inStock !== undefined) {
      where.unitsInStock = inStock === 'true' ? { [Op.gt]: 0 } : 0;
    }
    
    if (lowStock === 'true') {
      where.unitsInStock = { [Op.and]: [{ [Op.gt]: 0 }, { [Op.lt]: 10 }] };
    }
    
    if (minPrice || maxPrice) {
      where.unitPrice = {};
      if (minPrice) where.unitPrice[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.unitPrice[Op.lte] = parseFloat(maxPrice);
    }
    
    // Build include array
    const include = [];
    if (includeCategory) {
      include.push({
        model: models.Category,
        as: 'category',
        attributes: ['categoryId', 'categoryName']
      });
    }
    if (includeSupplier) {
      include.push({
        model: models.Supplier,
        as: 'supplier',
        attributes: ['supplierId', 'companyName', 'country']
      });
    }
    
    const { count, rows } = await models.Product.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [[sort, order]],
      distinct: true
    });
    
    // Add business logic to each product
    const productsWithLogic = rows.map(product => {
      const productData = product.toJSON();
      
      // Add computed business logic fields
      productData.stockStatus = getProductStockStatus(productData);
      productData.stockValue = parseFloat(productData.unitPrice || 0) * parseInt(productData.unitsInStock || 0);
      productData.totalValue = parseFloat(productData.unitPrice || 0) * 
        (parseInt(productData.unitsInStock || 0) + parseInt(productData.unitsOnOrder || 0));
      productData.isActive = !productData.discontinued;
      productData.isLowStock = productData.unitsInStock < 10 && productData.unitsInStock > 0;
      productData.isOutOfStock = productData.unitsInStock === 0;
      productData.needsReorder = productData.unitsInStock <= (productData.reorderLevel || 0);
      productData.healthScore = getProductHealthScore(productData);
      productData.priceCategory = productData.unitPrice < 20 ? 'Budget' : 
        productData.unitPrice < 50 ? 'Standard' : 
        productData.unitPrice < 100 ? 'Premium' : 'Luxury';
      
      return productData;
    });
    
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: productsWithLogic,
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
 * /products/{id}:
 *   get:
 *     summary: Get product by ID with comprehensive business logic
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeCategory
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeSupplier
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeOrderHistory
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Product details with business logic
 *       404:
 *         description: Product not found
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  query('includeCategory').optional().isBoolean(),
  query('includeSupplier').optional().isBoolean(),
  query('includeOrderHistory').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeCategory = req.query.includeCategory !== 'false'; // default true
    const includeSupplier = req.query.includeSupplier !== 'false'; // default true
    const includeOrderHistory = req.query.includeOrderHistory === 'true';
    
    const include = [];
    if (includeCategory) {
      include.push({
        model: models.Category,
        as: 'category'
      });
    }
    if (includeSupplier) {
      include.push({
        model: models.Supplier,
        as: 'supplier'
      });
    }
    if (includeOrderHistory) {
      include.push({
        model: models.OrderDetail,
        as: 'orderDetails',
        include: [{
          model: models.Order,
          as: 'order',
          attributes: ['orderId', 'orderDate', 'custId'],
          include: [{
            model: models.Customer,
            as: 'customer',
            attributes: ['custId', 'companyName']
          }]
        }],
        limit: 10,
        order: [['orderDetailId', 'DESC']]
      });
    }
    
    const product = await models.Product.findByPk(id, { include });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          statusCode: 404
        }
      });
    }
    
    const productData = product.toJSON();
    
    // Add comprehensive business logic
    productData.stockStatus = getProductStockStatus(productData);
    productData.stockValue = parseFloat(productData.unitPrice || 0) * parseInt(productData.unitsInStock || 0);
    productData.totalValue = parseFloat(productData.unitPrice || 0) * 
      (parseInt(productData.unitsInStock || 0) + parseInt(productData.unitsOnOrder || 0));
    productData.isActive = !productData.discontinued;
    productData.isLowStock = productData.unitsInStock < 10 && productData.unitsInStock > 0;
    productData.isOutOfStock = productData.unitsInStock === 0;
    productData.needsReorder = productData.unitsInStock <= (productData.reorderLevel || 0);
    productData.healthScore = getProductHealthScore(productData);
    productData.priceCategory = productData.unitPrice < 20 ? 'Budget' : 
      productData.unitPrice < 50 ? 'Standard' : 
      productData.unitPrice < 100 ? 'Premium' : 'Luxury';
    
    // Calculate sales statistics if order history included
    if (includeOrderHistory && productData.orderDetails) {
      const totalQuantitySold = productData.orderDetails.reduce((sum, detail) => 
        sum + parseInt(detail.quantity || 0), 0
      );
      const totalRevenue = productData.orderDetails.reduce((sum, detail) => 
        sum + (parseFloat(detail.unitPrice || 0) * parseInt(detail.quantity || 0) * (1 - parseFloat(detail.discount || 0))), 0
      );
      
      productData.salesStatistics = {
        totalQuantitySold,
        totalRevenue: totalRevenue.toFixed(2),
        averageOrderQuantity: productData.orderDetails.length > 0 ? 
          (totalQuantitySold / productData.orderDetails.length).toFixed(2) : 0,
        lastOrderDate: productData.orderDetails.length > 0 ? 
          productData.orderDetails[0].order?.orderDate : null
      };
    }
    
    // Product recommendations
    productData.recommendations = [];
    if (productData.isOutOfStock) {
      productData.recommendations.push('Restock immediately - product is out of stock');
    } else if (productData.isLowStock) {
      productData.recommendations.push('Consider restocking - low inventory levels');
    }
    if (productData.discontinued) {
      productData.recommendations.push('Review discontinued status and consider alternatives');
    }
    if (!productData.categoryId) {
      productData.recommendations.push('Assign product to a category');
    }
    if (!productData.supplierId) {
      productData.recommendations.push('Assign a supplier to this product');
    }
    
    res.json({
      success: true,
      data: productData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create new product with business validation
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productName
 *             properties:
 *               productName:
 *                 type: string
 *                 maxLength: 40
 *               supplierId:
 *                 type: integer
 *               categoryId:
 *                 type: integer
 *               quantityPerUnit:
 *                 type: string
 *               unitPrice:
 *                 type: number
 *                 format: decimal
 *               unitsInStock:
 *                 type: integer
 *               unitsOnOrder:
 *                 type: integer
 *               reorderLevel:
 *                 type: integer
 *               discontinued:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', [
  body('productName')
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 1, max: 40 })
    .withMessage('Product name must be between 1 and 40 characters'),
  body('supplierId').optional().isInt({ min: 1 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('quantityPerUnit').optional().isString(),
  body('unitPrice').optional().isFloat({ min: 0 }),
  body('unitsInStock').optional().isInt({ min: 0 }),
  body('unitsOnOrder').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
  body('discontinued').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Business validation
    validateProductData(req.body);
    
    // Validate foreign key references
    if (req.body.categoryId) {
      const category = await models.Category.findByPk(req.body.categoryId, { transaction });
      if (!category) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: {
            message: 'Category not found',
            field: 'categoryId',
            statusCode: 400
          }
        });
      }
    }
    
    if (req.body.supplierId) {
      const supplier = await models.Supplier.findByPk(req.body.supplierId, { transaction });
      if (!supplier) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: {
            message: 'Supplier not found',
            field: 'supplierId',
            statusCode: 400
          }
        });
      }
    }
    
    // Set default values
    const productData = {
      ...req.body,
      unitPrice: req.body.unitPrice || 0,
      unitsInStock: req.body.unitsInStock || 0,
      unitsOnOrder: req.body.unitsOnOrder || 0,
      reorderLevel: req.body.reorderLevel || 0,
      discontinued: req.body.discontinued || false
    };
    
    const product = await models.Product.create(productData, { transaction });
    await transaction.commit();
    
    // Get the complete product with relations
    const completeProduct = await models.Product.findByPk(product.productId, {
      include: [
        { model: models.Category, as: 'category' },
        { model: models.Supplier, as: 'supplier' }
      ]
    });
    
    const responseData = completeProduct.toJSON();
    responseData.stockStatus = getProductStockStatus(responseData);
    responseData.healthScore = getProductHealthScore(responseData);
    responseData.isActive = !responseData.discontinued;
    
    res.status(201).json({
      success: true,
      data: responseData,
      message: 'Product created successfully'
    });
  } catch (error) {
    await transaction.rollback();
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          statusCode: 400
        }
      });
    }
    next(error);
  }
});

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update product with business validation
 *     tags: [Products]
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
 *               productName:
 *                 type: string
 *                 maxLength: 40
 *               supplierId:
 *                 type: integer
 *               categoryId:
 *                 type: integer
 *               quantityPerUnit:
 *                 type: string
 *               unitPrice:
 *                 type: number
 *                 format: decimal
 *               unitsInStock:
 *                 type: integer
 *               unitsOnOrder:
 *                 type: integer
 *               reorderLevel:
 *                 type: integer
 *               discontinued:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('productName')
    .optional()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ min: 1, max: 40 })
    .withMessage('Product name must be between 1 and 40 characters'),
  body('supplierId').optional().isInt({ min: 1 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('quantityPerUnit').optional().isString(),
  body('unitPrice').optional().isFloat({ min: 0 }),
  body('unitsInStock').optional().isInt({ min: 0 }),
  body('unitsOnOrder').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
  body('discontinued').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Check if product exists
    const existingProduct = await models.Product.findByPk(id, { transaction });
    if (!existingProduct) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          statusCode: 404
        }
      });
    }
    
    // Business validation
    if (Object.keys(req.body).length > 0) {
      validateProductData(req.body);
    }
    
    // Validate foreign key references if provided
    if (req.body.categoryId) {
      const category = await models.Category.findByPk(req.body.categoryId, { transaction });
      if (!category) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: {
            message: 'Category not found',
            field: 'categoryId',
            statusCode: 400
          }
        });
      }
    }
    
    if (req.body.supplierId) {
      const supplier = await models.Supplier.findByPk(req.body.supplierId, { transaction });
      if (!supplier) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: {
            message: 'Supplier not found',
            field: 'supplierId',
            statusCode: 400
          }
        });
      }
    }
    
    // Update product
    await models.Product.update(req.body, {
      where: { productId: id },
      transaction
    });
    
    await transaction.commit();
    
    // Get updated product with business logic
    const updatedProduct = await models.Product.findByPk(id, {
      include: [
        { model: models.Category, as: 'category' },
        { model: models.Supplier, as: 'supplier' }
      ]
    });
    
    const productData = updatedProduct.toJSON();
    productData.stockStatus = getProductStockStatus(productData);
    productData.healthScore = getProductHealthScore(productData);
    productData.isActive = !productData.discontinued;
    productData.stockValue = parseFloat(productData.unitPrice || 0) * parseInt(productData.unitsInStock || 0);
    
    res.json({
      success: true,
      data: productData,
      message: 'Product updated successfully'
    });
  } catch (error) {
    await transaction.rollback();
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          statusCode: 400
        }
      });
    }
    next(error);
  }
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete product with business rules validation
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force delete even with order history
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 *       400:
 *         description: Cannot delete product with order history
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
  query('force').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    
    // Check if product exists
    const product = await models.Product.findByPk(id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          statusCode: 404
        }
      });
    }
    
    // Check if product has order history
    const orderDetailCount = await models.OrderDetail.count({
      where: { productId: id },
      transaction
    });
    
    if (orderDetailCount > 0 && !force) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot delete product with ${orderDetailCount} order records. Use force=true to override or consider marking as discontinued.`,
          statusCode: 400
        }
      });
    }
    
    if (force && orderDetailCount > 0) {
      // In a real system, you might archive these records instead
      await models.OrderDetail.destroy({
        where: { productId: id },
        transaction
      });
    }
    
    // Delete product
    await models.Product.destroy({
      where: { productId: id },
      transaction
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        deletedProductId: id,
        affectedOrderDetails: orderDetailCount
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @swagger
 * /products/low-stock:
 *   get:
 *     summary: Get low stock products (ProductService pattern)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Stock threshold for low stock
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
 *           default: 20
 *     responses:
 *       200:
 *         description: Low stock products with reorder recommendations
 */
router.get('/low-stock', [
  query('threshold').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await models.Product.findAndCountAll({
      where: {
        unitsInStock: { [Op.and]: [{ [Op.gt]: 0 }, { [Op.lte]: threshold }] },
        discontinued: false
      },
      include: [
        { model: models.Category, as: 'category', attributes: ['categoryId', 'categoryName'] },
        { model: models.Supplier, as: 'supplier', attributes: ['supplierId', 'companyName', 'phone'] }
      ],
      order: [['unitsInStock', 'ASC']],
      limit,
      offset
    });
    
    const lowStockProducts = rows.map(product => {
      const productData = product.toJSON();
      
      // Calculate reorder recommendation
      const recommendedOrder = Math.max(
        (productData.reorderLevel || threshold) * 2 - productData.unitsInStock,
        threshold
      );
      
      return {
        ...productData,
        stockStatus: getProductStockStatus(productData),
        urgencyLevel: productData.unitsInStock <= 5 ? 'Critical' : 
          productData.unitsInStock <= threshold / 2 ? 'High' : 'Medium',
        recommendedOrderQuantity: recommendedOrder,
        estimatedStockoutDays: productData.unitsInStock <= 5 ? 'Immediate' : 
          Math.ceil(productData.unitsInStock / 2), // Assuming 2 units sold per day
        stockValue: parseFloat(productData.unitPrice || 0) * parseInt(productData.unitsInStock || 0)
      };
    });
    
    const totalPages = Math.ceil(count / limit);
    const totalStockValue = lowStockProducts.reduce((sum, product) => sum + product.stockValue, 0);
    
    res.json({
      success: true,
      data: lowStockProducts,
      pagination: { page, limit, total: count, pages: totalPages },
      summary: {
        threshold,
        totalLowStockProducts: count,
        criticalProducts: lowStockProducts.filter(p => p.urgencyLevel === 'Critical').length,
        totalStockValue: totalStockValue.toFixed(2),
        categories: [...new Set(lowStockProducts.map(p => p.category?.categoryName).filter(Boolean))]
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /products/out-of-stock:
 *   get:
 *     summary: Get out of stock products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: includeDiscontinued
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Out of stock products
 */
router.get('/out-of-stock', [
  query('includeDiscontinued').optional().isBoolean(),
  query('categoryId').optional().isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const includeDiscontinued = req.query.includeDiscontinued === 'true';
    const categoryId = req.query.categoryId;
    
    const where = { unitsInStock: 0 };
    if (!includeDiscontinued) where.discontinued = false;
    if (categoryId) where.categoryId = categoryId;
    
    const outOfStockProducts = await models.Product.findAll({
      where,
      include: [
        { model: models.Category, as: 'category', attributes: ['categoryId', 'categoryName'] },
        { model: models.Supplier, as: 'supplier', attributes: ['supplierId', 'companyName', 'phone', 'email'] }
      ],
      order: [['productName', 'ASC']]
    });
    
    const enhancedProducts = outOfStockProducts.map(product => {
      const productData = product.toJSON();
      return {
        ...productData,
        stockStatus: 'Out of Stock',
        priority: productData.discontinued ? 'Low' : 'High',
        actionRequired: productData.discontinued ? 'Review product status' : 'Restock immediately',
        estimatedRestockCost: parseFloat(productData.unitPrice || 0) * (productData.reorderLevel || 50)
      };
    });
    
    res.json({
      success: true,
      data: enhancedProducts,
      summary: {
        totalOutOfStock: enhancedProducts.length,
        activeProducts: enhancedProducts.filter(p => !p.discontinued).length,
        discontinuedProducts: enhancedProducts.filter(p => p.discontinued).length,
        estimatedRestockCost: enhancedProducts.reduce((sum, p) => sum + p.estimatedRestockCost, 0).toFixed(2)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /products/by-category/{categoryId}:
 *   get:
 *     summary: Get products by category with enhanced filtering
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
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
 *         name: inStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: priceRange
 *         schema:
 *           type: string
 *           enum: [budget, standard, premium, luxury]
 *     responses:
 *       200:
 *         description: Products in category
 *       404:
 *         description: Category not found
 */
router.get('/by-category/:categoryId', [
  param('categoryId').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('inStock').optional().isBoolean(),
  query('priceRange').optional().isIn(['budget', 'standard', 'premium', 'luxury'])
], handleValidationErrors, async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const inStock = req.query.inStock;
    const priceRange = req.query.priceRange;
    const offset = (page - 1) * limit;
    
    // Check if category exists
    const category = await models.Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: { message: 'Category not found', statusCode: 404 }
      });
    }
    
    const where = { categoryId };
    
    if (inStock !== undefined) {
      where.unitsInStock = inStock === 'true' ? { [Op.gt]: 0 } : 0;
    }
    
    if (priceRange) {
      switch (priceRange) {
        case 'budget':
          where.unitPrice = { [Op.lt]: 20 };
          break;
        case 'standard':
          where.unitPrice = { [Op.and]: [{ [Op.gte]: 20 }, { [Op.lt]: 50 }] };
          break;
        case 'premium':
          where.unitPrice = { [Op.and]: [{ [Op.gte]: 50 }, { [Op.lt]: 100 }] };
          break;
        case 'luxury':
          where.unitPrice = { [Op.gte]: 100 };
          break;
      }
    }
    
    const { count, rows } = await models.Product.findAndCountAll({
      where,
      include: [{ model: models.Supplier, as: 'supplier', attributes: ['supplierId', 'companyName'] }],
      order: [['productName', 'ASC']],
      limit,
      offset
    });
    
    const productsWithLogic = rows.map(product => {
      const productData = product.toJSON();
      return {
        ...productData,
        stockStatus: getProductStockStatus(productData),
        priceCategory: productData.unitPrice < 20 ? 'Budget' : 
          productData.unitPrice < 50 ? 'Standard' : 
          productData.unitPrice < 100 ? 'Premium' : 'Luxury',
        stockValue: parseFloat(productData.unitPrice || 0) * parseInt(productData.unitsInStock || 0)
      };
    });
    
    const totalPages = Math.ceil(count / limit);
    const statistics = calculateProductStatistics(rows);
    
    res.json({
      success: true,
      data: productsWithLogic,
      pagination: { page, limit, total: count, pages: totalPages },
      category: category.toJSON(),
      statistics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /products/by-supplier/{supplierId}:
 *   get:
 *     summary: Get products by supplier
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: supplierId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeDiscontinued
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Products from supplier
 *       404:
 *         description: Supplier not found
 */
router.get('/by-supplier/:supplierId', [
  param('supplierId').isInt({ min: 1 }),
  query('includeDiscontinued').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const includeDiscontinued = req.query.includeDiscontinued === 'true';
    
    // Check if supplier exists
    const supplier = await models.Supplier.findByPk(supplierId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: { message: 'Supplier not found', statusCode: 404 }
      });
    }
    
    const where = { supplierId };
    if (!includeDiscontinued) where.discontinued = false;
    
    const products = await models.Product.findAll({
      where,
      include: [{ model: models.Category, as: 'category', attributes: ['categoryId', 'categoryName'] }],
      order: [['productName', 'ASC']]
    });
    
    const productsWithLogic = products.map(product => {
      const productData = product.toJSON();
      return {
        ...productData,
        stockStatus: getProductStockStatus(productData),
        stockValue: parseFloat(productData.unitPrice || 0) * parseInt(productData.unitsInStock || 0),
        healthScore: getProductHealthScore(productData)
      };
    });
    
    const statistics = calculateProductStatistics(products);
    
    res.json({
      success: true,
      data: productsWithLogic,
      supplier: supplier.toJSON(),
      statistics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /products/search:
 *   get:
 *     summary: Advanced product search with multiple criteria
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category name filter
 *       - in: query
 *         name: supplier
 *         schema:
 *           type: string
 *         description: Supplier name filter
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: stockStatus
 *         schema:
 *           type: string
 *           enum: [inStock, lowStock, outOfStock]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, name, price, stock]
 *           default: relevance
 *     responses:
 *       200:
 *         description: Search results with relevance scoring
 */
router.get('/search', [
  query('q').optional().isLength({ min: 1 }),
  query('category').optional().isString(),
  query('supplier').optional().isString(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('stockStatus').optional().isIn(['inStock', 'lowStock', 'outOfStock']),
  query('sortBy').optional().isIn(['relevance', 'name', 'price', 'stock'])
], handleValidationErrors, async (req, res, next) => {
  try {
    const { q, category, supplier, minPrice, maxPrice, stockStatus, sortBy } = req.query;
    
    if (!q && !category && !supplier && !stockStatus) {
      return res.status(400).json({
        success: false,
        error: { message: 'At least one search parameter is required', statusCode: 400 }
      });
    }
    
    // Build complex search query
    const where = {};
    const include = [
      { model: models.Category, as: 'category', attributes: ['categoryId', 'categoryName'] },
      { model: models.Supplier, as: 'supplier', attributes: ['supplierId', 'companyName'] }
    ];
    
    if (q) {
      where[Op.or] = [
        { productName: { [Op.iLike]: `%${q}%` } },
        { quantityPerUnit: { [Op.iLike]: `%${q}%` } }
      ];
    }
    
    if (category) {
      include[0].where = { categoryName: { [Op.iLike]: `%${category}%` } };
      include[0].required = true;
    }
    
    if (supplier) {
      include[1].where = { companyName: { [Op.iLike]: `%${supplier}%` } };
      include[1].required = true;
    }
    
    if (minPrice || maxPrice) {
      where.unitPrice = {};
      if (minPrice) where.unitPrice[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.unitPrice[Op.lte] = parseFloat(maxPrice);
    }
    
    if (stockStatus) {
      switch (stockStatus) {
        case 'inStock':
          where.unitsInStock = { [Op.gt]: 10 };
          break;
        case 'lowStock':
          where.unitsInStock = { [Op.and]: [{ [Op.gt]: 0 }, { [Op.lte]: 10 }] };
          break;
        case 'outOfStock':
          where.unitsInStock = 0;
          break;
      }
    }
    
    // Determine sort order
    let order;
    switch (sortBy) {
      case 'name':
        order = [['productName', 'ASC']];
        break;
      case 'price':
        order = [['unitPrice', 'ASC']];
        break;
      case 'stock':
        order = [['unitsInStock', 'DESC']];
        break;
      default: // relevance
        order = q ? [[sequelize.literal(`
          CASE 
            WHEN "productName" ILIKE '%${q}%' THEN 1
            WHEN "quantityPerUnit" ILIKE '%${q}%' THEN 2
            ELSE 3
          END
        `), 'ASC']] : [['productName', 'ASC']];
    }
    
    const products = await models.Product.findAll({
      where,
      include,
      order,
      limit: 50 // Limit search results
    });
    
    const searchResults = products.map(product => {
      const productData = product.toJSON();
      
      // Calculate relevance score if searching by query
      let relevanceScore = 100;
      if (q) {
        const queryLower = q.toLowerCase();
        const nameLower = productData.productName?.toLowerCase() || '';
        
        if (nameLower.includes(queryLower)) {
          relevanceScore += nameLower.indexOf(queryLower) === 0 ? 50 : 25;
        }
        if (productData.quantityPerUnit?.toLowerCase().includes(queryLower)) {
          relevanceScore += 10;
        }
      }
      
      return {
        ...productData,
        stockStatus: getProductStockStatus(productData),
        relevanceScore: q ? relevanceScore : undefined,
        matchedFields: q ? this.getMatchedFields(productData, q) : undefined
      };
    });
    
    res.json({
      success: true,
      data: searchResults,
      searchCriteria: { q, category, supplier, minPrice, maxPrice, stockStatus, sortBy },
      resultCount: searchResults.length
    });
  } catch (error) {
    next(error);
  }
});

// Helper function for search matching
function getMatchedFields(product, query) {
  const matches = [];
  const queryLower = query.toLowerCase();
  
  if (product.productName?.toLowerCase().includes(queryLower)) {
    matches.push('productName');
  }
  if (product.quantityPerUnit?.toLowerCase().includes(queryLower)) {
    matches.push('quantityPerUnit');
  }
  
  return matches;
}

/**
 * @swagger
 * /products/statistics:
 *   get:
 *     summary: Get comprehensive product statistics
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Product statistics and insights
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const [
      totalProducts,
      activeProducts,
      discontinuedProducts,
      inStockProducts,
      outOfStockProducts,
      lowStockProducts
    ] = await Promise.all([
      models.Product.count(),
      models.Product.count({ where: { discontinued: false } }),
      models.Product.count({ where: { discontinued: true } }),
      models.Product.count({ where: { unitsInStock: { [Op.gt]: 0 } } }),
      models.Product.count({ where: { unitsInStock: 0 } }),
      models.Product.count({ where: { unitsInStock: { [Op.and]: [{ [Op.gt]: 0 }, { [Op.lte]: 10 }] } } })
    ]);
    
    // Get price statistics
    const priceStats = await models.Product.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('unitPrice')), 'averagePrice'],
        [sequelize.fn('MIN', sequelize.col('unitPrice')), 'minPrice'],
        [sequelize.fn('MAX', sequelize.col('unitPrice')), 'maxPrice'],
        [sequelize.fn('SUM', sequelize.literal('unitPrice * unitsInStock')), 'totalStockValue']
      ],
      where: { discontinued: false },
      raw: true
    });
    
    // Get top categories by product count
    const topCategories = await models.Product.findAll({
      attributes: [
        [sequelize.col('category.categoryName'), 'categoryName'],
        [sequelize.fn('COUNT', sequelize.col('Product.productId')), 'productCount']
      ],
      include: [{
        model: models.Category,
        as: 'category',
        attributes: []
      }],
      where: { discontinued: false },
      group: ['category.categoryId', 'category.categoryName'],
      order: [[sequelize.literal('productCount'), 'DESC']],
      limit: 5,
      raw: true
    });
    
    // Get supplier diversity
    const supplierCount = await models.Product.count({
      distinct: true,
      col: 'supplierId',
      where: { discontinued: false }
    });
    
    res.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          activeProducts,
          discontinuedProducts,
          discontinuationRate: totalProducts > 0 ? (discontinuedProducts / totalProducts * 100).toFixed(2) : 0
        },
        inventory: {
          inStockProducts,
          outOfStockProducts,
          lowStockProducts,
          stockAvailabilityRate: totalProducts > 0 ? (inStockProducts / totalProducts * 100).toFixed(2) : 0
        },
        pricing: {
          averagePrice: parseFloat(priceStats?.averagePrice || 0).toFixed(2),
          minPrice: parseFloat(priceStats?.minPrice || 0).toFixed(2),
          maxPrice: parseFloat(priceStats?.maxPrice || 0).toFixed(2),
          totalStockValue: parseFloat(priceStats?.totalStockValue || 0).toFixed(2)
        },
        categories: {
          topCategoriesByProductCount: topCategories.map(cat => ({
            categoryName: cat.categoryName,
            productCount: parseInt(cat.productCount)
          }))
        },
        suppliers: {
          totalSuppliers: supplierCount,
          averageProductsPerSupplier: supplierCount > 0 ? (activeProducts / supplierCount).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;