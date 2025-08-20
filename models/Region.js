const { DataTypes } = require('sequelize');
const Region = (sequelize) => {
    const Region = sequelize.define('Region', {
      regionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        field: 'regionId'
      },
      regionDescription: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'regiondescription',
        validate: {
          notEmpty: { msg: 'Region description cannot be empty' }
        }
      }
    }, {
      tableName: 'Region',
      timestamps: false
    });
  
    Region.associate = (models) => {
      Region.hasMany(models.Territory, {
        foreignKey: 'regionId',
        as: 'territories'
      });
    };
  
    return Region;
  };

  module.exports = Region;