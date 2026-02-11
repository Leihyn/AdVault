import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult } from './types.js';

const COMING_SOON = 'Instagram integration coming soon';

export class InstagramAdapter implements IPlatformAdapter {
  readonly platform = Platform.INSTAGRAM;

  async fetchChannelInfo(_platformChannelId: string): Promise<PlatformChannelInfo> {
    throw new Error(COMING_SOON);
  }

  async canPost(_platformChannelId: string): Promise<boolean> {
    throw new Error(COMING_SOON);
  }

  async publishPost(
    _platformChannelId: string,
    _text: string,
    _mediaUrl?: string,
    _mediaType?: string,
  ): Promise<PostResult> {
    throw new Error(COMING_SOON);
  }

  async verifyPostExists(_platformChannelId: string, _platformPostId: string): Promise<boolean> {
    throw new Error(COMING_SOON);
  }

  getPostUrl(platformChannelId: string, platformPostId: string): string {
    return `https://www.instagram.com/p/${platformPostId}`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    if (username) return `https://www.instagram.com/${username}`;
    return `https://www.instagram.com/${platformChannelId}`;
  }
}
