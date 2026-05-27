const TABLE_COL_REGEX = /^[a-zA-Z0-9_]+$/;

const validateSessionId = (req, res, next) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    res.status(400);
    return next(new Error('Session ID is required'));
  }
  next();
};

const validateConnectParams = (req, res, next) => {
  const { type, host, port, database, username } = req.body;
  if (!type || !host || !port || !database || !username) {
    res.status(400);
    return next(new Error('Missing required connection parameters'));
  }

  if (!['mysql', 'postgres', 'pg'].includes(type.toLowerCase())) {
    res.status(400);
    return next(new Error('Unsupported database type'));
  }

  next();
};

const validateTableName = (req, res, next) => {
  const { table } = req.params;
  if (table && !TABLE_COL_REGEX.test(table)) {
    res.status(400);
    return next(new Error('Invalid table name'));
  }
  next();
};

const validateColumnName = (col) => {
  if (col && !TABLE_COL_REGEX.test(col)) {
    throw new Error(`Invalid column name: ${col}`);
  }
};

module.exports = { validateSessionId, validateConnectParams, validateTableName, validateColumnName, TABLE_COL_REGEX };
