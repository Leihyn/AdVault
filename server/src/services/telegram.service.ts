import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fetches channel info and stats from Telegram.
 * Updates the channel record in the database.
 */
export async function fetchChannelStats(bot: Bot, chatId: bigint) {
  try {
    const chat = await bot.api.getChat(Number(chatId));
    if (chat.type !== 'channel' && chat.type !== 'supergroup') {
      throw new Error('Not a channel or supergroup');
    }

    const memberCount = await bot.api.getChatMemberCount(Number(chatId));

    return {
      title: chat.title || '',
      username: 'username' in chat ? chat.username : undefined,
      subscribers: memberCount,
      description: 'description' in chat ? chat.description : undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch stats for chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Checks if the bot is an admin in the given channel.
 */
export async function checkBotIsAdmin(bot: Bot, chatId: bigint): Promise<boolean> {
  try {
    const me = await bot.api.getMe();
    const member = await bot.api.getChatMember(Number(chatId), me.id);
    return member.status === 'administrator' || member.status === 'creator';
  } catch {
    return false;
  }
}

/**
 * Checks if a specific user is still an admin/creator of the channel.
 */
export async function checkUserIsAdmin(bot: Bot, chatId: bigint, userId: number): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(Number(chatId), userId);
    return member.status === 'administrator' || member.status === 'creator';
  } catch {
    return false;
  }
}

/**
 * Fetches detailed channel statistics using getChatStatistics (requires bot admin + 50+ members).
 * Falls back to basic stats for smaller channels.
 */
export async function fetchDetailedChannelStats(bot: Bot, chatId: bigint) {
  const basicStats = await fetchChannelStats(bot, chatId);

  let avgViews = 0;
  let avgReach = 0;
  let languages: Array<{ language: string; percentage: number }> = [];

  try {
    // getChatStatistics requires bot admin in the channel and channel with 50+ members
    const stats = await (bot.api as any).raw.getChannelStatistics({ chat_id: Number(chatId), is_dark: false });

    if (stats?.recent_message_interactions?.length) {
      const interactions = stats.recent_message_interactions;
      const totalViews = interactions.reduce((sum: number, m: any) => sum + (m.view_count || 0), 0);
      const totalForwards = interactions.reduce((sum: number, m: any) => sum + (m.forward_count || 0), 0);
      avgViews = Math.round(totalViews / interactions.length);
      avgReach = Math.round((totalViews + totalForwards) / interactions.length);
    }

    if (stats?.languages_graph?.data) {
      const langData = stats.languages_graph.data;
      if (Array.isArray(langData)) {
        languages = langData
          .filter((d: any) => d.name && d.percentage != null)
          .map((d: any) => ({ language: d.name, percentage: Number(d.percentage) }));
      }
    }
  } catch {
    // getChatStatistics not available for this channel — use basic stats only
  }

  return {
    ...basicStats,
    avgViews,
    avgReach,
    languages,
  };
}

/**
 * Fetches all administrators of a channel.
 */
export async function fetchTelegramChannelAdmins(bot: Bot, chatId: bigint) {
  const admins = await bot.api.getChatAdministrators(Number(chatId));
  return admins.map((admin) => ({
    platformUserId: String(admin.user.id),
    username: admin.user.username,
    firstName: admin.user.first_name,
    isCreator: admin.status === 'creator',
    canPostMessages: admin.status === 'creator' || ('can_post_messages' in admin && admin.can_post_messages === true),
  }));
}

/**
 * Sends a message to a channel. Used for auto-posting ads.
 */
export async function sendChannelMessage(
  bot: Bot,
  chatId: bigint,
  text: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<number> {
  let messageId: number;

  if (mediaUrl && mediaType === 'photo') {
    const msg = await bot.api.sendPhoto(Number(chatId), mediaUrl, { caption: text });
    messageId = msg.message_id;
  } else if (mediaUrl && mediaType === 'video') {
    const msg = await bot.api.sendVideo(Number(chatId), mediaUrl, { caption: text });
    messageId = msg.message_id;
  } else {
    const msg = await bot.api.sendMessage(Number(chatId), text);
    messageId = msg.message_id;
  }

  return messageId;
}

/**
 * Checks if a message still exists in a channel (not deleted).
 */
export async function verifyMessageExists(
  bot: Bot,
  chatId: bigint,
  messageId: number,
): Promise<boolean> {
  try {
    // Copy the message back into the same channel silently, then delete the copy.
    // If the original was deleted, copyMessage throws — meaning the post is gone.
    const copied = await bot.api.copyMessage(
      Number(chatId), Number(chatId), messageId,
      { disable_notification: true },
    );
    await bot.api.deleteMessage(Number(chatId), copied.message_id);
    return true;
  } catch {
    return false;
  }
}
