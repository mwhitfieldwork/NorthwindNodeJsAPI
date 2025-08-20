const { DataTypes } = require('sequelize');
const Territory = (sequelize) => {
    const Territory = sequelize.define('Territory', {
      territoryId: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        field: 'territoryId'
      },
      territoryDescription: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'territorydescription',
        validate: {
          notEmpty: { msg: 'Territory description cannot be empty' }
        }
      },
      regionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'regionId',
        references: {
          model: 'Region',
          key: 'regionId'
        }
      }
    }, {
      tableName: 'Territory',
      timestamps: false
    });
  
    Territory.associate = (models) => {
      Territory.belongsTo(models.Region, {
        foreignKey: 'regionId',
        as: 'region'
      });
  
      Territory.belongsToMany(models.Employee, {
        through: models.EmployeeTerritory,
        foreignKey: 'territoryId',
        otherKey: 'employeeId',
        as: 'employees'
      });
    };
  
    return Territory;
  };

  module.exports = Territory;