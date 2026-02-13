import { Bot } from 'grammy';
import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult, PostMetrics } from './types.js';
import {
  fetchChannelStats,
  fetchDetailedChannelStats,
  checkBotIsAdmin,
  checkUserIsAdmin,
  sendChannelMessage,
  verifyMessageExists,
  fetchTelegramChannelAdmins,
} from '../services/telegram.service.js';

export class TelegramAdapter implements IPlatformAdapter {
  readonly platform = Platform.TELEGRAM;

  constructor(private bot: Bot) {}

  async fetchChannelInfo(platformChannelId: string): Promise<PlatformChannelInfo> {
    const chatId = BigInt(platformChannelId);
    const stats = await fetchDetailedChannelStats(this.bot, chatId);
    return {
      title: stats.title,
      username: stats.username,
      subscribers: stats.subscribers,
      description: stats.description,
      avgViews: stats.avgViews,
      avgReach: stats.avgReach,
      languages: stats.languages,
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

  async fetchPostMetrics(platformChannelId: string, platformPostId: string): Promise<PostMetrics> {
    // Telegram Bot API cannot fetch view/like counts — only existence
    const exists = await this.verifyPostExists(platformChannelId, platformPostId);
    return { exists };
  }

  parsePostUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('t.me')) return null;

      // t.me/channel/123 or t.me/c/123456/789
      const parts = parsed.pathname.split('/').filter(Boolean);

      if (parts[0] === 'c' && parts.length >= 3) {
        // Private channel: t.me/c/<channel_id>/<message_id>
        return parts[2];
      }

      if (parts.length >= 2) {
        // Public channel: t.me/<username>/<message_id>
        const msgId = parts[parts.length - 1];
        if (/^\d+$/.test(msgId)) return msgId;
      }

      return null;
    } catch {
      return null;
    }
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

  async verifyUserAdmin(platformChannelId: string, platformUserId: string): Promise<boolean> {
    const chatId = BigInt(platformChannelId);
    return checkUserIsAdmin(this.bot, chatId, Number(platformUserId));
  }

  async fetchAdmins(platformChannelId: string) {
    const chatId = BigInt(platformChannelId);
    return fetchTelegramChannelAdmins(this.bot, chatId);
  }
}
