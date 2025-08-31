const { Sequelize } = require('sequelize');

// Database configuration
const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'Northwind',
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'northwind123',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  dialectOptions: {
    charset: 'utf8',
    collate: 'utf8_general_ci',
  },
  define: {
    timestamps: false,
    freezeTableName: true,
    underscored: false,
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 20,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
  timezone: '+00:00',
});

// Import models
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const SalesOrder  = require('../models/Order');
const OrderDetail = require('../models/OrderDetail');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Shipper = require('../models/Shipper');
const Territory = require('../models/Territory');
const Region = require('../models/Region');
const CustomerDemographics = require('../models/CustomerDemographics');
const EmployeeTerritory = require('../models/EmployeeTerritory');
const User = require('../models/User'); // ADD THIS LINE
const CustomerModel = require('../models/Customer');
const SalesOrderModel = require('../models/Order');


// Initialize models
const models = {
  Category: Category(sequelize),
  //Customer: Customer(sequelize),
  Customer: CustomerModel(sequelize, Sequelize.DataTypes),
  Employee: Employee(sequelize),
  //SalesOrder: SalesOrder(sequelize),
  SalesOrder: SalesOrderModel(sequelize, Sequelize.DataTypes),
  OrderDetail: OrderDetail(sequelize),
  Product: Product(sequelize),
  Supplier: Supplier(sequelize),
  Shipper: Shipper(sequelize),
  Territory: Territory(sequelize),
  Region: Region(sequelize),
  CustomerDemographics: CustomerDemographics(sequelize),
  EmployeeTerritory: EmployeeTerritory(sequelize),
  User: User(sequelize), 
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = {
  sequelize,
  models,
};