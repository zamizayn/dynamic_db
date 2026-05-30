const { randomUUID: uuidv4 } = require('crypto');
const mysql = require('mysql2/promise');
const { Pool: PgPool } = require('pg');

class ConnectionManager {
  constructor() {
    this.sessions = new Map();

    // Optional: cleanup interval to remove stale sessions
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // 1 hour
  }

  async createConnection(config) {
    const sessionId = uuidv4();
    const { type, host, port, database, username, password } = config;

    let dbClient;

    if (type.toLowerCase() === 'mysql') {
      dbClient = mysql.createPool({
        host,
        port,
        database,
        user: username,
        password: password || '',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      // Test MySQL connection
      try {
        const connection = await dbClient.getConnection();
        connection.release();
      } catch (err) {
        throw new Error(`MySQL Connection Failed: ${err.message || 'Connection refused'}`);
      }
    } else if (type.toLowerCase() === 'postgres' || type.toLowerCase() === 'pg') {
      dbClient = new PgPool({
        host,
        port,
        database,
        user: username,
        password: password || '',
      });
      // Test PG connection
      try {
        const client = await dbClient.connect();
        client.release();
      } catch (err) {
        throw new Error(`PostgreSQL Connection Failed: ${err.message || 'Connection refused'}`);
      }
    } else {
      throw new Error('Unsupported database type');
    }

    this.sessions.set(sessionId, {
      type: type.toLowerCase(),
      client: dbClient,
      lastAccessed: Date.now()
    });

    return sessionId;
  }

  getConnection(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid or expired session ID');
    }

    // Update last accessed
    session.lastAccessed = Date.now();
    return session;
  }

  async closeConnection(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.type === 'mysql') {
        await session.client.end();
      } else {
        await session.client.end(); // PgPool end
      }
      this.sessions.delete(sessionId);
    }
  }

  cleanup() {
    const now = Date.now();
    const EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > EXPIRY_TIME) {
        this.closeConnection(sessionId).catch(console.error);
      }
    }
  }
}

// Export as a singleton
module.exports = new ConnectionManager();
