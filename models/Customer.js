const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
    custId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'custId'
    },
    companyName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'companyName',
      validate: {
        notEmpty: {
          msg: 'Company name cannot be empty'
        },
        len: {
          args: [1, 40],
          msg: 'Company name must be between 1 and 40 characters'
        }
      }
    },
    contactName: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'contactName'
    },
    contactTitle: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'contactTitle'
    },
    address: {
      type: DataTypes.STRING(60),
      allowNull: true,
      field: 'address'
    },
    city: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: 'city'
    },
    region: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: 'region'
    },
    postalCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'postalCode'
    },
    country: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: 'country'
    },
    phone: {
      type: DataTypes.STRING(24),
      allowNull: true,
      field: 'phone'
    },
    mobile: {
      type: DataTypes.STRING(24),
      allowNull: true,
      field: 'mobile'
    },
    email: {
      type: DataTypes.STRING(225),
      allowNull: true,
      field: 'email',
      validate: {
        isEmail: {
          msg: 'Must be a valid email address'
        }
      }
    },
    fax: {
      type: DataTypes.STRING(24),
      allowNull: true,
      field: 'fax'
    }
  }, {
    tableName: 'Customer',
    timestamps: false,
    indexes: [
      {
        fields: ['companyName']
      },
      {
        fields: ['city']
      },
      {
        fields: ['country']
      },
      {
        fields: ['postalCode']
      }
    ]
  });

  Customer.associate = (models) => {
    Customer.hasMany(models.Order, {
      foreignKey: 'custId',
      as: 'orders'
    });
  };

  // Instance methods
  Customer.prototype.getFullAddress = function() {
    const parts = [this.address, this.city, this.region, this.postalCode, this.country];
    return parts.filter(part => part).join(', ');
  };

  // Virtual fields
  Customer.addHook('afterFind', async (instances) => {
    if (!instances) return;
    
    const customers = Array.isArray(instances) ? instances : [instances];
    
    for (const customer of customers) {
      if (customer && customer.dataValues) {
        const orderCount = await customer.countOrders?.() || 0;
        customer.dataValues.orderCount = orderCount;
        customer.dataValues.fullAddress = customer.getFullAddress();
      }
    }
  });

  return Customer;
};