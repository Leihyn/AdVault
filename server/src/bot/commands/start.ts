import { Context, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { config } from '../../config.js';

const prisma = new PrismaClient();

export async function startCommand(ctx: Context) {
  if (!ctx.from) return;

  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(ctx.from.id) },
    update: {
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
    },
    create: {
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
    },
  });

  const keyboard = new InlineKeyboard()
    .text('I own a channel', 'role_owner')
    .text('I want to advertise', 'role_advertiser')
    .row()
    .text('Both', 'role_both')
    .row()
    .webApp('Open Marketplace', config.MINI_APP_URL);

  await ctx.reply(
    `Welcome to AdVault, ${ctx.from.first_name}!\n\n` +
    `The safe way to buy and sell Telegram channel ads.\n\n` +
    `Escrow protects both sides: advertisers pay into a locked wallet, ` +
    `funds release only after the ad is posted and verified.\n\n` +
    `What brings you here?`,
    { reply_markup: keyboard },
  );
}

export async function handleRoleSelection(ctx: Context) {
  if (!ctx.callbackQuery?.data || !ctx.from) return;
  await ctx.answerCallbackQuery();

  const roleMap: Record<string, 'OWNER' | 'ADVERTISER' | 'BOTH'> = {
    role_owner: 'OWNER',
    role_advertiser: 'ADVERTISER',
    role_both: 'BOTH',
  };

  const role = roleMap[ctx.callbackQuery.data];
  if (!role) return;

  await prisma.user.update({
    where: { telegramId: BigInt(ctx.from.id) },
    data: { role },
  });

  const roleLabels = { OWNER: 'Channel Owner', ADVERTISER: 'Advertiser', BOTH: 'Both' };
  const nextSteps = role === 'ADVERTISER'
    ? 'Browse channels in the Mini App or create a campaign with /createcampaign.'
    : 'Register your channel with /addchannel, then set your ad formats and pricing.';

  const keyboard = new InlineKeyboard()
    .webApp('Open Marketplace', config.MINI_APP_URL);

  await ctx.editMessageText(
    `You're set up as: ${roleLabels[role]}\n\n${nextSteps}`,
    { reply_markup: keyboard },
  );
}
