const { DataTypes } = require('sequelize');
const CustomerDemographics = (sequelize) => {
  const CustomerDemographics = sequelize.define('CustomerDemographics', {
    customerTypeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'customerTypeId'
    },
    customerDesc: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'customerDesc'
    }
  }, {
    tableName: 'CustomerDemographics',
    timestamps: false
  });

  return CustomerDemographics;
};

module.exports = CustomerDemographics;