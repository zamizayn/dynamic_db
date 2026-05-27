import { describe, it, expect, beforeAll } from 'vitest';

process.env.ENCRYPTION_KEY = 'test_encryption_key_32_bytes_long!';

import { encrypt, decrypt } from '../db/crypto';

describe('crypto', () => {
  it('encrypts and decrypts a password', () => {
    const password = 'my_secret_db_password_123!';
    const encrypted = encrypt(password);
    expect(encrypted).not.toBe(password);
    expect(encrypted).toContain(':');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(password);
  });

  it('returns falsy values as-is', () => {
    expect(encrypt('')).toBe('');
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeUndefined();
    expect(decrypt('')).toBe('');
    expect(decrypt(null)).toBeNull();
  });

  it('produces different ciphertexts for same input', () => {
    const password = 'same_password';
    const e1 = encrypt(password);
    const e2 = encrypt(password);
    expect(e1).not.toBe(e2);
    expect(decrypt(e1)).toBe(password);
    expect(decrypt(e2)).toBe(password);
  });
});
