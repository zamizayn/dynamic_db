const express = require('express');
const router = express.Router();
const {
  connectDB,
  getTables,
  getTableData,
  insertRecord,
  updateRecord,
  deleteRecord,
  getForeignKeys,
  getTableMetadata,
  aggregateTableData,
  pivotTableData,
  getTableHealth,
  getSavedConnections,
  saveConnectionConfig,
  deleteSavedConnection,
  connectSavedDatabase,
  disconnectDB
} = require('../controllers/dbController');
const { validateSessionId, validateConnectParams, validateTableName } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { apiLimiter, connectLimiter } = require('../middleware/rateLimitMiddleware');

router.use(apiLimiter);

router.post('/connect', protect, connectLimiter, validateConnectParams, connectDB);

router.get('/connections', protect, getSavedConnections);
router.post('/connections', protect, saveConnectionConfig);
router.delete('/connections/:id', protect, deleteSavedConnection);
router.post('/connections/connect/:id', protect, connectLimiter, connectSavedDatabase);

router.get('/tables/:sessionId', protect, validateSessionId, getTables);

router.delete('/disconnect/:sessionId', protect, validateSessionId, disconnectDB);

router.get('/table/:sessionId/:table', protect, validateSessionId, validateTableName, getTableData);

router.get('/table/:sessionId/:table/fks', protect, validateSessionId, validateTableName, getForeignKeys);

router.get('/table/:sessionId/:table/metadata', protect, validateSessionId, validateTableName, getTableMetadata);

router.post('/table/:sessionId/:table/aggregate', protect, validateSessionId, validateTableName, aggregateTableData);

router.post('/table/:sessionId/:table/pivot', protect, validateSessionId, validateTableName, pivotTableData);

router.get('/table/:sessionId/:table/health', protect, validateSessionId, validateTableName, getTableHealth);

router.post('/table/:sessionId/:table', protect, validateSessionId, validateTableName, insertRecord);

router.put('/table/:sessionId/:table', protect, validateSessionId, validateTableName, updateRecord);

router.delete('/table/:sessionId/:table', protect, validateSessionId, validateTableName, deleteRecord);

module.exports = router;
