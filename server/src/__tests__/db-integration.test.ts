import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, DealStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Clean slate before tests
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

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ==================== User CRUD ====================
  describe('User model', () => {
    it('creates a user with telegramId', async () => {
      const user = await prisma.user.create({
        data: {
          telegramId: 100001n,
          username: 'owner1',
          firstName: 'Channel',
          role: 'OWNER',
        },
      });
      expect(user.id).toBeGreaterThan(0);
      expect(user.telegramId).toBe(100001n);
      expect(user.role).toBe('OWNER');
    });

    it('creates a second user (advertiser)', async () => {
      const user = await prisma.user.create({
        data: {
          telegramId: 100002n,
          username: 'adv1',
          firstName: 'Advertiser',
          role: 'ADVERTISER',
          tonWalletAddress: 'EQAdvertiserWalletAddress',
        },
      });
      expect(user.role).toBe('ADVERTISER');
      expect(user.tonWalletAddress).toBe('EQAdvertiserWalletAddress');
    });

    it('rejects duplicate telegramId', async () => {
      await expect(
        prisma.user.create({
          data: { telegramId: 100001n, firstName: 'Duplicate' },
        }),
      ).rejects.toThrow();
    });

    it('upserts user (update on conflict)', async () => {
      const user = await prisma.user.upsert({
        where: { telegramId: 100001n },
        update: { firstName: 'Updated' },
        create: { telegramId: 100001n, firstName: 'New' },
      });
      expect(user.firstName).toBe('Updated');
    });

    it('finds user by telegramId', async () => {
      const user = await prisma.user.findUnique({
        where: { telegramId: 100001n },
      });
      expect(user).not.toBeNull();
      expect(user!.username).toBe('owner1');
    });
  });

  // ==================== Channel CRUD ====================
  describe('Channel model', () => {
    it('creates a channel', async () => {
      const owner = await prisma.user.findUnique({ where: { telegramId: 100001n } });
      const channel = await prisma.channel.create({
        data: {
          telegramChatId: -1001234567890n,
          ownerId: owner!.id,
          title: 'Test Channel',
          username: 'testchannel',
          subscribers: 5000,
          avgViews: 1000,
          language: 'en',
          category: 'tech',
          isVerified: true,
        },
      });
      expect(channel.id).toBeGreaterThan(0);
      expect(channel.telegramChatId).toBe(-1001234567890n);
      expect(channel.subscribers).toBe(5000);
    });

    it('rejects duplicate telegramChatId', async () => {
      const owner = await prisma.user.findUnique({ where: { telegramId: 100001n } });
      await expect(
        prisma.channel.create({
          data: {
            telegramChatId: -1001234567890n,
            ownerId: owner!.id,
            title: 'Duplicate Channel',
          },
        }),
      ).rejects.toThrow();
    });

    it('creates a second channel for the same owner', async () => {
      const owner = await prisma.user.findUnique({ where: { telegramId: 100001n } });
      const channel = await prisma.channel.create({
        data: {
          telegramChatId: -1009999999999n,
          ownerId: owner!.id,
          title: 'Second Channel',
          subscribers: 10000,
          isVerified: true,
        },
      });
      expect(channel.title).toBe('Second Channel');
    });

    it('finds channels by owner', async () => {
      const owner = await prisma.user.findUnique({ where: { telegramId: 100001n } });
      const channels = await prisma.channel.findMany({
        where: { ownerId: owner!.id },
      });
      expect(channels).toHaveLength(2);
    });

    it('updates channel stats', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const updated = await prisma.channel.update({
        where: { id: channel!.id },
        data: { subscribers: 6000, statsUpdatedAt: new Date() },
      });
      expect(updated.subscribers).toBe(6000);
    });
  });

  // ==================== Ad Format ====================
  describe('AdFormat model', () => {
    it('creates ad formats for a channel', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const format = await prisma.adFormat.create({
        data: {
          channelId: channel!.id,
          formatType: 'POST',
          label: '1/24 Post',
          priceTon: 50,
        },
      });
      expect(format.formatType).toBe('POST');
      expect(format.priceTon).toBe(50);
      expect(format.isActive).toBe(true);
    });

    it('creates multiple format types', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      await prisma.adFormat.create({
        data: {
          channelId: channel!.id,
          formatType: 'STORY',
          label: 'Story Ad',
          priceTon: 25,
        },
      });
      const formats = await prisma.adFormat.findMany({
        where: { channelId: channel!.id },
      });
      expect(formats).toHaveLength(2);
    });
  });

  // ==================== Campaign ====================
  describe('Campaign model', () => {
    it('creates a campaign', async () => {
      const advertiser = await prisma.user.findUnique({ where: { telegramId: 100002n } });
      const campaign = await prisma.campaign.create({
        data: {
          advertiserId: advertiser!.id,
          title: 'DeFi Promo',
          brief: 'Promote our DeFi app',
          budgetTon: 500,
          targetLanguage: 'en',
          targetCategory: 'tech',
        },
      });
      expect(campaign.status).toBe('ACTIVE');
      expect(campaign.budgetTon).toBe(500);
    });

    it('lists active campaigns', async () => {
      const campaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
      });
      expect(campaigns).toHaveLength(1);
    });

    it('updates campaign status', async () => {
      const campaign = await prisma.campaign.findFirst();
      const updated = await prisma.campaign.update({
        where: { id: campaign!.id },
        data: { status: 'PAUSED' },
      });
      expect(updated.status).toBe('PAUSED');
      // Restore
      await prisma.campaign.update({
        where: { id: campaign!.id },
        data: { status: 'ACTIVE' },
      });
    });
  });

  // ==================== Campaign Application ====================
  describe('CampaignApplication model', () => {
    it('creates an application', async () => {
      const campaign = await prisma.campaign.findFirst();
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const app = await prisma.campaignApplication.create({
        data: {
          campaignId: campaign!.id,
          channelId: channel!.id,
          proposedPriceTon: 40,
          message: 'Great fit for our channel',
        },
      });
      expect(app.status).toBe('PENDING');
      expect(app.proposedPriceTon).toBe(40);
    });

    it('rejects duplicate application (unique constraint)', async () => {
      const campaign = await prisma.campaign.findFirst();
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      await expect(
        prisma.campaignApplication.create({
          data: {
            campaignId: campaign!.id,
            channelId: channel!.id,
            proposedPriceTon: 50,
          },
        }),
      ).rejects.toThrow();
    });
  });

  // ==================== Deal lifecycle ====================
  describe('Deal lifecycle (full flow)', () => {
    let dealId: number;

    it('creates a deal in PENDING_PAYMENT', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const advertiser = await prisma.user.findUnique({ where: { telegramId: 100002n } });
      const format = await prisma.adFormat.findFirst({ where: { channelId: channel!.id } });

      const deal = await prisma.deal.create({
        data: {
          channelId: channel!.id,
          advertiserId: advertiser!.id,
          adFormatId: format!.id,
          amountTon: 50,
          status: 'PENDING_PAYMENT',
          ownerAlias: 'Seller-ab12',
          advertiserAlias: 'Buyer-cd34',
          escrowAddress: 'EQTestEscrowAddress',
          timeoutAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      dealId = deal.id;
      expect(deal.status).toBe('PENDING_PAYMENT');
      expect(deal.ownerAlias).toBe('Seller-ab12');
    });

    it('transitions deal to FUNDED', async () => {
      const deal = await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'FUNDED' },
      });
      expect(deal.status).toBe('FUNDED');
    });

    it('creates a deal event for audit trail', async () => {
      const event = await prisma.dealEvent.create({
        data: {
          dealId,
          eventType: 'STATUS_FUNDED',
          oldStatus: 'PENDING_PAYMENT',
          newStatus: 'FUNDED',
        },
      });
      expect(event.eventType).toBe('STATUS_FUNDED');
    });

    it('records a deposit transaction', async () => {
      const tx = await prisma.transaction.create({
        data: {
          dealId,
          type: 'DEPOSIT',
          amountTon: 50,
          toAddress: 'EQTestEscrowAddress',
          txHash: 'test_tx_hash_001',
          confirmedAt: new Date(),
        },
      });
      expect(tx.type).toBe('DEPOSIT');
      expect(tx.amountTon).toBe(50);
    });

    it('transitions to CREATIVE_PENDING', async () => {
      await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'CREATIVE_PENDING' },
      });
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('CREATIVE_PENDING');
    });

    it('submits a creative with encrypted content', async () => {
      const owner = await prisma.user.findUnique({ where: { telegramId: 100001n } });
      const { encryptField } = await import('../utils/privacy.js');

      const creative = await prisma.creative.create({
        data: {
          dealId,
          contentText: encryptField('Buy our amazing product!'),
          mediaUrl: encryptField('https://example.com/ad.jpg'),
          mediaType: 'photo',
          version: 1,
          submittedById: owner!.id,
          status: 'SUBMITTED',
        },
      });
      expect(creative.version).toBe(1);
      expect(creative.status).toBe('SUBMITTED');
      // Encrypted content should not be plaintext
      expect(creative.contentText).not.toBe('Buy our amazing product!');
      expect(creative.contentText).toContain(':'); // iv:tag:ciphertext format
    });

    it('decrypts creative content correctly', async () => {
      const { decryptField } = await import('../utils/privacy.js');
      const creative = await prisma.creative.findFirst({ where: { dealId } });

      const plaintext = decryptField(creative!.contentText!);
      expect(plaintext).toBe('Buy our amazing product!');

      const mediaUrl = decryptField(creative!.mediaUrl!);
      expect(mediaUrl).toBe('https://example.com/ad.jpg');
    });

    it('transitions through creative approval', async () => {
      await prisma.deal.update({ where: { id: dealId }, data: { status: 'CREATIVE_SUBMITTED' } });
      await prisma.deal.update({ where: { id: dealId }, data: { status: 'CREATIVE_APPROVED' } });
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('CREATIVE_APPROVED');
    });

    it('schedules the post', async () => {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'SCHEDULED',
          scheduledPostAt: scheduledAt,
        },
      });
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('SCHEDULED');
      expect(deal!.scheduledPostAt).not.toBeNull();
    });

    it('marks as posted', async () => {
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'POSTED',
          postedMessageId: 12345,
        },
      });
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('POSTED');
      expect(deal!.postedMessageId).toBe(12345);
    });

    it('verifies and completes the deal', async () => {
      await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'VERIFIED' },
      });
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('COMPLETED');
      expect(deal!.completedAt).not.toBeNull();
    });

    it('records a release transaction', async () => {
      const tx = await prisma.transaction.create({
        data: {
          dealId,
          type: 'RELEASE',
          amountTon: 47.5, // 50 - 5% fee
          fromAddress: 'EQMasterWalletAddress',
          toAddress: 'EQOwnerWalletAddress',
          txHash: 'test_tx_release_001',
          confirmedAt: new Date(),
        },
      });
      expect(tx.type).toBe('RELEASE');
      expect(tx.amountTon).toBe(47.5);
    });

    it('full deal has all related records', async () => {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          creatives: true,
          transactions: true,
          events: true,
          channel: true,
          advertiser: true,
        },
      });
      expect(deal!.creatives).toHaveLength(1);
      expect(deal!.transactions).toHaveLength(2); // deposit + release
      expect(deal!.events).toHaveLength(1);
      expect(deal!.channel.title).toBe('Test Channel');
    });
  });

  // ==================== Deal receipt & purge ====================
  describe('DealReceipt and purge flow', () => {
    it('creates a deal receipt with hash', async () => {
      const deal = await prisma.deal.findFirst({ where: { status: 'COMPLETED' } });
      const { hashDealData } = await import('../utils/privacy.js');

      const dataHash = hashDealData({
        dealId: deal!.id,
        channelId: deal!.channelId,
        advertiserId: deal!.advertiserId,
        amountTon: deal!.amountTon,
        finalStatus: deal!.status,
        escrowAddress: deal!.escrowAddress,
        completedAt: (deal!.completedAt || deal!.updatedAt).toISOString(),
      });

      const receipt = await prisma.dealReceipt.create({
        data: {
          dealId: deal!.id,
          channelTitle: 'Test Channel',
          advertiserAlias: deal!.advertiserAlias,
          ownerAlias: deal!.ownerAlias,
          amountTon: deal!.amountTon,
          finalStatus: deal!.status,
          dataHash,
          completedAt: deal!.completedAt || new Date(),
        },
      });
      expect(receipt.dataHash).toMatch(/^[0-9a-f]{64}$/);
      expect(receipt.finalStatus).toBe('COMPLETED');
    });

    it('purges sensitive data (simulating purge worker)', async () => {
      const deal = await prisma.deal.findFirst({ where: { status: 'COMPLETED' } });

      await prisma.$transaction([
        prisma.creative.updateMany({
          where: { dealId: deal!.id },
          data: { contentText: null, mediaUrl: null, reviewerNotes: null },
        }),
        prisma.dealEvent.deleteMany({ where: { dealId: deal!.id } }),
        prisma.transaction.updateMany({
          where: { dealId: deal!.id },
          data: { fromAddress: null, toAddress: null, txHash: null },
        }),
        prisma.deal.update({
          where: { id: deal!.id },
          data: { escrowMnemonicEncrypted: null, escrowAddress: null },
        }),
      ]);

      // Verify purge
      const purgedDeal = await prisma.deal.findUnique({
        where: { id: deal!.id },
        include: { creatives: true, events: true, transactions: true },
      });
      expect(purgedDeal!.escrowAddress).toBeNull();
      expect(purgedDeal!.escrowMnemonicEncrypted).toBeNull();
      expect(purgedDeal!.creatives[0].contentText).toBeNull();
      expect(purgedDeal!.creatives[0].mediaUrl).toBeNull();
      expect(purgedDeal!.events).toHaveLength(0);
      expect(purgedDeal!.transactions[0].txHash).toBeNull();

      // But receipt still exists
      const receipt = await prisma.dealReceipt.findUnique({
        where: { dealId: deal!.id },
      });
      expect(receipt).not.toBeNull();
      expect(receipt!.dataHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ==================== Dispute flow ====================
  describe('Dispute deal flow', () => {
    let disputeDealId: number;

    it('creates and funds a deal for dispute testing', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const advertiser = await prisma.user.findUnique({ where: { telegramId: 100002n } });
      const format = await prisma.adFormat.findFirst({ where: { channelId: channel!.id } });

      const deal = await prisma.deal.create({
        data: {
          channelId: channel!.id,
          advertiserId: advertiser!.id,
          adFormatId: format!.id,
          amountTon: 30,
          status: 'FUNDED',
          ownerAlias: 'Seller-ef56',
          advertiserAlias: 'Buyer-gh78',
          timeoutAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
      disputeDealId = deal.id;
    });

    it('transitions to DISPUTED', async () => {
      const deal = await prisma.deal.update({
        where: { id: disputeDealId },
        data: { status: 'DISPUTED' },
      });
      expect(deal.status).toBe('DISPUTED');
    });

    it('resolves dispute with REFUNDED', async () => {
      const deal = await prisma.deal.update({
        where: { id: disputeDealId },
        data: { status: 'REFUNDED', completedAt: new Date() },
      });
      expect(deal.status).toBe('REFUNDED');
      expect(deal.completedAt).not.toBeNull();
    });

    it('records refund transaction', async () => {
      const tx = await prisma.transaction.create({
        data: {
          dealId: disputeDealId,
          type: 'REFUND',
          amountTon: 30,
          fromAddress: 'EQMasterWallet',
          toAddress: 'EQAdvertiserWalletAddress',
          txHash: 'refund_tx_001',
          confirmedAt: new Date(),
        },
      });
      expect(tx.type).toBe('REFUND');
    });
  });

  // ==================== Timeout flow ====================
  describe('Timeout deal flow', () => {
    it('creates a deal and times it out', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const advertiser = await prisma.user.findUnique({ where: { telegramId: 100002n } });
      const format = await prisma.adFormat.findFirst({ where: { channelId: channel!.id } });

      const deal = await prisma.deal.create({
        data: {
          channelId: channel!.id,
          advertiserId: advertiser!.id,
          adFormatId: format!.id,
          amountTon: 20,
          status: 'PENDING_PAYMENT',
          ownerAlias: 'Seller-ij90',
          advertiserAlias: 'Buyer-kl12',
          timeoutAt: new Date(Date.now() - 1000), // already expired
        },
      });

      // Simulate timeout worker finding expired deals
      const timedOutDeals = await prisma.deal.findMany({
        where: {
          timeoutAt: { lte: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'] },
        },
      });
      expect(timedOutDeals.length).toBeGreaterThanOrEqual(1);

      // Transition to TIMED_OUT
      await prisma.deal.update({
        where: { id: deal.id },
        data: { status: 'TIMED_OUT', completedAt: new Date() },
      });
      const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect(updated!.status).toBe('TIMED_OUT');
    });
  });

  // ==================== Channel Admin ====================
  describe('ChannelAdmin model', () => {
    it('adds an admin to a channel', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const advertiser = await prisma.user.findUnique({ where: { telegramId: 100002n } });

      const admin = await prisma.channelAdmin.create({
        data: {
          channelId: channel!.id,
          userId: advertiser!.id,
          canManageDeals: true,
          canManagePricing: false,
        },
      });
      expect(admin.canManageDeals).toBe(true);
      expect(admin.canManagePricing).toBe(false);
    });

    it('lists admins with user info', async () => {
      const channel = await prisma.channel.findFirst({
        where: { telegramChatId: -1001234567890n },
      });
      const admins = await prisma.channelAdmin.findMany({
        where: { channelId: channel!.id },
        include: { user: true },
      });
      expect(admins).toHaveLength(1);
      expect(admins[0].user.username).toBe('adv1');
    });
  });

  // ==================== Query edge cases ====================
  describe('query edge cases', () => {
    it('filters channels by subscriber range', async () => {
      const channels = await prisma.channel.findMany({
        where: {
          subscribers: { gte: 4000, lte: 7000 },
          isVerified: true,
        },
      });
      expect(channels.length).toBeGreaterThanOrEqual(1);
      for (const ch of channels) {
        expect(ch.subscribers).toBeGreaterThanOrEqual(4000);
        expect(ch.subscribers).toBeLessThanOrEqual(7000);
      }
    });

    it('pagination works correctly', async () => {
      const page1 = await prisma.channel.findMany({
        where: { isVerified: true },
        take: 1,
        skip: 0,
        orderBy: { subscribers: 'desc' },
      });
      const page2 = await prisma.channel.findMany({
        where: { isVerified: true },
        take: 1,
        skip: 1,
        orderBy: { subscribers: 'desc' },
      });
      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0].id);
      // Descending: page1 has more subscribers
      expect(page1[0].subscribers!).toBeGreaterThanOrEqual(page2[0].subscribers!);
    });

    it('counts deals by status', async () => {
      const counts = await prisma.deal.groupBy({
        by: ['status'],
        _count: true,
      });
      expect(counts.length).toBeGreaterThan(0);
      const statuses = counts.map((c) => c.status);
      expect(statuses).toContain('COMPLETED');
    });

    it('finds deals with related data', async () => {
      const deals = await prisma.deal.findMany({
        include: {
          channel: { select: { title: true } },
          advertiser: { select: { username: true } },
          adFormat: { select: { formatType: true, label: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(deals.length).toBeGreaterThan(0);
      expect(deals[0].channel.title).toBeDefined();
      expect(deals[0].adFormat.formatType).toBeDefined();
    });
  });

  // ==================== Aggregate queries ====================
  describe('aggregate queries (stats)', () => {
    it('counts total channels', async () => {
      const count = await prisma.channel.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('counts total deals', async () => {
      const count = await prisma.deal.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('sums completed deal amounts', async () => {
      const result = await prisma.deal.aggregate({
        _sum: { amountTon: true },
        where: { status: 'COMPLETED' },
      });
      expect(result._sum.amountTon).toBeGreaterThanOrEqual(50);
    });

    it('counts completed deals', async () => {
      const count = await prisma.deal.count({
        where: { status: 'COMPLETED' },
      });
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
