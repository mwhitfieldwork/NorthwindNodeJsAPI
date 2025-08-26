const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    PKID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    UserName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isEmail: true
      }
    },
    Password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [6, 255]
      }
    },
    admin: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1]]
      }
    }
  }, {
    tableName: 'Users', // Changed to lowercase to match typical conventions
    timestamps: false,
    hooks: {
      beforeCreate: async (user) => {
        if (user.Password) {
          const saltRounds = 12;
          user.Password = await bcrypt.hash(user.Password, saltRounds);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('Password')) {
          const saltRounds = 12;
          user.Password = await bcrypt.hash(user.Password, saltRounds);
        }
      }
    }
  });

  // Instance methods
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.Password);
  };

  User.prototype.toSafeObject = function() {
    return {
      PKID: this.PKID,
      UserName: this.UserName,
      admin: this.admin
    };
  };

  // Static methods (class methods)
  User.findByUserName = async function(userName) {
    return await this.findOne({
      where: { UserName: userName }
    });
  };

  return User;
};