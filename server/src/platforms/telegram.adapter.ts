import { Bot } from 'grammy';
import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult } from './types.js';
import {
  fetchChannelStats,
  checkBotIsAdmin,
  sendChannelMessage,
  verifyMessageExists,
} from '../services/telegram.service.js';

export class TelegramAdapter implements IPlatformAdapter {
  readonly platform = Platform.TELEGRAM;

  constructor(private bot: Bot) {}

  async fetchChannelInfo(platformChannelId: string): Promise<PlatformChannelInfo> {
    const chatId = BigInt(platformChannelId);
    const stats = await fetchChannelStats(this.bot, chatId);
    return {
      title: stats.title,
      username: stats.username,
      subscribers: stats.subscribers,
      description: stats.description,
    };
  }

  async canPost(platformChannelId: string): Promise<boolean> {
    const chatId = BigInt(platformChannelId);
    return checkBotIsAdmin(this.bot, chatId);
  }

  async publishPost(
    platformChannelId: string,
    text: string,
    mediaUrl?: string,
    mediaType?: string,
  ): Promise<PostResult> {
    const chatId = BigInt(platformChannelId);
    const messageId = await sendChannelMessage(this.bot, chatId, text, mediaUrl, mediaType);
    return {
      platformPostId: String(messageId),
      url: this.getPostUrl(platformChannelId, String(messageId)),
    };
  }

  async verifyPostExists(platformChannelId: string, platformPostId: string): Promise<boolean> {
    const chatId = BigInt(platformChannelId);
    const messageId = Number(platformPostId);
    return verifyMessageExists(this.bot, chatId, messageId);
  }

  getPostUrl(platformChannelId: string, platformPostId: string): string {
    // Telegram post URLs use the channel username, but we may not have it here.
    // Fall back to chat ID-based format.
    return `https://t.me/c/${platformChannelId.replace('-100', '')}/${platformPostId}`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    if (username) return `https://t.me/${username}`;
    return `https://t.me/c/${platformChannelId.replace('-100', '')}`;
  }
}
