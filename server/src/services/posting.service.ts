import { PrismaClient } from '@prisma/client';
import { transitionDeal } from './deal.service.js';

const prisma = new PrismaClient();

/**
 * Posts the approved creative to the target channel via the bot.
 * Called by the posting worker at the scheduled time.
 *
 * The bot reference is injected by the worker - this service
 * just handles the DB state transitions.
 */
export async function markAsPosted(dealId: number, messageId: number) {
  await prisma.deal.update({
    where: { id: dealId },
    data: { postedMessageId: messageId },
  });

  await transitionDeal(dealId, 'POSTED');
}

/**
 * Marks a deal as verified after the hold period.
 * The verification worker calls this after confirming the post
 * is still intact (not deleted/edited).
 */
export async function markAsVerified(dealId: number) {
  await prisma.deal.update({
    where: { id: dealId },
    data: { postVerifiedAt: new Date() },
  });

  await transitionDeal(dealId, 'VERIFIED');
}

/**
 * Gets the approved creative content for a deal, ready for posting.
 */
export async function getPostContent(dealId: number) {
  const creative = await prisma.creative.findFirst({
    where: { dealId, status: 'APPROVED' },
    orderBy: { version: 'desc' },
  });
  return creative;
}
