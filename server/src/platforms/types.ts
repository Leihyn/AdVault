export enum Platform {
  TELEGRAM = 'TELEGRAM',
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
  TWITTER = 'TWITTER',
}

export interface PlatformChannelInfo {
  title: string;
  username?: string;
  subscribers: number;
  description?: string;
  avatarUrl?: string;
}

export interface PostResult {
  platformPostId: string;
  url?: string;
}

export interface IPlatformAdapter {
  readonly platform: Platform;

  /** Fetch channel info (title, subscribers, etc.) from the platform API. */
  fetchChannelInfo(platformChannelId: string): Promise<PlatformChannelInfo>;

  /** Check whether the bot/integration can post to this channel. */
  canPost(platformChannelId: string): Promise<boolean>;

  /** Publish a post to the channel. Returns the platform-specific post ID. */
  publishPost(
    platformChannelId: string,
    text: string,
    mediaUrl?: string,
    mediaType?: string,
  ): Promise<PostResult>;

  /** Check if a post still exists (hasn't been deleted). */
  verifyPostExists(platformChannelId: string, platformPostId: string): Promise<boolean>;

  /** Get the public URL for a specific post. */
  getPostUrl(platformChannelId: string, platformPostId: string): string;

  /** Get the public URL for the channel itself. */
  getChannelUrl(platformChannelId: string, username?: string): string;
}
