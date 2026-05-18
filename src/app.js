const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const dbRoutes = require('./routes/dbRoutes');
const authRoutes = require('./routes/authRoutes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', dbRoutes);

// Health check endpoint (can be separate or in dbRoutes, putting it here for simplicity)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date() });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server if this file is run directly
if (require.main === module) {
  const { sequelize } = require('./db/sequelize');
  
  sequelize.sync()
    .then(() => {
      console.log('PostgreSQL database synced successfully with Sequelize.');
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to sync database, starting server anyway:', err);
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    });
}

module.exports = app;
