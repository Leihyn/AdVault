import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { getScheduledDeals } from '../services/deal.service.js';
import { markAsPosted } from '../services/posting.service.js';
import { getDecryptedCreativeForPosting } from '../services/creative.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';
import { platformRegistry } from '../platforms/registry.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const prisma = new PrismaClient();
const LOCK_TTL_MS = 30_000;

/**
 * Auto-posts scheduled ads to channels.
 * Uses Redis distributed locks for idempotency.
 * Dispatches to the correct platform adapter based on channel.platform.
 */
export function createPostingProcessor(bot: Bot) {
  const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

  return async function processPosting(_job: Job) {
    const deals = await getScheduledDeals();
    let posted = 0;

    for (const deal of deals) {
      const lockKey = `lock:posting:${deal.id}`;
      const locked = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      if (!locked) continue;

      try {
        // Re-check status for idempotency
        const current = await prisma.deal.findUnique({
          where: { id: deal.id },
          select: { status: true },
        });
        if (current?.status !== 'SCHEDULED') continue;

        const creative = await getDecryptedCreativeForPosting(deal.id);
        if (!creative) {
          console.error(`Deal ${deal.id}: no approved creative found`);
          continue;
        }

        const adapter = platformRegistry.get(deal.channel.platform);
        const platformChannelId = deal.channel.platformChannelId || String(deal.channel.telegramChatId);
        const result = await adapter.publishPost(
          platformChannelId,
          creative.contentText || '',
          creative.mediaUrl || undefined,
          creative.mediaType || undefined,
        );

        await markAsPosted(deal.id, result.platformPostId);
        await notifyDealStatusChange(bot, deal.id, 'POSTED');
        posted++;
      } catch (error) {
        console.error(`Failed to post deal ${deal.id}:`, error);
      } finally {
        await redis.del(lockKey);
      }
    }

    return { posted };
  };
}
