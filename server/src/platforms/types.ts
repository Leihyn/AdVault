export enum Platform {
  TELEGRAM = 'TELEGRAM',
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
  TWITTER = 'TWITTER',
  TIKTOK = 'TIKTOK',
}

export interface PlatformChannelInfo {
  title: string;
  username?: string;
  subscribers: number;
  description?: string;
  avatarUrl?: string;
  avgViews?: number;
  avgReach?: number;
  premiumPercentage?: number;
  languages?: Array<{ language: string; percentage: number }>;
}

export interface PostResult {
  platformPostId: string;
  url?: string;
}

export interface PostMetrics {
  exists: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
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

  /** Fetch post metrics (views, likes, etc.) for KPI tracking. */
  fetchPostMetrics(platformChannelId: string, platformPostId: string): Promise<PostMetrics>;

  /** Parse a post URL to extract the platform-specific post ID. Returns null if URL is not recognized. */
  parsePostUrl(url: string): string | null;

  /** Get the public URL for a specific post. */
  getPostUrl(platformChannelId: string, platformPostId: string): string;

  /** Get the public URL for the channel itself. */
  getChannelUrl(platformChannelId: string, username?: string): string;

  /** Verify a user is still an admin of the channel. Optional — not all platforms support this. */
  verifyUserAdmin?(platformChannelId: string, platformUserId: string): Promise<boolean>;

  /** Fetch all admins of a channel. Optional — not all platforms support this. */
  fetchAdmins?(platformChannelId: string): Promise<Array<{
    platformUserId: string;
    username?: string;
    firstName?: string;
    isCreator: boolean;
    canPostMessages: boolean;
  }>>;
}
