import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult, PostMetrics } from './types.js';

/**
 * Twitter/X adapter with post verification via publish.twitter.com oEmbed.
 * No API key required for basic existence checks.
 *
 * Limitations:
 * - No automated posting (creators post manually)
 * - Channel info requires Twitter API v2 (OAuth)
 * - Metrics not available via oEmbed (only existence)
 * - X may rate-limit oEmbed requests
 */
export class TwitterAdapter implements IPlatformAdapter {
  readonly platform = Platform.TWITTER;

  async fetchChannelInfo(_platformChannelId: string): Promise<PlatformChannelInfo> {
    // Twitter API v2 requires OAuth — return minimal info for manual registration
    return {
      title: _platformChannelId,
      subscribers: 0,
    };
  }

  async canPost(_platformChannelId: string): Promise<boolean> {
    return false;
  }

  async publishPost(
    _platformChannelId: string,
    _text: string,
    _mediaUrl?: string,
    _mediaType?: string,
  ): Promise<PostResult> {
    throw new Error('Twitter/X does not support automated posting. Post your tweet and submit the URL.');
  }

  async verifyPostExists(_platformChannelId: string, platformPostId: string): Promise<boolean> {
    try {
      // Use Twitter's public oEmbed endpoint — works without API keys
      const tweetUrl = `https://twitter.com/i/status/${platformPostId}`;
      const res = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchPostMetrics(_platformChannelId: string, platformPostId: string): Promise<PostMetrics> {
    try {
      const tweetUrl = `https://twitter.com/i/status/${platformPostId}`;
      const res = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}`,
        { signal: AbortSignal.timeout(10_000) },
      );

      if (!res.ok) return { exists: false };

      // Twitter oEmbed only confirms existence — no engagement metrics
      return {
        exists: true,
        views: undefined,
        likes: undefined,
        comments: undefined,
      };
    } catch {
      return { exists: false };
    }
  }

  parsePostUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      // https://twitter.com/username/status/1234567890
      // https://x.com/username/status/1234567890
      if (parsed.hostname.includes('twitter.com') || parsed.hostname.includes('x.com')) {
        const statusMatch = parsed.pathname.match(/\/status\/(\d+)/);
        if (statusMatch) return statusMatch[1];
      }

      return null;
    } catch {
      return null;
    }
  }

  getPostUrl(platformChannelId: string, platformPostId: string): string {
    return `https://x.com/${platformChannelId}/status/${platformPostId}`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    if (username) return `https://x.com/${username}`;
    return `https://x.com/i/user/${platformChannelId}`;
  }
}
