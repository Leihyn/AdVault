import { generateWallet, getEscrowBalance, transferFunds, transferFromMaster } from '../ton/wallet.js';
import { PrismaClient } from '@prisma/client';
import { transitionDeal } from './deal.service.js';
import { config } from '../config.js';

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
  const requiredNano = BigInt(Math.floor(deal.amountTon * 1e9));

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
 * Privacy relay pattern:
 *   1. Escrow wallet → Master wallet (consolidate + take fee)
 *   2. Master wallet → Owner wallet (payout from common pool)
 *
 * On-chain, observers see all payouts originating from the same master
 * wallet. They can't trace a specific escrow deposit to a specific owner.
 */
export async function releaseFunds(dealId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: { include: { owner: true } } },
  });
  if (!deal || !deal.escrowMnemonicEncrypted) throw new Error('Deal not found or no escrow');

  const ownerWallet = deal.channel.owner.tonWalletAddress;
  if (!ownerWallet) throw new Error('Channel owner has no wallet address');

  const feePercent = config.PLATFORM_FEE_PERCENT;
  const fee = deal.amountTon * (feePercent / 100);
  const payout = deal.amountTon - fee;

  // Hop 1: Escrow → Master (full amount, fee stays in master)
  const masterAddress = config.TON_MASTER_WALLET_ADDRESS;
  if (masterAddress) {
    await transferFunds(deal.escrowMnemonicEncrypted, masterAddress, deal.amountTon);

    // Hop 2: Master → Owner (payout minus fee, origin is now master wallet)
    const txHash = await transferFromMaster(ownerWallet, payout);

    await prisma.transaction.create({
      data: {
        dealId,
        type: 'RELEASE',
        amountTon: payout,
        txHash,
        fromAddress: masterAddress,  // Record master as origin, not escrow
        toAddress: ownerWallet,
        confirmedAt: new Date(),
      },
    });

    await transitionDeal(dealId, 'COMPLETED');
    return txHash;
  }

  // Fallback: direct transfer if master wallet not configured
  const txHash = await transferFunds(deal.escrowMnemonicEncrypted, ownerWallet, payout);

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
 *
 * Same relay pattern: escrow → master → advertiser.
 * Refunds also route through master to avoid linking the escrow
 * address to the advertiser's personal wallet.
 */
export async function refundFunds(dealId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { advertiser: true },
  });
  if (!deal || !deal.escrowMnemonicEncrypted) throw new Error('Deal not found or no escrow');

  const advertiserWallet = deal.advertiser.tonWalletAddress;
  if (!advertiserWallet) throw new Error('Advertiser has no wallet address');

  const masterAddress = config.TON_MASTER_WALLET_ADDRESS;
  if (masterAddress) {
    await transferFunds(deal.escrowMnemonicEncrypted, masterAddress, deal.amountTon);

    const txHash = await transferFromMaster(advertiserWallet, deal.amountTon);

    await prisma.transaction.create({
      data: {
        dealId,
        type: 'REFUND',
        amountTon: deal.amountTon,
        txHash,
        fromAddress: masterAddress,
        toAddress: advertiserWallet,
        confirmedAt: new Date(),
      },
    });

    await transitionDeal(dealId, 'REFUNDED');
    return txHash;
  }

  // Fallback: direct transfer
  const txHash = await transferFunds(deal.escrowMnemonicEncrypted, advertiserWallet, deal.amountTon);

  await prisma.transaction.create({
    data: {
      dealId,
      type: 'REFUND',
      amountTon: deal.amountTon,
      txHash,
      fromAddress: deal.escrowAddress,
      toAddress: advertiserWallet,
      confirmedAt: new Date(),
    },
  });

  await transitionDeal(dealId, 'REFUNDED');
  return txHash;
}
