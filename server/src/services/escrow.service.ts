import { generateWallet, getEscrowBalance, transferFunds, transferFromMaster } from '../ton/wallet.js';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { transitionDeal } from './deal.service.js';
import { config } from '../config.js';
import { toNanotons, subtractFee, decimalToString } from '../utils/decimal.js';

const prisma = new PrismaClient();

/**
 * Generates a per-deal escrow wallet and stores the encrypted mnemonic.
 * Returns the wallet address the advertiser should send funds to.
 */
export async function createEscrowWallet(dealId: number) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error('Deal not found');

  const { address, mnemonicEncrypted } = await generateWallet(dealId);

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      escrowAddress: address,
      escrowMnemonicEncrypted: mnemonicEncrypted,
    },
  });

  return address;
}

/**
 * Checks if a deal's escrow wallet has been funded.
 * Called by the payment monitoring worker.
 */
export async function checkEscrowFunding(dealId: number): Promise<boolean> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || !deal.escrowAddress || deal.status !== 'PENDING_PAYMENT') return false;

  const balance = await getEscrowBalance(deal.escrowAddress);
  const requiredNano = toNanotons(deal.amountTon as unknown as Decimal);

  if (balance >= requiredNano) {
    await transitionDeal(dealId, 'FUNDED');
    await transitionDeal(dealId, 'CREATIVE_PENDING');

    await prisma.transaction.create({
      data: {
        dealId,
        type: 'DEPOSIT',
        amountTon: deal.amountTon,
        toAddress: deal.escrowAddress,
      },
    });

    return true;
  }

  return false;
}

/**
 * Releases escrowed funds to the channel owner after verification.
 *
 * Saga pattern with PendingTransfer:
 *   1. Create PendingTransfer record (intent)
 *   2. Escrow wallet -> Master wallet (hop 1)
 *   3. Update PendingTransfer with hop1TxId
 *   4. Master wallet -> Owner wallet (hop 2)
 *   5. Mark PendingTransfer complete
 *
 * If hop 2 fails, the recovery worker retries using the PendingTransfer record.
 */
export async function releaseFunds(dealId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: { include: { owner: true } } },
  });
  if (!deal || !deal.escrowMnemonicEncrypted) throw new Error('Deal not found or no escrow');

  const ownerWallet = deal.channel.owner.tonWalletAddress;
  if (!ownerWallet) throw new Error('Channel owner has no wallet address');

  const amount = deal.amountTon as unknown as Decimal;
  const { fee, payout } = subtractFee(amount, config.PLATFORM_FEE_PERCENT);

  const masterAddress = config.TON_MASTER_WALLET_ADDRESS;
  if (masterAddress) {
    // Create saga record before starting transfers
    const pendingTransfer = await prisma.pendingTransfer.create({
      data: {
        dealId,
        type: 'RELEASE',
        recipientAddress: ownerWallet,
        amountTon: payout,
      },
    });

    // Hop 1: Escrow -> Master (full amount, fee stays in master)
    const hop1TxId = await transferFunds(
      deal.escrowMnemonicEncrypted,
      masterAddress,
      decimalToString(amount),
    );

    await prisma.pendingTransfer.update({
      where: { id: pendingTransfer.id },
      data: { hop1TxId },
    });

    // Hop 2: Master -> Owner (payout minus fee)
    try {
      const hop2TxId = await transferFromMaster(ownerWallet, decimalToString(payout));

      await prisma.pendingTransfer.update({
        where: { id: pendingTransfer.id },
        data: { hop2TxId, completedAt: new Date() },
      });

      await prisma.transaction.create({
        data: {
          dealId,
          type: 'RELEASE',
          amountTon: payout,
          txHash: hop2TxId,
          fromAddress: masterAddress,
          toAddress: ownerWallet,
          confirmedAt: new Date(),
        },
      });

      await transitionDeal(dealId, 'COMPLETED');
      return hop2TxId;
    } catch (error) {
      // Hop 2 failed — saga record persists for recovery worker
      await prisma.pendingTransfer.update({
        where: { id: pendingTransfer.id },
        data: {
          lastError: error instanceof Error ? error.message : String(error),
          retries: { increment: 1 },
        },
      });
      throw error;
    }
  }

  // Fallback: direct transfer if master wallet not configured
  const txHash = await transferFunds(
    deal.escrowMnemonicEncrypted,
    ownerWallet,
    decimalToString(payout),
  );

  await prisma.transaction.create({
    data: {
      dealId,
      type: 'RELEASE',
      amountTon: payout,
      txHash,
      fromAddress: deal.escrowAddress,
      toAddress: ownerWallet,
      confirmedAt: new Date(),
    },
  });

  await transitionDeal(dealId, 'COMPLETED');
  return txHash;
}

/**
 * Refunds escrowed funds to the advertiser.
 * Same saga pattern as releaseFunds.
 */
export async function refundFunds(dealId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { advertiser: true },
  });
  if (!deal || !deal.escrowMnemonicEncrypted) throw new Error('Deal not found or no escrow');

  const advertiserWallet = deal.advertiser.tonWalletAddress;
  if (!advertiserWallet) throw new Error('Advertiser has no wallet address');

  const amount = deal.amountTon as unknown as Decimal;
  const masterAddress = config.TON_MASTER_WALLET_ADDRESS;

  if (masterAddress) {
    const pendingTransfer = await prisma.pendingTransfer.create({
      data: {
        dealId,
        type: 'REFUND',
        recipientAddress: advertiserWallet,
        amountTon: amount,
      },
    });

    const hop1TxId = await transferFunds(
      deal.escrowMnemonicEncrypted,
      masterAddress,
      decimalToString(amount),
    );

    await prisma.pendingTransfer.update({
      where: { id: pendingTransfer.id },
      data: { hop1TxId },
    });

    try {
      const hop2TxId = await transferFromMaster(advertiserWallet, decimalToString(amount));

      await prisma.pendingTransfer.update({
        where: { id: pendingTransfer.id },
        data: { hop2TxId, completedAt: new Date() },
      });

      await prisma.transaction.create({
        data: {
          dealId,
          type: 'REFUND',
          amountTon: amount,
          txHash: hop2TxId,
          fromAddress: masterAddress,
          toAddress: advertiserWallet,
          confirmedAt: new Date(),
        },
      });

      await transitionDeal(dealId, 'REFUNDED');
      return hop2TxId;
    } catch (error) {
      await prisma.pendingTransfer.update({
        where: { id: pendingTransfer.id },
        data: {
          lastError: error instanceof Error ? error.message : String(error),
          retries: { increment: 1 },
        },
      });
      throw error;
    }
  }

  // Fallback: direct transfer
  const txHash = await transferFunds(
    deal.escrowMnemonicEncrypted,
    advertiserWallet,
    decimalToString(amount),
  );

  await prisma.transaction.create({
    data: {
      dealId,
      type: 'REFUND',
      amountTon: amount,
      txHash,
      fromAddress: deal.escrowAddress,
      toAddress: advertiserWallet,
      confirmedAt: new Date(),
    },
  });

  await transitionDeal(dealId, 'REFUNDED');
  return txHash;
}

/**
 * Retries incomplete pending transfers (saga recovery).
 * Called by the recovery worker on schedule.
 */
export async function retryPendingTransfers(): Promise<number> {
  const MAX_RETRIES = 5;

  const incomplete = await prisma.pendingTransfer.findMany({
    where: {
      completedAt: null,
      hop1TxId: { not: null }, // Hop 1 succeeded
      hop2TxId: null,          // Hop 2 hasn't succeeded
      retries: { lt: MAX_RETRIES },
    },
    include: { deal: true },
  });

  let recovered = 0;

  for (const transfer of incomplete) {
    try {
      const hop2TxId = await transferFromMaster(
        transfer.recipientAddress,
        decimalToString(transfer.amountTon as unknown as Decimal),
      );

      await prisma.pendingTransfer.update({
        where: { id: transfer.id },
        data: { hop2TxId, completedAt: new Date() },
      });

      await prisma.transaction.create({
        data: {
          dealId: transfer.dealId,
          type: transfer.type,
          amountTon: transfer.amountTon,
          txHash: hop2TxId,
          fromAddress: config.TON_MASTER_WALLET_ADDRESS,
          toAddress: transfer.recipientAddress,
          confirmedAt: new Date(),
        },
      });

      // Complete the deal transition
      const targetStatus = transfer.type === 'RELEASE' ? 'COMPLETED' : 'REFUNDED';
      await transitionDeal(transfer.dealId, targetStatus as any);

      recovered++;
    } catch (error) {
      await prisma.pendingTransfer.update({
        where: { id: transfer.id },
        data: {
          lastError: error instanceof Error ? error.message : String(error),
          retries: { increment: 1 },
        },
      });
      console.error(`Recovery failed for transfer ${transfer.id}:`, error);
    }
  }

  return recovered;
}
