import { Job } from 'bullmq';
import { retryPendingTransfers } from '../services/escrow.service.js';

/**
 * Recovery worker: retries incomplete two-hop transfers.
 * When hop 1 (escrow -> master) succeeds but hop 2 (master -> recipient) fails,
 * the PendingTransfer record persists. This worker retries hop 2 with backoff.
 */
export async function processRecovery(_job: Job) {
  const recovered = await retryPendingTransfers();
  if (recovered > 0) {
    console.log(`Recovery worker: completed ${recovered} pending transfer(s)`);
  }
  return { recovered };
}
