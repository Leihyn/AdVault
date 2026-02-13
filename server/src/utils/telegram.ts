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

/** Max age for initData: 24 hours — mini apps stay open for extended sessions */
const MAX_AUTH_AGE_SECONDS = 86400;

/**
 * Validates Telegram Mini App initData.
 * Returns parsed user data if valid, null otherwise.
 */
export function validateInitData(initDataRaw: string): TelegramInitData | null {
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) {
      console.warn('[auth] initData missing hash');
      return null;
    }

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

    if (hash !== expectedHash) {
      console.warn('[auth] initData hash mismatch — check BOT_TOKEN matches the bot opening the mini app');
      return null;
    }

    // Validate auth_date — reject missing, expired, or future timestamps
    const authDateStr = params.get('auth_date');
    if (!authDateStr) return null;

    const authDate = parseInt(authDateStr, 10);
    if (!authDate || isNaN(authDate)) return null;

    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;

    if (age > MAX_AUTH_AGE_SECONDS || age < -60) {
      console.warn(`[auth] initData expired — age: ${age}s, max: ${MAX_AUTH_AGE_SECONDS}s`);
      return null;
    }

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
