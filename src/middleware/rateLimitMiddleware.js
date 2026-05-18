const rateLimit = require('express-rate-limit');

// General API rate limiter: 5000 requests per 15 minutes (increased for intensive BI slicer queries)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for database connections to prevent brute force
const connectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many connection attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, connectLimiter };
