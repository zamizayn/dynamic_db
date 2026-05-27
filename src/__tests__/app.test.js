import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test_jwt_secret';
process.env.API_KEY = 'test_api_key';
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_bytes_long!';

vi.mock('../db/sequelize', () => ({
  sequelize: { sync: vi.fn().mockResolvedValue() },
  SavedConnection: {}
}));

vi.mock('../db/connectionManager', () => ({
  default: {
    createConnection: vi.fn(),
    getConnection: vi.fn(),
  }
}));

const app = require('../app');

describe('App', () => {
  it('health endpoint returns success', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Server is running');
  });

  it('auth endpoint returns 401 with wrong API key', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({ apiKey: 'wrong_key' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('auth endpoint returns 401 with wrong/missing API key', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('auth endpoint returns 200 with valid API key', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({ apiKey: 'test_api_key' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
