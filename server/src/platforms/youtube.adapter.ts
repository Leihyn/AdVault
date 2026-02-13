import { google } from 'googleapis';
import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult, PostMetrics } from './types.js';
import { config } from '../config.js';

const youtube = google.youtube('v3');

export class YouTubeAdapter implements IPlatformAdapter {
  readonly platform = Platform.YOUTUBE;

  async fetchChannelInfo(platformChannelId: string): Promise<PlatformChannelInfo> {
    const res = await youtube.channels.list({
      key: config.YOUTUBE_API_KEY,
      part: ['snippet', 'statistics'],
      id: [platformChannelId],
    });

    const channel = res.data.items?.[0];
    if (!channel) throw new Error(`YouTube channel not found: ${platformChannelId}`);

    return {
      title: channel.snippet?.title || '',
      username: channel.snippet?.customUrl?.replace('@', ''),
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      description: channel.snippet?.description ?? undefined,
      avatarUrl: channel.snippet?.thumbnails?.default?.url ?? undefined,
    };
  }

  async canPost(_platformChannelId: string): Promise<boolean> {
    // YouTube doesn't support bot-posting; users upload manually and submit the URL
    return false;
  }

  async publishPost(
    _platformChannelId: string,
    _text: string,
    _mediaUrl?: string,
    _mediaType?: string,
  ): Promise<PostResult> {
    throw new Error(
      'YouTube does not support automated posting. Upload your video to YouTube and submit the video URL.',
    );
  }

  async verifyPostExists(_platformChannelId: string, platformPostId: string): Promise<boolean> {
    try {
      const res = await youtube.videos.list({
        key: config.YOUTUBE_API_KEY,
        part: ['id'],
        id: [platformPostId],
      });
      return (res.data.items?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  async fetchPostMetrics(_platformChannelId: string, platformPostId: string): Promise<PostMetrics> {
    try {
      const res = await youtube.videos.list({
        key: config.YOUTUBE_API_KEY,
        part: ['statistics'],
        id: [platformPostId],
      });
      const video = res.data.items?.[0];
      if (!video) return { exists: false };

      return {
        exists: true,
        views: Number(video.statistics?.viewCount || 0),
        likes: Number(video.statistics?.likeCount || 0),
        comments: Number(video.statistics?.commentCount || 0),
      };
    } catch {
      return { exists: false };
    }
  }

  parsePostUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      // youtube.com/watch?v=VIDEO_ID
      if (parsed.hostname.includes('youtube.com') && parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }

      // youtube.com/shorts/VIDEO_ID
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch && parsed.hostname.includes('youtube.com')) {
        return shortsMatch[1];
      }

      // youtu.be/VIDEO_ID
      if (parsed.hostname === 'youtu.be') {
        return parsed.pathname.slice(1) || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  getPostUrl(_platformChannelId: string, platformPostId: string): string {
    return `https://www.youtube.com/watch?v=${platformPostId}`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    if (username) return `https://www.youtube.com/@${username}`;
    return `https://www.youtube.com/channel/${platformChannelId}`;
  }

  /**
   * Parses YouTube channel URLs/inputs into a { type, value } pair.
   *
   * Supported formats:
   * - https://youtube.com/channel/UC_x5XG... → { type: 'id', value: 'UC_x5XG...' }
   * - https://youtube.com/@MrBeast → { type: 'handle', value: '@MrBeast' }
   * - https://youtube.com/c/MrBeast → { type: 'custom', value: 'MrBeast' }
   * - UC_x5XG... (bare ID) → { type: 'id', value: 'UC_x5XG...' }
   * - @MrBeast (bare handle) → { type: 'handle', value: '@MrBeast' }
   */
  parseChannelUrl(input: string): { type: 'id' | 'handle' | 'custom'; value: string } | null {
    const trimmed = input.trim();

    // Bare channel ID (starts with UC)
    if (/^UC[\w-]{22,}$/.test(trimmed)) {
      return { type: 'id', value: trimmed };
    }

    // Bare handle
    if (trimmed.startsWith('@') && trimmed.length > 1 && !trimmed.includes('/')) {
      return { type: 'handle', value: trimmed };
    }

    // Try parsing as URL
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('youtube.com') && !url.hostname.includes('youtu.be')) return null;

      // /channel/UC...
      const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]+)/);
      if (channelMatch) return { type: 'id', value: channelMatch[1] };

      // /@Handle
      const handleMatch = url.pathname.match(/^\/@([\w.-]+)/);
      if (handleMatch) return { type: 'handle', value: `@${handleMatch[1]}` };

      // /c/CustomName
      const customMatch = url.pathname.match(/^\/c\/([\w.-]+)/);
      if (customMatch) return { type: 'custom', value: customMatch[1] };

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves any channel input (URL, handle, ID) to a UC... channel ID.
   * Uses the YouTube Data API for handle/custom name resolution.
   */
  async resolveChannelId(input: string): Promise<string> {
    const parsed = this.parseChannelUrl(input);
    if (!parsed) throw new Error(`Could not parse YouTube channel input: ${input}`);

    // Already a channel ID
    if (parsed.type === 'id') return parsed.value;

    // Handle → resolve via forHandle
    if (parsed.type === 'handle') {
      const res = await youtube.channels.list({
        key: config.YOUTUBE_API_KEY,
        part: ['id'],
        forHandle: parsed.value.replace('@', ''),
      });
      const id = res.data.items?.[0]?.id;
      if (!id) throw new Error(`YouTube channel not found for handle: ${parsed.value}`);
      return id;
    }

    // Custom name → search via forUsername (legacy) then fall back to search
    const res = await youtube.channels.list({
      key: config.YOUTUBE_API_KEY,
      part: ['id'],
      forUsername: parsed.value,
    });
    const id = res.data.items?.[0]?.id;
    if (!id) throw new Error(`YouTube channel not found for custom name: ${parsed.value}`);
    return id;
  }
}
