import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { getTimedOutDeals, transitionDeal } from '../services/deal.service.js';
import { refundFunds } from '../services/escrow.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const prisma = new PrismaClient();
const LOCK_TTL_MS = 30_000;

/** Statuses where refund should be attempted on timeout */
const REFUNDABLE_STATUSES = [
  'FUNDED',
  'CREATIVE_PENDING',
  'CREATIVE_SUBMITTED',
  'CREATIVE_REVISION',
  'CREATIVE_APPROVED',
];

/**
 * Auto-cancels deals that have exceeded their timeout.
 * Uses Redis distributed locks for idempotency.
 */
export function createTimeoutProcessor(bot: Bot) {
  const redis = new IORedis(config.REDIS_URL!, { maxRetriesPerRequest: null });

  return async function processTimeout(_job: Job) {
    const deals = await getTimedOutDeals();
    let timedOut = 0;

    for (const deal of deals) {
      const lockKey = `lock:timeout:${deal.id}`;
      const locked = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      if (!locked) continue;

      try {
        // Re-check status for idempotency
        const current = await prisma.deal.findUnique({
          where: { id: deal.id },
          select: { status: true },
        });
        if (!current || ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'].includes(current.status)) {
          continue;
        }

        await transitionDeal(deal.id, 'TIMED_OUT');
        await notifyDealStatusChange(bot, deal.id, 'TIMED_OUT');

        if (REFUNDABLE_STATUSES.includes(deal.status)) {
          try {
            await refundFunds(deal.id);
            await notifyDealStatusChange(bot, deal.id, 'REFUNDED');
          } catch (error) {
            console.error(`Failed to refund timed-out deal ${deal.id}:`, error);
          }
        }

        timedOut++;
      } catch (error) {
        console.error(`Timeout error for deal ${deal.id}:`, error);
      } finally {
        await redis.del(lockKey);
      }
    }

    return { timedOut };
  };
}
