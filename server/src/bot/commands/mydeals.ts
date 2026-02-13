import { Context, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { config } from '../../config.js';

const prisma = new PrismaClient();

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting Payment',
  FUNDED: 'Funded',
  CREATIVE_PENDING: 'Awaiting Creative',
  CREATIVE_SUBMITTED: 'Creative Under Review',
  CREATIVE_REVISION: 'Revision Requested',
  CREATIVE_APPROVED: 'Creative Approved',
  POSTED: 'Posted',
  TRACKING: 'Tracking Metrics',
  VERIFIED: 'Verified',
  COMPLETED: 'Completed',
  FAILED: 'Requirements Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  DISPUTED: 'Disputed',
  TIMED_OUT: 'Timed Out',
};

export async function myDealsCommand(ctx: Context) {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });
  if (!user) {
    return ctx.reply('Please /start first to set up your account.');
  }

  const deals = await prisma.deal.findMany({
    where: {
      OR: [
        { advertiserId: user.id },
        { channel: { ownerId: user.id } },
      ],
      status: {
        notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'],
      },
    },
    include: {
      channel: { select: { title: true, username: true } },
      adFormat: { select: { label: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  if (deals.length === 0) {
    return ctx.reply('You have no active deals.\n\nBrowse channels or campaigns in the Mini App to get started.');
  }

  let text = 'Your active deals:\n\n';
  for (const deal of deals) {
    const role = deal.advertiserId === user.id ? 'Advertiser' : 'Owner';
    text += `#${deal.id} — ${deal.channel.title}\n`;
    text += `  Format: ${deal.adFormat.label} | ${deal.amountTon} TON\n`;
    text += `  Status: ${STATUS_LABELS[deal.status] || deal.status}\n`;
    text += `  Your role: ${role}\n\n`;
  }

  const keyboard = new InlineKeyboard()
    .webApp('View Details', config.MINI_APP_URL);

  await ctx.reply(text, { reply_markup: keyboard });
}
