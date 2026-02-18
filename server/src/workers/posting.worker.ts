import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { transitionDeal } from '../services/deal.service.js';
import { getDecryptedCreativeForPosting } from '../services/creative.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';
import { verifyChannelAdmin } from '../utils/adminGuard.js';
import { hashCreativeContent } from '../utils/privacy.js';
import { platformRegistry } from '../platforms/registry.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const prisma = new PrismaClient();
const LOCK_TTL_MS = 30_000;

/**
 * Finds deals in CREATIVE_APPROVED with scheduledPostAt <= now() and auto-posts them.
 * Transitions: CREATIVE_APPROVED -> POSTED -> TRACKING
 */
export function createPostingProcessor(bot: Bot) {
  const redis = new IORedis(config.REDIS_URL!, { maxRetriesPerRequest: null });

  return async function processPosting(_job: Job) {
    const deals = await prisma.deal.findMany({
      where: {
        status: 'CREATIVE_APPROVED',
        scheduledPostAt: { lte: new Date() },
      },
      include: {
        channel: true,
      },
    });

    let posted = 0;
    let failed = 0;

    for (const deal of deals) {
      const lockKey = `lock:posting:${deal.id}`;
      const locked = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      if (!locked) continue;

      try {
        // Re-check status (idempotency)
        const current = await prisma.deal.findUnique({
          where: { id: deal.id },
          select: { status: true },
        });
        if (current?.status !== 'CREATIVE_APPROVED') continue;

        // Verify admin status before posting
        try {
          await verifyChannelAdmin(deal.channelId, deal.channel.ownerId);
        } catch (adminError) {
          console.warn(`Deal ${deal.id}: admin check failed — ${(adminError as Error).message}`);
          await transitionDeal(deal.id, 'FAILED', undefined, { reason: 'Bot lost admin access' });
          await notifyDealStatusChange(bot, deal.id, 'FAILED');
          failed++;
          continue;
        }

        // Get decrypted creative content
        const creative = await getDecryptedCreativeForPosting(deal.id);
        if (!creative) {
          console.warn(`Deal ${deal.id}: no approved creative found`);
          continue;
        }

        const adapter = platformRegistry.get(deal.channel.platform);
        const platformChannelId = deal.channel.platformChannelId || String(deal.channel.telegramChatId);

        // Publish
        const result = await adapter.publishPost(
          platformChannelId,
          creative.contentText || '',
          creative.mediaUrl || undefined,
          creative.mediaType || undefined,
        );

        // Compute content hash for edit detection
        const contentHash = hashCreativeContent(
          creative.contentText || '',
          creative.mediaUrl || '',
        );

        const now = new Date();

        // Update deal with post info
        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            platformPostId: result.platformPostId,
            postedMessageId: result.platformPostId,
            postedAt: now,
            trackingStartedAt: now,
            postProofUrl: result.url || null,
            contentHash,
          },
        });

        // Transition: CREATIVE_APPROVED -> POSTED -> TRACKING
        await transitionDeal(deal.id, 'POSTED', undefined, {
          autoPosted: true,
          platformPostId: result.platformPostId,
        });
        await transitionDeal(deal.id, 'TRACKING', undefined, {
          trackingStartedAt: now.toISOString(),
        });

        // Notify both parties
        await notifyDealStatusChange(bot, deal.id, 'POSTED');
        await notifyDealStatusChange(bot, deal.id, 'TRACKING');

        posted++;
      } catch (error) {
        console.error(`Posting error for deal ${deal.id}:`, error);
        failed++;
      } finally {
        await redis.del(lockKey);
      }
    }

    return { posted, failed };
  };
}
