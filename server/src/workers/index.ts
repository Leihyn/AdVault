import { Queue, Worker } from 'bullmq';
import { Bot } from 'grammy';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { processPaymentCheck } from './payment.worker.js';
import { createVerifyProcessor } from './verify.worker.js';
import { createTimeoutProcessor } from './timeout.worker.js';
import { processPurge } from './purge.worker.js';
import { processRecovery } from './recovery.worker.js';
import { processDisputeEscalation } from './dispute.worker.js';
import { createStatsRefreshProcessor } from './stats-refresh.worker.js';
import { createPostingProcessor } from './posting.worker.js';
import { platformRegistry } from '../platforms/registry.js';
import { TelegramAdapter } from '../platforms/telegram.adapter.js';
import { YouTubeAdapter } from '../platforms/youtube.adapter.js';
import { InstagramAdapter } from '../platforms/instagram.adapter.js';
import { TwitterAdapter } from '../platforms/twitter.adapter.js';
import { TikTokAdapter } from '../platforms/tiktok.adapter.js';

const QUEUE_NAMES = {
  PAYMENT: 'payment-check',
  VERIFY: 'verify',
  TIMEOUT: 'timeout',
  PURGE: 'purge',
  RECOVERY: 'recovery',
  DISPUTE: 'dispute-escalation',
  STATS_REFRESH: 'stats-refresh',
  POSTING: 'posting',
} as const;

export function createWorkers(bot: Bot) {
  // Register platform adapters
  platformRegistry.register(new TelegramAdapter(bot));
  platformRegistry.register(new YouTubeAdapter());
  platformRegistry.register(new InstagramAdapter());
  platformRegistry.register(new TwitterAdapter());
  platformRegistry.register(new TikTokAdapter());
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

  // Queues
  const paymentQueue = new Queue(QUEUE_NAMES.PAYMENT, { connection });
  const verifyQueue = new Queue(QUEUE_NAMES.VERIFY, { connection });
  const timeoutQueue = new Queue(QUEUE_NAMES.TIMEOUT, { connection });
  const purgeQueue = new Queue(QUEUE_NAMES.PURGE, { connection });
  const recoveryQueue = new Queue(QUEUE_NAMES.RECOVERY, { connection });
  const disputeQueue = new Queue(QUEUE_NAMES.DISPUTE, { connection });
  const statsRefreshQueue = new Queue(QUEUE_NAMES.STATS_REFRESH, { connection });
  const postingQueue = new Queue(QUEUE_NAMES.POSTING, { connection });

  // Workers
  const paymentWorker = new Worker(QUEUE_NAMES.PAYMENT, processPaymentCheck, { connection });
  const verifyWorker = new Worker(QUEUE_NAMES.VERIFY, createVerifyProcessor(bot), { connection });
  const timeoutWorker = new Worker(QUEUE_NAMES.TIMEOUT, createTimeoutProcessor(bot), { connection });
  const purgeWorker = new Worker(QUEUE_NAMES.PURGE, processPurge, { connection });
  const recoveryWorker = new Worker(QUEUE_NAMES.RECOVERY, processRecovery, { connection });
  const disputeWorker = new Worker(QUEUE_NAMES.DISPUTE, processDisputeEscalation, { connection });
  const statsRefreshWorker = new Worker(QUEUE_NAMES.STATS_REFRESH, createStatsRefreshProcessor(bot), { connection });
  const postingWorker = new Worker(QUEUE_NAMES.POSTING, createPostingProcessor(bot), { connection });

  // Error handlers
  for (const worker of [paymentWorker, verifyWorker, timeoutWorker, purgeWorker, recoveryWorker, disputeWorker, statsRefreshWorker, postingWorker]) {
    worker.on('failed', (job, err) => {
      console.error(`Worker ${worker.name} job ${job?.id} failed:`, err.message);
    });
  }

  // Schedule repeatable jobs
  async function scheduleJobs() {
    // Check for payments every 30 seconds
    await paymentQueue.upsertJobScheduler('payment-check-schedule', {
      every: 30_000,
    });

    // Verify post metrics every 5 minutes
    await verifyQueue.upsertJobScheduler('verify-schedule', {
      every: 300_000,
    });

    // Check for timeouts every 5 minutes
    await timeoutQueue.upsertJobScheduler('timeout-schedule', {
      every: 300_000,
    });

    // Purge old deal data once per hour
    await purgeQueue.upsertJobScheduler('purge-schedule', {
      every: 3_600_000,
    });

    // Retry failed pending transfers every 2 minutes
    await recoveryQueue.upsertJobScheduler('recovery-schedule', {
      every: 120_000,
    });

    // Check for expired dispute resolution windows every 15 minutes
    await disputeQueue.upsertJobScheduler('dispute-escalation-schedule', {
      every: 900_000,
    });

    // Refresh channel stats every 6 hours
    await statsRefreshQueue.upsertJobScheduler('stats-refresh-schedule', {
      every: 21_600_000,
    });

    // Check for scheduled posts to publish every 60 seconds
    await postingQueue.upsertJobScheduler('posting-schedule', {
      every: 60_000,
    });

    console.log('Worker schedules registered');
  }

  async function shutdown() {
    await Promise.all([
      paymentWorker.close(),
      verifyWorker.close(),
      timeoutWorker.close(),
      purgeWorker.close(),
      recoveryWorker.close(),
      disputeWorker.close(),
      statsRefreshWorker.close(),
      postingWorker.close(),
      paymentQueue.close(),
      verifyQueue.close(),
      timeoutQueue.close(),
      purgeQueue.close(),
      recoveryQueue.close(),
      disputeQueue.close(),
      statsRefreshQueue.close(),
      postingQueue.close(),
      connection.quit(),
    ]);
  }

  return { scheduleJobs, shutdown };
}
