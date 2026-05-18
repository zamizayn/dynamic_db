const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Simple endpoint to generate a token for development/testing
router.post('/token', (req, res) => {
  const { apiKey } = req.body;
  
  // In a real app, you would validate the apiKey against a database.
  // For this demonstration, we'll accept any request and give them a token, 
  // or you can enforce a specific dummy key.
  if (apiKey === 'admin_key_123') {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid API Key' });
  }
});

module.exports = router;
