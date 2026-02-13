import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult, PostMetrics } from './types.js';

/**
 * Instagram adapter with post verification via oEmbed API.
 * No API key required for basic existence checks.
 *
 * Limitations:
 * - No automated posting (creators upload manually)
 * - Channel info requires Instagram Graph API (OAuth)
 * - Metrics from oEmbed are limited (no views/likes)
 * - oEmbed may be rate-limited by Instagram
 */
export class InstagramAdapter implements IPlatformAdapter {
  readonly platform = Platform.INSTAGRAM;

  async fetchChannelInfo(_platformChannelId: string): Promise<PlatformChannelInfo> {
    // Instagram Graph API requires OAuth — return minimal info for manual registration
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
    throw new Error('Instagram does not support automated posting. Upload your content and submit the URL.');
  }

  async verifyPostExists(_platformChannelId: string, platformPostId: string): Promise<boolean> {
    try {
      const url = `https://www.instagram.com/p/${platformPostId}/`;
      const res = await fetch(`https://www.instagram.com/p/${platformPostId}/?__a=1&__d=dis`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });

      // If redirected to login page or 404, post doesn't exist or is private
      if (!res.ok) return false;

      // Try oEmbed as fallback — more reliable
      const oembedRes = await fetch(
        `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      return oembedRes.ok;
    } catch {
      return false;
    }
  }

  async fetchPostMetrics(_platformChannelId: string, platformPostId: string): Promise<PostMetrics> {
    try {
      const url = `https://www.instagram.com/p/${platformPostId}/`;
      const res = await fetch(
        `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(10_000) },
      );

      if (!res.ok) return { exists: false };

      // oEmbed confirms existence but doesn't return engagement metrics
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
      if (!parsed.hostname.includes('instagram.com')) return null;

      // https://www.instagram.com/p/ABC123/
      const postMatch = parsed.pathname.match(/\/p\/([A-Za-z0-9_-]+)/);
      if (postMatch) return postMatch[1];

      // https://www.instagram.com/reel/ABC123/
      const reelMatch = parsed.pathname.match(/\/reel\/([A-Za-z0-9_-]+)/);
      if (reelMatch) return reelMatch[1];

      // https://www.instagram.com/stories/username/1234567890/
      const storyMatch = parsed.pathname.match(/\/stories\/[^/]+\/(\d+)/);
      if (storyMatch) return storyMatch[1];

      return null;
    } catch {
      return null;
    }
  }

  getPostUrl(platformChannelId: string, platformPostId: string): string {
    return `https://www.instagram.com/p/${platformPostId}/`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    const handle = username || platformChannelId;
    return `https://www.instagram.com/${handle}/`;
  }
}
