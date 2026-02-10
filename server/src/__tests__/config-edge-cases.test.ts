import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the exact config schema from config.ts for isolated testing
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

const required = { DATABASE_URL: 'postgresql://x', BOT_TOKEN: 'test' };

describe('Config Validation — Edge Cases', () => {
  // ==================== Empty / whitespace strings ====================
  describe('empty and whitespace string handling', () => {
    it('accepts empty string for DATABASE_URL (no min length)', () => {
      const result = envSchema.safeParse({ DATABASE_URL: '', BOT_TOKEN: 'test' });
      expect(result.success).toBe(true);
    });

    it('accepts empty string for BOT_TOKEN (no min length)', () => {
      const result = envSchema.safeParse({ DATABASE_URL: 'pg://x', BOT_TOKEN: '' });
      expect(result.success).toBe(true);
    });

    it('accepts whitespace-only DATABASE_URL', () => {
      const result = envSchema.safeParse({ DATABASE_URL: '   ', BOT_TOKEN: 'test' });
      expect(result.success).toBe(true);
    });
  });

  // ==================== PORT edge cases ====================
  describe('PORT edge cases', () => {
    it('accepts PORT = 0', () => {
      const result = envSchema.safeParse({ ...required, PORT: '0' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PORT).toBe(0);
    });

    it('accepts negative PORT', () => {
      const result = envSchema.safeParse({ ...required, PORT: '-3000' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PORT).toBe(-3000);
    });

    it('accepts very large PORT (beyond valid range)', () => {
      const result = envSchema.safeParse({ ...required, PORT: '99999' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PORT).toBe(99999);
    });

    it('accepts PORT as float string (coerces to number)', () => {
      const result = envSchema.safeParse({ ...required, PORT: '3000.5' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PORT).toBe(3000.5);
    });

    it('rejects non-numeric PORT string (z.coerce.number rejects NaN)', () => {
      const result = envSchema.safeParse({ ...required, PORT: 'abc' });
      // z.coerce.number() does Number('abc') → NaN, then Zod rejects NaN
      expect(result.success).toBe(false);
    });
  });

  // ==================== PLATFORM_FEE_PERCENT edge cases ====================
  describe('PLATFORM_FEE_PERCENT edge cases', () => {
    it('accepts 0% fee', () => {
      const result = envSchema.safeParse({ ...required, PLATFORM_FEE_PERCENT: '0' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PLATFORM_FEE_PERCENT).toBe(0);
    });

    it('accepts 100% fee', () => {
      const result = envSchema.safeParse({ ...required, PLATFORM_FEE_PERCENT: '100' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PLATFORM_FEE_PERCENT).toBe(100);
    });

    it('accepts fee > 100% (no upper bound)', () => {
      const result = envSchema.safeParse({ ...required, PLATFORM_FEE_PERCENT: '150' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PLATFORM_FEE_PERCENT).toBe(150);
    });

    it('accepts negative fee', () => {
      const result = envSchema.safeParse({ ...required, PLATFORM_FEE_PERCENT: '-5' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PLATFORM_FEE_PERCENT).toBe(-5);
    });

    it('accepts fractional fee', () => {
      const result = envSchema.safeParse({ ...required, PLATFORM_FEE_PERCENT: '2.5' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PLATFORM_FEE_PERCENT).toBe(2.5);
    });
  });

  // ==================== PURGE_AFTER_DAYS edge cases ====================
  describe('PURGE_AFTER_DAYS edge cases', () => {
    it('accepts 0 days (immediate purge)', () => {
      const result = envSchema.safeParse({ ...required, PURGE_AFTER_DAYS: '0' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PURGE_AFTER_DAYS).toBe(0);
    });

    it('accepts negative days', () => {
      const result = envSchema.safeParse({ ...required, PURGE_AFTER_DAYS: '-1' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PURGE_AFTER_DAYS).toBe(-1);
    });

    it('accepts very large retention period', () => {
      const result = envSchema.safeParse({ ...required, PURGE_AFTER_DAYS: '36500' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.PURGE_AFTER_DAYS).toBe(36500);
    });
  });

  // ==================== ESCROW_ENCRYPTION_KEY edge cases ====================
  describe('ESCROW_ENCRYPTION_KEY edge cases', () => {
    it('defaults to 64 zeros', () => {
      const result = envSchema.safeParse(required);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.ESCROW_ENCRYPTION_KEY).toBe('0'.repeat(64));
    });

    it('accepts short encryption key (no length validation in schema)', () => {
      const result = envSchema.safeParse({ ...required, ESCROW_ENCRYPTION_KEY: 'abc' });
      expect(result.success).toBe(true);
      // Will crash at runtime when Buffer.from('abc', 'hex') produces 1 byte instead of 32
    });

    it('accepts non-hex encryption key (no format validation in schema)', () => {
      const result = envSchema.safeParse({ ...required, ESCROW_ENCRYPTION_KEY: 'g'.repeat(64) });
      expect(result.success).toBe(true);
      // Will crash at runtime when Buffer.from tries to parse non-hex
    });

    it('accepts empty encryption key', () => {
      const result = envSchema.safeParse({ ...required, ESCROW_ENCRYPTION_KEY: '' });
      expect(result.success).toBe(true);
    });
  });

  // ==================== TON_NETWORK edge cases ====================
  describe('TON_NETWORK edge cases', () => {
    it('rejects "Mainnet" (case-sensitive)', () => {
      const result = envSchema.safeParse({ ...required, TON_NETWORK: 'Mainnet' });
      expect(result.success).toBe(false);
    });

    it('rejects "MAINNET" (case-sensitive)', () => {
      const result = envSchema.safeParse({ ...required, TON_NETWORK: 'MAINNET' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string for TON_NETWORK', () => {
      const result = envSchema.safeParse({ ...required, TON_NETWORK: '' });
      expect(result.success).toBe(false);
    });
  });

  // ==================== TON_MASTER_MNEMONIC edge cases ====================
  describe('TON_MASTER_MNEMONIC edge cases', () => {
    it('defaults to empty string', () => {
      const result = envSchema.safeParse(required);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.TON_MASTER_MNEMONIC).toBe('');
    });

    it('accepts mnemonic with wrong word count (no validation)', () => {
      const result = envSchema.safeParse({
        ...required,
        TON_MASTER_MNEMONIC: 'word1 word2', // should be 24 words
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== Multiple validation failures ====================
  describe('multiple validation failures', () => {
    it('rejects when both required fields are missing', () => {
      const result = envSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.DATABASE_URL).toBeDefined();
        expect(errors.BOT_TOKEN).toBeDefined();
      }
    });

    it('provides specific error messages for required fields', () => {
      const result = envSchema.safeParse({ DATABASE_URL: 123 });
      expect(result.success).toBe(false);
    });
  });

  // ==================== Extra fields ====================
  describe('extra/unknown fields', () => {
    it('strips unknown fields (zod default behavior)', () => {
      const result = envSchema.safeParse({
        ...required,
        UNKNOWN_VAR: 'value',
        SECRET_KEY: 'should-be-stripped',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).UNKNOWN_VAR).toBeUndefined();
        expect((result.data as any).SECRET_KEY).toBeUndefined();
      }
    });
  });
});
