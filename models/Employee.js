const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Employee = sequelize.define('Employee', {
    employeeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'employeeId'
    },
    lastName: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'lastname',
      validate: {
        notEmpty: {
          msg: 'Last name cannot be empty'
        },
        len: {
          args: [1, 20],
          msg: 'Last name must be between 1 and 20 characters'
        }
      }
    },
    firstName: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'firstname',
      validate: {
        notEmpty: {
          msg: 'First name cannot be empty'
        },
        len: {
          args: [1, 10],
          msg: 'First name must be between 1 and 10 characters'
        }
      }
    },
    title: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'title'
    },
    titleOfCourtesy: {
      type: DataTypes.STRING(25),
      allowNull: true,
      field: 'titleOfCourtesy'
    },
    birthDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'birthDate'
    },
    hireDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'hireDate'
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
    extension: {
      type: DataTypes.STRING(4),
      allowNull: true,
      field: 'extension'
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
    photo: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: 'photo'
    },
    notes: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: 'notes'
    },
    mgrId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'mgrId',
      references: {
        model: 'Employee',
        key: 'employeeId'
      }
    },
    photoPath: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'photoPath'
    }
  }, {
    tableName: 'Employee',
    timestamps: false,
    indexes: [
      {
        fields: ['lastName']
      },
      {
        fields: ['mgrId']
      }
    ]
  });

  Employee.associate = (models) => {
    // Self-referencing association for manager
    Employee.belongsTo(Employee, {
      foreignKey: 'mgrId',
      as: 'manager'
    });
    
    Employee.hasMany(Employee, {
      foreignKey: 'mgrId',
      as: 'subordinates'
    });
    
    Employee.hasMany(models.Order, {
      foreignKey: 'employeeId',
      as: 'orders'
    });

    // Many-to-many with Territory through EmployeeTerritory
    Employee.belongsToMany(models.Territory, {
      through: models.EmployeeTerritory,
      foreignKey: 'employeeId',
      otherKey: 'territoryId',
      as: 'territories'
    });
  };

  // Instance methods
  Employee.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  Employee.prototype.getAge = function() {
    if (!this.birthDate) return null;
    const today = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  Employee.prototype.getYearsOfService = function() {
    if (!this.hireDate) return null;
    const today = new Date();
    const hireDate = new Date(this.hireDate);
    return Math.floor((today - hireDate) / (365.25 * 24 * 60 * 60 * 1000));
  };

  // Virtual fields
  Employee.addHook('afterFind', async (instances) => {
    if (!instances) return;
    
    const employees = Array.isArray(instances) ? instances : [instances];
    
    for (const employee of employees) {
      if (employee && employee.dataValues) {
        employee.dataValues.fullName = employee.getFullName();
        employee.dataValues.age = employee.getAge();
        employee.dataValues.yearsOfService = employee.getYearsOfService();
        
        const orderCount = await employee.countOrders?.() || 0;
        employee.dataValues.orderCount = orderCount;
      }
    }
  });

  return Employee;
};