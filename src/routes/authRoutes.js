const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authLimiter } = require('../middleware/rateLimitMiddleware');
const { protect, revokeToken } = require('../middleware/authMiddleware');

router.post('/token', authLimiter, (req, res) => {
  const { apiKey } = req.body;

  if (!process.env.API_KEY) {
    return res.status(500).json({ success: false, message: 'Server misconfiguration: API_KEY not set' });
  }

  if (apiKey === process.env.API_KEY) {
    const token = jwt.sign(
      { role: 'admin', jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid API Key' });
  }
});

router.post('/revoke', protect, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  revokeToken(token);
  res.json({ success: true, message: 'Token revoked successfully' });
});

module.exports = router;
