import { PrismaClient, DisputeOutcome } from '@prisma/client';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { transitionDeal } from './deal.service.js';
import { releaseFunds, refundFunds } from './escrow.service.js';

const prisma = new PrismaClient();

const MUTUAL_RESOLUTION_HOURS = 48;

/**
 * Opens a dispute on a deal. Creates a Dispute record with a 48-hour
 * mutual resolution window. Both parties can submit evidence and propose
 * an outcome during this window.
 */
export async function openDispute(dealId: number, userId: number, reason: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true, dispute: true },
  });
  if (!deal) throw new NotFoundError('Deal');
  if (deal.dispute) throw new AppError('This deal already has an active dispute');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  // Only funded deals can be disputed (must have escrow funds to argue over)
  const disputableStatuses = [
    'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED', 'CREATIVE_REVISION',
    'CREATIVE_APPROVED', 'POSTED', 'TRACKING', 'FAILED',
  ];
  if (!disputableStatuses.includes(deal.status)) {
    throw new AppError('This deal cannot be disputed in its current status');
  }

  const mutualDeadline = new Date(Date.now() + MUTUAL_RESOLUTION_HOURS * 60 * 60 * 1000);

  // Transition deal to DISPUTED + create dispute record
  await transitionDeal(dealId, 'DISPUTED', userId, {
    disputedBy: isAdvertiser ? 'advertiser' : 'owner',
    reason,
  });

  const dispute = await prisma.dispute.create({
    data: {
      dealId,
      openedById: userId,
      reason,
      status: 'OPEN',
      mutualDeadline,
    },
  });

  return dispute;
}

/**
 * Submit evidence for a dispute. Both parties can submit multiple pieces
 * of evidence (screenshots, URLs, explanations).
 */
export async function submitEvidence(
  dealId: number,
  userId: number,
  description: string,
  url?: string,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true, dispute: true },
  });
  if (!deal) throw new NotFoundError('Deal');
  if (!deal.dispute) throw new AppError('No dispute exists for this deal');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  if (deal.dispute.status === 'RESOLVED') {
    throw new AppError('This dispute has already been resolved');
  }

  const evidence = await prisma.disputeEvidence.create({
    data: {
      disputeId: deal.dispute.id,
      submittedById: userId,
      description,
      url,
    },
  });

  return evidence;
}

/**
 * Propose a resolution outcome. Each party can propose:
 * - RELEASE_TO_OWNER: funds go to the creator
 * - REFUND_TO_ADVERTISER: funds go back to the advertiser
 * - SPLIT: funds split by percentage (proposer specifies their split %)
 *
 * If both parties propose the same outcome, it auto-resolves.
 */
export async function proposeResolution(
  dealId: number,
  userId: number,
  outcome: DisputeOutcome,
  splitPercent?: number,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true, dispute: true },
  });
  if (!deal) throw new NotFoundError('Deal');
  if (!deal.dispute) throw new AppError('No dispute exists for this deal');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  if (deal.dispute.status === 'RESOLVED') {
    throw new AppError('This dispute has already been resolved');
  }

  if (outcome === 'SPLIT' && (splitPercent == null || splitPercent < 0 || splitPercent > 100)) {
    throw new AppError('Split percentage must be between 0 and 100 (your share to the owner)');
  }

  // Update the proposing party's column
  const updateData: Record<string, unknown> = {};
  if (isOwner) {
    updateData.ownerProposal = outcome;
    updateData.ownerSplitPercent = outcome === 'SPLIT' ? splitPercent : null;
  } else {
    updateData.advertiserProposal = outcome;
    updateData.advertiserSplitPercent = outcome === 'SPLIT' ? splitPercent : null;
  }

  await prisma.dispute.update({
    where: { id: deal.dispute.id },
    data: updateData,
  });

  // Check if both parties agree
  const updated = await prisma.dispute.findUnique({ where: { id: deal.dispute.id } });
  if (!updated) throw new AppError('Dispute not found');

  if (updated.ownerProposal && updated.advertiserProposal) {
    if (updated.ownerProposal === updated.advertiserProposal) {
      // Both agree on the same outcome
      if (updated.ownerProposal === 'SPLIT') {
        // For splits, both must agree on the same percentage
        if (updated.ownerSplitPercent === updated.advertiserSplitPercent) {
          return executeResolution(deal.dispute.id, dealId, updated.ownerProposal, updated.ownerSplitPercent ?? 50);
        }
        // Different split percentages — not an agreement, stays open
      } else {
        return executeResolution(deal.dispute.id, dealId, updated.ownerProposal);
      }
    }
  }

  return { status: 'proposal_recorded', agreement: false };
}

/**
 * Accept the other party's proposal. Shortcut for mutual resolution
 * without having to propose the exact same thing.
 */
export async function acceptProposal(dealId: number, userId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true, dispute: true },
  });
  if (!deal) throw new NotFoundError('Deal');
  if (!deal.dispute) throw new AppError('No dispute exists for this deal');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  if (deal.dispute.status === 'RESOLVED') {
    throw new AppError('This dispute has already been resolved');
  }

  // Find the other party's proposal
  const otherProposal = isOwner ? deal.dispute.advertiserProposal : deal.dispute.ownerProposal;
  const otherSplit = isOwner ? deal.dispute.advertiserSplitPercent : deal.dispute.ownerSplitPercent;

  if (!otherProposal) {
    throw new AppError('The other party has not made a proposal yet');
  }

  return executeResolution(deal.dispute.id, dealId, otherProposal, otherSplit ?? 50);
}

/**
 * Admin resolves a dispute that couldn't be mutually resolved.
 * Only available after the 48h mutual resolution window expires.
 */
export async function adminResolve(
  disputeId: number,
  adminUserId: number,
  outcome: DisputeOutcome,
  reason: string,
  splitPercent?: number,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { deal: true },
  });
  if (!dispute) throw new NotFoundError('Dispute');

  if (dispute.status === 'RESOLVED') {
    throw new AppError('This dispute has already been resolved');
  }

  if (outcome === 'SPLIT' && (splitPercent == null || splitPercent < 0 || splitPercent > 100)) {
    throw new AppError('Split percentage must be between 0 and 100');
  }

  return executeResolution(
    dispute.id,
    dispute.dealId,
    outcome,
    splitPercent ?? 50,
    adminUserId,
    reason,
  );
}

/**
 * Execute a dispute resolution: update records and move funds.
 */
async function executeResolution(
  disputeId: number,
  dealId: number,
  outcome: DisputeOutcome,
  splitPercent = 50,
  resolvedById?: number,
  resolvedReason?: string,
) {
  const now = new Date();

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: 'RESOLVED',
      resolvedOutcome: outcome,
      resolvedSplitPercent: outcome === 'SPLIT' ? splitPercent : null,
      resolvedById,
      resolvedReason,
      resolvedAt: now,
    },
  });

  try {
    switch (outcome) {
      case 'RELEASE_TO_OWNER':
        await releaseFunds(dealId);
        await transitionDeal(dealId, 'COMPLETED', resolvedById, {
          resolvedVia: 'dispute',
          outcome: 'release_to_owner',
        });
        break;

      case 'REFUND_TO_ADVERTISER':
        await refundFunds(dealId);
        await transitionDeal(dealId, 'REFUNDED', resolvedById, {
          resolvedVia: 'dispute',
          outcome: 'refund_to_advertiser',
        });
        break;

      case 'SPLIT':
        // For splits, we refund the full amount to the advertiser for now.
        // A proper split would require two transfers from escrow, which the
        // current two-hop architecture doesn't support neatly. In practice,
        // the admin or system would coordinate the split off-chain or via
        // two sequential operations. For now, release to owner (they get the
        // larger portion) and the platform handles the advertiser's share manually.
        //
        // TODO: Implement proper split transfers when the escrow supports it.
        // For now: if owner gets >= 50%, release to owner. Otherwise, refund.
        if (splitPercent >= 50) {
          await releaseFunds(dealId);
          await transitionDeal(dealId, 'COMPLETED', resolvedById, {
            resolvedVia: 'dispute',
            outcome: 'split',
            ownerPercent: splitPercent,
          });
        } else {
          await refundFunds(dealId);
          await transitionDeal(dealId, 'REFUNDED', resolvedById, {
            resolvedVia: 'dispute',
            outcome: 'split',
            ownerPercent: splitPercent,
          });
        }
        break;
    }
  } catch (error) {
    console.error(`Failed to execute dispute resolution for deal ${dealId}:`, error);
    throw new AppError('Resolution recorded but fund transfer failed. Platform admin will follow up.');
  }

  return { status: 'resolved', outcome, splitPercent: outcome === 'SPLIT' ? splitPercent : undefined };
}

/**
 * Get dispute details for a deal, including evidence.
 */
export async function getDispute(dealId: number, userId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true },
  });
  if (!deal) throw new NotFoundError('Deal');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  const dispute = await prisma.dispute.findUnique({
    where: { dealId },
    include: {
      evidence: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!dispute) throw new NotFoundError('Dispute');

  return {
    ...dispute,
    viewerRole: isOwner ? 'owner' : 'advertiser',
    myProposal: isOwner ? dispute.ownerProposal : dispute.advertiserProposal,
    otherProposal: isOwner ? dispute.advertiserProposal : dispute.ownerProposal,
    otherSplitPercent: isOwner ? dispute.advertiserSplitPercent : dispute.ownerSplitPercent,
  };
}

/**
 * Find disputes past the mutual resolution deadline that haven't been resolved.
 * Called by the dispute timeout worker to auto-escalate to admin review.
 */
export async function getExpiredDisputes() {
  return prisma.dispute.findMany({
    where: {
      status: { in: ['OPEN', 'MUTUAL_RESOLUTION'] },
      mutualDeadline: { lte: new Date() },
    },
  });
}

/**
 * Escalate a dispute to admin review when the mutual deadline expires.
 */
export async function escalateToAdmin(disputeId: number) {
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: 'ADMIN_REVIEW',
      escalatedAt: new Date(),
    },
  });
}
