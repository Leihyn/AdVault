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
  scheduleDealSchema,
  disputeDealSchema,
  submitCreativeSchema,
  revisionSchema,
  updateUserSchema,
  paginationSchema,
} from '../api/schemas/index.js';

describe('Zod Validation Schemas', () => {
  // ==================== Channel Schemas ====================
  describe('createChannelSchema', () => {
    it('accepts valid channel data', () => {
      const result = createChannelSchema.parse({
        telegramChatId: '-1001234567890',
        title: 'My Channel',
        description: 'A great channel',
        username: 'mychannel',
        language: 'en',
        category: 'tech',
      });
      expect(result.telegramChatId).toBe(-1001234567890n);
      expect(result.title).toBe('My Channel');
    });

    it('requires title', () => {
      expect(() => createChannelSchema.parse({
        telegramChatId: '-100123',
      })).toThrow();
    });

    it('rejects empty title', () => {
      expect(() => createChannelSchema.parse({
        telegramChatId: '-100123',
        title: '',
      })).toThrow();
    });

    it('coerces telegramChatId to bigint', () => {
      const result = createChannelSchema.parse({
        telegramChatId: '999',
        title: 'Test',
      });
      expect(typeof result.telegramChatId).toBe('bigint');
    });

    it('allows optional fields to be omitted', () => {
      const result = createChannelSchema.parse({
        telegramChatId: '-100123',
        title: 'Test',
      });
      expect(result.description).toBeUndefined();
      expect(result.username).toBeUndefined();
    });
  });

  describe('updateChannelSchema', () => {
    it('accepts partial updates', () => {
      const result = updateChannelSchema.parse({ description: 'Updated' });
      expect(result.description).toBe('Updated');
      expect(result.language).toBeUndefined();
    });

    it('accepts empty object', () => {
      const result = updateChannelSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('channelFiltersSchema', () => {
    it('applies defaults', () => {
      const result = channelFiltersSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('coerces string numbers', () => {
      const result = channelFiltersSchema.parse({
        minSubscribers: '1000',
        page: '3',
        limit: '10',
      });
      expect(result.minSubscribers).toBe(1000);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });
  });

  describe('addAdFormatSchema', () => {
    it('accepts valid format', () => {
      const result = addAdFormatSchema.parse({
        formatType: 'POST',
        label: '1/24 Post',
        priceTon: 50,
      });
      expect(result.formatType).toBe('POST');
      expect(result.priceTon).toBe(50);
    });

    it('rejects invalid format type', () => {
      expect(() => addAdFormatSchema.parse({
        formatType: 'INVALID',
        label: 'Test',
        priceTon: 10,
      })).toThrow();
    });

    it('accepts all valid format types', () => {
      for (const type of ['POST', 'FORWARD', 'STORY', 'CUSTOM']) {
        const result = addAdFormatSchema.parse({ formatType: type, label: 'Test', priceTon: 1 });
        expect(result.formatType).toBe(type);
      }
    });

    it('rejects zero price', () => {
      expect(() => addAdFormatSchema.parse({
        formatType: 'POST',
        label: 'Test',
        priceTon: 0,
      })).toThrow();
    });

    it('rejects negative price', () => {
      expect(() => addAdFormatSchema.parse({
        formatType: 'POST',
        label: 'Test',
        priceTon: -5,
      })).toThrow();
    });
  });

  describe('addAdminSchema', () => {
    it('accepts valid admin data', () => {
      const result = addAdminSchema.parse({ userId: 1 });
      expect(result.userId).toBe(1);
    });

    it('rejects non-positive userId', () => {
      expect(() => addAdminSchema.parse({ userId: 0 })).toThrow();
      expect(() => addAdminSchema.parse({ userId: -1 })).toThrow();
    });
  });

  // ==================== Campaign Schemas ====================
  describe('createCampaignSchema', () => {
    it('accepts valid campaign', () => {
      const result = createCampaignSchema.parse({
        title: 'DeFi Promo',
        brief: 'Promote our DeFi app to crypto channels',
        budgetTon: 200,
      });
      expect(result.title).toBe('DeFi Promo');
      expect(result.budgetTon).toBe(200);
    });

    it('requires title, brief, and budget', () => {
      expect(() => createCampaignSchema.parse({})).toThrow();
      expect(() => createCampaignSchema.parse({ title: 'T' })).toThrow();
      expect(() => createCampaignSchema.parse({ title: 'T', brief: 'B' })).toThrow();
    });

    it('rejects zero budget', () => {
      expect(() => createCampaignSchema.parse({
        title: 'T',
        brief: 'B',
        budgetTon: 0,
      })).toThrow();
    });
  });

  describe('updateCampaignSchema', () => {
    it('accepts valid status transitions', () => {
      for (const status of ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']) {
        const result = updateCampaignSchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it('rejects invalid status', () => {
      expect(() => updateCampaignSchema.parse({ status: 'INVALID' })).toThrow();
    });
  });

  describe('applyToCampaignSchema', () => {
    it('accepts valid application', () => {
      const result = applyToCampaignSchema.parse({
        channelId: 1,
        proposedPriceTon: 30,
        message: 'Our channel is perfect for this',
      });
      expect(result.channelId).toBe(1);
      expect(result.proposedPriceTon).toBe(30);
    });

    it('rejects missing channelId', () => {
      expect(() => applyToCampaignSchema.parse({
        proposedPriceTon: 30,
      })).toThrow();
    });
  });

  // ==================== Deal Schemas ====================
  describe('createDealSchema', () => {
    it('accepts valid deal', () => {
      const result = createDealSchema.parse({
        channelId: 1,
        adFormatId: 2,
        amountTon: 50,
      });
      expect(result.channelId).toBe(1);
      expect(result.amountTon).toBe(50);
      expect(result.campaignId).toBeUndefined();
    });

    it('accepts optional campaignId', () => {
      const result = createDealSchema.parse({
        channelId: 1,
        adFormatId: 2,
        amountTon: 50,
        campaignId: 3,
      });
      expect(result.campaignId).toBe(3);
    });

    it('rejects negative amount', () => {
      expect(() => createDealSchema.parse({
        channelId: 1,
        adFormatId: 2,
        amountTon: -10,
      })).toThrow();
    });
  });

  describe('scheduleDealSchema', () => {
    it('accepts valid ISO datetime', () => {
      const result = scheduleDealSchema.parse({
        scheduledPostAt: '2025-06-15T14:00:00.000Z',
      });
      expect(result.scheduledPostAt).toBe('2025-06-15T14:00:00.000Z');
    });

    it('rejects invalid datetime', () => {
      expect(() => scheduleDealSchema.parse({
        scheduledPostAt: 'not-a-date',
      })).toThrow();
    });
  });

  describe('disputeDealSchema', () => {
    it('accepts valid reason', () => {
      const result = disputeDealSchema.parse({ reason: 'Post was deleted' });
      expect(result.reason).toBe('Post was deleted');
    });

    it('rejects empty reason', () => {
      expect(() => disputeDealSchema.parse({ reason: '' })).toThrow();
    });
  });

  // ==================== Creative Schemas ====================
  describe('submitCreativeSchema', () => {
    it('accepts text-only creative', () => {
      const result = submitCreativeSchema.parse({ contentText: 'Buy our product!' });
      expect(result.contentText).toBe('Buy our product!');
    });

    it('accepts creative with media', () => {
      const result = submitCreativeSchema.parse({
        contentText: 'Check this out',
        mediaUrl: 'https://example.com/img.jpg',
        mediaType: 'photo',
      });
      expect(result.mediaType).toBe('photo');
    });

    it('accepts all media types', () => {
      for (const type of ['photo', 'video', 'document']) {
        const result = submitCreativeSchema.parse({ mediaType: type, mediaUrl: 'https://x.com/f' });
        expect(result.mediaType).toBe(type);
      }
    });

    it('rejects invalid media type', () => {
      expect(() => submitCreativeSchema.parse({
        mediaType: 'audio',
        mediaUrl: 'https://x.com/f',
      })).toThrow();
    });

    it('rejects invalid URL', () => {
      expect(() => submitCreativeSchema.parse({
        mediaUrl: 'not-a-url',
      })).toThrow();
    });
  });

  describe('revisionSchema', () => {
    it('accepts valid notes', () => {
      const result = revisionSchema.parse({ notes: 'Please change the CTA' });
      expect(result.notes).toBe('Please change the CTA');
    });

    it('rejects empty notes', () => {
      expect(() => revisionSchema.parse({ notes: '' })).toThrow();
    });
  });

  // ==================== User Schemas ====================
  describe('updateUserSchema', () => {
    it('accepts wallet address update', () => {
      const result = updateUserSchema.parse({
        tonWalletAddress: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG',
      });
      expect(result.tonWalletAddress).toBeDefined();
    });

    it('strips unknown fields like role', () => {
      const result = updateUserSchema.parse({ role: 'ADMIN', tonWalletAddress: 'abc' });
      expect((result as any).role).toBeUndefined();
      expect(result.tonWalletAddress).toBe('abc');
    });
  });

  // ==================== Pagination ====================
  describe('paginationSchema', () => {
    it('applies defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('coerces strings to numbers', () => {
      const result = paginationSchema.parse({ page: '5', limit: '50' });
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });
  });
});
