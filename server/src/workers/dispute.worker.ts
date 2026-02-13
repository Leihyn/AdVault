import { Job } from 'bullmq';
import { getExpiredDisputes, escalateToAdmin } from '../services/dispute.service.js';

/**
 * Checks for disputes past their 48h mutual resolution deadline.
 * Escalates unresolved disputes to ADMIN_REVIEW status.
 * Runs every 15 minutes.
 */
export async function processDisputeEscalation(_job: Job) {
  const expired = await getExpiredDisputes();
  let escalated = 0;

  for (const dispute of expired) {
    try {
      await escalateToAdmin(dispute.id);
      escalated++;
      console.log(`Dispute ${dispute.id} (deal ${dispute.dealId}) escalated to admin review`);
    } catch (error) {
      console.error(`Failed to escalate dispute ${dispute.id}:`, error);
    }
  }

  return { escalated };
}
