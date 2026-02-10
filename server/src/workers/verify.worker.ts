import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { getPostedDeals } from '../services/deal.service.js';
import { markAsVerified } from '../services/posting.service.js';
import { verifyMessageExists } from '../services/telegram.service.js';
import { releaseFunds } from '../services/escrow.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';

const prisma = new PrismaClient();
const HOLD_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verifies posted ads are still intact (not deleted/edited).
 * After the hold period, marks as verified and releases funds.
 */
export function createVerifyProcessor(bot: Bot) {
  return async function processVerify(_job: Job) {
    const deals = await getPostedDeals();
    let verified = 0;

    for (const deal of deals) {
      try {
        if (!deal.postedMessageId) continue;

        // Check if message still exists
        const exists = await verifyMessageExists(
          bot,
          deal.channel.telegramChatId,
          deal.postedMessageId,
        );

        if (!exists) {
          // Post was deleted — flag the deal
          console.warn(`Deal ${deal.id}: posted message was deleted`);
          await notifyDealStatusChange(bot, deal.id, 'DISPUTED');
          continue;
        }

        // Check if hold period has passed
        const postedAt = deal.updatedAt; // updatedAt was set when status → POSTED
        const elapsed = Date.now() - postedAt.getTime();

        if (elapsed >= HOLD_PERIOD_MS) {
          await markAsVerified(deal.id);
          await notifyDealStatusChange(bot, deal.id, 'VERIFIED');

          // Auto-release funds
          try {
            await releaseFunds(deal.id);
            await notifyDealStatusChange(bot, deal.id, 'COMPLETED');
          } catch (error) {
            console.error(`Failed to release funds for deal ${deal.id}:`, error);
          }

          verified++;
        }
      } catch (error) {
        console.error(`Verify error for deal ${deal.id}:`, error);
      }
    }

    return { verified };
  };
}
