const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderDetail = sequelize.define('OrderDetail', {
    orderDetailId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'orderDetailId'
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'orderId',
      references: {
        model: 'SalesOrder',
        key: 'orderId'
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'productId',
      references: {
        model: 'Product',
        key: 'productId'
      }
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'unitPrice',
      validate: {
        min: {
          args: 0,
          msg: 'Unit price must be non-negative'
        }
      }
    },
    quantity: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      field: 'quantity',
      validate: {
        min: {
          args: 1,
          msg: 'Quantity must be at least 1'
        }
      }
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'discount',
      defaultValue: 0.00,
      validate: {
        min: {
          args: 0,
          msg: 'Discount must be non-negative'
        },
        max: {
          args: 1,
          msg: 'Discount cannot exceed 100%'
        }
      }
    }
  }, {
    tableName: 'OrderDetail',
    timestamps: false,
    indexes: [
      {
        fields: ['orderId']
      },
      {
        fields: ['productId']
      }
    ]
  });

  OrderDetail.associate = (models) => {
    OrderDetail.belongsTo(models.SalesOrder, { // ✅ updated from models.SalesOrder
      foreignKey: 'orderId',
      as: 'order' // 👈 keep this alias consistent with your query
    });
  
    OrderDetail.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product'
    });
  };

  // Instance methods
  OrderDetail.prototype.getLineTotal = function() {
    return parseFloat(this.unitPrice) * parseInt(this.quantity) * (1 - parseFloat(this.discount));
  };

  OrderDetail.prototype.getDiscountAmount = function() {
    return parseFloat(this.unitPrice) * parseInt(this.quantity) * parseFloat(this.discount);
  };

  // Virtual fields
  OrderDetail.addHook('afterFind', async (instances) => {
    if (!instances) return;
    
    const details = Array.isArray(instances) ? instances : [instances];
    
    for (const detail of details) {
      if (detail && detail.dataValues) {
        detail.dataValues.lineTotal = detail.getLineTotal();
        detail.dataValues.discountAmount = detail.getDiscountAmount();
        detail.dataValues.subtotal = parseFloat(detail.unitPrice) * parseInt(detail.quantity);
      }
    }
  });

  return OrderDetail;
};