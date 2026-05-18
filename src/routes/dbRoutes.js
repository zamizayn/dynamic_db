const express = require('express');
const router = express.Router();
const {
  connectDB,
  getTables,
  getTableData,
  insertRecord,
  updateRecord,
  getForeignKeys,
  getTableMetadata,
  aggregateTableData,
  pivotTableData,
  getTableHealth,
  getSavedConnections,
  saveConnectionConfig,
  deleteSavedConnection,
  connectSavedDatabase
} = require('../controllers/dbController');
const { validateSessionId, validateConnectParams } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { apiLimiter, connectLimiter } = require('../middleware/rateLimitMiddleware');

// Apply general API rate limiter to all DB routes
router.use(apiLimiter);

// 1. Create Database Connection (Stricter rate limit)
router.post('/connect', protect, connectLimiter, validateConnectParams, connectDB);

// Connection Manager persistent hub endpoints
router.get('/connections', protect, getSavedConnections);
router.post('/connections', protect, saveConnectionConfig);
router.delete('/connections/:id', protect, deleteSavedConnection);
router.post('/connections/connect/:id', protect, connectSavedDatabase);

// 2. Fetch All Tables
router.get('/tables/:sessionId', protect, validateSessionId, getTables);

// 3. Fetch Table Data
router.get('/table/:sessionId/:table', protect, validateSessionId, getTableData);

// 3.5. Fetch Table Foreign Keys
router.get('/table/:sessionId/:table/fks', protect, validateSessionId, getForeignKeys);

// 3.6. Fetch Table Column Metadata
router.get('/table/:sessionId/:table/metadata', protect, validateSessionId, getTableMetadata);

// 3.7. Fetch Table Column Dynamic Aggregation
router.post('/table/:sessionId/:table/aggregate', protect, validateSessionId, aggregateTableData);

// 3.8. Fetch Table Multi-Dimension Pivot Aggregation
router.post('/table/:sessionId/:table/pivot', protect, validateSessionId, pivotTableData);

// 3.9. Fetch Table Health Stats & Metadata completeness score
router.get('/table/:sessionId/:table/health', protect, validateSessionId, getTableHealth);

// 4. Insert Record
router.post('/table/:sessionId/:table', protect, validateSessionId, insertRecord);

// 5. Update Record
router.put('/table/:sessionId/:table', protect, validateSessionId, updateRecord);

module.exports = router;
