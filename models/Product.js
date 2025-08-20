const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    productId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'productId'
    },
    productName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'productName',
      validate: {
        notEmpty: {
          msg: 'Product name cannot be empty'
        },
        len: {
          args: [1, 40],
          msg: 'Product name must be between 1 and 40 characters'
        }
      }
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'supplierId',
      references: {
        model: 'Supplier',
        key: 'supplierId'
      }
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'categoryId',
      references: {
        model: 'Category',
        key: 'categoryId'
      }
    },
    quantityPerUnit: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'quantityPerUnit'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'unitPrice',
      validate: {
        min: {
          args: 0,
          msg: 'Unit price must be non-negative'
        }
      }
    },
    unitsInStock: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      field: 'unitsInStock',
      validate: {
        min: {
          args: 0,
          msg: 'Units in stock must be non-negative'
        }
      }
    },
    unitsOnOrder: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      field: 'unitsOnOrder',
      validate: {
        min: {
          args: 0,
          msg: 'Units on order must be non-negative'
        }
      }
    },
    reorderLevel: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      field: 'reorderLevel',
      validate: {
        min: {
          args: 0,
          msg: 'Reorder level must be non-negative'
        }
      }
    },
    discontinued: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'discontinued',
      defaultValue: false
    }
  }, {
    tableName: 'Product',
    timestamps: false,
    indexes: [
      {
        fields: ['productName']
      },
      {
        fields: ['categoryId']
      },
      {
        fields: ['supplierId']
      },
      {
        fields: ['discontinued']
      }
    ]
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category'
    });
    
    Product.belongsTo(models.Supplier, {
      foreignKey: 'supplierId',
      as: 'supplier'
    });
    
    Product.hasMany(models.OrderDetail, {
      foreignKey: 'productId',
      as: 'orderDetails'
    });
  };

  // Instance methods
  Product.prototype.isDiscontinued = function() {
    return this.discontinued === 1 || this.discontinued === true;
  };

  Product.prototype.isLowStock = function() {
    const stock = parseInt(this.unitsInStock || 0);
    const reorder = parseInt(this.reorderLevel || 0);
    return stock <= reorder && stock > 0;
  };

  Product.prototype.isOutOfStock = function() {
    return parseInt(this.unitsInStock || 0) === 0;
  };

  Product.prototype.getAvailableStock = function() {
    return parseInt(this.unitsInStock || 0) + parseInt(this.unitsOnOrder || 0);
  };

  Product.prototype.getStockValue = function() {
    return parseFloat(this.unitPrice || 0) * parseInt(this.unitsInStock || 0);
  };

  Product.prototype.getStockStatus = function() {
    if (this.isDiscontinued()) return 'Discontinued';
    if (this.isOutOfStock()) return 'Out of Stock';
    if (this.isLowStock()) return 'Low Stock';
    return 'In Stock';
  };

  // Virtual fields
  Product.addHook('afterFind', async (instances) => {
    if (!instances) return;
    
    const products = Array.isArray(instances) ? instances : [instances];
    
    for (const product of products) {
      if (product && product.dataValues) {
        product.dataValues.stockStatus = product.getStockStatus();
        product.dataValues.availableStock = product.getAvailableStock();
        product.dataValues.stockValue = product.getStockValue();
        product.dataValues.isLowStock = product.isLowStock();
        product.dataValues.isOutOfStock = product.isOutOfStock();
      }
    }
  });

  return Product;
};