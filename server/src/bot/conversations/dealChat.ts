import { Context, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { Bot } from 'grammy';

const prisma = new PrismaClient();

/**
 * Routes deal-related messages through the bot.
 * Users can message each other about a deal by replying to deal notifications.
 *
 * Format: /msg <dealId> <message>
 */
export async function handleDealMessage(ctx: Context, bot: Bot) {
  if (!ctx.from || !ctx.message?.text) return;

  const match = ctx.message.text.match(/^\/msg\s+(\d+)\s+(.+)/s);
  if (!match) {
    await ctx.reply('Usage: /msg <deal_id> <your message>');
    return;
  }

  const dealId = parseInt(match[1], 10);
  const messageText = match[2];

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });
  if (!user) {
    await ctx.reply('Please /start first.');
    return;
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      channel: { include: { owner: true } },
      advertiser: true,
    },
  });

  if (!deal) {
    await ctx.reply('Deal not found.');
    return;
  }

  const isAdvertiser = deal.advertiserId === user.id;
  const isOwner = deal.channel.ownerId === user.id;
  if (!isAdvertiser && !isOwner) {
    await ctx.reply('You\'re not a party to this deal.');
    return;
  }

  // Send to the other party
  const recipientTelegramId = isAdvertiser
    ? deal.channel.owner.telegramId
    : deal.advertiser.telegramId;

  const senderLabel = isAdvertiser ? 'Advertiser' : 'Channel Owner';
  const senderName = ctx.from.first_name || ctx.from.username || 'User';

  const keyboard = new InlineKeyboard()
    .text('Reply', `reply_deal_${dealId}`);

  try {
    await bot.api.sendMessage(
      Number(recipientTelegramId),
      `Deal #${dealId} — Message from ${senderLabel} (${senderName}):\n\n${messageText}`,
      { reply_markup: keyboard },
    );
    await ctx.reply('Message sent.');
  } catch (error) {
    console.error('Failed to send deal message:', error);
    await ctx.reply('Failed to deliver the message. The other party may have blocked the bot.');
  }
}
