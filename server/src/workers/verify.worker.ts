import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { getTrackingDeals, transitionDeal } from '../services/deal.service.js';
import { evaluateRequirements } from '../services/proof.service.js';
import { releaseFunds, refundFunds } from '../services/escrow.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';
import { platformRegistry } from '../platforms/registry.js';
import { verifyChannelAdmin } from '../utils/adminGuard.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const prisma = new PrismaClient();
const LOCK_TTL_MS = 30_000;

/**
 * Verifies tracked deals against their performance requirements.
 * For each deal in TRACKING status:
 * 1. Fetch metrics from the platform
 * 2. If post deleted → fail immediately, refund
 * 3. Evaluate all requirements
 * 4. If all met → VERIFIED → COMPLETED (release funds)
 * 5. If window expired and not all met → FAILED → REFUNDED
 * 6. Otherwise → do nothing (check again next cycle)
 */
export function createVerifyProcessor(bot: Bot) {
  const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

  return async function processVerify(_job: Job) {
    const deals = await getTrackingDeals();
    let verified = 0;
    let failed = 0;

    for (const deal of deals) {
      const lockKey = `lock:verify:${deal.id}`;
      const locked = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      if (!locked) continue;

      try {
        // Re-check status for idempotency
        const current = await prisma.deal.findUnique({
          where: { id: deal.id },
          select: { status: true },
        });
        if (current?.status !== 'TRACKING') continue;

        if (!deal.platformPostId) continue;

        const adapter = platformRegistry.get(deal.channel.platform);
        const platformChannelId = deal.channel.platformChannelId || String(deal.channel.telegramChatId);

        // Fetch metrics
        const metrics = await adapter.fetchPostMetrics(platformChannelId, deal.platformPostId);

        // Post deleted → fail immediately
        if (!metrics.exists) {
          console.warn(`Deal ${deal.id}: post was deleted during tracking`);
          await transitionDeal(deal.id, 'FAILED', undefined, { reason: 'Post deleted' });
          await notifyDealStatusChange(bot, deal.id, 'FAILED');
          try {
            await refundFunds(deal.id);
            await notifyDealStatusChange(bot, deal.id, 'REFUNDED');
          } catch (error) {
            console.error(`Failed to refund deal ${deal.id}:`, error);
          }
          failed++;
          continue;
        }

        // Evaluate requirements
        const { allMet } = await evaluateRequirements(deal.id, metrics);

        if (allMet) {
          // All requirements met — verify and release
          // Re-verify bot admin before releasing funds
          try {
            await verifyChannelAdmin(deal.channelId, deal.channel.ownerId);
          } catch (adminError) {
            console.warn(`Deal ${deal.id}: admin check failed before release — ${(adminError as Error).message}`);
            await transitionDeal(deal.id, 'FAILED', undefined, { reason: 'Bot lost admin access' });
            await notifyDealStatusChange(bot, deal.id, 'FAILED');
            failed++;
            continue;
          }

          await prisma.deal.update({
            where: { id: deal.id },
            data: { postVerifiedAt: new Date() },
          });
          await transitionDeal(deal.id, 'VERIFIED');
          await notifyDealStatusChange(bot, deal.id, 'VERIFIED');

          try {
            await releaseFunds(deal.id);
            await notifyDealStatusChange(bot, deal.id, 'COMPLETED');
          } catch (error) {
            console.error(`Failed to release funds for deal ${deal.id}:`, error);
          }

          verified++;
          continue;
        }

        // Check if verification window expired
        const trackingStart = deal.trackingStartedAt || deal.updatedAt;
        const windowMs = deal.verificationWindowHours * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(trackingStart).getTime();

        if (elapsed >= windowMs) {
          // Window expired, requirements not met → FAILED → REFUNDED
          await transitionDeal(deal.id, 'FAILED', undefined, { reason: 'Verification window expired' });
          await notifyDealStatusChange(bot, deal.id, 'FAILED');

          try {
            await refundFunds(deal.id);
            await notifyDealStatusChange(bot, deal.id, 'REFUNDED');
          } catch (error) {
            console.error(`Failed to refund failed deal ${deal.id}:`, error);
          }

          failed++;
        }
        // Otherwise: do nothing, check again next cycle
      } catch (error) {
        console.error(`Verify error for deal ${deal.id}:`, error);
      } finally {
        await redis.del(lockKey);
      }
    }

    return { verified, failed };
  };
}
