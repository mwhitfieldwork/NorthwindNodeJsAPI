const { DataTypes } = require('sequelize');
const EmployeeTerritory = (sequelize) => {
    const EmployeeTerritory = sequelize.define('EmployeeTerritory', {
      employeeId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        field: 'employeeId',
        references: {
          model: 'Employee',
          key: 'employeeId'
        }
      },
      territoryId: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        field: 'territoryId',
        references: {
          model: 'Territory',
          key: 'territoryId'
        }
      }
    }, {
      tableName: 'EmployeeTerritory',
      timestamps: false
    });
  
    return EmployeeTerritory;
  };

  module.exports = EmployeeTerritory;