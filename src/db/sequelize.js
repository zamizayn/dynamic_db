const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

// Ensure dotenv is initialized
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'friska_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'root',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false, // disable logging for cleaner terminal outputs
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const SavedConnection = sequelize.define('SavedConnection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  host: {
    type: DataTypes.STRING,
    allowNull: false
  },
  port: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  database: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'saved_connections',
  timestamps: true // adds createdAt and updatedAt columns
});

module.exports = {
  sequelize,
  SavedConnection
};
