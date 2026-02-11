import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, Platform } from '@prisma/client';
import {
  createChannel,
  listChannels,
  getChannel,
  getChannelsByOwner,
  addAdFormat,
} from '../services/channel.service.js';
import { markAsPosted, markAsVerified } from '../services/posting.service.js';
import { createDeal, getDeal, getScheduledDeals, getPostedDeals, transitionDeal } from '../services/deal.service.js';
import { platformRegistry } from '../platforms/registry.js';
import { TelegramAdapter } from '../platforms/telegram.adapter.js';
import { YouTubeAdapter } from '../platforms/youtube.adapter.js';
import { InstagramAdapter } from '../platforms/instagram.adapter.js';
import { TwitterAdapter } from '../platforms/twitter.adapter.js';
import { Platform as PlatformEnum } from '../platforms/types.js';
import {
  createChannelSchema,
  channelFiltersSchema,
  addAdFormatSchema,
} from '../api/schemas/index.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

const prisma = new PrismaClient();

async function cleanDatabase() {
  await prisma.dealReceipt.deleteMany();
  await prisma.pendingTransfer.deleteMany();
  await prisma.dealEvent.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.campaignApplication.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.adFormat.deleteMany();
  await prisma.channelAdmin.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany();
}

let ownerId: number;
let advertiserId: number;

describe('Cross-Platform Expansion Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();

    const owner = await prisma.user.create({
      data: {
        telegramId: 900001n,
        username: 'platform_owner',
        firstName: 'PlatOwner',
        role: 'OWNER',
        tonWalletAddress: 'EQPlatOwner',
      },
    });
    ownerId = owner.id;

    const adv = await prisma.user.create({
      data: {
        telegramId: 900002n,
        username: 'platform_adv',
        firstName: 'PlatAdv',
        role: 'ADVERTISER',
        tonWalletAddress: 'EQPlatAdv',
      },
    });
    advertiserId = adv.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ==================== Platform Types & Registry ====================
  describe('Platform types and registry', () => {
    it('PlatformEnum matches Prisma Platform enum values', () => {
      expect(PlatformEnum.TELEGRAM).toBe('TELEGRAM');
      expect(PlatformEnum.YOUTUBE).toBe('YOUTUBE');
      expect(PlatformEnum.INSTAGRAM).toBe('INSTAGRAM');
      expect(PlatformEnum.TWITTER).toBe('TWITTER');
    });

    it('registry throws for unregistered platform', () => {
      expect(() => platformRegistry.get('NONEXISTENT')).toThrow('No adapter registered');
    });

    it('registry.has returns false for unregistered platform', () => {
      expect(platformRegistry.has('NONEXISTENT')).toBe(false);
    });
  });

  // ==================== Telegram Adapter ====================
  describe('TelegramAdapter', () => {
    it('has correct platform identifier', () => {
      // Create with a mock bot
      const adapter = new TelegramAdapter({} as any);
      expect(adapter.platform).toBe(PlatformEnum.TELEGRAM);
    });

    it('generates correct channel URL with username', () => {
      const adapter = new TelegramAdapter({} as any);
      expect(adapter.getChannelUrl('-1001234', 'testchannel')).toBe('https://t.me/testchannel');
    });

    it('generates correct channel URL without username', () => {
      const adapter = new TelegramAdapter({} as any);
      const url = adapter.getChannelUrl('-1001234567890');
      expect(url).toContain('t.me/c/');
    });

    it('generates correct post URL', () => {
      const adapter = new TelegramAdapter({} as any);
      const url = adapter.getPostUrl('-1001234567890', '42');
      expect(url).toContain('t.me/c/');
      expect(url).toContain('/42');
    });
  });

  // ==================== YouTube Adapter ====================
  describe('YouTubeAdapter', () => {
    it('has correct platform identifier', () => {
      const adapter = new YouTubeAdapter();
      expect(adapter.platform).toBe(PlatformEnum.YOUTUBE);
    });

    it('canPost always returns false (manual posting)', async () => {
      const adapter = new YouTubeAdapter();
      const result = await adapter.canPost('UC_x5XG1OV2P6uZZ5FSM9Ttw');
      expect(result).toBe(false);
    });

    it('publishPost throws with descriptive error', async () => {
      const adapter = new YouTubeAdapter();
      await expect(
        adapter.publishPost('UCtest', 'Hello', undefined, undefined),
      ).rejects.toThrow('YouTube does not support automated posting');
    });

    it('generates correct video URL', () => {
      const adapter = new YouTubeAdapter();
      expect(adapter.getPostUrl('UCtest', 'dQw4w9WgXcQ')).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });

    it('generates correct channel URL with username', () => {
      const adapter = new YouTubeAdapter();
      expect(adapter.getChannelUrl('UCtest', 'pewdiepie')).toBe(
        'https://www.youtube.com/@pewdiepie',
      );
    });

    it('generates correct channel URL without username', () => {
      const adapter = new YouTubeAdapter();
      expect(adapter.getChannelUrl('UC_x5XG1OV2P6uZZ5FSM9Ttw')).toBe(
        'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
      );
    });
  });

  // ==================== Instagram Adapter (Stub) ====================
  describe('InstagramAdapter (stub)', () => {
    it('has correct platform identifier', () => {
      const adapter = new InstagramAdapter();
      expect(adapter.platform).toBe(PlatformEnum.INSTAGRAM);
    });

    it('fetchChannelInfo throws coming soon', async () => {
      const adapter = new InstagramAdapter();
      await expect(adapter.fetchChannelInfo('test')).rejects.toThrow('coming soon');
    });

    it('canPost throws coming soon', async () => {
      const adapter = new InstagramAdapter();
      await expect(adapter.canPost('test')).rejects.toThrow('coming soon');
    });

    it('publishPost throws coming soon', async () => {
      const adapter = new InstagramAdapter();
      await expect(adapter.publishPost('test', 'text')).rejects.toThrow('coming soon');
    });

    it('verifyPostExists throws coming soon', async () => {
      const adapter = new InstagramAdapter();
      await expect(adapter.verifyPostExists('test', '123')).rejects.toThrow('coming soon');
    });

    it('getPostUrl returns valid Instagram URL', () => {
      const adapter = new InstagramAdapter();
      expect(adapter.getPostUrl('testuser', 'ABC123')).toBe('https://www.instagram.com/p/ABC123');
    });

    it('getChannelUrl returns valid Instagram URL with username', () => {
      const adapter = new InstagramAdapter();
      expect(adapter.getChannelUrl('12345', 'testuser')).toBe('https://www.instagram.com/testuser');
    });
  });

  // ==================== Twitter Adapter (Stub) ====================
  describe('TwitterAdapter (stub)', () => {
    it('has correct platform identifier', () => {
      const adapter = new TwitterAdapter();
      expect(adapter.platform).toBe(PlatformEnum.TWITTER);
    });

    it('fetchChannelInfo throws coming soon', async () => {
      const adapter = new TwitterAdapter();
      await expect(adapter.fetchChannelInfo('test')).rejects.toThrow('coming soon');
    });

    it('canPost throws coming soon', async () => {
      const adapter = new TwitterAdapter();
      await expect(adapter.canPost('test')).rejects.toThrow('coming soon');
    });

    it('publishPost throws coming soon', async () => {
      const adapter = new TwitterAdapter();
      await expect(adapter.publishPost('test', 'text')).rejects.toThrow('coming soon');
    });

    it('verifyPostExists throws coming soon', async () => {
      const adapter = new TwitterAdapter();
      await expect(adapter.verifyPostExists('test', '123')).rejects.toThrow('coming soon');
    });

    it('getPostUrl returns valid X/Twitter URL', () => {
      const adapter = new TwitterAdapter();
      expect(adapter.getPostUrl('elonmusk', '123456789')).toBe(
        'https://x.com/elonmusk/status/123456789',
      );
    });

    it('getChannelUrl returns valid X/Twitter URL with username', () => {
      const adapter = new TwitterAdapter();
      expect(adapter.getChannelUrl('12345', 'elonmusk')).toBe('https://x.com/elonmusk');
    });

    it('getChannelUrl returns valid X/Twitter URL without username', () => {
      const adapter = new TwitterAdapter();
      expect(adapter.getChannelUrl('12345')).toBe('https://x.com/i/user/12345');
    });
  });

  // ==================== Schema Validation ====================
  describe('Schema validation — platform fields', () => {
    describe('createChannelSchema', () => {
      it('accepts Telegram channel with telegramChatId (backward compat)', () => {
        const result = createChannelSchema.safeParse({
          telegramChatId: '-1001234567890',
          title: 'Test Channel',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.platform).toBe('TELEGRAM');
        }
      });

      it('accepts Telegram channel with platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'TELEGRAM',
          platformChannelId: '-1001234567890',
          title: 'Test Channel',
        });
        expect(result.success).toBe(true);
      });

      it('accepts YouTube channel with platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'YOUTUBE',
          platformChannelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
          title: 'YouTube Channel',
        });
        expect(result.success).toBe(true);
      });

      it('accepts Instagram channel with platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'INSTAGRAM',
          platformChannelId: 'testuser',
          title: 'Instagram Account',
        });
        expect(result.success).toBe(true);
      });

      it('accepts Twitter channel with platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'TWITTER',
          platformChannelId: '1234567890',
          title: 'Twitter Account',
        });
        expect(result.success).toBe(true);
      });

      it('rejects YouTube channel without platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'YOUTUBE',
          title: 'Bad YouTube Channel',
        });
        expect(result.success).toBe(false);
      });

      it('rejects Instagram channel without platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'INSTAGRAM',
          title: 'Bad Instagram',
        });
        expect(result.success).toBe(false);
      });

      it('rejects Twitter channel without platformChannelId', () => {
        const result = createChannelSchema.safeParse({
          platform: 'TWITTER',
          title: 'Bad Twitter',
        });
        expect(result.success).toBe(false);
      });

      it('rejects Telegram channel without any ID', () => {
        const result = createChannelSchema.safeParse({
          platform: 'TELEGRAM',
          title: 'No ID',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid platform value', () => {
        const result = createChannelSchema.safeParse({
          platform: 'TIKTOK',
          platformChannelId: 'test',
          title: 'TikTok Channel',
        });
        expect(result.success).toBe(false);
      });

      it('defaults platform to TELEGRAM when not provided', () => {
        const result = createChannelSchema.safeParse({
          telegramChatId: '-1001234567890',
          title: 'Test',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.platform).toBe('TELEGRAM');
        }
      });
    });

    describe('channelFiltersSchema', () => {
      it('accepts platform filter', () => {
        const result = channelFiltersSchema.safeParse({ platform: 'YOUTUBE' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.platform).toBe('YOUTUBE');
        }
      });

      it('accepts filters without platform', () => {
        const result = channelFiltersSchema.safeParse({ language: 'en' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.platform).toBeUndefined();
        }
      });

      it('rejects invalid platform in filter', () => {
        const result = channelFiltersSchema.safeParse({ platform: 'TIKTOK' });
        expect(result.success).toBe(false);
      });

      it('accepts all valid platform values in filter', () => {
        for (const p of ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER']) {
          const result = channelFiltersSchema.safeParse({ platform: p });
          expect(result.success).toBe(true);
        }
      });
    });

    describe('addAdFormatSchema — new format types', () => {
      it('accepts VIDEO format', () => {
        const result = addAdFormatSchema.safeParse({
          formatType: 'VIDEO',
          label: 'Sponsored Video',
          priceTon: 100,
        });
        expect(result.success).toBe(true);
      });

      it('accepts REEL format', () => {
        const result = addAdFormatSchema.safeParse({
          formatType: 'REEL',
          label: 'Sponsored Reel',
          priceTon: 50,
        });
        expect(result.success).toBe(true);
      });

      it('accepts TWEET format', () => {
        const result = addAdFormatSchema.safeParse({
          formatType: 'TWEET',
          label: 'Sponsored Tweet',
          priceTon: 25,
        });
        expect(result.success).toBe(true);
      });

      it('accepts COMMUNITY_POST format', () => {
        const result = addAdFormatSchema.safeParse({
          formatType: 'COMMUNITY_POST',
          label: 'Community Post',
          priceTon: 10,
        });
        expect(result.success).toBe(true);
      });

      it('still accepts original format types', () => {
        for (const ft of ['POST', 'FORWARD', 'STORY', 'CUSTOM']) {
          const result = addAdFormatSchema.safeParse({
            formatType: ft,
            label: ft,
            priceTon: 10,
          });
          expect(result.success).toBe(true);
        }
      });
    });
  });

  // ==================== Database — Channel with Platform ====================
  describe('Database — Channel model with platform fields', () => {
    let telegramChannelId: number;
    let youtubeChannelId: number;

    it('creates a Telegram channel with platformChannelId auto-derived', async () => {
      const channel = await createChannel({
        telegramChatId: -100800001n,
        ownerId,
        title: 'Platform TG Channel',
        username: 'platformtg',
        subscribers: 5000,
        language: 'en',
        category: 'tech',
      });
      telegramChannelId = channel.id;
      expect(channel.platform).toBe('TELEGRAM');
      expect(channel.platformChannelId).toBe(String(-100800001n));
      expect(channel.telegramChatId).toBe(-100800001n);
    });

    it('creates a YouTube channel', async () => {
      const channel = await createChannel({
        platform: 'YOUTUBE',
        platformChannelId: 'UC_TestChannel123',
        ownerId,
        title: 'Platform YT Channel',
        username: 'testytchannel',
        subscribers: 50000,
        language: 'en',
        category: 'entertainment',
      });
      youtubeChannelId = channel.id;
      expect(channel.platform).toBe('YOUTUBE');
      expect(channel.platformChannelId).toBe('UC_TestChannel123');
      expect(channel.telegramChatId).toBeNull();
    });

    it('creates a Twitter channel (stub platform)', async () => {
      const channel = await createChannel({
        platform: 'TWITTER',
        platformChannelId: '1234567890',
        ownerId,
        title: 'Platform Twitter Account',
        username: 'testtwitter',
        subscribers: 10000,
      });
      expect(channel.platform).toBe('TWITTER');
      expect(channel.platformChannelId).toBe('1234567890');
      expect(channel.telegramChatId).toBeNull();
    });

    it('creates an Instagram channel (stub platform)', async () => {
      const channel = await createChannel({
        platform: 'INSTAGRAM',
        platformChannelId: 'testinsta',
        ownerId,
        title: 'Platform Instagram Account',
        username: 'testinsta',
        subscribers: 25000,
      });
      expect(channel.platform).toBe('INSTAGRAM');
      expect(channel.platformChannelId).toBe('testinsta');
      expect(channel.telegramChatId).toBeNull();
    });

    it('rejects duplicate platform + platformChannelId', async () => {
      await expect(
        createChannel({
          platform: 'YOUTUBE',
          platformChannelId: 'UC_TestChannel123',
          ownerId,
          title: 'Duplicate YT',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('allows same platformChannelId on different platforms', async () => {
      // Same ID but different platform should work
      const channel = await createChannel({
        platform: 'TWITTER',
        platformChannelId: 'UC_TestChannel123', // same as YouTube channel
        ownerId,
        title: 'Twitter with YT-like ID',
      });
      expect(channel.platform).toBe('TWITTER');
    });

    it('getChannelsByOwner returns channels across all platforms', async () => {
      const channels = await getChannelsByOwner(ownerId);
      const platforms = channels.map((c) => c.platform);
      expect(platforms).toContain('TELEGRAM');
      expect(platforms).toContain('YOUTUBE');
      expect(platforms).toContain('TWITTER');
      expect(platforms).toContain('INSTAGRAM');
    });

    it('listChannels filters by platform', async () => {
      // First verify all channels so they show up in listings
      await prisma.channel.updateMany({
        where: { ownerId },
        data: { isVerified: true },
      });

      const ytResult = await listChannels({ platform: 'YOUTUBE' });
      expect(ytResult.channels.length).toBeGreaterThanOrEqual(1);
      for (const ch of ytResult.channels) {
        expect(ch.platform).toBe('YOUTUBE');
      }

      const tgResult = await listChannels({ platform: 'TELEGRAM' });
      for (const ch of tgResult.channels) {
        expect(ch.platform).toBe('TELEGRAM');
      }
    });

    it('listChannels without platform filter returns all platforms', async () => {
      const result = await listChannels({});
      const platforms = new Set(result.channels.map((c: any) => c.platform));
      expect(platforms.size).toBeGreaterThan(1);
    });

    it('getChannel includes platform fields', async () => {
      const channel = await getChannel(youtubeChannelId);
      expect(channel.platform).toBe('YOUTUBE');
      expect(channel.platformChannelId).toBe('UC_TestChannel123');
    });

    it('addAdFormat works with new format types on YouTube channel', async () => {
      const format = await addAdFormat(youtubeChannelId, ownerId, {
        formatType: 'VIDEO',
        label: 'Sponsored Video',
        priceTon: 100,
      });
      expect(format.formatType).toBe('VIDEO');
      expect(format.channelId).toBe(youtubeChannelId);
    });

    it('addAdFormat works with COMMUNITY_POST on YouTube channel', async () => {
      const format = await addAdFormat(youtubeChannelId, ownerId, {
        formatType: 'COMMUNITY_POST',
        label: 'Community Post',
        priceTon: 15,
      });
      expect(format.formatType).toBe('COMMUNITY_POST');
    });
  });

  // ==================== Deal with Platform Channels ====================
  describe('Deal lifecycle with platform channels', () => {
    let ytChannelId: number;
    let ytFormatId: number;
    let ytDealId: number;
    let tgChannelId: number;
    let tgFormatId: number;
    let tgDealId: number;

    beforeAll(async () => {
      // Create a verified YouTube channel with format
      const ytCh = await prisma.channel.create({
        data: {
          platform: 'YOUTUBE',
          platformChannelId: 'UC_DealTestYT',
          ownerId,
          title: 'Deal Test YT',
          subscribers: 100000,
          isVerified: true,
        },
      });
      ytChannelId = ytCh.id;

      const ytFmt = await prisma.adFormat.create({
        data: {
          channelId: ytChannelId,
          formatType: 'VIDEO',
          label: 'Sponsored Video',
          priceTon: 50,
        },
      });
      ytFormatId = ytFmt.id;

      // Create a verified Telegram channel with format
      const tgCh = await prisma.channel.create({
        data: {
          platform: 'TELEGRAM',
          platformChannelId: String(-100900099n),
          telegramChatId: -100900099n,
          ownerId,
          title: 'Deal Test TG',
          subscribers: 5000,
          isVerified: true,
        },
      });
      tgChannelId = tgCh.id;

      const tgFmt = await prisma.adFormat.create({
        data: {
          channelId: tgChannelId,
          formatType: 'POST',
          label: 'Channel Post',
          priceTon: 10,
        },
      });
      tgFormatId = tgFmt.id;
    });

    it('creates a deal on a YouTube channel', async () => {
      const deal = await createDeal({
        channelId: ytChannelId,
        advertiserId,
        adFormatId: ytFormatId,
        amountTon: 50,
      });
      ytDealId = deal.id;
      expect(deal.status).toBe('PENDING_PAYMENT');
      expect(deal.channelId).toBe(ytChannelId);
    });

    it('creates a deal on a Telegram channel', async () => {
      const deal = await createDeal({
        channelId: tgChannelId,
        advertiserId,
        adFormatId: tgFormatId,
        amountTon: 10,
      });
      tgDealId = deal.id;
      expect(deal.status).toBe('PENDING_PAYMENT');
    });

    it('getDeal includes platform and platformChannelId', async () => {
      const deal = await getDeal(ytDealId);
      expect(deal.channel.platform).toBe('YOUTUBE');
      expect(deal.channel.platformChannelId).toBe('UC_DealTestYT');
    });

    it('getDeal for Telegram deal includes telegram-specific fields', async () => {
      const deal = await getDeal(tgDealId);
      expect(deal.channel.platform).toBe('TELEGRAM');
      expect(deal.channel.telegramChatId).toBe(-100900099n);
      expect(deal.channel.platformChannelId).toBe(String(-100900099n));
    });

    it('postedMessageId accepts string values (platform-agnostic)', async () => {
      // Transition YouTube deal through to POSTED
      await transitionDeal(ytDealId, 'FUNDED');
      await transitionDeal(ytDealId, 'CREATIVE_PENDING');
      await transitionDeal(ytDealId, 'CREATIVE_SUBMITTED');
      await transitionDeal(ytDealId, 'CREATIVE_APPROVED');
      await transitionDeal(ytDealId, 'SCHEDULED');

      // markAsPosted with a YouTube video ID (string)
      await markAsPosted(ytDealId, 'dQw4w9WgXcQ');

      const deal = await prisma.deal.findUnique({ where: { id: ytDealId } });
      expect(deal!.postedMessageId).toBe('dQw4w9WgXcQ');
      expect(deal!.status).toBe('POSTED');
      expect(deal!.postedAt).not.toBeNull();
    });

    it('postedMessageId accepts numeric-string values for Telegram', async () => {
      await transitionDeal(tgDealId, 'FUNDED');
      await transitionDeal(tgDealId, 'CREATIVE_PENDING');
      await transitionDeal(tgDealId, 'CREATIVE_SUBMITTED');
      await transitionDeal(tgDealId, 'CREATIVE_APPROVED');
      await transitionDeal(tgDealId, 'SCHEDULED');

      await markAsPosted(tgDealId, '12345');

      const deal = await prisma.deal.findUnique({ where: { id: tgDealId } });
      expect(deal!.postedMessageId).toBe('12345');
      expect(deal!.status).toBe('POSTED');
    });

    it('getPostedDeals returns deals with platform info', async () => {
      const posted = await getPostedDeals();
      expect(posted.length).toBeGreaterThanOrEqual(2);

      const ytDeal = posted.find((d) => d.id === ytDealId);
      expect(ytDeal).toBeDefined();
      expect(ytDeal!.channel.platform).toBe('YOUTUBE');
      expect(ytDeal!.channel.platformChannelId).toBe('UC_DealTestYT');

      const tgDeal = posted.find((d) => d.id === tgDealId);
      expect(tgDeal).toBeDefined();
      expect(tgDeal!.channel.platform).toBe('TELEGRAM');
    });

    it('markAsVerified works for YouTube deal', async () => {
      await markAsVerified(ytDealId);
      const deal = await prisma.deal.findUnique({ where: { id: ytDealId } });
      expect(deal!.status).toBe('VERIFIED');
      expect(deal!.postVerifiedAt).not.toBeNull();
    });

    it('markAsVerified works for Telegram deal', async () => {
      await markAsVerified(tgDealId);
      const deal = await prisma.deal.findUnique({ where: { id: tgDealId } });
      expect(deal!.status).toBe('VERIFIED');
    });
  });

  // ==================== Prisma Schema — Composite Unique ====================
  describe('Prisma schema — composite unique constraint', () => {
    it('enforces unique (platform, platformChannelId) at database level', async () => {
      await prisma.channel.create({
        data: {
          platform: 'YOUTUBE',
          platformChannelId: 'UC_UniqueTest',
          ownerId,
          title: 'Unique Test',
        },
      });

      await expect(
        prisma.channel.create({
          data: {
            platform: 'YOUTUBE',
            platformChannelId: 'UC_UniqueTest',
            ownerId,
            title: 'Duplicate',
          },
        }),
      ).rejects.toThrow();
    });

    it('allows same platformChannelId with different platform', async () => {
      const ch = await prisma.channel.create({
        data: {
          platform: 'INSTAGRAM',
          platformChannelId: 'UC_UniqueTest', // same ID, different platform
          ownerId,
          title: 'Insta with same ID',
        },
      });
      expect(ch.id).toBeGreaterThan(0);
    });

    it('telegramChatId remains unique when set', async () => {
      await prisma.channel.create({
        data: {
          platform: 'TELEGRAM',
          platformChannelId: String(-100999001n),
          telegramChatId: -100999001n,
          ownerId,
          title: 'TG Unique Test',
        },
      });

      await expect(
        prisma.channel.create({
          data: {
            platform: 'TELEGRAM',
            platformChannelId: String(-100999002n),
            telegramChatId: -100999001n, // same telegramChatId
            ownerId,
            title: 'Duplicate TG',
          },
        }),
      ).rejects.toThrow();
    });

    it('allows null telegramChatId for non-Telegram channels', async () => {
      const ch1 = await prisma.channel.create({
        data: {
          platform: 'YOUTUBE',
          platformChannelId: 'UC_NullTgTest1',
          ownerId,
          title: 'YT Null TG 1',
        },
      });
      const ch2 = await prisma.channel.create({
        data: {
          platform: 'YOUTUBE',
          platformChannelId: 'UC_NullTgTest2',
          ownerId,
          title: 'YT Null TG 2',
        },
      });
      expect(ch1.telegramChatId).toBeNull();
      expect(ch2.telegramChatId).toBeNull();
    });
  });

  // ==================== Channel Service — Platform Derivation ====================
  describe('Channel service — platformChannelId derivation', () => {
    it('auto-derives platformChannelId from telegramChatId for Telegram', async () => {
      const ch = await createChannel({
        telegramChatId: -100888001n,
        ownerId,
        title: 'Auto-derive Test',
      });
      expect(ch.platformChannelId).toBe(String(-100888001n));
      expect(ch.platform).toBe('TELEGRAM');
    });

    it('uses explicit platformChannelId when both are provided', async () => {
      const ch = await createChannel({
        platform: 'TELEGRAM',
        platformChannelId: '-100888002',
        telegramChatId: -100888002n,
        ownerId,
        title: 'Explicit Both Test',
      });
      expect(ch.platformChannelId).toBe('-100888002');
    });

    it('sets telegramChatId from platformChannelId for Telegram channels', async () => {
      const ch = await createChannel({
        platform: 'TELEGRAM',
        platformChannelId: '-100888003',
        ownerId,
        title: 'PlatformId Only TG',
      });
      expect(ch.telegramChatId).toBe(-100888003n);
    });

    it('does not set telegramChatId for YouTube channels', async () => {
      const ch = await createChannel({
        platform: 'YOUTUBE',
        platformChannelId: 'UC_NoTgIdTest',
        ownerId,
        title: 'YT No TG ID',
      });
      expect(ch.telegramChatId).toBeNull();
    });
  });

  // ==================== Deal.postedMessageId String Migration ====================
  describe('Deal.postedMessageId — String type', () => {
    it('stores YouTube video IDs (alphanumeric strings)', async () => {
      const deal = await prisma.deal.create({
        data: {
          channelId: (await prisma.channel.findFirst({ where: { platform: 'YOUTUBE' } }))!.id,
          advertiserId,
          adFormatId: (await prisma.adFormat.findFirst())!.id,
          amountTon: 1,
          ownerAlias: 'Seller-test',
          advertiserAlias: 'Buyer-test',
          postedMessageId: 'dQw4w9WgXcQ',
        },
      });
      expect(deal.postedMessageId).toBe('dQw4w9WgXcQ');
    });

    it('stores Telegram message IDs as strings', async () => {
      const deal = await prisma.deal.create({
        data: {
          channelId: (await prisma.channel.findFirst({ where: { platform: 'TELEGRAM' } }))!.id,
          advertiserId,
          adFormatId: (await prisma.adFormat.findFirst())!.id,
          amountTon: 1,
          ownerAlias: 'Seller-test2',
          advertiserAlias: 'Buyer-test2',
          postedMessageId: '98765',
        },
      });
      expect(deal.postedMessageId).toBe('98765');
    });

    it('stores long Twitter status IDs', async () => {
      const deal = await prisma.deal.create({
        data: {
          channelId: (await prisma.channel.findFirst({ where: { platform: 'TWITTER' } }))!.id,
          advertiserId,
          adFormatId: (await prisma.adFormat.findFirst())!.id,
          amountTon: 1,
          ownerAlias: 'Seller-test3',
          advertiserAlias: 'Buyer-test3',
          postedMessageId: '1760000000000000000',
        },
      });
      expect(deal.postedMessageId).toBe('1760000000000000000');
    });

    it('stores null postedMessageId (not yet posted)', async () => {
      const deal = await prisma.deal.create({
        data: {
          channelId: (await prisma.channel.findFirst({ where: { platform: 'YOUTUBE' } }))!.id,
          advertiserId,
          adFormatId: (await prisma.adFormat.findFirst())!.id,
          amountTon: 1,
          ownerAlias: 'Seller-test4',
          advertiserAlias: 'Buyer-test4',
        },
      });
      expect(deal.postedMessageId).toBeNull();
    });
  });

  // ==================== AdFormatType Enum ====================
  describe('AdFormatType — new enum values', () => {
    let chId: number;

    beforeAll(async () => {
      const ch = await prisma.channel.create({
        data: {
          platform: 'YOUTUBE',
          platformChannelId: 'UC_FormatTest',
          ownerId,
          title: 'Format Test Channel',
        },
      });
      chId = ch.id;
    });

    it('creates VIDEO ad format', async () => {
      const fmt = await prisma.adFormat.create({
        data: { channelId: chId, formatType: 'VIDEO', label: 'Video', priceTon: 100 },
      });
      expect(fmt.formatType).toBe('VIDEO');
    });

    it('creates REEL ad format', async () => {
      const fmt = await prisma.adFormat.create({
        data: { channelId: chId, formatType: 'REEL', label: 'Reel', priceTon: 50 },
      });
      expect(fmt.formatType).toBe('REEL');
    });

    it('creates TWEET ad format', async () => {
      const fmt = await prisma.adFormat.create({
        data: { channelId: chId, formatType: 'TWEET', label: 'Tweet', priceTon: 25 },
      });
      expect(fmt.formatType).toBe('TWEET');
    });

    it('creates COMMUNITY_POST ad format', async () => {
      const fmt = await prisma.adFormat.create({
        data: { channelId: chId, formatType: 'COMMUNITY_POST', label: 'Community', priceTon: 10 },
      });
      expect(fmt.formatType).toBe('COMMUNITY_POST');
    });

    it('original format types still work', async () => {
      for (const ft of ['POST', 'FORWARD', 'STORY', 'CUSTOM'] as const) {
        const fmt = await prisma.adFormat.create({
          data: { channelId: chId, formatType: ft, label: ft, priceTon: 5 },
        });
        expect(fmt.formatType).toBe(ft);
      }
    });
  });

  // ==================== Auth Middleware — request.user alias ====================
  describe('Auth middleware — request.user alias', () => {
    it('FastifyRequest type declaration includes user property', async () => {
      // Type-level test: verify the augmented type compiles
      // We test this by importing the auth module (which declares the module augmentation)
      const authModule = await import('../api/middleware/auth.js');
      expect(authModule.authMiddleware).toBeDefined();
      expect(typeof authModule.authMiddleware).toBe('function');
    });
  });

  // ==================== Config — YOUTUBE_API_KEY ====================
  describe('Config — YOUTUBE_API_KEY', () => {
    it('config includes YOUTUBE_API_KEY field', async () => {
      const { config } = await import('../config.js');
      expect(config).toHaveProperty('YOUTUBE_API_KEY');
      expect(typeof config.YOUTUBE_API_KEY).toBe('string');
    });
  });
});
