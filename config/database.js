// config/database.js
const { Sequelize, DataTypes } = require('sequelize');

/**
 * Env support:
 * - Prefer a single URL if provided: DATABASE_URL | MYSQL_URL | RAILWAY_DATABASE_URL
 * - Otherwise use individual fields. We support both DB_* and DATABASE_* and Railway's MYSQL* vars.
 */
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';

const URL =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.RAILWAY_DATABASE_URL;

const HOST =
  process.env.DATABASE_HOST ||
  process.env.DB_HOST ||
  process.env.MYSQLHOST ||
  'localhost';

const PORT =
  Number(process.env.DATABASE_PORT || process.env.DB_PORT || process.env.MYSQLPORT || 3306);

const USER =
  process.env.DATABASE_USER ||
  process.env.DB_USERNAME ||
  process.env.MYSQLUSER ||
  'root';

const PASSWORD =
  process.env.DATABASE_PASSWORD ||
  process.env.DB_PASSWORD ||
  process.env.MYSQLPASSWORD ||
  '';

const NAME =
  process.env.DATABASE_NAME ||
  process.env.DB_NAME ||
  process.env.MYSQLDATABASE ||
  'Northwind';

/**
 * SSL: Railway's MySQL proxy typically needs TLS. We default to enabling SSL in production.
 * You can force it on/off with DB_SSL=true/false if needed.
 */
const sslWanted = String(process.env.DB_SSL || (isProd ? 'true' : 'false')).toLowerCase() === 'true';

const baseOptions = {
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: false,
    freezeTableName: true,
    underscored: false,
  },
  pool: {
    max: 15,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
  timezone: '+00:00',
  dialectOptions: {
    // character set preferences
    charset: 'utf8',
    collate: 'utf8_general_ci',
    ...(sslWanted ? { ssl: { rejectUnauthorized: false } } : {}),
  },
};

const sequelize = URL
  ? new Sequelize(URL, baseOptions)
  : new Sequelize(NAME, USER, PASSWORD, {
      host: HOST,
      port: PORT,
      ...baseOptions,
    });

/** -------------------------
 *  Model definitions
 *  -------------------------
 *  We keep your `models` map so routes/controllers can access them uniformly.
 *  We pass (sequelize, DataTypes) to every model; extra args are harmless if unused.
 */
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const SalesOrder = require('../models/Order');
const OrderDetail = require('../models/OrderDetail');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Shipper = require('../models/Shipper');
const Territory = require('../models/Territory');
const Region = require('../models/Region');
const CustomerDemographics = require('../models/CustomerDemographics');
const EmployeeTerritory = require('../models/EmployeeTerritory');
const User = require('../models/User');

const models = {
  Category: Category(sequelize, DataTypes),
  Customer: Customer(sequelize, DataTypes),
  Employee: Employee(sequelize, DataTypes),
  SalesOrder: SalesOrder(sequelize, DataTypes),
  OrderDetail: OrderDetail(sequelize, DataTypes),
  Product: Product(sequelize, DataTypes),
  Supplier: Supplier(sequelize, DataTypes),
  Shipper: Shipper(sequelize, DataTypes),
  Territory: Territory(sequelize, DataTypes),
  Region: Region(sequelize, DataTypes),
  CustomerDemographics: CustomerDemographics(sequelize, DataTypes),
  EmployeeTerritory: EmployeeTerritory(sequelize, DataTypes),
  User: User(sequelize, DataTypes),
};

// Wire up associations if
for (const name of Object.keys(models)) {
  if (typeof models[name].associate === 'function') {
    models[name].associate(models);
  }
}

/**
 * Small helper you can use in /ready
 */
async function pingDatabase() {
  const [rows] = await sequelize.query('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}

module.exports = {
  sequelize,
  models,
  pingDatabase,
};
