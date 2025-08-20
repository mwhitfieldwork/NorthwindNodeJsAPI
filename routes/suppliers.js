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
 *     Supplier:
 *       type: object
 *       properties:
 *         supplierId:
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
 *         email:
 *           type: string
 *           format: email
 *         fax:
 *           type: string
 *           maxLength: 24
 *         homePage:
 *           type: string
 *         productCount:
 *           type: integer
 */

/**
 * @swagger
 * /suppliers:
 *   get:
 *     summary: Get all suppliers with filtering, sorting, and pagination
 *     tags: [Suppliers]
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
 *           enum: [supplierId, companyName, contactName, city, country]
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
 *         name: includeProducts
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of suppliers
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['supplierId', 'companyName', 'contactName', 'city', 'country']),
  query('order').optional().isIn(['ASC', 'DESC']),
  query('search').optional().isLength({ min: 1 }),
  query('country').optional().isString(),
  query('city').optional().isString(),
  query('includeProducts').optional().isBoolean()
], handleValidationErrors, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'companyName';
    const order = req.query.order || 'ASC';
    const search = req.query.search;
    const country = req.query.country;
    const city = req.query.city;
    const includeProducts = req.query.includeProducts === 'true';
    
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
    if (includeProducts) {
      include.push({
        model: models.Product,
        as: 'products',
        attributes: ['productId', 'productName', 'unitPrice', 'discontinued'],
        where: { discontinued: false },
        required: false
      });
    }
    
    const { count, rows } = await models.Supplier.findAndCountAll({
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
 * /suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     tags: [Suppliers]
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
 *         description: Supplier details
 *       404:
 *         description: Supplier not found
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
        attributes: ['productId', 'productName', 'unitPrice', 'unitsInStock', 'discontinued'],
        include: [{
          model: models.Category,
          as: 'category',
          attributes: ['categoryId', 'categoryName']
        }]
      });
    }
    
    const supplier = await models.Supplier.findByPk(id, { include });
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /suppliers:
 *   post:
 *     summary: Create new supplier
 *     tags: [Suppliers]
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
 *               email:
 *                 type: string
 *                 format: email
 *               fax:
 *                 type: string
 *                 maxLength: 24
 *               homePage:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier created successfully
 *       400:
 *         description: Validation error
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
  body('email').optional().isEmail().withMessage('Must be a valid email'),
  body('fax').optional().isLength({ max: 24 }),
  body('homePage').optional().isURL().withMessage('Homepage must be a valid URL')
], handleValidationErrors, async (req, res, next) => {
  try {
    const supplier = await models.Supplier.create(req.body);
    
    res.status(201).json({
      success: true,
      data: supplier,
      message: 'Supplier created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /suppliers/{id}:
 *   put:
 *     summary: Update supplier
 *     tags: [Suppliers]
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
 *               email:
 *                 type: string
 *                 format: email
 *               fax:
 *                 type: string
 *                 maxLength: 24
 *               homePage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 *       404:
 *         description: Supplier not found
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
  body('email').optional().isEmail(),
  body('fax').optional().isLength({ max: 24 }),
  body('homePage').optional().isURL()
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [updatedRows] = await models.Supplier.update(req.body, {
      where: { supplierId: id }
    });
    
    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          statusCode: 404
        }
      });
    }
    
    const updatedSupplier = await models.Supplier.findByPk(id);
    
    res.json({
      success: true,
      data: updatedSupplier,
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /suppliers/{id}:
 *   delete:
 *     summary: Delete supplier
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Supplier deleted successfully
 *       404:
 *         description: Supplier not found
 *       400:
 *         description: Cannot delete supplier with products
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if supplier has products
    const productCount = await models.Product.count({
      where: { supplierId: id }
    });
    
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot delete supplier with ${productCount} products. Remove or reassign products first.`,
          statusCode: 400
        }
      });
    }
    
    const deletedRows = await models.Supplier.destroy({
      where: { supplierId: id }
    });
    
    if (deletedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          statusCode: 404
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /suppliers/{id}/products:
 *   get:
 *     summary: Get supplier products
 *     tags: [Suppliers]
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
 *         name: discontinued
 *         schema:
 *           type: boolean
 *         description: Filter by discontinued status
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Supplier products
 *       404:
 *         description: Supplier not found
 */
router.get('/:id/products', [
  param('id').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('discontinued').optional().isBoolean(),
  query('categoryId').optional().isInt({ min: 1 })
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const discontinued = req.query.discontinued;
    const categoryId = req.query.categoryId;
    const offset = (page - 1) * limit;
    
    // Check if supplier exists
    const supplier = await models.Supplier.findByPk(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          statusCode: 404
        }
      });
    }
    
    const where = { supplierId: id };
    if (discontinued !== undefined) where.discontinued = discontinued === 'true';
    if (categoryId) where.categoryId = categoryId;
    
    const { count, rows } = await models.Product.findAndCountAll({
      where,
      include: [{
        model: models.Category,
        as: 'category',
        attributes: ['categoryId', 'categoryName']
      }],
      limit,
      offset,
      order: [['productName', 'ASC']]
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
 * /suppliers/countries:
 *   get:
 *     summary: Get list of countries with supplier counts
 *     tags: [Suppliers]
 *     responses:
 *       200:
 *         description: List of countries
 */
router.get('/countries', async (req, res, next) => {
  try {
    const countries = await models.Supplier.findAll({
      attributes: [
        'country',
        [models.sequelize.fn('COUNT', models.sequelize.col('supplierId')), 'supplierCount']
      ],
      where: {
        country: { [Op.ne]: null }
      },
      group: ['country'],
      order: [['country', 'ASC']]
    });
    
    res.json({
      success: true,
      data: countries
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /suppliers/statistics:
 *   get:
 *     summary: Get supplier statistics
 *     tags: [Suppliers]
 *     responses:
 *       200:
 *         description: Supplier statistics
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const [
      totalSuppliers,
      suppliersWithProducts,
      suppliersWithoutProducts,
      topSuppliersByProductCount
    ] = await Promise.all([
      models.Supplier.count(),
      models.Supplier.count({
        include: [{
          model: models.Product,
          as: 'products',
          required: true
        }]
      }),
      models.Supplier.count({
        include: [{
          model: models.Product,
          as: 'products',
          required: false,
          where: { productId: null }
        }]
      }),
      models.Supplier.findAll({
        attributes: [
          'supplierId',
          'companyName',
          'country',
          [models.sequelize.fn('COUNT', models.sequelize.col('products.productId')), 'productCount']
        ],
        include: [{
          model: models.Product,
          as: 'products',
          attributes: []
        }],
        group: ['supplierId'],
        order: [[models.sequelize.literal('productCount'), 'DESC']],
        limit: 10
      })
    ]);
    
    res.json({
      success: true,
      data: {
        totalSuppliers,
        suppliersWithProducts,
        suppliersWithoutProducts,
        topSuppliersByProductCount
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;