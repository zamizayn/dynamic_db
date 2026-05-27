const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);
  }
  res.status(statusCode);
  res.json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err.message,
  });
};

module.exports = { notFound, errorHandler };
