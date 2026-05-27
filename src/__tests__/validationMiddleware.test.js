import { describe, it, expect, vi } from 'vitest';
import { validateSessionId, validateConnectParams, validateTableName, validateColumnName, TABLE_COL_REGEX } from '../middleware/validationMiddleware';

function mockReqRes(overrides = {}) {
  const req = { params: {}, body: {}, ...overrides };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  return { req, res, next };
}

describe('validateSessionId', () => {
  it('calls next() when sessionId is present', () => {
    const { req, res, next } = mockReqRes({ params: { sessionId: 'abc-123' } });
    validateSessionId(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next(error) when sessionId is missing', () => {
    const { req, res, next } = mockReqRes({ params: {} });
    validateSessionId(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(new Error('Session ID is required'));
  });
});

describe('validateConnectParams', () => {
  it('accepts valid params', () => {
    const { req, res, next } = mockReqRes({
      body: { type: 'mysql', host: 'localhost', port: 3306, database: 'test', username: 'root' }
    });
    validateConnectParams(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects unsupported database type', () => {
    const { req, res, next } = mockReqRes({
      body: { type: 'sqlite', host: 'localhost', port: 3306, database: 'test', username: 'root' }
    });
    validateConnectParams(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing params', () => {
    const { req, res, next } = mockReqRes({ body: { type: 'mysql' } });
    validateConnectParams(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validateTableName', () => {
  it('accepts valid table names', () => {
    const { req, res, next } = mockReqRes({ params: { table: 'users' } });
    validateTableName(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects invalid table names', () => {
    const { req, res, next } = mockReqRes({ params: { table: 'users; DROP TABLE' } });
    validateTableName(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('passes through when no table param', () => {
    const { req, res, next } = mockReqRes({ params: {} });
    validateTableName(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('validateColumnName', () => {
  it('does not throw for valid names', () => {
    expect(() => validateColumnName('user_id')).not.toThrow();
    expect(() => validateColumnName('name')).not.toThrow();
    expect(() => validateColumnName(undefined)).not.toThrow();
  });

  it('throws for invalid names', () => {
    expect(() => validateColumnName('col; DROP')).toThrow('Invalid column name');
  });
});

describe('TABLE_COL_REGEX', () => {
  it('matches valid identifiers', () => {
    expect(TABLE_COL_REGEX.test('users')).toBe(true);
    expect(TABLE_COL_REGEX.test('order_items')).toBe(true);
    expect(TABLE_COL_REGEX.test('table1')).toBe(true);
  });

  it('rejects SQL injection patterns', () => {
    expect(TABLE_COL_REGEX.test("users'; DROP TABLE")).toBe(false);
    expect(TABLE_COL_REGEX.test('users--')).toBe(false);
    expect(TABLE_COL_REGEX.test('table name')).toBe(false);
  });
});
