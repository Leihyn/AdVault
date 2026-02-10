import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { validateInitData } from '../utils/telegram.js';
import { config } from '../config.js';

/**
 * Helper to create valid Telegram initData for testing.
 * Mimics what Telegram sends when opening a Mini App.
 */
function createInitData(userData: object, overrides?: { authDate?: number; extraParams?: Record<string, string> }) {
  const authDate = overrides?.authDate || Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(userData));
  params.set('auth_date', authDate.toString());
  if (overrides?.extraParams) {
    for (const [k, v] of Object.entries(overrides.extraParams)) {
      params.set(k, v);
    }
  }

  // Compute valid hash
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(config.BOT_TOKEN)
    .digest();

  const hash = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  params.set('hash', hash);
  return params.toString();
}

describe('Telegram initData Validation', () => {
  const validUser = {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
  };

  it('validates correctly signed initData', () => {
    const initData = createInitData(validUser);
    const result = validateInitData(initData);
    expect(result).not.toBeNull();
    expect(result!.user.id).toBe(123456789);
    expect(result!.user.first_name).toBe('Test');
    expect(result!.user.username).toBe('testuser');
  });

  it('returns auth_date', () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = createInitData(validUser, { authDate: now });
    const result = validateInitData(initData);
    expect(result).not.toBeNull();
    expect(result!.auth_date).toBe(now);
  });

  it('rejects missing hash', () => {
    const params = new URLSearchParams();
    params.set('user', JSON.stringify(validUser));
    params.set('auth_date', Math.floor(Date.now() / 1000).toString());
    // No hash
    const result = validateInitData(params.toString());
    expect(result).toBeNull();
  });

  it('rejects tampered hash', () => {
    const initData = createInitData(validUser);
    const tampered = initData.replace(/hash=[^&]+/, 'hash=0000000000000000000000000000000000000000000000000000000000000000');
    const result = validateInitData(tampered);
    expect(result).toBeNull();
  });

  it('rejects expired auth_date (older than 24h)', () => {
    const oldDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const initData = createInitData(validUser, { authDate: oldDate });
    const result = validateInitData(initData);
    expect(result).toBeNull();
  });

  it('accepts auth_date within 24h window', () => {
    const recentDate = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const initData = createInitData(validUser, { authDate: recentDate });
    const result = validateInitData(initData);
    expect(result).not.toBeNull();
  });

  it('rejects missing user data', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams();
    params.set('auth_date', authDate.toString());

    const checkString = `auth_date=${authDate}`;
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(config.BOT_TOKEN)
      .digest();
    const hash = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    params.set('hash', hash);
    const result = validateInitData(params.toString());
    expect(result).toBeNull();
  });

  it('rejects completely invalid input', () => {
    expect(validateInitData('')).toBeNull();
    expect(validateInitData('garbage')).toBeNull();
    expect(validateInitData('hash=abc')).toBeNull();
  });

  it('rejects tampered user data', () => {
    const initData = createInitData(validUser);
    // Change user data after signing
    // URL-encoded: "Test" becomes %22Test%22, so replace the value without quotes
    const tampered = initData.replace('Test', 'Hacker');
    const result = validateInitData(tampered);
    expect(result).toBeNull();
  });

  it('preserves query_id if present', () => {
    const initData = createInitData(validUser, { extraParams: { query_id: 'AAHdF6IqAAAAAADdF6IqA' } });
    const result = validateInitData(initData);
    expect(result).not.toBeNull();
    expect(result!.query_id).toBe('AAHdF6IqAAAAAADdF6IqA');
  });

  it('handles user with minimal fields', () => {
    const minimalUser = { id: 1, first_name: 'A' };
    const initData = createInitData(minimalUser);
    const result = validateInitData(initData);
    expect(result).not.toBeNull();
    expect(result!.user.id).toBe(1);
  });
});
