import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Replicate the config schema for isolated testing (doesn't trigger process.exit)
const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  BOT_TOKEN: z.string(),
  MINI_APP_URL: z.string().default('https://localhost:5173'),
  TON_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  TON_API_KEY: z.string().default(''),
  TON_MASTER_MNEMONIC: z.string().default(''),
  TON_MASTER_WALLET_ADDRESS: z.string().default(''),
  ESCROW_ENCRYPTION_KEY: z.string().default('0'.repeat(64)),
  PLATFORM_FEE_PERCENT: z.coerce.number().default(5),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PURGE_AFTER_DAYS: z.coerce.number().default(30),
});

describe('Config Validation', () => {
  it('accepts valid minimal config', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      BOT_TOKEN: 'bot123:token',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
      expect(result.data.PLATFORM_FEE_PERCENT).toBe(5);
      expect(result.data.TON_NETWORK).toBe('testnet');
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PURGE_AFTER_DAYS).toBe(30);
    }
  });

  it('rejects missing DATABASE_URL', () => {
    const result = envSchema.safeParse({
      BOT_TOKEN: 'token',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing BOT_TOKEN', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
    });
    expect(result.success).toBe(false);
  });

  it('coerces PORT from string', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      BOT_TOKEN: 'token',
      PORT: '8080',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(8080);
  });

  it('coerces PLATFORM_FEE_PERCENT from string', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      BOT_TOKEN: 'token',
      PLATFORM_FEE_PERCENT: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PLATFORM_FEE_PERCENT).toBe(10);
  });

  it('rejects invalid TON_NETWORK', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      BOT_TOKEN: 'token',
      TON_NETWORK: 'invalidnet',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      BOT_TOKEN: 'token',
      NODE_ENV: 'staging',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid TON_NETWORK values', () => {
    for (const network of ['mainnet', 'testnet']) {
      const result = envSchema.safeParse({
        DATABASE_URL: 'postgresql://localhost/db',
        BOT_TOKEN: 'token',
        TON_NETWORK: network,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid NODE_ENV values', () => {
    for (const env of ['development', 'production', 'test']) {
      const result = envSchema.safeParse({
        DATABASE_URL: 'postgresql://localhost/db',
        BOT_TOKEN: 'token',
        NODE_ENV: env,
      });
      expect(result.success).toBe(true);
    }
  });

  it('applies REDIS_URL default', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      BOT_TOKEN: 'token',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('accepts full config with all fields', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
      REDIS_URL: 'redis://redis:6379',
      BOT_TOKEN: 'bot123:secret',
      MINI_APP_URL: 'https://app.example.com',
      TON_NETWORK: 'mainnet',
      TON_API_KEY: 'apikey123',
      TON_MASTER_MNEMONIC: 'word1 word2 word3',
      TON_MASTER_WALLET_ADDRESS: 'EQtest',
      ESCROW_ENCRYPTION_KEY: 'b'.repeat(64),
      PLATFORM_FEE_PERCENT: '3',
      PORT: '4000',
      NODE_ENV: 'production',
      PURGE_AFTER_DAYS: '60',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TON_NETWORK).toBe('mainnet');
      expect(result.data.PORT).toBe(4000);
      expect(result.data.PLATFORM_FEE_PERCENT).toBe(3);
      expect(result.data.PURGE_AFTER_DAYS).toBe(60);
    }
  });

  it('coerces PURGE_AFTER_DAYS from string', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      BOT_TOKEN: 'token',
      PURGE_AFTER_DAYS: '90',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PURGE_AFTER_DAYS).toBe(90);
  });
});
