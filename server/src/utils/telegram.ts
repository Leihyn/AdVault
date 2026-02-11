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

/** Max age for initData: 5 minutes (down from 24h) */
const MAX_AUTH_AGE_SECONDS = 300;

/**
 * Validates Telegram Mini App initData.
 * Returns parsed user data if valid, null otherwise.
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

    // Validate auth_date — reject missing, expired, or future timestamps
    const authDateStr = params.get('auth_date');
    if (!authDateStr) return null;

    const authDate = parseInt(authDateStr, 10);
    if (!authDate || isNaN(authDate)) return null;

    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;

    // Reject tokens older than 5 minutes or more than 1 minute in the future
    if (age > MAX_AUTH_AGE_SECONDS || age < -60) return null;

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
