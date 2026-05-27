const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const revokedTokens = new Set();

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const entry of revokedTokens) {
    if (entry.exp <= now) {
      revokedTokens.delete(entry);
    }
  }
}, 60 * 60 * 1000);

const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (revokedTokens.has(decoded.jti)) {
        res.status(401);
        return next(new Error('Token has been revoked'));
      }

      req.user = decoded;

      next();
    } catch (error) {
      res.status(401);
      return next(new Error('Not authorized, token failed'));
    }
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token provided'));
  }
};

const revokeToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    revokedTokens.add(decoded.jti);
    return true;
  } catch {
    return false;
  }
};

module.exports = { protect, revokeToken };
