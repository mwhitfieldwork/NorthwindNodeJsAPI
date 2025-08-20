const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    categoryId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'categoryId'
    },
    categoryName: {
      type: DataTypes.STRING(15),
      allowNull: false,
      field: 'categoryName',
      validate: {
        notEmpty: {
          msg: 'Category name cannot be empty'
        },
        len: {
          args: [1, 15],
          msg: 'Category name must be between 1 and 15 characters'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'description'
    },
    picture: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: 'picture'
    }
  }, {
    tableName: 'Category',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['categoryName']
      }
    ]
  });

  Category.associate = (models) => {
    Category.hasMany(models.Product, {
      foreignKey: 'categoryId',
      as: 'products'
    });
  };

  // Virtual field for product count
  Category.addHook('afterFind', async (instances) => {
    if (!instances) return;
    
    const categories = Array.isArray(instances) ? instances : [instances];
    
    for (const category of categories) {
      if (category && category.dataValues) {
        const productCount = await category.countProducts?.() || 0;
        category.dataValues.productCount = productCount;
      }
    }
  });

  return Category;
};