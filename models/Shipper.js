const { DataTypes } = require('sequelize');

const Shipper = (sequelize) => {
  const Shipper = sequelize.define('Shipper', {
    shipperId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'shipperId'
    },
    companyName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'companyName',
      validate: {
        notEmpty: { msg: 'Company name cannot be empty' }
      }
    },
    phone: {
      type: DataTypes.STRING(44),
      allowNull: true,
      field: 'phone'
    }
  }, {
    tableName: 'Shipper',
    timestamps: false
  });

  Shipper.associate = (models) => {
    Shipper.hasMany(models.Order, {
      foreignKey: 'shipperId',
      as: 'orders'
    });
  };

  return Shipper;
};

module.exports = Shipper;
