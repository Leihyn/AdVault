import { Bot } from 'grammy';
import { PrismaClient, DealStatus } from '@prisma/client';

const prisma = new PrismaClient();

type NotifyTarget = 'owner' | 'advertiser' | 'both';

const STATUS_MESSAGES: Partial<Record<DealStatus, { message: string; target: NotifyTarget }>> = {
  FUNDED: {
    message: 'Payment received! The deal is now funded. Waiting for creative submission.',
    target: 'both',
  },
  CREATIVE_SUBMITTED: {
    message: 'A creative draft has been submitted for your review.',
    target: 'advertiser',
  },
  CREATIVE_APPROVED: {
    message: 'Creative approved! You can now schedule the post.',
    target: 'both',
  },
  CREATIVE_REVISION: {
    message: 'Revision requested on your creative. Check the notes and resubmit.',
    target: 'owner',
  },
  SCHEDULED: {
    message: 'Post has been scheduled. It will be auto-posted at the specified time.',
    target: 'both',
  },
  POSTED: {
    message: 'Ad has been posted to the channel! Verification period begins now (24h).',
    target: 'both',
  },
  VERIFIED: {
    message: 'Post verified! Funds will be released to the channel owner.',
    target: 'both',
  },
  COMPLETED: {
    message: 'Deal completed! Funds have been released.',
    target: 'both',
  },
  CANCELLED: {
    message: 'Deal has been cancelled.',
    target: 'both',
  },
  REFUNDED: {
    message: 'Funds have been refunded to the advertiser.',
    target: 'both',
  },
  DISPUTED: {
    message: 'A dispute has been raised on this deal. An admin will review.',
    target: 'both',
  },
  TIMED_OUT: {
    message: 'Deal has timed out due to inactivity.',
    target: 'both',
  },
};

/**
 * Sends a notification to deal participants when status changes.
 */
export async function notifyDealStatusChange(
  bot: Bot,
  dealId: number,
  newStatus: DealStatus,
) {
  const info = STATUS_MESSAGES[newStatus];
  if (!info) return;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      channel: { include: { owner: true } },
      advertiser: true,
    },
  });
  if (!deal) return;

  // Use pseudonymous alias in notifications — don't leak real names across parties
  const dealLabel = `Deal #${deal.id}`;
  const text = `${dealLabel}\n\n${info.message}`;

  const targets: bigint[] = [];
  if (info.target === 'owner' || info.target === 'both') {
    targets.push(deal.channel.owner.telegramId);
  }
  if (info.target === 'advertiser' || info.target === 'both') {
    targets.push(deal.advertiser.telegramId);
  }

  // Dedupe in case owner === advertiser (unlikely but possible)
  const unique = [...new Set(targets)];

  for (const telegramId of unique) {
    try {
      await bot.api.sendMessage(Number(telegramId), text);
    } catch (error) {
      console.error(`Failed to notify user ${telegramId}:`, error);
    }
  }
}

/**
 * Sends a notification about a new campaign application.
 */
export async function notifyNewApplication(
  bot: Bot,
  campaignId: number,
  channelTitle: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { advertiser: true },
  });
  if (!campaign) return;

  const text = `New application for "${campaign.title}"\n\nChannel: ${channelTitle}\n\nOpen the Mini App to review.`;

  try {
    await bot.api.sendMessage(Number(campaign.advertiser.telegramId), text);
  } catch (error) {
    console.error(`Failed to notify advertiser:`, error);
  }
}

/**
 * Sends a timeout warning before auto-cancelling a deal.
 */
export async function notifyTimeoutWarning(
  bot: Bot,
  dealId: number,
  hoursRemaining: number,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      channel: { include: { owner: true } },
      advertiser: true,
    },
  });
  if (!deal) return;

  const text = `Deal #${deal.id} (${deal.channel.title})\n\nThis deal will auto-cancel in ~${hoursRemaining}h due to inactivity. Take action to keep it alive.`;
  const targets = [deal.channel.owner.telegramId, deal.advertiser.telegramId];

  for (const telegramId of [...new Set(targets)]) {
    try {
      await bot.api.sendMessage(Number(telegramId), text);
    } catch (error) {
      console.error(`Failed to send timeout warning to ${telegramId}:`, error);
    }
  }
}
