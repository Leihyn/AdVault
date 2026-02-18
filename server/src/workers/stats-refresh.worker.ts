import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { updateChannelStats } from '../services/channel.service.js';
import { platformRegistry } from '../platforms/registry.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const prisma = new PrismaClient();
const LOCK_TTL_MS = 60_000;
const MAX_PER_CYCLE = 50;

/**
 * Periodically refreshes channel stats (subscribers, avg views, language breakdown)
 * for channels where statsUpdatedAt is null or older than 6 hours.
 */
export function createStatsRefreshProcessor(bot: Bot) {
  const redis = new IORedis(config.REDIS_URL!, { maxRetriesPerRequest: null });

  return async function processStatsRefresh(_job: Job) {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const channels = await prisma.channel.findMany({
      where: {
        OR: [
          { statsUpdatedAt: null },
          { statsUpdatedAt: { lt: sixHoursAgo } },
        ],
      },
      orderBy: { statsUpdatedAt: { sort: 'asc', nulls: 'first' } },
      take: MAX_PER_CYCLE,
    });

    let refreshed = 0;
    let failed = 0;

    for (const channel of channels) {
      const lockKey = `lock:stats-refresh:${channel.id}`;
      const locked = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      if (!locked) continue;

      try {
        const adapter = platformRegistry.get(channel.platform);
        const platformChannelId = channel.platformChannelId || String(channel.telegramChatId);

        const info = await adapter.fetchChannelInfo(platformChannelId);

        await updateChannelStats(channel.id, {
          subscribers: info.subscribers,
          avgViews: info.avgViews,
          avgReach: info.avgReach,
          premiumPercentage: info.premiumPercentage,
          languages: info.languages,
        });

        refreshed++;
      } catch (error) {
        console.error(`Stats refresh failed for channel ${channel.id}:`, error);
        failed++;
      } finally {
        await redis.del(lockKey);
      }
    }

    return { refreshed, failed, total: channels.length };
  };
}
