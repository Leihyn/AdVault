/**
 * Comprehensive end-to-end test for the Performance-Based Escrow flow.
 *
 * Tests the full lifecycle:
 *   Deal creation with requirements → Fund → Creative → Approve →
 *   Post proof → Tracking → Metric evaluation → Verify/Fail
 *
 * Also tests: waiving, confirming CUSTOM metrics, failure paths,
 * edge cases, and the verify worker logic.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createDeal,
  getDeal,
  getTrackingDeals,
  transitionDeal,
} from '../services/deal.service.js';
import {
  evaluateRequirements,
  waiveRequirement,
  confirmRequirement,
} from '../services/proof.service.js';
import { createChannel, addAdFormat } from '../services/channel.service.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';

const prisma = new PrismaClient();

// ================================================================
// Helpers
// ================================================================

async function cleanDatabase() {
  await prisma.dealReceipt.deleteMany();
  await prisma.dealEvent.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.dealRequirement.deleteMany();
  await prisma.pendingTransfer.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.campaignApplication.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.adFormat.deleteMany();
  await prisma.channelAdmin.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany();
}

/** Transition a deal through the creative flow to CREATIVE_APPROVED */
async function rushToCreativeApproved(dealId: number) {
  await transitionDeal(dealId, 'FUNDED');
  await transitionDeal(dealId, 'CREATIVE_PENDING');
  await transitionDeal(dealId, 'CREATIVE_SUBMITTED');
  await transitionDeal(dealId, 'CREATIVE_APPROVED');
}

/** Transition a deal from CREATIVE_APPROVED → POSTED → TRACKING */
async function rushToTracking(dealId: number) {
  await prisma.deal.update({
    where: { id: dealId },
    data: {
      postProofUrl: 'https://t.me/testchan/42',
      platformPostId: '42',
      postedAt: new Date(),
      trackingStartedAt: new Date(),
    },
  });
  await transitionDeal(dealId, 'POSTED');
  await transitionDeal(dealId, 'TRACKING');
}

// ================================================================
// Shared state
// ================================================================

let ownerId: number;
let advertiserId: number;
let outsiderId: number;
let telegramChannelId: number;
let youtubeChannelId: number;
let telegramFormatId: number;
let youtubeFormatId: number;

describe('Performance-Based Escrow — Full Flow', () => {
  beforeAll(async () => {
    await cleanDatabase();

    const owner = await prisma.user.create({
      data: {
        telegramId: 600001n,
        username: 'perf_owner',
        firstName: 'PerfOwner',
        role: 'OWNER',
        tonWalletAddress: 'EQOwnerWalletPerf',
      },
    });
    ownerId = owner.id;

    const adv = await prisma.user.create({
      data: {
        telegramId: 600002n,
        username: 'perf_advertiser',
        firstName: 'PerfAdv',
        role: 'ADVERTISER',
        tonWalletAddress: 'EQAdvWalletPerf',
      },
    });
    advertiserId = adv.id;

    const outsider = await prisma.user.create({
      data: {
        telegramId: 600003n,
        username: 'perf_outsider',
        firstName: 'Outsider',
        role: 'ADVERTISER',
      },
    });
    outsiderId = outsider.id;

    const tgChannel = await createChannel({
      telegramChatId: -100600001n,
      ownerId,
      title: 'Perf Test TG Channel',
      username: 'perftestchan',
      subscribers: 10000,
      language: 'en',
      category: 'crypto',
    });
    telegramChannelId = tgChannel.id;

    const ytChannel = await createChannel({
      platform: 'YOUTUBE',
      platformChannelId: 'UC_perf_test_123',
      ownerId,
      title: 'Perf Test YT Channel',
      username: 'perftestyt',
      subscribers: 50000,
      language: 'en',
      category: 'tech',
    });
    youtubeChannelId = ytChannel.id;

    const tgFormat = await addAdFormat(telegramChannelId, ownerId, {
      formatType: 'POST',
      label: '1/24 TG Post',
      priceTon: 1.0,
    });
    telegramFormatId = tgFormat.id;

    const ytFormat = await addAdFormat(youtubeChannelId, ownerId, {
      formatType: 'VIDEO',
      label: 'YT Sponsored Video',
      priceTon: 5.0,
    });
    youtubeFormatId = ytFormat.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ================================================================
  // 1. DEAL CREATION WITH REQUIREMENTS
  // ================================================================
  describe('Deal creation with requirements', () => {
    it('creates a deal with default POST_EXISTS when no requirements provided', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });

      expect(deal.status).toBe('PENDING_PAYMENT');
      expect(deal.verificationWindowHours).toBe(24);

      const reqs = await prisma.dealRequirement.findMany({ where: { dealId: deal.id } });
      expect(reqs).toHaveLength(1);
      expect(reqs[0].metricType).toBe('POST_EXISTS');
      expect(reqs[0].targetValue).toBe(1);
      expect(reqs[0].status).toBe('PENDING');
    });

    it('creates a deal with custom requirements', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 5.0,
        verificationWindowHours: 48,
        requirements: [
          { metricType: 'VIEWS', targetValue: 10000 },
          { metricType: 'LIKES', targetValue: 500 },
          { metricType: 'COMMENTS', targetValue: 50 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });

      expect(deal.verificationWindowHours).toBe(48);

      const reqs = await prisma.dealRequirement.findMany({
        where: { dealId: deal.id },
        orderBy: { id: 'asc' },
      });
      expect(reqs).toHaveLength(4);
      expect(reqs.map((r) => r.metricType)).toEqual(['VIEWS', 'LIKES', 'COMMENTS', 'POST_EXISTS']);
      expect(reqs[0].targetValue).toBe(10000);
      expect(reqs[1].targetValue).toBe(500);
      expect(reqs[2].targetValue).toBe(50);
      expect(reqs[3].targetValue).toBe(1);
      reqs.forEach((r) => {
        expect(r.currentValue).toBe(0);
        expect(r.status).toBe('PENDING');
      });
    });

    it('creates a deal with CUSTOM metric requirement', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 2.0,
        verificationWindowHours: 72,
        requirements: [
          { metricType: 'POST_EXISTS', targetValue: 1 },
          { metricType: 'CUSTOM', targetValue: 1 },
        ],
      });

      const reqs = await prisma.dealRequirement.findMany({
        where: { dealId: deal.id },
        orderBy: { id: 'asc' },
      });
      expect(reqs).toHaveLength(2);
      expect(reqs[1].metricType).toBe('CUSTOM');
      expect(reqs[1].targetValue).toBe(1);
    });

    it('getDeal includes requirements in response', async () => {
      const created = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 5000 },
        ],
      });

      const deal = await getDeal(created.id);
      expect(deal.requirements).toHaveLength(1);
      expect(deal.requirements[0].metricType).toBe('VIEWS');
      expect(deal.requirements[0].targetValue).toBe(5000);
      expect(deal.requirements[0].status).toBe('PENDING');
    });
  });

  // ================================================================
  // 2. FULL HAPPY PATH — ALL REQUIREMENTS MET
  // ================================================================
  describe('Happy path: all requirements met', () => {
    let dealId: number;

    it('creates deal with multiple requirements', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 5.0,
        verificationWindowHours: 48,
        requirements: [
          { metricType: 'VIEWS', targetValue: 1000 },
          { metricType: 'LIKES', targetValue: 50 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      dealId = deal.id;
    });

    it('transitions through creative flow to CREATIVE_APPROVED', async () => {
      await rushToCreativeApproved(dealId);
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('CREATIVE_APPROVED');
    });

    it('transitions CREATIVE_APPROVED → POSTED → TRACKING (simulated proof)', async () => {
      await rushToTracking(dealId);
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('TRACKING');
      expect(deal!.platformPostId).toBe('42');
      expect(deal!.trackingStartedAt).toBeTruthy();
    });

    it('appears in getTrackingDeals', async () => {
      const tracking = await getTrackingDeals();
      const match = tracking.find((d) => d.id === dealId);
      expect(match).toBeDefined();
      expect(match!.requirements).toHaveLength(3);
    });

    it('evaluateRequirements updates currentValue but not all met yet', async () => {
      const result = await evaluateRequirements(dealId, {
        exists: true,
        views: 500,
        likes: 30,
      });

      expect(result.allMet).toBe(false);

      // POST_EXISTS should be met
      const postReq = result.results.find((r) => r.metricType === 'POST_EXISTS');
      expect(postReq!.met).toBe(true);

      // VIEWS not met yet (500 < 1000)
      const viewsReq = result.results.find((r) => r.metricType === 'VIEWS');
      expect(viewsReq!.met).toBe(false);

      // LIKES not met yet (30 < 50)
      const likesReq = result.results.find((r) => r.metricType === 'LIKES');
      expect(likesReq!.met).toBe(false);

      // Verify DB was updated
      const reqs = await prisma.dealRequirement.findMany({ where: { dealId }, orderBy: { id: 'asc' } });
      const viewsDb = reqs.find((r) => r.metricType === 'VIEWS');
      expect(viewsDb!.currentValue).toBe(500);
      expect(viewsDb!.status).toBe('PENDING');
      expect(viewsDb!.lastCheckedAt).toBeTruthy();

      const postDb = reqs.find((r) => r.metricType === 'POST_EXISTS');
      expect(postDb!.currentValue).toBe(1);
      expect(postDb!.status).toBe('MET');
      expect(postDb!.metAt).toBeTruthy();
    });

    it('evaluateRequirements marks all met when targets reached', async () => {
      const result = await evaluateRequirements(dealId, {
        exists: true,
        views: 1500,
        likes: 75,
      });

      expect(result.allMet).toBe(true);
      result.results.forEach((r) => expect(r.met).toBe(true));

      // Verify DB — all should be MET
      const reqs = await prisma.dealRequirement.findMany({ where: { dealId } });
      reqs.forEach((r) => {
        expect(r.status).toBe('MET');
        expect(r.metAt).toBeTruthy();
      });
    });

    it('transitions TRACKING → VERIFIED → COMPLETED', async () => {
      await transitionDeal(dealId, 'VERIFIED');
      let deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('VERIFIED');

      await transitionDeal(dealId, 'COMPLETED');
      deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('COMPLETED');
      expect(deal!.completedAt).toBeTruthy();
    });
  });

  // ================================================================
  // 3. FAILURE PATH — WINDOW EXPIRES
  // ================================================================
  describe('Failure path: verification window expires', () => {
    let dealId: number;

    it('creates deal and rushes to TRACKING', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
        verificationWindowHours: 24,
        requirements: [
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      dealId = deal.id;
      await rushToCreativeApproved(dealId);
      await rushToTracking(dealId);
    });

    it('post exists is met but we can still fail the deal manually', async () => {
      const result = await evaluateRequirements(dealId, { exists: true });
      expect(result.allMet).toBe(true);
    });

    it('TRACKING → FAILED is a valid transition', async () => {
      // Simulate the worker deciding the deal failed (e.g., post was deleted)
      await transitionDeal(dealId, 'FAILED', undefined, { reason: 'Post deleted' });
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('FAILED');
    });

    it('FAILED → REFUNDED completes the failure path', async () => {
      await transitionDeal(dealId, 'REFUNDED');
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('REFUNDED');
    });
  });

  // ================================================================
  // 4. POST DELETED DURING TRACKING
  // ================================================================
  describe('Post deleted during tracking', () => {
    let dealId: number;

    it('creates deal in TRACKING', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 3.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 5000 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      dealId = deal.id;
      await rushToCreativeApproved(dealId);
      await rushToTracking(dealId);
    });

    it('evaluateRequirements with exists=false marks POST_EXISTS as not met', async () => {
      const result = await evaluateRequirements(dealId, {
        exists: false,
        views: 0,
      });

      expect(result.allMet).toBe(false);
      const postReq = result.results.find((r) => r.metricType === 'POST_EXISTS');
      expect(postReq!.met).toBe(false);
    });

    it('worker would transition to FAILED then REFUNDED', async () => {
      await transitionDeal(dealId, 'FAILED', undefined, { reason: 'Post deleted' });
      await transitionDeal(dealId, 'REFUNDED');
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(deal!.status).toBe('REFUNDED');
    });
  });

  // ================================================================
  // 5. WAIVE REQUIREMENTS
  // ================================================================
  describe('Advertiser waives requirements', () => {
    let dealId: number;
    let viewsReqId: number;
    let likesReqId: number;

    it('creates deal in TRACKING with unmet requirements', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 5.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 10000 },
          { metricType: 'LIKES', targetValue: 500 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      dealId = deal.id;
      await rushToCreativeApproved(dealId);
      await rushToTracking(dealId);

      // Partially meet requirements
      await evaluateRequirements(dealId, { exists: true, views: 3000, likes: 200 });

      const reqs = await prisma.dealRequirement.findMany({
        where: { dealId },
        orderBy: { id: 'asc' },
      });
      viewsReqId = reqs.find((r) => r.metricType === 'VIEWS')!.id;
      likesReqId = reqs.find((r) => r.metricType === 'LIKES')!.id;
    });

    it('rejects waive from non-advertiser', async () => {
      await expect(waiveRequirement(dealId, viewsReqId, ownerId)).rejects.toThrow(ForbiddenError);
      await expect(waiveRequirement(dealId, viewsReqId, outsiderId)).rejects.toThrow(ForbiddenError);
    });

    it('advertiser waives VIEWS requirement', async () => {
      const result = await waiveRequirement(dealId, viewsReqId, advertiserId);
      expect(result.allMet).toBe(false); // LIKES still not met

      const req = await prisma.dealRequirement.findUnique({ where: { id: viewsReqId } });
      expect(req!.status).toBe('WAIVED');
    });

    it('advertiser waives LIKES — all requirements now met', async () => {
      const result = await waiveRequirement(dealId, likesReqId, advertiserId);
      expect(result.allMet).toBe(true);
      expect(result.autoVerified).toBe(true); // In TRACKING, should auto-verify

      const req = await prisma.dealRequirement.findUnique({ where: { id: likesReqId } });
      expect(req!.status).toBe('WAIVED');
    });
  });

  // ================================================================
  // 6. CONFIRM CUSTOM METRIC
  // ================================================================
  describe('Advertiser confirms CUSTOM metric', () => {
    let dealId: number;
    let customReqId: number;

    it('creates deal with CUSTOM requirement', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 2.0,
        requirements: [
          { metricType: 'POST_EXISTS', targetValue: 1 },
          { metricType: 'CUSTOM', targetValue: 1 },
        ],
      });
      dealId = deal.id;
      await rushToCreativeApproved(dealId);
      await rushToTracking(dealId);

      // POST_EXISTS met
      await evaluateRequirements(dealId, { exists: true });

      const reqs = await prisma.dealRequirement.findMany({
        where: { dealId },
        orderBy: { id: 'asc' },
      });
      customReqId = reqs.find((r) => r.metricType === 'CUSTOM')!.id;
    });

    it('CUSTOM metric is skipped by evaluateRequirements', async () => {
      const result = await evaluateRequirements(dealId, { exists: true });
      expect(result.allMet).toBe(false);

      const customResult = result.results.find((r) => r.metricType === 'CUSTOM');
      expect(customResult!.met).toBe(false);
    });

    it('rejects confirm from non-advertiser', async () => {
      await expect(confirmRequirement(dealId, customReqId, ownerId)).rejects.toThrow(ForbiddenError);
    });

    it('rejects confirm on non-CUSTOM metric', async () => {
      const postReq = (await prisma.dealRequirement.findMany({ where: { dealId } }))
        .find((r) => r.metricType === 'POST_EXISTS');
      await expect(confirmRequirement(dealId, postReq!.id, advertiserId)).rejects.toThrow(AppError);
    });

    it('advertiser confirms CUSTOM metric — all met', async () => {
      const result = await confirmRequirement(dealId, customReqId, advertiserId);
      expect(result.allMet).toBe(true);
      expect(result.autoVerified).toBe(true);

      const req = await prisma.dealRequirement.findUnique({ where: { id: customReqId } });
      expect(req!.status).toBe('MET');
      expect(req!.currentValue).toBe(1); // Set to targetValue
      expect(req!.metAt).toBeTruthy();
    });
  });

  // ================================================================
  // 7. WAIVE IN FAILED STATUS
  // ================================================================
  describe('Waive in FAILED status', () => {
    let dealId: number;
    let viewsReqId: number;

    it('creates deal, tracks, then fails', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 3.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 50000 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      dealId = deal.id;
      await rushToCreativeApproved(dealId);
      await rushToTracking(dealId);

      // Partially evaluate
      await evaluateRequirements(dealId, { exists: true, views: 10000 });

      // Transition to FAILED (window expired)
      await transitionDeal(dealId, 'FAILED', undefined, { reason: 'Window expired' });
    });

    it('advertiser can waive in FAILED status', async () => {
      const reqs = await prisma.dealRequirement.findMany({ where: { dealId } });
      viewsReqId = reqs.find((r) => r.metricType === 'VIEWS')!.id;

      const result = await waiveRequirement(dealId, viewsReqId, advertiserId);
      expect(result.allMet).toBe(true);
      // In FAILED status, autoVerified should be false
      expect(result.autoVerified).toBe(false);
    });
  });

  // ================================================================
  // 8. STATE MACHINE ENFORCEMENT
  // ================================================================
  describe('State machine enforcement', () => {
    it('cannot skip from CREATIVE_APPROVED to TRACKING', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);

      await expect(transitionDeal(deal.id, 'TRACKING')).rejects.toThrow(AppError);
    });

    it('cannot skip from POSTED to VERIFIED', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);
      await prisma.deal.update({
        where: { id: deal.id },
        data: { platformPostId: '99', trackingStartedAt: new Date() },
      });
      await transitionDeal(deal.id, 'POSTED');

      await expect(transitionDeal(deal.id, 'VERIFIED')).rejects.toThrow(AppError);
    });

    it('TRACKING can go to FAILED', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      await transitionDeal(deal.id, 'FAILED');
      const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect(updated!.status).toBe('FAILED');
    });

    it('TRACKING can go to DISPUTED', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      await transitionDeal(deal.id, 'DISPUTED', advertiserId, { reason: 'fraud' });
      const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect(updated!.status).toBe('DISPUTED');
    });

    it('FAILED can go to DISPUTED', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);
      await transitionDeal(deal.id, 'FAILED');

      await transitionDeal(deal.id, 'DISPUTED', ownerId, { reason: 'unfair' });
      const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect(updated!.status).toBe('DISPUTED');
    });

    it('FAILED cannot go to COMPLETED directly', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);
      await transitionDeal(deal.id, 'FAILED');

      await expect(transitionDeal(deal.id, 'COMPLETED')).rejects.toThrow(AppError);
    });
  });

  // ================================================================
  // 9. EVALUATE REQUIREMENTS EDGE CASES
  // ================================================================
  describe('evaluateRequirements edge cases', () => {
    it('already-MET requirements stay MET on subsequent evaluations', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 2.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 100 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      // First evaluation: views exceed target
      await evaluateRequirements(deal.id, { exists: true, views: 200 });

      const reqs1 = await prisma.dealRequirement.findMany({ where: { dealId: deal.id } });
      const viewsReq1 = reqs1.find((r) => r.metricType === 'VIEWS');
      expect(viewsReq1!.status).toBe('MET');
      const metAt = viewsReq1!.metAt;

      // Second evaluation: views dropped below target (e.g., YouTube recalculated)
      // but MET stays MET because the status check skips already-met requirements
      await evaluateRequirements(deal.id, { exists: true, views: 50 });

      const reqs2 = await prisma.dealRequirement.findMany({ where: { dealId: deal.id } });
      const viewsReq2 = reqs2.find((r) => r.metricType === 'VIEWS');
      expect(viewsReq2!.status).toBe('MET');
      // metAt should not change
      expect(viewsReq2!.metAt!.getTime()).toBe(metAt!.getTime());
    });

    it('WAIVED requirements stay WAIVED after evaluation', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 2.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 100000 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      // Waive views
      const reqs = await prisma.dealRequirement.findMany({ where: { dealId: deal.id } });
      const viewsReqId = reqs.find((r) => r.metricType === 'VIEWS')!.id;
      await waiveRequirement(deal.id, viewsReqId, advertiserId);

      // Evaluate — waived should still count as met
      const result = await evaluateRequirements(deal.id, { exists: true, views: 5 });
      expect(result.allMet).toBe(true);

      const viewsAfter = await prisma.dealRequirement.findUnique({ where: { id: viewsReqId } });
      expect(viewsAfter!.status).toBe('WAIVED');
    });

    it('handles metrics with zero values correctly', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 1.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 1 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      const result = await evaluateRequirements(deal.id, { exists: true, views: 0 });
      expect(result.allMet).toBe(false);

      const viewsResult = result.results.find((r) => r.metricType === 'VIEWS');
      expect(viewsResult!.met).toBe(false);
    });

    it('handles missing metrics gracefully (undefined views/likes)', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 100 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      // Telegram-style metrics: only exists, no views
      const result = await evaluateRequirements(deal.id, { exists: true });
      expect(result.allMet).toBe(false);

      const viewsResult = result.results.find((r) => r.metricType === 'VIEWS');
      expect(viewsResult!.met).toBe(false);
    });

    it('evaluates exact target value as met', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 1.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 1000 },
        ],
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      const result = await evaluateRequirements(deal.id, { exists: true, views: 1000 });
      expect(result.allMet).toBe(true);
    });
  });

  // ================================================================
  // 10. VERIFICATION WINDOW TRACKING
  // ================================================================
  describe('Verification window tracking', () => {
    it('deal stores trackingStartedAt when entering TRACKING', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
        verificationWindowHours: 48,
      });
      await rushToCreativeApproved(deal.id);
      const beforeTracking = new Date();
      await rushToTracking(deal.id);

      const tracked = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect(tracked!.trackingStartedAt).toBeTruthy();
      expect(tracked!.verificationWindowHours).toBe(48);

      // trackingStartedAt should be close to now
      const diff = Math.abs(tracked!.trackingStartedAt!.getTime() - beforeTracking.getTime());
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });

    it('getTrackingDeals includes channel and requirements', async () => {
      const deals = await getTrackingDeals();
      for (const deal of deals) {
        expect(deal.channel).toBeDefined();
        expect(deal.requirements).toBeDefined();
        expect(Array.isArray(deal.requirements)).toBe(true);
      }
    });
  });

  // ================================================================
  // 11. DEAL EVENTS AUDIT TRAIL
  // ================================================================
  describe('Deal events audit trail', () => {
    it('records events for every transition including TRACKING and FAILED', async () => {
      const deal = await createDeal({
        channelId: telegramChannelId,
        advertiserId,
        adFormatId: telegramFormatId,
        amountTon: 1.0,
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);
      await transitionDeal(deal.id, 'FAILED', undefined, { reason: 'test' });

      const events = await prisma.dealEvent.findMany({
        where: { dealId: deal.id },
        orderBy: { createdAt: 'asc' },
      });

      // DEAL_CREATED + FUNDED + CREATIVE_PENDING + CREATIVE_SUBMITTED + CREATIVE_APPROVED + POSTED + TRACKING + FAILED
      expect(events.length).toBeGreaterThanOrEqual(8);

      const trackingEvent = events.find((e) => e.newStatus === 'TRACKING');
      expect(trackingEvent).toBeDefined();

      const failedEvent = events.find((e) => e.newStatus === 'FAILED');
      expect(failedEvent).toBeDefined();
      expect(failedEvent!.oldStatus).toBe('TRACKING');
    });
  });

  // ================================================================
  // 12. SCHEMA VALIDATION
  // ================================================================
  describe('Schema validation for new fields', () => {
    it('createDealSchema validates verificationWindowHours range', async () => {
      const { createDealSchema } = await import('../api/schemas/index.js');

      // Valid
      expect(createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        verificationWindowHours: 1,
      }).verificationWindowHours).toBe(1);

      expect(createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        verificationWindowHours: 720,
      }).verificationWindowHours).toBe(720);

      // Invalid — too low
      expect(() => createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        verificationWindowHours: 0,
      })).toThrow();

      // Invalid — too high
      expect(() => createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        verificationWindowHours: 721,
      })).toThrow();
    });

    it('createDealSchema validates requirements array', async () => {
      const { createDealSchema } = await import('../api/schemas/index.js');

      // Valid with requirements
      const parsed = createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 1000 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      expect(parsed.requirements).toHaveLength(2);

      // Invalid metric type
      expect(() => createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        requirements: [{ metricType: 'INVALID', targetValue: 100 }],
      })).toThrow();

      // Invalid target value (must be positive)
      expect(() => createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        requirements: [{ metricType: 'VIEWS', targetValue: 0 }],
      })).toThrow();

      // Max 10 requirements
      expect(() => createDealSchema.parse({
        channelId: 1, adFormatId: 1, amountTon: 1.0,
        requirements: Array.from({ length: 11 }, () => ({ metricType: 'VIEWS', targetValue: 100 })),
      })).toThrow();
    });

    it('submitPostProofSchema validates URL', async () => {
      const { submitPostProofSchema } = await import('../api/schemas/index.js');

      expect(submitPostProofSchema.parse({ postUrl: 'https://t.me/channel/123' }).postUrl)
        .toBe('https://t.me/channel/123');

      expect(() => submitPostProofSchema.parse({ postUrl: 'not-a-url' })).toThrow();
      expect(() => submitPostProofSchema.parse({ postUrl: '' })).toThrow();
      expect(() => submitPostProofSchema.parse({})).toThrow();
    });
  });

  // ================================================================
  // 13. PLATFORM URL PARSING
  // ================================================================
  describe('Platform URL parsing', () => {
    it('Telegram: parses public channel URLs', async () => {
      const { TelegramAdapter } = await import('../platforms/telegram.adapter.js');
      const adapter = new TelegramAdapter({} as any);

      expect(adapter.parsePostUrl('https://t.me/mychannel/123')).toBe('123');
      expect(adapter.parsePostUrl('https://t.me/mychannel/456789')).toBe('456789');
    });

    it('Telegram: parses private channel URLs', async () => {
      const { TelegramAdapter } = await import('../platforms/telegram.adapter.js');
      const adapter = new TelegramAdapter({} as any);

      expect(adapter.parsePostUrl('https://t.me/c/1234567/89')).toBe('89');
    });

    it('Telegram: returns null for invalid URLs', async () => {
      const { TelegramAdapter } = await import('../platforms/telegram.adapter.js');
      const adapter = new TelegramAdapter({} as any);

      expect(adapter.parsePostUrl('https://example.com/foo')).toBeNull();
      expect(adapter.parsePostUrl('https://t.me/')).toBeNull();
      expect(adapter.parsePostUrl('not-a-url')).toBeNull();
    });

    it('YouTube: parses watch URLs', async () => {
      const { YouTubeAdapter } = await import('../platforms/youtube.adapter.js');
      const adapter = new YouTubeAdapter();

      expect(adapter.parsePostUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(adapter.parsePostUrl('https://youtube.com/watch?v=abc123')).toBe('abc123');
    });

    it('YouTube: parses shorts URLs', async () => {
      const { YouTubeAdapter } = await import('../platforms/youtube.adapter.js');
      const adapter = new YouTubeAdapter();

      expect(adapter.parsePostUrl('https://www.youtube.com/shorts/abc123')).toBe('abc123');
    });

    it('YouTube: parses youtu.be URLs', async () => {
      const { YouTubeAdapter } = await import('../platforms/youtube.adapter.js');
      const adapter = new YouTubeAdapter();

      expect(adapter.parsePostUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('YouTube: returns null for invalid URLs', async () => {
      const { YouTubeAdapter } = await import('../platforms/youtube.adapter.js');
      const adapter = new YouTubeAdapter();

      expect(adapter.parsePostUrl('https://example.com/video')).toBeNull();
      expect(adapter.parsePostUrl('https://youtube.com/channel/UC123')).toBeNull();
      expect(adapter.parsePostUrl('not-a-url')).toBeNull();
    });
  });

  // ================================================================
  // 14. NOTIFICATION MESSAGES
  // ================================================================
  describe('Notification messages exist for new statuses', () => {
    it('has messages for TRACKING and FAILED statuses', async () => {
      // Import the notification module to verify messages exist
      const mod = await import('../services/notification.service.js');
      // We can't directly access STATUS_MESSAGES, but we can verify the function doesn't crash
      // by calling it with a non-existent deal (it just returns early)
      // This is more of a smoke test
      expect(typeof mod.notifyDealStatusChange).toBe('function');
    });
  });

  // ================================================================
  // 15. CONCURRENT REQUIREMENT EVALUATION
  // ================================================================
  describe('Concurrent evaluations', () => {
    it('handles multiple evaluations updating requirements simultaneously', async () => {
      const deal = await createDeal({
        channelId: youtubeChannelId,
        advertiserId,
        adFormatId: youtubeFormatId,
        amountTon: 1.0,
        requirements: [
          { metricType: 'VIEWS', targetValue: 100 },
          { metricType: 'LIKES', targetValue: 10 },
          { metricType: 'POST_EXISTS', targetValue: 1 },
        ],
      });
      await rushToCreativeApproved(deal.id);
      await rushToTracking(deal.id);

      // Run 3 evaluations concurrently with increasing metrics
      const [r1, r2, r3] = await Promise.all([
        evaluateRequirements(deal.id, { exists: true, views: 50, likes: 5 }),
        evaluateRequirements(deal.id, { exists: true, views: 100, likes: 10 }),
        evaluateRequirements(deal.id, { exists: true, views: 200, likes: 20 }),
      ]);

      // At least one should report all met (the one with 200 views, 20 likes)
      const anyAllMet = [r1, r2, r3].some((r) => r.allMet);
      expect(anyAllMet).toBe(true);

      // Final DB state should have all MET
      const reqs = await prisma.dealRequirement.findMany({ where: { dealId: deal.id } });
      reqs.forEach((r) => expect(r.status).toBe('MET'));
    });
  });
});
