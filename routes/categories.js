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

// Helper functions for business logic
const calculateCategoryStatistics = (products) => {
  if (!products || products.length === 0) {
    return {
      totalProducts: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalStockValue: 0,
      activeProducts: 0,
      discontinuedProducts: 0,
      lowStockProducts: 0
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
    averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    totalStockValue: stockValues.reduce((a, b) => a + b, 0),
    lowStockProducts: products.filter(p => p.unitsInStock < 10).length
  };
};

const getProductStockStatus = (product) => {
  if (product.discontinued) return 'Discontinued';
  if (product.unitsInStock === 0) return 'Out of Stock';
  if (product.unitsInStock < 10) return 'Low Stock';
  return 'In Stock';
};

const validateCategoryData = (categoryData) => {
  const errors = [];

  if (!categoryData.categoryName || categoryData.categoryName.trim().length === 0) {
    errors.push('Category name is required');
  }

  if (categoryData.categoryName && categoryData.categoryName.length > 15) {
    errors.push('Category name cannot exceed 15 characters');
  }

  if (categoryData.categoryName && /^\d+$/.test(categoryData.categoryName)) {
    errors.push('Category name cannot be only numbers');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         categoryId:
 *           type: integer
 *         categoryName:
 *           type: string
 *           maxLength: 15
 *         description:
 *           type: string
 *         picture:
 *           type: string
 *           format: binary
 *         productCount:
 *           type: integer
 *         activeProductCount:
 *           type: integer
 *         hasProducts:
 *           type: boolean
 *         isPopular:
 *           type: boolean
 *         statistics:
 *           type: object
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all categories with filtering, sorting, and pagination
 *     tags: [Categories]
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
 *           enum: [categoryId, categoryName, description]
 *           default: categoryName
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
 *         description: Search in category name and description
 *       - in: query
 *         name: includeProducts
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeStatistics
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['categoryId', 'categoryName', 'description']),
  query('order').optional().isIn(['ASC', 'DESC']),
  query('search').optional().isLength({ min: 1 }),
  query('includeProducts').optional().isBoolean(),
  query('includeStatistics').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'categoryName';
    const order = req.query.order || 'ASC';
    const search = req.query.search;
    const includeProducts = req.query.includeProducts === 'true';
    const includeStatistics = req.query.includeStatistics === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    if (search) {
      where[Op.or] = [
        { categoryName: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Build include array
    const include = [];
    if (includeProducts || includeStatistics) {
      include.push({
        model: models.Product,
        as: 'products',
        attributes: ['productId', 'productName', 'unitPrice', 'unitsInStock', 'discontinued'],
        required: false
      });
    }
    
    const { count, rows } = await models.Category.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [[sort, order]],
      distinct: true
    });
    
    // Add business logic to each category
    const categoriesWithLogic = await Promise.all(
      rows.map(async (category) => {
        const categoryData = category.toJSON();
        
        // Get product counts
        const productCount = categoryData.products ? categoryData.products.length : 
          await models.Product.count({ where: { categoryId: category.categoryId } });
        
        const activeProductCount = categoryData.products ? 
          categoryData.products.filter(p => !p.discontinued).length :
          await models.Product.count({ 
            where: { categoryId: category.categoryId, discontinued: false } 
          });
        
        // Add computed fields
        categoryData.productCount = productCount;
        categoryData.activeProductCount = activeProductCount;
        categoryData.hasProducts = productCount > 0;
        categoryData.isPopular = productCount >= 10;
        
        // Add statistics if requested
        if (includeStatistics && categoryData.products) {
          categoryData.statistics = calculateCategoryStatistics(categoryData.products);
        }
        
        return categoryData;
      })
    );
    
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: categoriesWithLogic,
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
 * /categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeProducts
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  query('includeProducts').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeProducts = req.query.includeProducts === 'true';
    
    const include = [];
    if (includeProducts) {
      include.push({
        model: models.Product,
        as: 'products',
        attributes: ['productId', 'productName', 'unitPrice', 'unitsInStock', 'discontinued']
      });
    }
    
    const category = await models.Category.findByPk(id, { include });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          statusCode: 404
        }
      });
    }
    
    const categoryData = category.toJSON();
    
    // Add business logic
    const productCount = await models.Product.count({ where: { categoryId: id } });
    const activeProductCount = await models.Product.count({ 
      where: { categoryId: id, discontinued: false } 
    });
    
    categoryData.productCount = productCount;
    categoryData.activeProductCount = activeProductCount;
    categoryData.hasProducts = productCount > 0;
    categoryData.isPopular = productCount >= 10;
    
    // Add statistics if products included
    if (includeProducts && categoryData.products) {
      categoryData.statistics = calculateCategoryStatistics(categoryData.products);
      
      // Enhance product data
      categoryData.products = categoryData.products.map(product => ({
        ...product,
        stockStatus: getProductStockStatus(product),
        isActive: !product.discontinued
      }));
    }
    
    res.json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create new category
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryName
 *             properties:
 *               categoryName:
 *                 type: string
 *                 maxLength: 15
 *               description:
 *                 type: string
 *               picture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', [
  body('categoryName')
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 1, max: 15 })
    .withMessage('Category name must be between 1 and 15 characters'),
  body('description').optional().isString(),
  body('picture').optional()
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Business validation
    validateCategoryData(req.body);
    
    // Check for duplicate category name
    const existingCategory = await models.Category.findOne({
      where: { categoryName: req.body.categoryName },
      transaction
    });

    if (existingCategory) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: {
          message: `Category with name '${req.body.categoryName}' already exists`,
          statusCode: 400
        }
      });
    }
    
    const category = await models.Category.create(req.body, { transaction });
    await transaction.commit();
    
    // Add business logic to response
    const categoryData = category.toJSON();
    categoryData.productCount = 0;
    categoryData.activeProductCount = 0;
    categoryData.hasProducts = false;
    categoryData.isPopular = false;
    
    res.status(201).json({
      success: true,
      data: categoryData,
      message: 'Category created successfully'
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
 * /categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Categories]
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
 *               categoryName:
 *                 type: string
 *                 maxLength: 15
 *               description:
 *                 type: string
 *               picture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('categoryName')
    .optional()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ min: 1, max: 15 })
    .withMessage('Category name must be between 1 and 15 characters'),
  body('description').optional().isString(),
  body('picture').optional()
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Check if category exists
    const existingCategory = await models.Category.findByPk(id, { transaction });
    if (!existingCategory) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          statusCode: 404
        }
      });
    }
    
    // Business validation
    if (req.body.categoryName) {
      validateCategoryData(req.body);
      
      // Check for duplicate name (excluding current category)
      const duplicateCategory = await models.Category.findOne({
        where: {
          categoryName: req.body.categoryName,
          categoryId: { [Op.ne]: id }
        },
        transaction
      });

      if (duplicateCategory) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: {
            message: `Category with name '${req.body.categoryName}' already exists`,
            statusCode: 400
          }
        });
      }
    }
    
    // Update category
    await models.Category.update(req.body, {
      where: { categoryId: id },
      transaction
    });
    
    await transaction.commit();
    
    // Get updated category with business logic
    const updatedCategory = await models.Category.findByPk(id);
    const categoryData = updatedCategory.toJSON();
    
    const productCount = await models.Product.count({ where: { categoryId: id } });
    const activeProductCount = await models.Product.count({ 
      where: { categoryId: id, discontinued: false } 
    });
    
    categoryData.productCount = productCount;
    categoryData.activeProductCount = activeProductCount;
    categoryData.hasProducts = productCount > 0;
    categoryData.isPopular = productCount >= 10;
    
    res.json({
      success: true,
      data: categoryData,
      message: 'Category updated successfully'
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
 * /categories/{id}:
 *   delete:
 *     summary: Delete category
 *     tags: [Categories]
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
 *         description: Force delete even with associated products
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 *       400:
 *         description: Cannot delete category with products
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
  query('force').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    
    // Check if category exists
    const category = await models.Category.findByPk(id, { transaction });
    if (!category) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          statusCode: 404
        }
      });
    }
    
    // Check if category has products
    const productCount = await models.Product.count({
      where: { categoryId: id },
      transaction
    });
    
    if (productCount > 0 && !force) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot delete category with ${productCount} products. Use force=true to override.`,
          statusCode: 400
        }
      });
    }
    
    if (force && productCount > 0) {
      // Set products to null category
      await models.Product.update(
        { categoryId: null },
        { 
          where: { categoryId: id },
          transaction
        }
      );
    }
    
    // Delete category
    await models.Category.destroy({
      where: { categoryId: id },
      transaction
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: 'Category deleted successfully',
      data: {
        deletedCategoryId: id,
        affectedProducts: productCount
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @swagger
 * /categories/{id}/products:
 *   get:
 *     summary: Get products by category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
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
 *         name: includeDiscontinued
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Products in category
 *       404:
 *         description: Category not found
 */
router.get('/:id/products', [
  param('id').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('includeDiscontinued').optional().isBoolean(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const includeDiscontinued = req.query.includeDiscontinued === 'true';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;
    const offset = (page - 1) * limit;
    
    // Check if category exists
    const category = await models.Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          statusCode: 404
        }
      });
    }
    
    // Build where clause
    const where = { categoryId: id };
    
    if (!includeDiscontinued) {
      where.discontinued = false;
    }
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.unitPrice = {};
      if (minPrice !== undefined) where.unitPrice[Op.gte] = minPrice;
      if (maxPrice !== undefined) where.unitPrice[Op.lte] = maxPrice;
    }
    
    const { count, rows } = await models.Product.findAndCountAll({
      where,
      include: [
        {
          model: models.Supplier,
          as: 'supplier',
          attributes: ['supplierId', 'companyName']
        }
      ],
      limit,
      offset,
      order: [['productName', 'ASC']]
    });
    
    // Add business logic to products
    const productsWithLogic = rows.map(product => ({
      ...product.toJSON(),
      stockStatus: getProductStockStatus(product),
      isActive: !product.discontinued,
      stockValue: parseFloat(product.unitPrice || 0) * parseInt(product.unitsInStock || 0)
    }));
    
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
 * /categories/statistics:
 *   get:
 *     summary: Get category statistics
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category statistics with business metrics
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const categories = await models.Category.findAll({
      include: [{
        model: models.Product,
        as: 'products',
        attributes: ['productId', 'unitPrice', 'unitsInStock', 'discontinued']
      }],
      order: [['categoryName', 'ASC']]
    });

    const categoriesWithStats = categories.map(category => {
      const categoryData = category.toJSON();
      const products = categoryData.products || [];
      
      const statistics = calculateCategoryStatistics(products);
      
      return {
        ...categoryData,
        statistics,
        isPopular: statistics.totalProducts >= 10,
        hasLowStockProducts: statistics.lowStockProducts > 0,
        healthScore: statistics.activeProducts > 0 ? 
          Math.round((statistics.activeProducts / Math.max(statistics.totalProducts, 1)) * 100) : 0
      };
    });

    res.json({
      success: true,
      data: categoriesWithStats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /categories/{categoryName}/sales/{year}:
 *   get:
 *     summary: Get sales by category for a specific year
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: categoryName
 *         required: true
 *         schema:
 *           type: string
 *         description: Category name
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: string
 *         description: Order year (YYYY format)
 *     responses:
 *       200:
 *         description: Sales data by category and year
 *       404:
 *         description: Category not found
 */
router.get('/:categoryName/sales/:year', [
  param('categoryName').notEmpty().withMessage('Category name is required'),
  param('year').isLength({ min: 4, max: 4 }).isNumeric().withMessage('Year must be 4 digits')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { categoryName, year } = req.params;

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const salesData = await models.OrderDetail.findAll({
      attributes: [
        [sequelize.col('product.productName'), 'productName'],
        [
          sequelize.fn(
            'ROUND',
            sequelize.fn(
              'SUM',
              sequelize.literal('OrderDetail.unitPrice * OrderDetail.quantity * (1 - OrderDetail.discount)')
            ),
            0
          ),
          'totalPurchase'
        ]
      ],
      include: [
        {
          model: models.Product,
          as: 'product',
          attributes: [],
          include: [
            {
              model: models.Category,
              as: 'category',
              attributes: [],
              where: {
                categoryName: categoryName
              }
            }
          ]
        },
        {
          model: models.SalesOrder,
          as: 'order',
          attributes: [],
          where: {
            orderDate: {
              [Op.between]: [startDate, endDate]
            }
          }
        }
      ],
      group: ['product.productName'],
      order: [sequelize.literal('productName ASC')],
      raw: true
    });

    const formattedData = salesData.map(item => ({
      ProductName: item.productName,
      TotalPurchase: parseFloat(item.totalPurchase || 0).toFixed(2)
    }));

    res.json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error('[SalesByCategory Error]', error);
    next(error);
  }
});

/**
 * @swagger
 * /categories/customers/{customerId}/orders:
 *   get:
 *     summary: Get customer orders with category information
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
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
 *       - in: query
 *         name: categoryName
 *         schema:
 *           type: string
 *         description: Filter by category name
 *     responses:
 *       200:
 *         description: Customer orders with category details
 *       404:
 *         description: Customer not found
 */
router.get('/customers/:customerId/orders', [
  param('customerId').isInt({ min: 1 }).withMessage('Customer ID must be a positive integer'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('categoryName').optional().isString()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const categoryName = req.query.categoryName;
    const offset = (page - 1) * limit;
    
    // Check if customer exists
    const customer = await models.Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Customer not found',
          statusCode: 404
        }
      });
    }

    // Build the SQL query using raw query to avoid association issues
    let categoryFilter = '';
    let queryParams = { customerId, limit, offset };
    
    if (categoryName) {
      categoryFilter = 'AND c.categoryName ILIKE :categoryName';
      queryParams.categoryName = `%${categoryName}%`;
    }

    const customerOrdersQuery = `
      SELECT 
        so.custId as "customerID",
        p.productName as "productName",
        p.productId as "productID",
        c.categoryName as "categoryName",
        od.quantity as "quantity",
        od.unitPrice as "unitPrice",
        so.orderDate as "orderDate",
        (od.unitPrice * od.quantity * (1 - od.discount)) as "lineTotal"
      FROM OrderDetail od
      JOIN Product p ON od.productId = p.productId
      JOIN Category c ON p.categoryId = c.categoryId
      JOIN SalesOrder so ON od.orderId = so.orderId
      WHERE so.custId = :customerId
      ${categoryFilter}
      ORDER BY so.orderDate DESC
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM OrderDetail od
      JOIN Product p ON od.productId = p.productId
      JOIN Category c ON p.categoryId = c.categoryId
      JOIN SalesOrder so ON od.orderId = so.orderId
      WHERE so.custId = :customerId
      ${categoryFilter}
    `;

    const [customerOrders, countResult] = await Promise.all([
      sequelize.query(customerOrdersQuery, {
        replacements: queryParams,
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(countQuery, {
        replacements: { customerId, categoryName: queryParams.categoryName },
        type: sequelize.QueryTypes.SELECT
      })
    ]);

    const totalCount = parseInt(countResult[0].total);

    // Format the response to match .NET DTO structure
    const formattedOrders = customerOrders.map(order => ({
      customerID: order.customerID,
      productName: order.productName,
      productID: order.productID,
      categoryName: order.categoryName,
      quantity: order.quantity,
      unitPrice: parseFloat(order.unitPrice).toFixed(2),
      orderDate: order.orderDate,
      lineTotal: parseFloat(order.lineTotal || 0).toFixed(2)
    }));

    // Calculate summary statistics
    const totalSpent = formattedOrders.reduce((sum, order) => 
      sum + parseFloat(order.lineTotal), 0
    );
    
    const categoriesOrdered = [...new Set(formattedOrders.map(order => order.categoryName))];
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: formattedOrders,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: totalPages
      },
      summary: {
        customerID: parseInt(customerId),
        customerName: customer.companyName,
        totalOrderItems: totalCount,
        totalAmountSpent: totalSpent.toFixed(2),
        categoriesOrdered: categoriesOrdered.length,
        categoryList: categoriesOrdered
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /categories/customers/top:
 *   get:
 *     summary: Get top customers (distinct customers)
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 15
 *         description: Number of top customers to return
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [orderCount, totalSpent, contactName]
 *           default: orderCount
 *         description: Sort criteria for top customers
 *     responses:
 *       200:
 *         description: List of top customers with order statistics
 */
router.get('/customers/top', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['orderCount', 'totalSpent', 'contactName'])
], handleValidationErrors, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 15;
    const sortBy = req.query.sortBy || 'orderCount';
    
    // First, let's get customers with a simpler approach to avoid association issues
    const customersWithStats = await sequelize.query(`
      SELECT 
        c.custId,
        c.contactName,
        c.companyName,
        c.city,
        c.country,
        COUNT(DISTINCT so.orderId) as orderCount,
        COALESCE(SUM(so.freight), 0) as totalFreight,
        COALESCE(SUM(
          (SELECT SUM(od.unitPrice * od.quantity * (1 - od.discount))
           FROM OrderDetail od 
           WHERE od.orderId = so.orderId)
        ), 0) as totalSpent
      FROM Customer c
      LEFT JOIN SalesOrder so ON c.custId = so.custId
      GROUP BY c.custId, c.contactName, c.companyName, c.city, c.country
      ORDER BY ${sortBy === 'totalSpent' ? 'totalSpent' : sortBy === 'contactName' ? 'c.contactName' : 'orderCount'} ${sortBy === 'contactName' ? 'ASC' : 'DESC'}
      LIMIT :limit
    `, {
      replacements: { limit },
      type: sequelize.QueryTypes.SELECT
    });

    // Format the response with enhanced customer information
    const formattedCustomers = customersWithStats.map((customer, index) => {
      const orderCount = parseInt(customer.orderCount || 0);
      const totalSpent = parseFloat(customer.totalSpent || 0);
      
      return {
        rank: index + 1,
        customerID: customer.custId,
        contactName: customer.contactName,
        companyName: customer.companyName,
        city: customer.city,
        country: customer.country,
        orderCount: orderCount,
        totalSpent: totalSpent.toFixed(2),
        totalFreight: parseFloat(customer.totalFreight || 0).toFixed(2),
        averageOrderValue: orderCount > 0 ? 
          (totalSpent / orderCount).toFixed(2) : '0.00',
        customerTier: getCustomerTier(orderCount, totalSpent)
      };
    });

    // Calculate summary statistics
    const totalCustomers = await models.Customer.count();
    const totalOrderValue = formattedCustomers.reduce((sum, customer) => 
      sum + parseFloat(customer.totalSpent), 0
    );

    res.json({
      success: true,
      data: formattedCustomers,
      meta: {
        totalCustomers,
        topCustomersShown: formattedCustomers.length,
        sortedBy: sortBy,
        totalValueFromTopCustomers: totalOrderValue.toFixed(2),
        averageValuePerTopCustomer: formattedCustomers.length > 0 ? 
          (totalOrderValue / formattedCustomers.length).toFixed(2) : '0.00'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function for customer tier classification
function getCustomerTier(orderCount, totalSpent) {
  if (orderCount >= 20 && totalSpent >= 10000) return 'Platinum';
  if (orderCount >= 10 && totalSpent >= 5000) return 'Gold';
  if (orderCount >= 5 && totalSpent >= 1000) return 'Silver';
  return 'Bronze';
}

module.exports = router;