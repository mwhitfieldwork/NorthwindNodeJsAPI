# Northwind REST API

A comprehensive Node.js REST API built with Express and Sequelize ORM, replicating the classic Northwind database functionality with full CRUD operations, advanced filtering, sorting, pagination, and business logic.

## 🚀 Features

- **Full CRUD Operations** for all entities (Categories, Customers, Employees, Orders, Products, Suppliers, Shippers, Territories, Regions)
- **Advanced Filtering & Search** with multiple criteria
- **Sorting & Pagination** support
- **Business Logic & Computed Fields** (order totals, stock status, employee age, etc.)
- **Data Validation** with express-validator
- **CORS Support** for cross-domain access
- **Swagger API Documentation** 
- **Error Handling & Logging** middleware
- **Docker & Docker Compose** support
- **MySQL Database** with Sequelize ORM
- **Unit Tests** with Jest
- **Health Check** endpoints

## 📋 Prerequisites

- Node.js 18+ (LTS recommended)
- MySQL 8.0+
- Docker & Docker Compose (optional)

## 🛠️ Installation & Setup

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd northwind-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Database Setup**
   - Create MySQL database named `Northwind`
   - Import the Northwind schema from the provided SQL file
   - Run migrations (if using Sequelize CLI):
     ```bash
     npm run migrate
     npm run seed
     ```

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

### Option 2: Docker Compose (Recommended)

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd northwind-api
   cp .env.example .env
   # Edit .env as needed
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - MySQL database (port 3306)
   - Northwind API (port 3000)
   - phpMyAdmin (port 8080, optional)

3. **Check status**
   ```bash
   docker-compose ps
   docker-compose logs api
   ```

## 📚 API Documentation

Once the server is running, access:
- **Swagger Documentation**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/health`

## 🔗 API Endpoints

### Base URL: `/api/v1`

| Entity | Endpoints | Description |
|--------|-----------|-------------|
| **Categories** | `GET /categories` | List all categories with filtering/pagination |
| | `GET /categories/:id` | Get category by ID |
| | `POST /categories` | Create new category |
| | `PUT /categories/:id` | Update category |
| | `DELETE /categories/:id` | Delete category |
| **Customers** | `GET /customers` | List all customers with filtering/pagination |
| | `GET /customers/:id` | Get customer by ID |
| | `POST /customers` | Create new customer |
| | `PUT /customers/:id` | Update customer |
| | `DELETE /customers/:id` | Delete customer |
| **Employees** | `GET /employees` | List all employees with filtering/pagination |
| | `GET /employees/:id` | Get employee by ID |
| | `POST /employees` | Create new employee |
| | `PUT /employees/:id` | Update employee |
| | `DELETE /employees/:id` | Delete employee |
| **Orders** | `GET /orders` | List all orders with filtering/pagination |
| | `GET /orders/:id` | Get order by ID with details |
| | `POST /orders` | Create new order |
| | `PUT /orders/:id` | Update order |
| | `DELETE /orders/:id` | Delete order |
| **Products** | `GET /products` | List all products with filtering/pagination |
| | `GET /products/:id` | Get product by ID |
| | `POST /products` | Create new product |
| | `PUT /products/:id` | Update product |
| | `DELETE /products/:id` | Delete product |
| **Suppliers** | `GET /suppliers` | List all suppliers |
| | `GET /suppliers/:id` | Get supplier by ID |
| | `POST /suppliers` | Create new supplier |
| | `PUT /suppliers/:id` | Update supplier |
| | `DELETE /suppliers/:id` | Delete supplier |
| **Shippers** | `GET /shippers` | List all shippers |
| | `GET /shippers/:id` | Get shipper by ID |
| | `POST /shippers` | Create new shipper |
| | `PUT /shippers/:id` | Update shipper |
| | `DELETE /shippers/:id` | Delete shipper |
| **Regions** | `GET /regions` | List all regions |
| **Territories** | `GET /territories` | List all territories |

## 🔍 Query Parameters

All list endpoints support these common parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `sort` - Field to sort by
- `order` - Sort direction (ASC/DESC)
- `search` - Search term for text fields
- `include*` - Include related data (e.g., `includeProducts`, `includeOrders`)

### Example Requests

```bash
# Get categories with products
curl "http://localhost:3000/api/v1/categories?includeProducts=true&limit=5"

# Search customers by name
curl "http://localhost:3000/api/v1/customers?search=restaurant&page=1"

# Get orders with customer and employee details
curl "http://localhost:3000/api/v1/orders/10248?includeDetails=true"

# Filter products by category
curl "http://localhost:3000/api/v1/products?categoryId=1&sort=unitPrice&order=DESC"
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_NAME` | Database name | Northwind |
| `DB_USERNAME` | Database user | root |
| `DB_PASSWORD` | Database password | |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `API_BASE_URL` | API base path | /api/v1 |
| `CORS_ORIGINS` | CORS allowed origins | http://localhost:* |
| `JWT_SECRET` | JWT secret key | |
| `LOG_LEVEL` | Logging level | info |

### CORS Configuration

The API supports flexible CORS configuration:

```javascript
// Allow all origins
CORS_ORIGINS="*"

// Allow specific domains
CORS_ORIGINS="http://localhost:3000,https://myapp.com"

// Allow localhost with any port
CORS_ORIGINS="http://localhost:*"
```

## 🏗️ Project Structure

```
northwind-api/
├── config/
│   └── database.js          # Database configuration
├── controllers/             # Route handlers (if using controller pattern)
├── middleware/
│   ├── errorHandler.js      # Global error handling
│   └── requestLogger.js     # Request logging
├── models/
│   ├── Category.js          # Sequelize models
│   ├── Customer.js
│   ├── Employee.js
│   ├── Order.js
│   ├── OrderDetail.js
│   ├── Product.js
│   └── ...
├── routes/
│   ├── categories.js        # API routes
│   ├── customers.js
│   ├── employees.js
│   ├── orders.js
│   ├── products.js
│   └── ...
├── tests/
│   └── ...                  # Jest test files
├── .env.example             # Environment template
├── .gitignore
├── docker-compose.yml       # Docker composition
├── Dockerfile              # Container definition
├── package.json
├── README.md
└── server.js               # Main application file
```

## 📊 Database Schema

The API uses the classic Northwind database schema with the following entities:

- **Categories** - Product categories
- **Customers** - Customer information
- **Employees** - Employee details with hierarchical relationships
- **Orders (SalesOrder)** - Order headers
- **OrderDetails** - Order line items
- **Products** - Product catalog
- **Suppliers** - Product suppliers
- **Shippers** - Shipping companies
- **Regions** - Geographic regions
- **Territories** - Sales territories
- **EmployeeTerritories** - Employee-territory assignments

## 🔄 Business Logic & Computed Fields

The API includes business logic and computed fields:

### Products
- `stockStatus` - Current stock status (In Stock, Low Stock, Out of Stock, Discontinued)
- `stockValue` - Total value of stock (unitPrice × unitsInStock)
- `availableStock` - Available units (unitsInStock + unitsOnOrder)

### Orders
- `orderStatus` - Order status (Pending, Processing, Shipped)
- `isOverdue` - Boolean indicating if order is overdue
- `orderTotal` - Total order amount including freight
- `subtotal` - Order subtotal before freight

### Employees
- `fullName` - Concatenated first and last name
- `age` - Calculated age from birthDate
- `yearsOfService` - Years since hire date

### Customers
- `fullAddress` - Formatted complete address
- `orderCount` - Number of orders placed

## 🚨 Error Handling

The API provides comprehensive error handling with structured responses:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "statusCode": 400,
    "errors": [
      {
        "field": "categoryName",
        "message": "Category name is required"
      }
    ]
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## 🔒 Security Features

- **CORS Protection** - Configurable cross-origin resource sharing
- **Helmet** - Security headers
- **Input Validation** - All inputs validated with express-validator
- **SQL Injection Protection** - Sequelize ORM provides parameterized queries
- **Request Size Limits** - Body parsing limits configured

## 📈 Performance Features

- **Pagination** - All list endpoints support pagination
- **Selective Loading** - Include related data only when needed
- **Database Indexing** - Proper indexes on foreign keys and search fields
- **Connection Pooling** - MySQL connection pool configured
- **Compression** - Response compression enabled

## 🐳 Docker Deployment

### Production Deployment

1. **Build and run with docker-compose**
   ```bash
   # Production build
   docker-compose -f docker-compose.yml up -d --build
   
   # View logs
   docker-compose logs -f api
   
   # Scale API instances
   docker-compose up -d --scale api=3
   ```

2. **Environment configuration**
   ```bash
   # Create production .env
   NODE_ENV=production
   DB_PASSWORD=secure_password_here
   JWT_SECRET=secure_jwt_secret_here
   ```

### Health Checks

The application includes health checks for monitoring:

```bash
# Manual health check
curl http://localhost:3000/health

# Docker health check is automatic
docker-compose ps  # Shows health status
```

## 🧑‍💻 Development

### Adding New Endpoints

1. **Create model** in `models/` directory
2. **Add associations** in model definition
3. **Create routes** in `routes/` directory
4. **Add validation** using express-validator
5. **Update documentation** in route comments
6. **Write tests** in `tests/` directory

### Model Relationships

Sequelize associations are defined in each model:

```javascript
// Example: Product model associations
Product.associate = (models) => {
  Product.belongsTo(models.Category, {
    foreignKey: 'categoryId',
    as: 'category'
  });
  
  Product.belongsTo(models.Supplier, {
    foreignKey: 'supplierId',
    as: 'supplier'
  });
};
```

## 📝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check MySQL is running
   docker-compose ps
   
   # Check logs
   docker-compose logs mysql
   
   # Restart services
   docker-compose restart mysql api
   ```

2. **Port Already in Use**
   ```bash
   # Change port in .env or docker-compose.yml
   PORT=3001
   
   # Or stop conflicting process
   lsof -ti:3000 | xargs kill -9
   ```

3. **CORS Errors**
   ```bash
   # Update CORS_ORIGINS in .env
   CORS_ORIGINS="http://localhost:3000,http://localhost:3001"
   ```

### Support

For issues and questions:
- Check the [API Documentation](http://localhost:3000/api-docs)
- Review the logs: `docker-compose logs api`
- Create an issue in the repository

---

**Built with ❤️ using Node.js, Express, Sequelize, and MySQL**