import { Job } from 'bullmq';
import { checkPendingPayments } from '../ton/monitor.js';

/**
 * Monitors escrow wallets for incoming payments.
 * Runs on a repeatable schedule (every 30s).
 */
export async function processPaymentCheck(_job: Job) {
  const funded = await checkPendingPayments();
  if (funded > 0) {
    console.log(`Payment worker: ${funded} deal(s) newly funded`);
  }
  return { funded };
}
