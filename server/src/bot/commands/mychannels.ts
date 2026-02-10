import { Context, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { config } from '../../config.js';

const prisma = new PrismaClient();

export async function myChannelsCommand(ctx: Context) {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });
  if (!user) {
    return ctx.reply('Please /start first to set up your account.');
  }

  const channels = await prisma.channel.findMany({
    where: { ownerId: user.id },
    include: {
      adFormats: { where: { isActive: true } },
      _count: { select: { deals: true } },
    },
  });

  if (channels.length === 0) {
    return ctx.reply(
      'You have no registered channels.\n\nUse /addchannel to register your first channel.',
    );
  }

  let text = 'Your channels:\n\n';
  for (const ch of channels) {
    const formatsCount = ch.adFormats.length;
    const botStatus = ch.botIsAdmin ? 'Bot is admin' : 'Bot not admin';
    text += `${ch.title}${ch.username ? ` (@${ch.username})` : ''}\n`;
    text += `  Subscribers: ${ch.subscribers.toLocaleString()}\n`;
    text += `  Ad formats: ${formatsCount} | Deals: ${ch._count.deals}\n`;
    text += `  ${botStatus}\n\n`;
  }

  const keyboard = new InlineKeyboard()
    .webApp('Manage in App', config.MINI_APP_URL);

  await ctx.reply(text, { reply_markup: keyboard });
}
