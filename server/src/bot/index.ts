import { Bot, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import { ensureUser } from './middleware/auth.js';
import { startCommand, handleRoleSelection } from './commands/start.js';
import { myChannelsCommand } from './commands/mychannels.js';
import { myDealsCommand } from './commands/mydeals.js';
import {
  startAddChannel,
  handleAddChannelMessage,
  isInAddChannelFlow,
} from './conversations/addChannel.js';
import {
  startCreateCampaign,
  handleCreateCampaignMessage,
  isInCreateCampaignFlow,
} from './conversations/createCampaign.js';
import { handleDealMessage } from './conversations/dealChat.js';
import { notifyPostEdited } from '../services/notification.service.js';

const prisma = new PrismaClient();

export function createBot(): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  // Middleware: ensure every user exists in DB
  bot.use(ensureUser);

  // Commands
  bot.command('start', startCommand);
  bot.command('mychannels', myChannelsCommand);
  bot.command('mydeals', myDealsCommand);
  bot.command('addchannel', startAddChannel);
  bot.command('createcampaign', startCreateCampaign);
  bot.command('msg', (ctx) => handleDealMessage(ctx, bot));
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Available commands:\n\n' +
      '/start — Set up your account\n' +
      '/addchannel — Register a channel\n' +
      '/createcampaign — Create an ad campaign\n' +
      '/mychannels — View your channels\n' +
      '/mydeals — View active deals\n' +
      '/msg <deal_id> <message> — Message about a deal\n' +
      '/help — Show this help',
    );
  });

  // Callback queries (inline button clicks)
  bot.callbackQuery(/^role_/, handleRoleSelection);

  // Text messages — route to active conversation flows
  bot.on('message:text', async (ctx) => {
    if (!ctx.from) return;

    // Check if user is in a conversation flow
    if (isInAddChannelFlow(ctx.from.id)) {
      return handleAddChannelMessage(ctx, bot);
    }
    if (isInCreateCampaignFlow(ctx.from.id)) {
      return handleCreateCampaignMessage(ctx);
    }

    // If message starts with /msg, handle as deal chat
    if (ctx.message.text.startsWith('/msg')) {
      return handleDealMessage(ctx, bot);
    }
  });

  // Detect edited channel posts for active deals
  bot.on('edited_channel_post', async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const messageId = ctx.editedChannelPost.message_id;

      // Find any active deal with this channel + message ID in TRACKING status
      const deal = await prisma.deal.findFirst({
        where: {
          status: 'TRACKING',
          postedMessageId: String(messageId),
          channel: {
            OR: [
              { telegramChatId: BigInt(chatId) },
              { platformChannelId: String(chatId) },
            ],
          },
        },
      });

      if (deal) {
        console.warn(`Deal ${deal.id}: tracked post (msg ${messageId}) was edited in chat ${chatId}`);
        await notifyPostEdited(bot, deal.id);
      }
    } catch (error) {
      console.error('Error handling edited_channel_post:', error);
    }
  });

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
