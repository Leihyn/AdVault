import { describe, it, expect } from 'vitest';
import { generateAlias, encryptField, decryptField, hashDealData } from '../utils/privacy.js';

describe('Privacy Utilities', () => {
  describe('generateAlias', () => {
    it('generates Seller aliases with correct prefix', () => {
      const alias = generateAlias('Seller');
      expect(alias).toMatch(/^Seller-[0-9a-f]{4}$/);
    });

    it('generates Buyer aliases with correct prefix', () => {
      const alias = generateAlias('Buyer');
      expect(alias).toMatch(/^Buyer-[0-9a-f]{4}$/);
    });

    it('generates unique aliases each time', () => {
      const aliases = new Set<string>();
      for (let i = 0; i < 100; i++) {
        aliases.add(generateAlias('Seller'));
      }
      // With 4 hex chars (65536 possibilities), 100 should be almost all unique
      expect(aliases.size).toBeGreaterThan(90);
    });

    it('never generates empty aliases', () => {
      for (let i = 0; i < 50; i++) {
        const alias = generateAlias('Seller');
        expect(alias.length).toBeGreaterThan(0);
        expect(alias).not.toBe('Seller-');
      }
    });
  });

  describe('encryptField / decryptField', () => {
    it('encrypts and decrypts a simple string', () => {
      const original = 'Hello, World!';
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(original);
    });

    it('encrypted output differs from plaintext', () => {
      const original = 'secret data';
      const encrypted = encryptField(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted).not.toContain(original);
    });

    it('encrypted output contains three colon-separated parts (iv:tag:ciphertext)', () => {
      const encrypted = encryptField('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // IV is 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24);
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Ciphertext is non-empty hex
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('produces different ciphertext for same plaintext (random IV)', () => {
      const original = 'same input every time';
      const encrypted1 = encryptField(original);
      const encrypted2 = encryptField(original);
      expect(encrypted1).not.toBe(encrypted2);
      // But both decrypt to the same value
      expect(decryptField(encrypted1)).toBe(original);
      expect(decryptField(encrypted2)).toBe(original);
    });

    it('handles empty string', () => {
      const encrypted = encryptField('');
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles unicode content', () => {
      const original = '🎉 Привет мир! 你好世界 مرحبا';
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles long content (ad copy)', () => {
      const original = 'Buy our product! '.repeat(500);
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles URLs', () => {
      const original = 'https://example.com/image.jpg?token=abc123&size=large';
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles multiline content', () => {
      const original = 'Line 1\nLine 2\n\nLine 4\ttab';
      const encrypted = encryptField(original);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(original);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encryptField('secret');
      const parts = encrypted.split(':');
      // Tamper with ciphertext
      parts[2] = 'ff' + parts[2].slice(2);
      const tampered = parts.join(':');
      expect(() => decryptField(tampered)).toThrow();
    });

    it('throws on tampered auth tag', () => {
      const encrypted = encryptField('secret');
      const parts = encrypted.split(':');
      parts[1] = '00'.repeat(16);
      const tampered = parts.join(':');
      expect(() => decryptField(tampered)).toThrow();
    });

    it('throws on invalid format', () => {
      expect(() => decryptField('not-encrypted')).toThrow();
      expect(() => decryptField('a:b')).toThrow();
    });
  });

  describe('hashDealData', () => {
    const baseData = {
      dealId: 1,
      channelId: 10,
      advertiserId: 20,
      amountTon: 50,
      finalStatus: 'COMPLETED',
      escrowAddress: 'EQtest123',
      completedAt: '2025-01-01T00:00:00Z',
    };

    it('produces a 64-char hex SHA-256 hash', () => {
      const hash = hashDealData(baseData);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces deterministic output for same input', () => {
      const hash1 = hashDealData(baseData);
      const hash2 = hashDealData(baseData);
      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different deal IDs', () => {
      const hash1 = hashDealData(baseData);
      const hash2 = hashDealData({ ...baseData, dealId: 2 });
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash for different amounts', () => {
      const hash1 = hashDealData(baseData);
      const hash2 = hashDealData({ ...baseData, amountTon: 51 });
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash for different statuses', () => {
      const hash1 = hashDealData(baseData);
      const hash2 = hashDealData({ ...baseData, finalStatus: 'REFUNDED' });
      expect(hash1).not.toBe(hash2);
    });

    it('handles null escrow address', () => {
      const hash = hashDealData({ ...baseData, escrowAddress: null });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('key ordering does not affect hash (sorted keys)', () => {
      // hashDealData sorts keys internally, so property order shouldn't matter
      const hash1 = hashDealData(baseData);
      const reordered = {
        completedAt: baseData.completedAt,
        amountTon: baseData.amountTon,
        dealId: baseData.dealId,
        finalStatus: baseData.finalStatus,
        channelId: baseData.channelId,
        advertiserId: baseData.advertiserId,
        escrowAddress: baseData.escrowAddress,
      };
      const hash2 = hashDealData(reordered);
      expect(hash1).toBe(hash2);
    });
  });
});
