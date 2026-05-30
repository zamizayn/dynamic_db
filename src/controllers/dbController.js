const connectionManager = require('../db/connectionManager');
const connectionsStore = require('../db/connectionsStore');
const dialectAdapter = require('../db/dialectAdapter');
const { getJoinConfig } = require('../db/joinResolver');
const { validateColumnName } = require('../middleware/validationMiddleware');

const connectDB = async (req, res, next) => {
  try {
    const sessionId = await connectionManager.createConnection(req.body);

    if (req.body.saveConnection) {
      await connectionsStore.saveConnectionConfig(req.body);
    }

    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    next(error);
  }
};

const getTables = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);
    const tables = await adapter.getTables();

    res.json({
      success: true,
      tables
    });
  } catch (error) {
    next(error);
  }
};

const getTableData = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;

    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);
    const data = await adapter.getTableData(table, limit, offset);

    res.json({
      success: true,
      data,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
};

const insertRecord = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: 'No data provided for insertion' });
    }

    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);

    const columns = Object.keys(payload);
    columns.forEach(validateColumnName);

    const values = Object.values(payload).map(val =>
      (val !== null && typeof val === 'object') ? JSON.stringify(val) : val
    );

    await adapter.beginTransaction();
    try {
      const result = await adapter.insertRecord(table, columns, values);
      await adapter.commit();

      res.status(201).json({
        success: true,
        message: 'Record inserted successfully',
        result
      });
    } catch (err) {
      await adapter.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

const updateRecord = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const { conditions, data } = req.body;

    if (!conditions || Object.keys(conditions).length === 0) {
      return res.status(400).json({ success: false, message: 'Conditions are required for update' });
    }
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Data is required for update' });
    }

    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);

    const updateCols = Object.keys(data);
    updateCols.forEach(validateColumnName);
    const condCols = Object.keys(conditions);
    condCols.forEach(validateColumnName);

    const updateVals = Object.values(data).map(val =>
      (val !== null && typeof val === 'object') ? JSON.stringify(val) : val
    );

    const condVals = Object.values(conditions).map(val =>
      (val !== null && typeof val === 'object') ? JSON.stringify(val) : val
    );

    await adapter.beginTransaction();
    try {
      const result = await adapter.updateRecord(table, updateCols, updateVals, condCols, condVals);
      await adapter.commit();

      res.json({
        success: true,
        message: 'Record updated successfully',
        result
      });
    } catch (err) {
      await adapter.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

const getForeignKeys = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);
    const fks = await adapter.getForeignKeys(session, table);

    res.json({
      success: true,
      fks
    });
  } catch (error) {
    next(error);
  }
};

const getTableMetadata = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);
    const columns = await adapter.getTableColumns(session, table);

    const classifiedColumns = columns.map(col => {
      const colName = col.column_name;
      const dataType = col.data_type;
      const nameLower = colName.toLowerCase();
      const typeLower = dataType.toLowerCase();

      let classification = 'DIMENSION_CATEGORICAL';

      if (nameLower === 'id' || nameLower === 'uuid' || nameLower.endsWith('_id') || nameLower.endsWith('id')) {
        classification = 'IDENTIFIER';
      } else if (typeLower.includes('date') || typeLower.includes('time') || typeLower.includes('timestamp') || nameLower === 'year') {
        classification = 'DIMENSION_TEMPORAL';
      } else if (['integer', 'bigint', 'numeric', 'real', 'double precision', 'decimal', 'float', 'int'].includes(typeLower)) {
        classification = 'MEASURE';
      }

      return {
        column_name: colName,
        data_type: dataType,
        classification
      };
    });

    res.json({
      success: true,
      columns: classifiedColumns
    });
  } catch (error) {
    next(error);
  }
};

const aggregateTableData = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const { groupBy, aggregateCol, aggregateFunc, filterCol, filterVal } = req.body;

    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);

    validateColumnName(groupBy);
    validateColumnName(aggregateCol);
    if (filterCol) validateColumnName(filterCol);

    let func = aggregateFunc.toUpperCase();

    if (!['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'].includes(func)) {
      return res.status(400).json({ success: false, message: 'Invalid aggregation function' });
    }

    if (['SUM', 'AVG'].includes(func)) {
      const columns = await adapter.getTableColumns(session, table);
      const col = columns.find(c => c.column_name === aggregateCol);
      if (col) {
        const numericTypes = ['integer', 'bigint', 'numeric', 'real', 'double precision', 'decimal', 'float', 'int', 'smallint', 'tinyint'];
        if (!numericTypes.includes(col.data_type.toLowerCase())) {
          func = 'COUNT';
        }
      }
    }

    const joinCfg = await getJoinConfig(session, table, groupBy);

    let rows = await adapter.aggregateGroupBy(table, groupBy, aggregateCol, func, joinCfg, filterCol, filterVal);

    const formattedRows = rows.map(r => ({
      group_key: r.group_key === null ? 'NULL' : String(r.group_key),
      val: Number(r.val || 0)
    }));

    res.json({
      success: true,
      data: formattedRows
    });
  } catch (error) {
    next(error);
  }
};

const pivotTableData = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const { rowCol, colCol, aggregateCol, aggregateFunc, filterCol, filterVal } = req.body;

    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);

    validateColumnName(rowCol);
    validateColumnName(colCol);
    validateColumnName(aggregateCol);
    if (filterCol) validateColumnName(filterCol);

    if (!['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'].includes(aggregateFunc.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid aggregation function' });
    }

    const func = aggregateFunc.toUpperCase();

    const rowJoinCfg = await getJoinConfig(session, table, rowCol);
    const colJoinCfg = await getJoinConfig(session, table, colCol);

    let rows = await adapter.pivotAggregate(table, rowCol, colCol, aggregateCol, func, rowJoinCfg, colJoinCfg, filterCol, filterVal);

    const formattedRows = rows.map(r => ({
      row_key: r.row_key === null ? 'NULL' : String(r.row_key),
      col_key: r.col_key === null ? 'NULL' : String(r.col_key),
      val: Number(r.val || 0)
    }));

    res.json({
      success: true,
      data: formattedRows
    });
  } catch (error) {
    next(error);
  }
};

const getTableHealth = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);

    const stats = await adapter.getTableHealth(table);

    res.json({
      success: true,
      stats: {
        totalRows: stats.totalRows,
        sizeFormatted: stats.sizeBytes >= 1024 * 1024
          ? `${(stats.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(stats.sizeBytes / 1024).toFixed(1)} KB`,
        indexCount: stats.indexCount,
        integrityScore: stats.integrityScore,
        completenessScore: stats.completenessScore
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSavedConnections = async (req, res, next) => {
  try {
    const connections = await connectionsStore.getConnectionsList();
    res.json({ success: true, connections });
  } catch (error) {
    next(error);
  }
};

const saveConnectionConfig = async (req, res, next) => {
  try {
    const saved = await connectionsStore.saveConnectionConfig(req.body);
    res.json({ success: true, connection: saved });
  } catch (error) {
    next(error);
  }
};

const deleteSavedConnection = async (req, res, next) => {
  try {
    const { id } = req.params;
    await connectionsStore.deleteConnectionConfig(id);
    res.json({ success: true, message: 'Connection profile deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteRecord = async (req, res, next) => {
  try {
    const { sessionId, table } = req.params;
    const conditions = req.body;

    if (!conditions || Object.keys(conditions).length === 0) {
      return res.status(400).json({ success: false, message: 'Conditions are required for deletion' });
    }

    const session = connectionManager.getConnection(sessionId);
    const adapter = dialectAdapter(session);

    Object.keys(conditions).forEach(validateColumnName);

    await adapter.beginTransaction();
    try {
      const result = await adapter.deleteRecord(table, conditions);
      await adapter.commit();

      res.json({
        success: true,
        message: 'Record(s) deleted successfully',
        result
      });
    } catch (err) {
      await adapter.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

const disconnectDB = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await connectionManager.closeConnection(sessionId);
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    next(error);
  }
};

const connectSavedDatabase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await connectionsStore.getConnectionById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Saved connection profile not found' });
    }
    const sessionId = await connectionManager.createConnection(config);
    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
