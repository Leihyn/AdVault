import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { getTimedOutDeals, transitionDeal } from '../services/deal.service.js';
import { refundFunds } from '../services/escrow.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';

/** Statuses where refund should be attempted on timeout */
const REFUNDABLE_STATUSES = [
  'FUNDED',
  'CREATIVE_PENDING',
  'CREATIVE_SUBMITTED',
  'CREATIVE_REVISION',
  'CREATIVE_APPROVED',
  'SCHEDULED',
];

/**
 * Auto-cancels deals that have exceeded their timeout.
 * If the deal was funded, also triggers a refund.
 */
export function createTimeoutProcessor(bot: Bot) {
  return async function processTimeout(_job: Job) {
    const deals = await getTimedOutDeals();
    let timedOut = 0;

    for (const deal of deals) {
      try {
        await transitionDeal(deal.id, 'TIMED_OUT');
        await notifyDealStatusChange(bot, deal.id, 'TIMED_OUT');

        // Refund if the deal had funds
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
      }
    }

    return { timedOut };
  };
}
