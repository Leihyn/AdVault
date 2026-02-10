import { Queue, Worker } from 'bullmq';
import { Bot } from 'grammy';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { processPaymentCheck } from './payment.worker.js';
import { createPostingProcessor } from './posting.worker.js';
import { createVerifyProcessor } from './verify.worker.js';
import { createTimeoutProcessor } from './timeout.worker.js';
import { processPurge } from './purge.worker.js';

const QUEUE_NAMES = {
  PAYMENT: 'payment-check',
  POSTING: 'posting',
  VERIFY: 'verify',
  TIMEOUT: 'timeout',
  PURGE: 'purge',
} as const;

export function createWorkers(bot: Bot) {
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

  // Queues
  const paymentQueue = new Queue(QUEUE_NAMES.PAYMENT, { connection });
  const postingQueue = new Queue(QUEUE_NAMES.POSTING, { connection });
  const verifyQueue = new Queue(QUEUE_NAMES.VERIFY, { connection });
  const timeoutQueue = new Queue(QUEUE_NAMES.TIMEOUT, { connection });
  const purgeQueue = new Queue(QUEUE_NAMES.PURGE, { connection });

  // Workers
  const paymentWorker = new Worker(QUEUE_NAMES.PAYMENT, processPaymentCheck, { connection });
  const postingWorker = new Worker(QUEUE_NAMES.POSTING, createPostingProcessor(bot), { connection });
  const verifyWorker = new Worker(QUEUE_NAMES.VERIFY, createVerifyProcessor(bot), { connection });
  const timeoutWorker = new Worker(QUEUE_NAMES.TIMEOUT, createTimeoutProcessor(bot), { connection });
  const purgeWorker = new Worker(QUEUE_NAMES.PURGE, processPurge, { connection });

  // Error handlers
  for (const worker of [paymentWorker, postingWorker, verifyWorker, timeoutWorker, purgeWorker]) {
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

    // Check for posts to publish every 30 seconds
    await postingQueue.upsertJobScheduler('posting-schedule', {
      every: 30_000,
    });

    // Verify posts every 10 minutes
    await verifyQueue.upsertJobScheduler('verify-schedule', {
      every: 600_000,
    });

    // Check for timeouts every 5 minutes
    await timeoutQueue.upsertJobScheduler('timeout-schedule', {
      every: 300_000,
    });

    // Purge old deal data once per hour
    await purgeQueue.upsertJobScheduler('purge-schedule', {
      every: 3_600_000,
    });

    console.log('Worker schedules registered');
  }

  async function shutdown() {
    await Promise.all([
      paymentWorker.close(),
      postingWorker.close(),
      verifyWorker.close(),
      timeoutWorker.close(),
      purgeWorker.close(),
      paymentQueue.close(),
      postingQueue.close(),
      verifyQueue.close(),
      timeoutQueue.close(),
      purgeQueue.close(),
      connection.quit(),
    ]);
  }

  return { scheduleJobs, shutdown };
}
