import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { getPostedDeals } from '../services/deal.service.js';
import { markAsVerified } from '../services/posting.service.js';
import { releaseFunds } from '../services/escrow.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';
import { platformRegistry } from '../platforms/registry.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const prisma = new PrismaClient();
const HOLD_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCK_TTL_MS = 30_000;

/**
 * Verifies posted ads are still intact (not deleted/edited).
 * After the hold period, marks as verified and releases funds.
 * Dispatches to the correct platform adapter based on channel.platform.
 */
export function createVerifyProcessor(bot: Bot) {
  const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

  return async function processVerify(_job: Job) {
    const deals = await getPostedDeals();
    let verified = 0;

    for (const deal of deals) {
      const lockKey = `lock:verify:${deal.id}`;
      const locked = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      if (!locked) continue;

      try {
        // Re-check status to avoid stale processing
        const current = await prisma.deal.findUnique({
          where: { id: deal.id },
          select: { status: true },
        });
        if (current?.status !== 'POSTED') continue;

        if (!deal.postedMessageId) continue;

        const adapter = platformRegistry.get(deal.channel.platform);
        const platformChannelId = deal.channel.platformChannelId || String(deal.channel.telegramChatId);

        // Check if post still exists
        const exists = await adapter.verifyPostExists(
          platformChannelId,
          deal.postedMessageId,
        );

        if (!exists) {
          console.warn(`Deal ${deal.id}: posted message was deleted`);
          await notifyDealStatusChange(bot, deal.id, 'DISPUTED');
          continue;
        }

        // Use postedAt for hold period (not updatedAt which shifts on unrelated updates)
        const postedAt = (deal as any).postedAt || deal.updatedAt;
        const elapsed = Date.now() - new Date(postedAt).getTime();

        if (elapsed >= HOLD_PERIOD_MS) {
          await markAsVerified(deal.id);
          await notifyDealStatusChange(bot, deal.id, 'VERIFIED');

          try {
            await releaseFunds(deal.id);
            await notifyDealStatusChange(bot, deal.id, 'COMPLETED');
          } catch (error) {
            console.error(`Failed to release funds for deal ${deal.id}:`, error);
          }

          verified++;
        }
      } catch (error) {
        console.error(`Verify error for deal ${deal.id}:`, error);
      } finally {
        await redis.del(lockKey);
      }
    }

    return { verified };
  };
}
