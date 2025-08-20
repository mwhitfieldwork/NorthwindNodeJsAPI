const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('SalesOrder', {
    orderId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'orderId'
    },
    custId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'custId',
      references: {
        model: 'Customer',
        key: 'custId'
      }
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'employeeId',
      references: {
        model: 'Employee',
        key: 'employeeId'
      }
    },
    orderDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'orderDate'
    },
    requiredDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'requiredDate'
    },
    shippedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'shippedDate'
    },
    shipperId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'shipperid',
      references: {
        model: 'Shipper',
        key: 'shipperId'
      }
    },
    freight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'freight',
      defaultValue: 0.00
    },
    shipName: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'shipName'
    },
    shipAddress: {
      type: DataTypes.STRING(60),
      allowNull: true,
      field: 'shipAddress'
    },
    shipCity: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: 'shipCity'
    },
    shipRegion: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: 'shipRegion'
    },
    shipPostalCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'shipPostalCode'
    },
    shipCountry: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: 'shipCountry'
    }
  }, {
    tableName: 'SalesOrder',
    timestamps: false,
    indexes: [
      {
        fields: ['custId']
      },
      {
        fields: ['employeeId']
      },
      {
        fields: ['orderDate']
      },
      {
        fields: ['shippedDate']
      },
      {
        fields: ['shipperId']
      }
    ]
  });

  Order.associate = (models) => {
    Order.belongsTo(models.Customer, {
      foreignKey: 'custId',
      as: 'customer'
    });
    
    Order.belongsTo(models.Employee, {
      foreignKey: 'employeeId',
      as: 'employee'
    });
    
    Order.belongsTo(models.Shipper, {
      foreignKey: 'shipperId',
      as: 'shipper'
    });
    
    Order.hasMany(models.OrderDetail, {
      foreignKey: 'orderId',
      as: 'orderDetails'
    });
  };

  // Instance methods
  Order.prototype.getOrderStatus = function() {
    if (this.shippedDate) return 'Shipped';
    if (this.orderDate && !this.shippedDate) return 'Processing';
    return 'Pending';
  };

  Order.prototype.isOverdue = function() {
    if (!this.requiredDate || this.shippedDate) return false;
    return new Date() > new Date(this.requiredDate);
  };

  Order.prototype.getDaysToShip = function() {
    if (this.shippedDate) return 0;
    if (!this.requiredDate) return null;
    const today = new Date();
    const required = new Date(this.requiredDate);
    return Math.ceil((required - today) / (1000 * 60 * 60 * 24));
  };

  // Virtual fields
  Order.addHook('afterFind', async (instances) => {
    if (!instances) return;
    
    const orders = Array.isArray(instances) ? instances : [instances];
    
    for (const order of orders) {
      if (order && order.dataValues) {
        order.dataValues.orderStatus = order.getOrderStatus();
        order.dataValues.isOverdue = order.isOverdue();
        order.dataValues.daysToShip = order.getDaysToShip();
        
        // Calculate order total if orderDetails are included
        if (order.orderDetails && Array.isArray(order.orderDetails)) {
          const orderTotal = order.orderDetails.reduce((total, detail) => {
            return total + (parseFloat(detail.unitPrice || 0) * parseInt(detail.quantity || 0) * (1 - parseFloat(detail.discount || 0)));
          }, 0);
          order.dataValues.orderTotal = orderTotal + parseFloat(order.freight || 0);
          order.dataValues.subtotal = orderTotal;
        }
      }
    }
  });

  return Order;
};