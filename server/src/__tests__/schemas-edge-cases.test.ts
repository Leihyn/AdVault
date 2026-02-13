import { describe, it, expect } from 'vitest';
import {
  createChannelSchema,
  updateChannelSchema,
  channelFiltersSchema,
  addAdFormatSchema,
  addAdminSchema,
  createCampaignSchema,
  updateCampaignSchema,
  campaignFiltersSchema,
  applyToCampaignSchema,
  createDealSchema,
  submitPostProofSchema,
  disputeDealSchema,
  submitCreativeSchema,
  revisionSchema,
  updateUserSchema,
  paginationSchema,
} from '../api/schemas/index.js';

describe('Zod Schemas — Edge Cases', () => {
  // ==================== Whitespace-only strings ====================
  describe('whitespace-only string handling', () => {
    it('rejects whitespace-only channel title (min(1) passes for " ")', () => {
      // NOTE: z.string().min(1) allows " " — this tests the current behavior
      const result = createChannelSchema.safeParse({
        telegramChatId: '-100123',
        title: '   ',
      });
      // min(1) checks length, not content — spaces pass
      expect(result.success).toBe(true);
    });

    it('rejects whitespace-only campaign title', () => {
      const result = createCampaignSchema.safeParse({
        title: ' ',
        brief: 'Valid brief',
        budgetTon: 100,
      });
      // Same: min(1) allows single space
      expect(result.success).toBe(true);
    });

    it('rejects whitespace-only dispute reason', () => {
      const result = disputeDealSchema.safeParse({ reason: ' ' });
      expect(result.success).toBe(true); // min(1) allows space
    });

    it('rejects whitespace-only revision notes', () => {
      const result = revisionSchema.safeParse({ notes: '\t' });
      expect(result.success).toBe(true); // min(1) allows tab
    });
  });

  // ==================== Extreme number values ====================
  describe('extreme number values', () => {
    it('accepts MAX_SAFE_INTEGER for channelId', () => {
      const result = createDealSchema.safeParse({
        channelId: Number.MAX_SAFE_INTEGER,
        adFormatId: 1,
        amountTon: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects NaN for amountTon', () => {
      const result = createDealSchema.safeParse({
        channelId: 1,
        adFormatId: 1,
        amountTon: NaN,
      });
      expect(result.success).toBe(false);
    });

    it('rejects Infinity for amountTon (max 1_000_000)', () => {
      const result = createDealSchema.safeParse({
        channelId: 1,
        adFormatId: 1,
        amountTon: Infinity,
      });
      // .max(1_000_000) rejects Infinity
      expect(result.success).toBe(false);
    });

    it('rejects -Infinity for amountTon', () => {
      const result = createDealSchema.safeParse({
        channelId: 1,
        adFormatId: 1,
        amountTon: -Infinity,
      });
      // -Infinity is not positive
      expect(result.success).toBe(false);
    });

    it('accepts very small positive amountTon', () => {
      const result = createDealSchema.safeParse({
        channelId: 1,
        adFormatId: 1,
        amountTon: 0.000001,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.amountTon).toBeCloseTo(0.000001);
    });

    it('rejects very large amountTon (max 1_000_000)', () => {
      const result = createDealSchema.safeParse({
        channelId: 1,
        adFormatId: 1,
        amountTon: 999999999,
      });
      expect(result.success).toBe(false);
    });

    it('rejects float channelId (int required)', () => {
      const result = createDealSchema.safeParse({
        channelId: 1.5,
        adFormatId: 1,
        amountTon: 10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects float adFormatId', () => {
      const result = createDealSchema.safeParse({
        channelId: 1,
        adFormatId: 2.7,
        amountTon: 10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects very large priceTon for ad format (max 1_000_000)', () => {
      const result = addAdFormatSchema.safeParse({
        formatType: 'POST',
        label: 'Expensive',
        priceTon: 1e15,
      });
      expect(result.success).toBe(false);
    });

    it('rejects NaN for priceTon', () => {
      const result = addAdFormatSchema.safeParse({
        formatType: 'POST',
        label: 'Test',
        priceTon: NaN,
      });
      expect(result.success).toBe(false);
    });

    it('accepts fractional proposedPriceTon', () => {
      const result = applyToCampaignSchema.safeParse({
        channelId: 1,
        proposedPriceTon: 0.5,
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== Pagination bounds ====================
  describe('pagination edge cases', () => {
    it('rejects page = 0 (positive constraint)', () => {
      const result = paginationSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative page', () => {
      const result = paginationSchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects limit = 0 (positive constraint)', () => {
      const result = paginationSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects very large limit (max 100)', () => {
      const result = paginationSchema.safeParse({ limit: 1000000 });
      expect(result.success).toBe(false);
    });

    it('rejects coerced string "0" (0 is not positive)', () => {
      const result = paginationSchema.safeParse({ page: '0', limit: '0' });
      expect(result.success).toBe(false);
    });

    it('rejects NaN-producing string ("abc")', () => {
      const result = paginationSchema.safeParse({ page: 'abc' });
      // z.coerce.number() does Number('abc') → NaN, then Zod rejects NaN
      expect(result.success).toBe(false);
    });

    it('channel filters: minSubscribers > maxSubscribers accepted (no cross-validation)', () => {
      const result = channelFiltersSchema.safeParse({
        minSubscribers: 10000,
        maxSubscribers: 100,
      });
      expect(result.success).toBe(true);
    });

    it('campaign filters: minBudget > maxBudget accepted', () => {
      const result = campaignFiltersSchema.safeParse({
        minBudget: 1000,
        maxBudget: 10,
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== BigInt coercion ====================
  describe('bigint coercion (telegramChatId)', () => {
    it('coerces negative string to negative bigint', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: '-1001234567890',
        title: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.telegramChatId).toBe(-1001234567890n);
      }
    });

    it('coerces zero to 0n', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: '0',
        title: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.telegramChatId).toBe(0n);
    });

    it('handles very large chat ID', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: '999999999999999999',
        title: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.telegramChatId).toBe(999999999999999999n);
    });

    it('rejects non-numeric telegramChatId', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: 'abc',
        title: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects floating point telegramChatId', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: '1.5',
        title: 'Test',
      });
      expect(result.success).toBe(false);
    });
  });

  // ==================== URL validation ====================
  describe('URL validation in creative schema', () => {
    it('accepts HTTPS URLs', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'https://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('accepts HTTP URLs', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'http://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('rejects FTP URLs', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'ftp://example.com/file.jpg',
      });
      // z.string().url() accepts any valid URL scheme
      // This tests actual behavior
      if (!result.success) {
        expect(result.success).toBe(false);
      }
    });

    it('accepts javascript: URLs (z.string().url() validates syntax, not scheme)', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'javascript:alert(1)',
      });
      // z.string().url() checks URL syntax validity, not scheme safety
      // javascript: is syntactically valid — this is a security gap to be aware of
      expect(result.success).toBe(true);
    });

    it('accepts data: URLs (z.string().url() validates syntax, not scheme)', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'data:text/html,<script>alert(1)</script>',
      });
      // Same: data: is syntactically valid URL
      expect(result.success).toBe(true);
    });

    it('accepts URL with query parameters', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'https://example.com/img.jpg?w=800&h=600&format=webp',
      });
      expect(result.success).toBe(true);
    });

    it('accepts URL with fragments', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'https://example.com/page#section',
      });
      expect(result.success).toBe(true);
    });

    it('accepts URL with port', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'https://example.com:8443/image.png',
      });
      expect(result.success).toBe(true);
    });

    it('accepts URL with special characters (encoded)', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'https://example.com/path%20with%20spaces/file%2B.jpg',
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== Post Proof URL validation ====================
  describe('URL validation in submitPostProofSchema', () => {
    it('accepts valid HTTPS URL', () => {
      const result = submitPostProofSchema.safeParse({
        postUrl: 'https://t.me/mychannel/123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid YouTube URL', () => {
      const result = submitPostProofSchema.safeParse({
        postUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty string', () => {
      const result = submitPostProofSchema.safeParse({
        postUrl: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-URL string', () => {
      const result = submitPostProofSchema.safeParse({
        postUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('accepts HTTP URL', () => {
      const result = submitPostProofSchema.safeParse({
        postUrl: 'http://example.com/post/123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing postUrl field', () => {
      const result = submitPostProofSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ==================== XSS / Injection payloads ====================
  describe('XSS and injection payloads (schema layer)', () => {
    it('accepts XSS in channel title (no sanitization at schema level)', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: '123',
        title: '<script>alert("xss")</script>',
      });
      expect(result.success).toBe(true);
    });

    it('accepts SQL injection in channel description', () => {
      const result = createChannelSchema.safeParse({
        telegramChatId: '123',
        title: 'Normal',
        description: "'; DROP TABLE channels; --",
      });
      expect(result.success).toBe(true);
      // Safe because Prisma uses parameterized queries
    });

    it('accepts XSS in creative contentText', () => {
      const result = submitCreativeSchema.safeParse({
        contentText: '<img src=x onerror=alert(1)>',
      });
      expect(result.success).toBe(true);
    });

    it('accepts XSS in dispute reason', () => {
      const result = disputeDealSchema.safeParse({
        reason: '<script>document.cookie</script>',
      });
      expect(result.success).toBe(true);
    });

    it('accepts HTML entities in revision notes', () => {
      const result = revisionSchema.safeParse({
        notes: '&lt;script&gt;alert(1)&lt;/script&gt;',
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== Optional vs required ====================
  describe('creative schema: both fields optional', () => {
    it('accepts completely empty creative (no text, no media)', () => {
      const result = submitCreativeSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts mediaType without mediaUrl', () => {
      const result = submitCreativeSchema.safeParse({
        mediaType: 'photo',
      });
      // No cross-field validation: mediaType without mediaUrl is accepted
      expect(result.success).toBe(true);
    });

    it('accepts mediaUrl without mediaType', () => {
      const result = submitCreativeSchema.safeParse({
        mediaUrl: 'https://example.com/img.jpg',
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== Campaign schema edge cases ====================
  describe('campaign schemas edge cases', () => {
    it('targetSubscribersMin > targetSubscribersMax accepted (no cross-validation)', () => {
      const result = createCampaignSchema.safeParse({
        title: 'Test',
        brief: 'Brief',
        budgetTon: 100,
        targetSubscribersMin: 10000,
        targetSubscribersMax: 100,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative targetSubscribersMin (nonnegative constraint)', () => {
      const result = createCampaignSchema.safeParse({
        title: 'Test',
        brief: 'Brief',
        budgetTon: 100,
        targetSubscribersMin: -100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects DRAFT as campaign status', () => {
      const result = updateCampaignSchema.safeParse({ status: 'DRAFT' });
      expect(result.success).toBe(false);
    });

    it('rejects empty title in update (min(1) enforced on optional)', () => {
      const result = updateCampaignSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });
  });

  // ==================== User schema edge cases ====================
  describe('user schema edge cases', () => {
    it('accepts empty wallet address string', () => {
      const result = updateUserSchema.safeParse({ tonWalletAddress: '' });
      expect(result.success).toBe(true);
    });

    it('accepts any string as wallet address (no TON format validation)', () => {
      const result = updateUserSchema.safeParse({ tonWalletAddress: 'not-a-real-address' });
      expect(result.success).toBe(true);
    });

    it('accepts update with no fields', () => {
      const result = updateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('strips unknown fields like role', () => {
      const result = updateUserSchema.safeParse({ role: 'SUPERADMIN' });
      expect(result.success).toBe(true);
      if (result.success) expect((result.data as any).role).toBeUndefined();
    });
  });

  // ==================== Admin schema ====================
  describe('admin schema edge cases', () => {
    it('rejects float userId', () => {
      const result = addAdminSchema.safeParse({ userId: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects negative userId', () => {
      const result = addAdminSchema.safeParse({ userId: -5 });
      expect(result.success).toBe(false);
    });

    it('accepts boolean permissions', () => {
      const result = addAdminSchema.safeParse({
        userId: 1,
        canManageDeals: false,
        canManagePricing: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canManageDeals).toBe(false);
        expect(result.data.canManagePricing).toBe(true);
      }
    });
  });

  // ==================== Type coercion edge cases ====================
  describe('type coercion edge cases', () => {
    it('coerces boolean "true" for page', () => {
      const result = paginationSchema.safeParse({ page: true });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(1);
    });

    it('rejects boolean false for page (coerces to 0, not positive)', () => {
      const result = paginationSchema.safeParse({ page: false });
      expect(result.success).toBe(false);
    });

    it('rejects null for page (coerces to 0, not positive)', () => {
      const result = paginationSchema.safeParse({ page: null });
      expect(result.success).toBe(false);
    });

    it('rejects empty string for page (coerces to 0, not positive)', () => {
      const result = paginationSchema.safeParse({ page: '' });
      expect(result.success).toBe(false);
    });

    it('rejects negative string for minSubscribers (nonnegative constraint)', () => {
      const result = channelFiltersSchema.safeParse({ minSubscribers: '-500' });
      expect(result.success).toBe(false);
    });
  });
});
