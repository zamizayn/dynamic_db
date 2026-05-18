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

module.exports = { validateSessionId, validateConnectParams };
