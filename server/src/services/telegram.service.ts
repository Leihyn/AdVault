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
    // Try to forward message to self and delete it — a workaround
    // since Telegram doesn't have a direct "check message exists" API.
    // If the message was deleted, this will throw.
    const me = await bot.api.getMe();
    const copied = await bot.api.copyMessage(me.id, Number(chatId), messageId);
    await bot.api.deleteMessage(me.id, copied.message_id);
    return true;
  } catch {
    return false;
  }
}
