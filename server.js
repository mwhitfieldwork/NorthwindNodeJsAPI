require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const { sequelize } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Routes
const categoryRoutes = require('./routes/categories');
const customerRoutes = require('./routes/customers');
const employeeRoutes = require('./routes/employees');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const supplierRoutes = require('./routes/suppliers');
const loginRoutes = require('./routes/login');

const app = express();
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(200);
  }
  next();
});

// Security & perf
app.use(helmet());
app.use(compression());

// ✅ CORS (single, dynamic config)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200').split(',');
console.log('Allowed CORS Origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    console.log('🛰️ CORS check for origin:', origin);
    if (!origin || allowedOrigins.some(allowed =>
      allowed === '*' ||
      origin === allowed ||
      (allowed.includes('localhost') && origin.includes('localhost'))
    )) {
      console.log('✅ Origin allowed:', origin);
      callback(null, true);
    } else {
      console.warn('❌ Origin blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ✅ Preflight support

// Body parsing & logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));
app.use(requestLogger);

// Swagger
const API_BASE = process.env.API_BASE_URL || '/api/v1';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: process.env.SWAGGER_TITLE || 'Northwind API',
      version: process.env.SWAGGER_VERSION || '1.0.0',
      description: process.env.SWAGGER_DESCRIPTION || 'REST API for Northwind Database',
    },
    servers: [
      {
        url: `${PUBLIC_BASE_URL}${API_BASE}`,
        description: NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' }
          }
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            pages: { type: 'integer' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './models/*.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Health checks
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await sequelize.query('SELECT 1 AS ok');
    res.json({ status: 'ready', db: true });
  } catch (err) {
    res.status(500).json({ status: 'error', db: false, error: err.message });
  }
});

// API routes
app.use(`${API_BASE}/categories`, categoryRoutes);
app.use(`${API_BASE}/customers`, customerRoutes);
app.use(`${API_BASE}/employees`, employeeRoutes);
app.use(`${API_BASE}/orders`, orderRoutes);
app.use(`${API_BASE}/products`, productRoutes);
app.use(`${API_BASE}/suppliers`, supplierRoutes);
app.use(`${API_BASE}/login`, loginRoutes);

// 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404
  });
});

// Global error handler
app.use(errorHandler);

// Startup
async function startServer() {
  console.log('Server starting...');
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    if (NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized.');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server on :${PORT}`);
      console.log(`📖 Swagger: ${PUBLIC_BASE_URL}/api-docs`);
      console.log(`❤️ Health: ${PUBLIC_BASE_URL}/health`);
      console.log(`🟢 Ready:  ${PUBLIC_BASE_URL}/ready`);
      console.log(`🔗 Base:   ${PUBLIC_BASE_URL}${API_BASE}`);
    });

  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
}

// Shutdown
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

startServer();