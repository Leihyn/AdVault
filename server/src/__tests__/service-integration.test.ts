import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  listChannels,
  getChannel,
  createChannel,
  updateChannel,
  getChannelsByOwner,
  addAdFormat,
  addChannelAdmin,
} from '../services/channel.service.js';
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  applyToCampaign,
} from '../services/campaign.service.js';
import {
  createDeal,
  getDeal,
  getUserDeals,
  transitionDeal,
  cancelDeal,
  disputeDeal,
} from '../services/deal.service.js';
import {
  submitCreative,
  approveCreative,
  requestRevision,
  getCreatives,
} from '../services/creative.service.js';
import { NotFoundError, ForbiddenError, ConflictError, AppError } from '../utils/errors.js';

const prisma = new PrismaClient();

async function cleanDatabase() {
  await prisma.dealReceipt.deleteMany();
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
let ownerTgId: bigint;
let advertiserId: number;
let advertiserTgId: bigint;
let channelId: number;
let formatId: number;
let campaignId: number;

describe('Service Layer Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();

    // Create test users
    const owner = await prisma.user.create({
      data: {
        telegramId: 200001n,
        username: 'svc_owner',
        firstName: 'Owner',
        role: 'OWNER',
        tonWalletAddress: 'EQOwnerWallet',
      },
    });
    ownerId = owner.id;
    ownerTgId = owner.telegramId;

    const adv = await prisma.user.create({
      data: {
        telegramId: 200002n,
        username: 'svc_advertiser',
        firstName: 'Advertiser',
        role: 'ADVERTISER',
        tonWalletAddress: 'EQAdvertiserWallet',
      },
    });
    advertiserId = adv.id;
    advertiserTgId = adv.telegramId;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ==================== Channel Service ====================
  describe('channel.service', () => {
    it('createChannel creates a new channel', async () => {
      const channel = await createChannel({
        telegramChatId: -100300001n,
        ownerId,
        title: 'Service Test Channel',
        username: 'svctestchan',
        subscribers: 8000,
        language: 'en',
        category: 'crypto',
      });
      channelId = channel.id;
      expect(channel.title).toBe('Service Test Channel');
      expect(channel.ownerId).toBe(ownerId);
    });

    it('createChannel rejects duplicate telegramChatId', async () => {
      await expect(
        createChannel({
          telegramChatId: -100300001n,
          ownerId,
          title: 'Duplicate',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('getChannel returns channel with relations', async () => {
      const channel = await getChannel(channelId);
      expect(channel.title).toBe('Service Test Channel');
      expect(channel.owner).toBeDefined();
      expect(channel.owner.username).toBe('svc_owner');
    });

    it('getChannel throws NotFoundError for non-existent ID', async () => {
      await expect(getChannel(999999)).rejects.toThrow(NotFoundError);
    });

    it('updateChannel works for owner', async () => {
      const updated = await updateChannel(channelId, ownerId, {
        description: 'Updated description',
        category: 'tech',
      });
      expect(updated.description).toBe('Updated description');
      expect(updated.category).toBe('tech');
    });

    it('updateChannel throws ForbiddenError for non-owner', async () => {
      await expect(
        updateChannel(channelId, advertiserId, { description: 'Hack' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('listChannels returns verified channels', async () => {
      // Mark as verified first
      await prisma.channel.update({ where: { id: channelId }, data: { isVerified: true } });

      const result = await listChannels({}, 1, 20);
      expect(result.channels.length).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.page).toBe(1);
    });

    it('listChannels filters by language', async () => {
      const result = await listChannels({ language: 'en' });
      for (const ch of result.channels) {
        expect(ch.language).toBe('en');
      }
    });

    it('listChannels filters by subscriber range', async () => {
      const result = await listChannels({ minSubscribers: 5000, maxSubscribers: 10000 });
      for (const ch of result.channels) {
        expect(ch.subscribers).toBeGreaterThanOrEqual(5000);
        expect(ch.subscribers).toBeLessThanOrEqual(10000);
      }
    });

    it('getChannelsByOwner returns owner channels', async () => {
      const channels = await getChannelsByOwner(ownerId);
      expect(channels.length).toBeGreaterThanOrEqual(1);
      expect(channels[0].ownerId).toBe(ownerId);
    });

    it('addAdFormat adds a format', async () => {
      const format = await addAdFormat(channelId, ownerId, {
        formatType: 'POST',
        label: '1/24 Post',
        priceTon: 40,
      });
      formatId = format.id;
      expect(Number(format.priceTon)).toBe(40);
    });

    it('addAdFormat throws for non-owner', async () => {
      await expect(
        addAdFormat(channelId, advertiserId, {
          formatType: 'STORY',
          label: 'Story',
          priceTon: 20,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('addChannelAdmin works', async () => {
      const admin = await addChannelAdmin(channelId, ownerId, {
        userId: advertiserId,
        canManageDeals: true,
      });
      expect(admin.canManageDeals).toBe(true);
    });

    it('addChannelAdmin throws for non-owner', async () => {
      await expect(
        addChannelAdmin(channelId, advertiserId, { userId: ownerId }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ==================== Campaign Service ====================
  describe('campaign.service', () => {
    it('createCampaign creates a campaign', async () => {
      const campaign = await createCampaign({
        advertiserId,
        title: 'Test Campaign',
        brief: 'Promote our product',
        budgetTon: 200,
        targetLanguage: 'en',
      });
      campaignId = campaign.id;
      expect(campaign.status).toBe('ACTIVE');
    });

    it('getCampaign returns with relations', async () => {
      const campaign = await getCampaign(campaignId);
      expect(campaign.advertiser.username).toBe('svc_advertiser');
    });

    it('getCampaign throws NotFoundError', async () => {
      await expect(getCampaign(999999)).rejects.toThrow(NotFoundError);
    });

    it('listCampaigns returns active campaigns', async () => {
      const result = await listCampaigns({});
      expect(result.campaigns.length).toBeGreaterThanOrEqual(1);
    });

    it('updateCampaign works for owner', async () => {
      const updated = await updateCampaign(campaignId, advertiserId, {
        title: 'Updated Campaign',
      });
      expect(updated.title).toBe('Updated Campaign');
    });

    it('updateCampaign throws for non-owner', async () => {
      await expect(
        updateCampaign(campaignId, ownerId, { title: 'Hack' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('applyToCampaign works', async () => {
      const app = await applyToCampaign({
        campaignId,
        channelId,
        proposedPriceTon: 35,
        message: 'Great fit',
        userId: ownerId,
      });
      expect(Number(app.proposedPriceTon)).toBe(35);
      expect(app.status).toBe('PENDING');
    });

    it('applyToCampaign rejects duplicate', async () => {
      await expect(
        applyToCampaign({
          campaignId,
          channelId,
          proposedPriceTon: 40,
          userId: ownerId,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('applyToCampaign rejects non-channel-owner', async () => {
      await expect(
        applyToCampaign({
          campaignId,
          channelId,
          proposedPriceTon: 30,
          userId: advertiserId,
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ==================== Deal Service ====================
  describe('deal.service', () => {
    let dealId: number;

    it('createDeal creates a deal with aliases', async () => {
      const deal = await createDeal({
        channelId,
        advertiserId,
        adFormatId: formatId,
        amountTon: 40,
      });
      dealId = deal.id;
      expect(deal.status).toBe('PENDING_PAYMENT');
      expect(deal.ownerAlias).toMatch(/^Seller-[0-9a-f]{4}$/);
      expect(deal.advertiserAlias).toMatch(/^Buyer-[0-9a-f]{4}$/);
      expect(deal.timeoutAt).not.toBeNull();
    });

    it('getDeal returns full deal with relations', async () => {
      const deal = await getDeal(dealId);
      expect(deal.channel).toBeDefined();
      expect(deal.advertiser).toBeDefined();
      expect(deal.adFormat).toBeDefined();
      expect(deal.events.length).toBeGreaterThanOrEqual(1);
    });

    it('getDeal masks identity for advertiser', async () => {
      const deal = await getDeal(dealId, advertiserId);
      expect((deal as any).advertiserLabel).toBe('You');
      expect((deal as any).ownerLabel).toBe(deal.ownerAlias);
    });

    it('getDeal masks identity for owner', async () => {
      const deal = await getDeal(dealId, ownerId);
      expect((deal as any).ownerLabel).toBe('You');
      expect((deal as any).advertiserLabel).toBe(deal.advertiserAlias);
    });

    it('getDeal throws NotFoundError', async () => {
      await expect(getDeal(999999)).rejects.toThrow(NotFoundError);
    });

    it('transitionDeal moves to FUNDED', async () => {
      const deal = await transitionDeal(dealId, 'FUNDED');
      expect(deal.status).toBe('FUNDED');
    });

    it('transitionDeal rejects invalid transition', async () => {
      await expect(transitionDeal(dealId, 'COMPLETED')).rejects.toThrow(AppError);
    });

    it('transitionDeal moves through creative flow', async () => {
      await transitionDeal(dealId, 'CREATIVE_PENDING');
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('CREATIVE_PENDING');
    });

    it('getUserDeals returns deals for advertiser', async () => {
      const deals = await getUserDeals(advertiserId, 'advertiser');
      expect(deals.length).toBeGreaterThanOrEqual(1);
    });

    it('getUserDeals returns deals for owner', async () => {
      const deals = await getUserDeals(ownerId, 'owner');
      expect(deals.length).toBeGreaterThanOrEqual(1);
    });

    it('getUserDeals returns all roles when no filter', async () => {
      const deals = await getUserDeals(advertiserId);
      expect(deals.length).toBeGreaterThanOrEqual(1);
    });

    // Creative flow
    it('submitCreative works for channel owner', async () => {
      const creative = await submitCreative(dealId, ownerId, {
        contentText: 'Amazing product!',
        mediaUrl: 'https://example.com/ad.png',
        mediaType: 'photo',
      });
      expect(creative.version).toBe(1);
      // Returned decrypted
      expect(creative.contentText).toBe('Amazing product!');
    });

    it('submitCreative throws for non-owner', async () => {
      // Deal is now CREATIVE_SUBMITTED, revert to test
      await expect(
        submitCreative(dealId, advertiserId, { contentText: 'Hack' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('requestRevision works for advertiser', async () => {
      const creative = await requestRevision(dealId, advertiserId, 'Change the CTA');
      expect(creative).toBeDefined();
    });

    it('submitCreative resubmits after revision', async () => {
      const creative = await submitCreative(dealId, ownerId, {
        contentText: 'Revised amazing product!',
      });
      expect(creative.version).toBe(2);
      expect(creative.contentText).toBe('Revised amazing product!');
    });

    it('approveCreative works for advertiser', async () => {
      const creative = await approveCreative(dealId, advertiserId);
      expect(creative).toBeDefined();
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('CREATIVE_APPROVED');
    });

    it('getCreatives returns all versions decrypted', async () => {
      const creatives = await getCreatives(dealId);
      expect(creatives).toHaveLength(2);
      // Latest first (desc by version)
      expect(creatives[0].version).toBe(2);
      expect(creatives[0].contentText).toBe('Revised amazing product!');
      expect(creatives[1].version).toBe(1);
      expect(creatives[1].contentText).toBe('Amazing product!');
    });

    // Cancel/dispute
    it('cancelDeal throws for non-party', async () => {
      // Create a third user who isn't part of the deal
      const outsider = await prisma.user.create({
        data: { telegramId: 200003n, firstName: 'Outsider' },
      });
      // Create a new deal for cancel testing
      const cancelDeal2 = await createDeal({
        channelId,
        advertiserId,
        adFormatId: formatId,
        amountTon: 10,
      });
      await expect(cancelDeal(cancelDeal2.id, outsider.id)).rejects.toThrow(ForbiddenError);
    });

    it('cancelDeal works for advertiser', async () => {
      const cancelableDeal = await createDeal({
        channelId,
        advertiserId,
        adFormatId: formatId,
        amountTon: 15,
      });
      const result = await cancelDeal(cancelableDeal.id, advertiserId);
      expect(result.status).toBe('CANCELLED');
    });

    it('disputeDeal works for owner', async () => {
      const d = await createDeal({
        channelId,
        advertiserId,
        adFormatId: formatId,
        amountTon: 25,
      });
      await transitionDeal(d.id, 'FUNDED');
      const result = await disputeDeal(d.id, ownerId, 'Advertiser not responsive');
      expect(result.status).toBe('DISPUTED');
    });
  });
});
