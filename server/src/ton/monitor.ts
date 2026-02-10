import { PrismaClient } from '@prisma/client';
import { checkEscrowFunding } from '../services/escrow.service.js';

const prisma = new PrismaClient();

/**
 * Checks all pending payment deals for incoming funds.
 * Called by the payment worker on a repeatable schedule.
 */
export async function checkPendingPayments(): Promise<number> {
  const pendingDeals = await prisma.deal.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      escrowAddress: { not: null },
    },
    select: { id: true },
  });

  let funded = 0;
  for (const deal of pendingDeals) {
    try {
      const wasFunded = await checkEscrowFunding(deal.id);
      if (wasFunded) funded++;
    } catch (error) {
      console.error(`Error checking payment for deal ${deal.id}:`, error);
    }
  }

  return funded;
}
