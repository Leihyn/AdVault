import { Context } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { Bot } from 'grammy';

const prisma = new PrismaClient();

/**
 * Handles the /addchannel command — a simple step-by-step flow
 * using a state map to track which step each user is on.
 *
 * Flow:
 * 1. User sends /addchannel
 * 2. Bot asks for channel username
 * 3. User sends @username
 * 4. Bot checks admin status, fetches stats, registers channel
 */

const userStates = new Map<number, { step: string; data: Record<string, any> }>();

export function isInAddChannelFlow(userId: number): boolean {
  return userStates.has(userId);
}

export async function startAddChannel(ctx: Context) {
  if (!ctx.from) return;
  userStates.set(ctx.from.id, { step: 'awaiting_username', data: {} });
  await ctx.reply(
    'Let\'s register your channel.\n\n' +
    'Send me the channel username (e.g. @yourchannel).\n\n' +
    'Make sure the bot is added as an admin to the channel first.',
  );
}

export async function handleAddChannelMessage(ctx: Context, bot: Bot) {
  if (!ctx.from || !ctx.message?.text) return;

  const state = userStates.get(ctx.from.id);
  if (!state) return;

  if (state.step === 'awaiting_username') {
    let username = ctx.message.text.trim();
    if (username.startsWith('@')) username = username.slice(1);

    await ctx.reply(`Looking up @${username}...`);

    try {
      // Resolve the channel
      const chat = await bot.api.getChat(`@${username}`);
      if (chat.type !== 'channel' && chat.type !== 'supergroup') {
        await ctx.reply('That doesn\'t look like a channel. Please send a channel username.');
        return;
      }

      // Check if bot is admin
      const me = await bot.api.getMe();
      const botMember = await bot.api.getChatMember(chat.id, me.id);
      const botIsAdmin = botMember.status === 'administrator' || botMember.status === 'creator';

      // Check if user is admin
      const userMember = await bot.api.getChatMember(chat.id, ctx.from.id);
      const userIsAdmin = userMember.status === 'administrator' || userMember.status === 'creator';

      if (!userIsAdmin) {
        userStates.delete(ctx.from.id);
        await ctx.reply('You need to be an admin of this channel to register it.');
        return;
      }

      // Get member count
      const memberCount = await bot.api.getChatMemberCount(chat.id);

      // Get user from DB
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(ctx.from.id) },
      });
      if (!user) {
        userStates.delete(ctx.from.id);
        await ctx.reply('Please /start first.');
        return;
      }

      // Check for duplicate
      const existing = await prisma.channel.findUnique({
        where: { telegramChatId: BigInt(chat.id) },
      });
      if (existing) {
        userStates.delete(ctx.from.id);
        await ctx.reply('This channel is already registered.');
        return;
      }

      // Register the channel
      const title = 'title' in chat ? chat.title || '' : '';
      const description = 'description' in chat ? chat.description : undefined;

      const channel = await prisma.channel.create({
        data: {
          telegramChatId: BigInt(chat.id),
          ownerId: user.id,
          title,
          description: description || undefined,
          username: username,
          subscribers: memberCount,
          botIsAdmin,
          isVerified: botIsAdmin,
          statsUpdatedAt: new Date(),
        },
      });

      // Update user role if needed
      if (user.role === 'ADVERTISER') {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'BOTH' },
        });
      }

      userStates.delete(ctx.from.id);

      let text = `Channel registered!\n\n`;
      text += `${title}${username ? ` (@${username})` : ''}\n`;
      text += `Subscribers: ${memberCount.toLocaleString()}\n`;
      text += `Bot admin: ${botIsAdmin ? 'Yes' : 'No'}\n\n`;

      if (!botIsAdmin) {
        text += `The bot is not an admin yet. Add the bot as an admin to enable auto-posting.\n\n`;
      }

      text += `Next: set your ad formats and pricing in the Mini App.`;
      await ctx.reply(text);
    } catch (error: any) {
      userStates.delete(ctx.from.id);
      if (error.description?.includes('chat not found')) {
        await ctx.reply('Channel not found. Make sure the username is correct and the channel is public.');
      } else {
        console.error('addChannel error:', error);
        await ctx.reply('Something went wrong. Please try again.');
      }
    }
  }
}
