# Dynamic Database Gateway API Reference

A highly flexible Node.js / Express backend designed to establish on-demand dynamic connections to PostgreSQL and MySQL databases. It exposes a rich set of REST endpoints for metadata discovery, schema inspection, dynamic aggregation, data pivot visualization, and CRUD operations.

---

## Architecture Overview

The backend acts as an API gateway to client databases. Rather than maintaining static configuration for one database, it enables clients to submit connection strings dynamically.
- **Sessions**: The gateway manages in-memory connection pools identified by a temporary `sessionId` (UUID).
- **Persistent Profiles**: Connection details (excluding passwords) can be saved to a central metadata store (PostgreSQL) using Sequelize.
- **Security & Stability**: Protected by JSON Web Token (JWT) authorization, request payload validations, and distinct rate limits for connection attempts and standard API queries.

---

## Getting Started

### Prerequisites

- **Node.js**: v16+
- **Central Metadata Store**: PostgreSQL (configured in `.env` for saving connection configurations)

### Installation & Run

1. Clone the project and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```ini
   PORT=3001
   NODE_ENV=development
   JWT_SECRET=super_secret_dynamic_db_key_12345

   # PostgreSQL settings for central metadata store
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=friska_db
   DB_USER=postgres
   DB_PASS=root
   ```

3. Start the application:
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

---

## API Documentation

All endpoints (except Authentication and Health Check) require a bearer token in the headers:
```http
Authorization: Bearer <your_jwt_token>
```

### 1. Public & Utility Endpoints

#### Health Check
Verify if the API server is online.

- **URL**: `/api/health`
- **Method**: `GET`
- **Auth Required**: No
- **Response**:
  ```json
  {
    "success": true,
    "message": "Server is running",
    "timestamp": "2026-05-20T14:20:25.000Z"
  }
  ```

#### Authenticate / Generate Token
Generate a JWT for API requests using a predefined developer key.

- **URL**: `/api/auth/token`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "apiKey": "admin_key_123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "message": "Invalid API Key"
  }
  ```

---

### 2. Connection Management (`/api`)

#### Create Dynamic Session
Create an active connection pool in memory and return a temporary `sessionId`.

- **URL**: `/api/connect`
- **Method**: `POST`
- **Rate Limit**: Max 10 attempts per 15 minutes.
- **Request Body**:
  ```json
  {
    "type": "mysql", // "mysql", "postgres", or "pg"
    "host": "localhost",
    "port": 3306,
    "database": "sales_db",
    "username": "root",
    "password": "password123",
    "saveConnection": true // optional: set true to persist connection metadata
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "sessionId": "a9b8c7d6-e5f4-3a2b-1c0d-9e8f7a6b5c4d"
  }
  ```

#### Get Saved Connections
List all stored connection profiles from the central PostgreSQL database. Passwords are automatically excluded.

- **URL**: `/api/connections`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "success": true,
    "connections": [
      {
        "id": "e43b679b-222a-43c3-b09e-7650dfc4a123",
        "type": "postgres",
        "host": "production-db.company.internal",
        "port": 5432,
        "database": "inventory",
        "username": "db_user",
        "createdAt": "2026-05-20T10:00:00.000Z",
        "updatedAt": "2026-05-20T10:00:00.000Z"
      }
    ]
  }
  ```

#### Save Connection Config
Directly save or update a connection profile configurations to PostgreSQL.

- **URL**: `/api/connections`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "type": "postgres",
    "host": "127.0.0.1",
    "port": 5432,
    "database": "friska_db",
    "username": "postgres",
    "password": "root"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "connection": {
      "id": "5f64ee39-4418-472e-8367-e9a0fcd55c11",
      "type": "postgres",
      "host": "127.0.0.1",
      "port": 5432,
      "database": "friska_db",
      "username": "postgres"
    }
  }
  ```

#### Delete Saved Connection
Delete a connection profile by ID.

- **URL**: `/api/connections/:id`
- **Method**: `DELETE`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Connection profile deleted successfully"
  }
  ```

#### Connect from Saved Profile
Establish a dynamic session using a saved profile ID.

- **URL**: `/api/connections/connect/:id`
- **Method**: `POST`
- **Response**:
  ```json
  {
    "success": true,
    "sessionId": "b6a8d7c6-e9f0-4a8b-c9d8-1e2f3a4b5c6d"
  }
  ```

---

### 3. Metadata & Query APIs

All metadata and query APIs require the dynamic `sessionId` as a path parameter.

#### Fetch All Tables
List all tables in the database schema (excluding internal system/catalog tables).

- **URL**: `/api/tables/:sessionId`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "success": true,
    "tables": [
      "users",
      "products",
      "orders",
      "order_items"
    ]
  }
  ```

#### Fetch Table Metadata
Get all columns, data types, and dynamic classification (e.g. `IDENTIFIER`, `MEASURE`, `DIMENSION_CATEGORICAL`, `DIMENSION_TEMPORAL`) from the table schema.

- **URL**: `/api/table/:sessionId/:table/metadata`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "success": true,
    "columns": [
      {
        "column_name": "id",
        "data_type": "integer",
        "classification": "IDENTIFIER"
      },
      {
        "column_name": "price",
        "data_type": "numeric",
        "classification": "MEASURE"
      },
      {
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "classification": "DIMENSION_TEMPORAL"
      },
      {
        "column_name": "category",
        "data_type": "character varying",
        "classification": "DIMENSION_CATEGORICAL"
      }
    ]
  }
  ```

#### Fetch Foreign Keys
Get all foreign key columns mapping from the specified table.

- **URL**: `/api/table/:sessionId/:table/fks`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "success": true,
    "fks": [
      {
        "column_name": "user_id",
        "referenced_table_name": "users",
        "referenced_column_name": "id"
      }
    ]
  }
  ```

#### Fetch Table Health Stats
Obtain database level health metadata like row count, table disk size, index count, and simulated completeness metrics.

- **URL**: `/api/table/:sessionId/:table/health`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "success": true,
    "stats": {
      "totalRows": 2541,
      "sizeFormatted": "12.4 MB",
      "indexCount": 3,
      "integrityScore": 98,
      "completenessScore": 95
    }
  }
  ```

---

### 4. Dynamic Aggregations & Pivot Queries

These APIs automate dynamic join resolutions (e.g., if a foreign key is grouped by, it auto-joins and replaces values with the referenced table's friendly display fields like name, title, or email).

#### Dynamic Dimension Aggregation
Perform group-by aggregation over numeric measures with filters.

- **URL**: `/api/table/:sessionId/:table/aggregate`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "groupBy": "category_id", // column to group on
    "aggregateCol": "price", // numeric column to aggregate
    "aggregateFunc": "SUM", // "SUM", "COUNT", "AVG", "MIN", "MAX"
    "filterCol": "status", // optional: filter criteria column
    "filterVal": "active" // optional: filter value match
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "group_key": "Electronics", // Auto-resolved from category table friendly name column
        "val": 14529.99
      },
      {
        "group_key": "Home Appliances",
        "val": 8940.50
      }
    ]
  }
  ```

#### Multi-Dimension Pivot Aggregation
Perform cross-tabulation pivot aggregations for matrix data visualizations.

- **URL**: `/api/table/:sessionId/:table/pivot`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "rowCol": "country_id", // dimension for rows
    "colCol": "order_year", // dimension for columns
    "aggregateCol": "total_amount", // numeric column to aggregate
    "aggregateFunc": "SUM", // "SUM", "COUNT", "AVG", "MIN", "MAX"
    "filterCol": "status", // optional
    "filterVal": "delivered" // optional
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "row_key": "United States",
        "col_key": "2025",
        "val": 52400.00
      },
      {
        "row_key": "United Kingdom",
        "col_key": "2026",
        "val": 31920.00
      }
    ]
  }
  ```

---

### 5. Data Operations (CRUD)

#### Fetch Table Data
Fetch all rows directly from the specified table.

- **URL**: `/api/table/:sessionId/:table`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com"
      }
    ]
  }
  ```

#### Insert Record
Insert a row into the target table. Objects/arrays are automatically converted to JSON strings.

- **URL**: `/api/table/:sessionId/:table`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "username": "bob",
    "email": "bob@example.com",
    "preferences": {
      "theme": "dark"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Record inserted successfully"
  }
  ```

#### Update Record
Update record(s) matching precise condition keys.

- **URL**: `/api/table/:sessionId/:table`
- **Method**: `PUT`
- **Request Body**:
  ```json
  {
    "conditions": {
      "id": 2
    },
    "data": {
      "email": "bob.new@example.com"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Record updated successfully"
  }
  ```

---

## Middleware & Protections

1. **Authorization (`authMiddleware.js`)**
   - Validates the incoming HTTP header `Authorization: Bearer <JWT>`.
   - Decodes payload using the shared `JWT_SECRET`.
2. **Rate Limiting (`rateLimitMiddleware.js`)**
   - **General API Limiter**: Max 5000 requests per 15 minutes (tailored for high-frequency BI chart requests).
   - **Connection Limiter**: Max 10 connection requests per 15 minutes (protects dynamic connection endpoints from brute force).
3. **Validations (`validationMiddleware.js`)**
   - Prevents empty session parameters.
   - Enforces database types constraint (`mysql`, `postgres`, `pg`).
   - SQL Injection protection exists via parameterization on query bindings and strict regex checks (`/^[a-zA-Z0-9_]+$/`) on table/column parameters.
