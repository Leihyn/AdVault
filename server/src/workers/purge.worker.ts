import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import { hashDealData } from '../utils/privacy.js';

const prisma = new PrismaClient();

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'];

/**
 * Purges completed deal data after the configured retention period.
 *
 * What gets deleted:
 *   - Creative content (contentText, mediaUrl)
 *   - Deal events (full audit trail)
 *   - Transaction details (addresses, hashes)
 *   - Escrow mnemonic (encrypted blob)
 *
 * What gets kept:
 *   - DealReceipt with SHA-256 hash (proof of completion)
 *   - Deal skeleton (id, status, amount, timestamps — no PII)
 *
 * The hash receipt lets either party prove a deal existed and
 * completed at a specific amount, without storing the raw data.
 */
export async function processPurge(_job: Job) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.PURGE_AFTER_DAYS);

  // Find terminal deals older than the retention period that haven't been purged yet
  const deals = await prisma.deal.findMany({
    where: {
      status: { in: TERMINAL_STATUSES as any },
      completedAt: { lte: cutoff },
      // Only purge deals that still have data (escrowMnemonicEncrypted as sentinel)
      escrowMnemonicEncrypted: { not: null },
    },
    include: {
      channel: { select: { title: true } },
      transactions: true,
    },
    take: 50, // Process in batches to avoid long-running transactions
  });

  let purged = 0;

  for (const deal of deals) {
    try {
      // Create hash receipt before deleting data
      const dataHash = hashDealData({
        dealId: deal.id,
        channelId: deal.channelId,
        advertiserId: deal.advertiserId,
        amountTon: deal.amountTon,
        finalStatus: deal.status,
        escrowAddress: deal.escrowAddress,
        completedAt: (deal.completedAt || deal.updatedAt).toISOString(),
      });

      // Store the receipt
      await prisma.dealReceipt.upsert({
        where: { dealId: deal.id },
        update: {},
        create: {
          dealId: deal.id,
          channelTitle: deal.channel.title,
          advertiserAlias: deal.advertiserAlias,
          ownerAlias: deal.ownerAlias,
          amountTon: deal.amountTon,
          finalStatus: deal.status,
          dataHash,
          completedAt: deal.completedAt || deal.updatedAt,
        },
      });

      // Delete sensitive data in a transaction
      await prisma.$transaction([
        // Wipe creative content
        prisma.creative.updateMany({
          where: { dealId: deal.id },
          data: {
            contentText: null,
            mediaUrl: null,
            reviewerNotes: null,
          },
        }),
        // Delete event trail
        prisma.dealEvent.deleteMany({ where: { dealId: deal.id } }),
        // Wipe transaction addresses
        prisma.transaction.updateMany({
          where: { dealId: deal.id },
          data: {
            fromAddress: null,
            toAddress: null,
            txHash: null,
          },
        }),
        // Clear escrow secrets and address from deal
        prisma.deal.update({
          where: { id: deal.id },
          data: {
            escrowMnemonicEncrypted: null,
            escrowAddress: null,
          },
        }),
      ]);

      purged++;
    } catch (error) {
      console.error(`Failed to purge deal ${deal.id}:`, error);
    }
  }

  if (purged > 0) {
    console.log(`Purge worker: cleaned ${purged} deal(s)`);
  }

  return { purged };
}
