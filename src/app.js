const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const dbRoutes = require('./routes/dbRoutes');
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.TRUST_PROXY) {
  const trustProxy = isNaN(process.env.TRUST_PROXY)
    ? process.env.TRUST_PROXY === 'true'
    : parseInt(process.env.TRUST_PROXY, 10);
  app.set('trust proxy', trustProxy);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api', dbRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date() });
});

app.use(notFound);
app.use(errorHandler);

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
