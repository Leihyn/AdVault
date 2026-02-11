import { PrismaClient, DealStatus, Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { generateAlias } from '../utils/privacy.js';
import { toDecimal } from '../utils/decimal.js';

const prisma = new PrismaClient();

/** Valid state transitions for the deal state machine */
const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  PENDING_PAYMENT: ['FUNDED', 'CANCELLED', 'TIMED_OUT'],
  FUNDED: ['CREATIVE_PENDING', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_PENDING: ['CREATIVE_SUBMITTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_SUBMITTED: ['CREATIVE_APPROVED', 'CREATIVE_REVISION', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_REVISION: ['CREATIVE_SUBMITTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_APPROVED: ['SCHEDULED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  SCHEDULED: ['POSTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  POSTED: ['VERIFIED', 'DISPUTED', 'TIMED_OUT'],
  VERIFIED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
  DISPUTED: ['REFUNDED', 'COMPLETED'],
  TIMED_OUT: ['REFUNDED'],
};

/** Timeout durations in hours for each status */
const STATUS_TIMEOUTS: Partial<Record<DealStatus, number>> = {
  PENDING_PAYMENT: 24,
  FUNDED: 72,
  CREATIVE_PENDING: 72,
  CREATIVE_SUBMITTED: 96,
  CREATIVE_REVISION: 72,
};

export async function createDeal(data: {
  channelId: number;
  advertiserId: number;
  adFormatId: number;
  campaignId?: number;
  amountTon: number;
  escrowAddress?: string;
  escrowMnemonicEncrypted?: string;
}) {
  const timeoutAt = new Date();
  timeoutAt.setHours(timeoutAt.getHours() + (STATUS_TIMEOUTS.PENDING_PAYMENT || 24));

  const deal = await prisma.deal.create({
    data: {
      channelId: data.channelId,
      advertiserId: data.advertiserId,
      adFormatId: data.adFormatId,
      campaignId: data.campaignId,
      amountTon: toDecimal(data.amountTon),
      escrowAddress: data.escrowAddress,
      escrowMnemonicEncrypted: data.escrowMnemonicEncrypted,
      ownerAlias: generateAlias('Seller'),
      advertiserAlias: generateAlias('Buyer'),
      status: 'PENDING_PAYMENT',
      timeoutAt,
    },
  });

  await createDealEvent(deal.id, 'DEAL_CREATED', null, 'PENDING_PAYMENT', data.advertiserId);
  return deal;
}

export async function getDeal(id: number, requestingUserId?: number) {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      channel: { select: { id: true, title: true, username: true, telegramChatId: true, platform: true, platformChannelId: true, ownerId: true } },
      advertiser: { select: { id: true, username: true, firstName: true, tonWalletAddress: true } },
      adFormat: true,
      campaign: { select: { id: true, title: true } },
      creatives: { orderBy: { version: 'desc' } },
      transactions: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!deal) throw new NotFoundError('Deal');

  // Verify the requesting user is a party to the deal
  if (requestingUserId) {
    const isAdvertiser = deal.advertiserId === requestingUserId;
    const isOwner = deal.channel.ownerId === requestingUserId;

    if (!isAdvertiser && !isOwner) {
      throw new ForbiddenError('Not a party to this deal');
    }

    if (isAdvertiser && !isOwner) {
      // Advertiser sees owner as alias, strip owner's real identity
      (deal as any).channel = {
        id: deal.channel.id,
        title: deal.channel.title,
        username: deal.channel.username,
      };
      (deal as any).ownerLabel = deal.ownerAlias;
      (deal as any).advertiserLabel = 'You';
    } else if (isOwner && !isAdvertiser) {
      // Owner sees advertiser as alias, strip advertiser's real identity
      (deal as any).advertiser = {
        id: 0,
        username: deal.advertiserAlias,
        firstName: deal.advertiserAlias,
        tonWalletAddress: null,
      };
      (deal as any).ownerLabel = 'You';
      (deal as any).advertiserLabel = deal.advertiserAlias;
    }
  }

  return deal;
}

export async function getUserDeals(userId: number, role?: 'owner' | 'advertiser') {
  const where: any = {};

  if (role === 'advertiser') {
    where.advertiserId = userId;
  } else if (role === 'owner') {
    where.channel = { ownerId: userId };
  } else {
    where.OR = [{ advertiserId: userId }, { channel: { ownerId: userId } }];
  }

  return prisma.deal.findMany({
    where,
    include: {
      channel: { select: { id: true, title: true, username: true } },
      advertiser: { select: { id: true, username: true, firstName: true } },
      adFormat: { select: { formatType: true, label: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Atomically transitions a deal's status using row-level locking.
 * Uses a Prisma interactive transaction with SELECT ... FOR UPDATE
 * to prevent concurrent workers from racing on the same deal.
 */
export async function transitionDeal(
  dealId: number,
  newStatus: DealStatus,
  actorId?: number,
  metadata?: Record<string, any>,
) {
  return prisma.$transaction(async (tx) => {
    // Row-level lock: prevents concurrent transitions on the same deal
    const [deal] = await tx.$queryRaw<Array<{ id: number; status: string }>>`
      SELECT id, status FROM deals WHERE id = ${dealId} FOR UPDATE
    `;
    if (!deal) throw new NotFoundError('Deal');

    const currentStatus = deal.status as DealStatus;
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Calculate new timeout if applicable
    const timeoutHours = STATUS_TIMEOUTS[newStatus];
    const timeoutAt = timeoutHours
      ? new Date(Date.now() + timeoutHours * 60 * 60 * 1000)
      : null;

    // Track when deal reaches a terminal state (for auto-purge scheduling)
    const terminalStatuses: DealStatus[] = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'];
    const completedAt = terminalStatuses.includes(newStatus) ? new Date() : undefined;

    const updated = await tx.deal.update({
      where: { id: dealId },
      data: {
        status: newStatus,
        timeoutAt,
        ...(completedAt && { completedAt }),
      },
    });

    await tx.dealEvent.create({
      data: {
        dealId,
        eventType: `STATUS_${newStatus}`,
        oldStatus: currentStatus,
        newStatus,
        actorId: actorId || null,
        metadata: metadata || undefined,
      },
    });

    return updated;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

export async function cancelDeal(dealId: number, userId: number) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true },
  });
  if (!deal) throw new NotFoundError('Deal');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  return transitionDeal(dealId, 'CANCELLED', userId, {
    cancelledBy: isAdvertiser ? 'advertiser' : 'owner',
  });
}

export async function disputeDeal(dealId: number, userId: number, reason: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true },
  });
  if (!deal) throw new NotFoundError('Deal');

  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  return transitionDeal(dealId, 'DISPUTED', userId, {
    disputedBy: isAdvertiser ? 'advertiser' : 'owner',
    reason,
  });
}

export async function setScheduledPostTime(dealId: number, userId: number, scheduledAt: Date) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true },
  });
  if (!deal) throw new NotFoundError('Deal');

  // Either party can set the schedule
  const isAdvertiser = deal.advertiserId === userId;
  const isOwner = deal.channel.ownerId === userId;
  if (!isAdvertiser && !isOwner) throw new ForbiddenError('Not a party to this deal');

  if (deal.status !== 'CREATIVE_APPROVED') {
    throw new AppError('Creative must be approved before scheduling');
  }

  await prisma.deal.update({
    where: { id: dealId },
    data: { scheduledPostAt: scheduledAt },
  });

  return transitionDeal(dealId, 'SCHEDULED', userId, {
    scheduledAt: scheduledAt.toISOString(),
  });
}

export async function getTimedOutDeals() {
  return prisma.deal.findMany({
    where: {
      timeoutAt: { lte: new Date() },
      status: {
        notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'],
      },
    },
    include: {
      channel: { select: { ownerId: true } },
    },
  });
}

export async function getScheduledDeals() {
  return prisma.deal.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledPostAt: { lte: new Date() },
    },
    include: {
      channel: true,
      creatives: {
        where: { status: 'APPROVED' },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });
}

export async function getPostedDeals() {
  return prisma.deal.findMany({
    where: {
      status: 'POSTED',
      postedMessageId: { not: null },
    },
    include: {
      channel: true,
    },
  });
}

/** Get deal receipt (proof of completion after purge) */
export async function getDealReceipt(dealId: number) {
  const receipt = await prisma.dealReceipt.findUnique({
    where: { dealId },
  });
  if (!receipt) {
    return { purged: false, message: 'Deal data still available or deal not found' };
  }
  return { purged: true, receipt };
}

async function createDealEvent(
  dealId: number,
  eventType: string,
  oldStatus: string | null,
  newStatus: string,
  actorId: number | null,
  metadata?: Record<string, any>,
) {
  return prisma.dealEvent.create({
    data: {
      dealId,
      eventType,
      oldStatus,
      newStatus,
      actorId,
      metadata: metadata || undefined,
    },
  });
}
