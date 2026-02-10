import { createHmac } from 'crypto';
import { config } from '../config.js';

export interface TelegramInitData {
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  auth_date: number;
  hash: string;
  query_id?: string;
}

/**
 * Validates Telegram Mini App initData.
 * Returns parsed user data if valid, null otherwise.
 *
 * Telegram signs initData with HMAC-SHA256 using a key derived from the bot token.
 * We recompute the hash and compare to verify authenticity.
 */
export function validateInitData(initDataRaw: string): TelegramInitData | null {
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return null;

    // Remove hash from params for validation
    params.delete('hash');

    // Sort params alphabetically and build check string
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create HMAC key from bot token
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(config.BOT_TOKEN)
      .digest();

    // Compute expected hash
    const expectedHash = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (hash !== expectedHash) return null;

    // Check auth_date is not too old (allow 24h)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userData = params.get('user');
    if (!userData) return null;

    return {
      user: JSON.parse(userData),
      auth_date: authDate,
      hash,
      query_id: params.get('query_id') || undefined,
    };
  } catch {
    return null;
  }
}
