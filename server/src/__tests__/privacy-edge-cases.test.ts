import { describe, it, expect } from 'vitest';
import { generateAlias, encryptField, decryptField, hashDealData } from '../utils/privacy.js';

describe('Privacy Utilities — Edge Cases', () => {
  // ==================== generateAlias ====================
  describe('generateAlias edge cases', () => {
    it('alias length is always exactly Role-xxxx (10 or 11 chars)', () => {
      for (let i = 0; i < 50; i++) {
        const seller = generateAlias('Seller');
        const buyer = generateAlias('Buyer');
        expect(seller).toHaveLength(11); // "Seller-" (7) + 4 hex = 11
        expect(buyer).toHaveLength(10);  // "Buyer-" (6) + 4 hex = 10
      }
    });

    it('suffix is always lowercase hex', () => {
      for (let i = 0; i < 50; i++) {
        const alias = generateAlias('Seller');
        const suffix = alias.split('-')[1];
        expect(suffix).toMatch(/^[0-9a-f]{4}$/);
      }
    });

    it('preserves exact role prefix (no mutation)', () => {
      const seller = generateAlias('Seller');
      const buyer = generateAlias('Buyer');
      expect(seller.startsWith('Seller-')).toBe(true);
      expect(buyer.startsWith('Buyer-')).toBe(true);
    });
  });

  // ==================== encryptField / decryptField edge cases ====================
  describe('encryptField / decryptField edge cases', () => {
    it('handles null byte in plaintext', () => {
      const original = 'before\x00after';
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles string with only whitespace', () => {
      const original = '   \t\n\r  ';
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('handles single character', () => {
      const encrypted = encryptField('x');
      expect(decryptField(encrypted)).toBe('x');
    });

    it('handles string with colons (delimiter character)', () => {
      // Colons are the delimiter in iv:tag:ciphertext format
      const original = 'key:value:extra:more';
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('handles JSON strings', () => {
      const original = JSON.stringify({ user: 'test', nested: { arr: [1, 2, 3] } });
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(JSON.parse(decrypted)).toEqual({ user: 'test', nested: { arr: [1, 2, 3] } });
    });

    it('handles HTML/XSS payloads without corruption', () => {
      const original = '<script>alert("xss")</script><img onerror="hack" src=x>';
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('handles SQL injection strings without corruption', () => {
      const original = "'; DROP TABLE users; --";
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('handles very long repeated patterns', () => {
      const original = 'A'.repeat(100000);
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('handles zero-width unicode characters', () => {
      const original = 'invisible\u200B\u200C\u200Dchars\uFEFF';
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('handles RTL text', () => {
      const original = 'مرحبا\u202Bمرحبا\u202C';
      const encrypted = encryptField(original);
      expect(decryptField(encrypted)).toBe(original);
    });

    it('throws on completely empty encrypted string', () => {
      expect(() => decryptField('')).toThrow();
    });

    it('throws on single colon', () => {
      expect(() => decryptField(':')).toThrow();
    });

    it('throws on four colon-separated parts', () => {
      expect(() => decryptField('a:b:c:d')).toThrow('Invalid encrypted field format');
    });

    it('throws on valid-looking but wrong IV length', () => {
      // IV should be 24 hex chars (12 bytes), using 20
      const shortIv = 'aa'.repeat(10);
      const tag = 'bb'.repeat(16);
      const ct = 'cc'.repeat(8);
      expect(() => decryptField(`${shortIv}:${tag}:${ct}`)).toThrow();
    });

    it('throws on non-hex characters in IV', () => {
      const badIv = 'zz'.repeat(12);
      const tag = 'bb'.repeat(16);
      const ct = 'cc'.repeat(8);
      expect(() => decryptField(`${badIv}:${tag}:${ct}`)).toThrow();
    });

    it('throws when auth tag is all zeros (wrong key material)', () => {
      const encrypted = encryptField('test data');
      const parts = encrypted.split(':');
      parts[1] = '00'.repeat(16); // zero auth tag
      expect(() => decryptField(parts.join(':'))).toThrow();
    });

    it('throws when ciphertext bytes are flipped', () => {
      const encrypted = encryptField('hello world');
      const parts = encrypted.split(':');
      // Flip first byte of ciphertext
      const ct = parts[2];
      const flipped = ((parseInt(ct.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')) + ct.slice(2);
      parts[2] = flipped;
      expect(() => decryptField(parts.join(':'))).toThrow();
    });

    it('two encryptions of same text produce different IV, tag, and ciphertext', () => {
      const text = 'identical';
      const enc1 = encryptField(text);
      const enc2 = encryptField(text);
      const [iv1, tag1, ct1] = enc1.split(':');
      const [iv2, tag2, ct2] = enc2.split(':');
      expect(iv1).not.toBe(iv2);   // Random IV
      expect(ct1).not.toBe(ct2);   // Different IV → different ciphertext
      expect(tag1).not.toBe(tag2); // Different auth tag
    });

    it('encrypted output is always hex characters only (plus colons)', () => {
      const encrypted = encryptField('test payload with special chars: <>&"');
      expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]*$/);
    });
  });

  // ==================== hashDealData edge cases ====================
  describe('hashDealData edge cases', () => {
    it('produces different hash when escrowAddress is null vs empty string', () => {
      const base = {
        dealId: 1, channelId: 1, advertiserId: 1,
        amountTon: 10, finalStatus: 'COMPLETED', completedAt: '2025-01-01T00:00:00Z',
      };
      const hashNull = hashDealData({ ...base, escrowAddress: null });
      const hashEmpty = hashDealData({ ...base, escrowAddress: '' });
      expect(hashNull).not.toBe(hashEmpty);
    });

    it('produces different hash when escrowAddress is undefined vs null', () => {
      const base = {
        dealId: 1, channelId: 1, advertiserId: 1,
        amountTon: 10, finalStatus: 'COMPLETED', completedAt: '2025-01-01T00:00:00Z',
      };
      const hashUndefined = hashDealData({ ...base, escrowAddress: undefined });
      const hashNull = hashDealData({ ...base, escrowAddress: null });
      // JSON.stringify treats undefined and null differently
      expect(hashUndefined).not.toBe(hashNull);
    });

    it('handles very large deal IDs', () => {
      const hash = hashDealData({
        dealId: Number.MAX_SAFE_INTEGER,
        channelId: 1, advertiserId: 1,
        amountTon: 10, finalStatus: 'COMPLETED',
        escrowAddress: 'EQtest', completedAt: '2025-01-01T00:00:00Z',
      });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles floating point amountTon', () => {
      const hash = hashDealData({
        dealId: 1, channelId: 1, advertiserId: 1,
        amountTon: 0.000000001,
        finalStatus: 'COMPLETED',
        escrowAddress: 'EQtest', completedAt: '2025-01-01T00:00:00Z',
      });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('floating point precision: 0.1 + 0.2 !== 0.3 produces different hash', () => {
      const base = {
        dealId: 1, channelId: 1, advertiserId: 1,
        finalStatus: 'COMPLETED',
        escrowAddress: 'EQtest', completedAt: '2025-01-01T00:00:00Z',
      };
      const hash1 = hashDealData({ ...base, amountTon: 0.3 });
      const hash2 = hashDealData({ ...base, amountTon: 0.1 + 0.2 });
      // IEEE 754: 0.1 + 0.2 === 0.30000000000000004, not 0.3
      expect(hash1).not.toBe(hash2);
    });

    it('handles zero amount', () => {
      const hash = hashDealData({
        dealId: 1, channelId: 1, advertiserId: 1,
        amountTon: 0,
        finalStatus: 'CANCELLED', escrowAddress: null,
        completedAt: '2025-01-01T00:00:00Z',
      });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles negative amount (no validation in hashDealData)', () => {
      const hash = hashDealData({
        dealId: 1, channelId: 1, advertiserId: 1,
        amountTon: -50,
        finalStatus: 'REFUNDED', escrowAddress: null,
        completedAt: '2025-01-01T00:00:00Z',
      });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles special characters in completedAt', () => {
      const hash = hashDealData({
        dealId: 1, channelId: 1, advertiserId: 1,
        amountTon: 10, finalStatus: 'COMPLETED',
        escrowAddress: 'EQtest',
        completedAt: '2025-06-15T14:30:00.000+05:30', // timezone offset
      });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
