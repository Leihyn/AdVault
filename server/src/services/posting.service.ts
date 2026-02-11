import { PrismaClient } from '@prisma/client';
import { transitionDeal } from './deal.service.js';

const prisma = new PrismaClient();

/**
 * Marks a deal as posted — stores the messageId and the exact timestamp.
 * postedAt is used by the verification worker to compute the hold period
 * (instead of updatedAt which can shift on unrelated updates).
 */
export async function markAsPosted(dealId: number, messageId: string) {
  await prisma.deal.update({
    where: { id: dealId },
    data: {
      postedMessageId: messageId,
      postedAt: new Date(),
    },
  });

  await transitionDeal(dealId, 'POSTED');
}

/**
 * Marks a deal as verified after the hold period.
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
