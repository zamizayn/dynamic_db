const { SavedConnection } = require('./sequelize');
const { encrypt, decrypt } = require('./crypto');

const getConnectionsList = async () => {
  try {
    const connections = await SavedConnection.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    return connections.map(c => c.get({ plain: true }));
  } catch (err) {
    console.error('Failed to retrieve saved connections from Postgres:', err);
    return [];
  }
};

const getConnectionById = async (id) => {
  try {
    const connection = await SavedConnection.findByPk(id);
    if (!connection) return null;
    const plain = connection.get({ plain: true });
    if (plain.password) {
      plain.password = decrypt(plain.password);
    }
    return plain;
  } catch (err) {
    console.error(`Failed to retrieve connection profile by id ${id} from Postgres:`, err);
    return null;
  }
};

const saveConnectionConfig = async (config) => {
  try {
    const existing = await SavedConnection.findOne({
      where: {
        type: config.type,
        host: config.host,
        port: Number(config.port),
        database: config.database,
        username: config.username
      }
    });

    const encryptedPassword = encrypt(config.password || '');

    let result;
    if (existing) {
      await existing.update({
        password: encryptedPassword
      });
      result = existing;
    } else {
      result = await SavedConnection.create({
        type: config.type,
        host: config.host,
        port: Number(config.port),
        database: config.database,
        username: config.username,
        password: encryptedPassword
      });
    }

    const plain = result.get({ plain: true });
    return { ...plain, password: undefined };
  } catch (err) {
    console.error('Failed to persist connection profile in Postgres:', err);
    throw new Error('Failed to save connection in central database');
  }
};

const deleteConnectionConfig = async (id) => {
  try {
    await SavedConnection.destroy({
      where: { id }
    });
    return true;
  } catch (err) {
    console.error(`Failed to delete connection profile ${id} from Postgres:`, err);
    throw new Error('Failed to delete connection from central database');
  }
};

module.exports = {
  getConnectionsList,
  getConnectionById,
  saveConnectionConfig,
  deleteConnectionConfig
};
