import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult, PostMetrics } from './types.js';

/**
 * TikTok adapter using oEmbed API for post verification and metrics.
 * No API key required — oEmbed is public.
 *
 * Limitations:
 * - No automated posting (creators upload manually)
 * - Channel info requires scraping or manual input
 * - Metrics limited to what oEmbed returns (views only, no likes/comments)
 */
export class TikTokAdapter implements IPlatformAdapter {
  readonly platform = Platform.TIKTOK;

  async fetchChannelInfo(_platformChannelId: string): Promise<PlatformChannelInfo> {
    // TikTok has no public API for channel info without auth
    // Return minimal info — title/subscribers come from manual registration
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
    throw new Error('TikTok does not support automated posting. Upload your video to TikTok and submit the URL.');
  }

  async verifyPostExists(_platformChannelId: string, platformPostId: string): Promise<boolean> {
    try {
      const url = this.getPostUrl(_platformChannelId, platformPostId);
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchPostMetrics(_platformChannelId: string, platformPostId: string): Promise<PostMetrics> {
    try {
      const url = this.getPostUrl(_platformChannelId, platformPostId);
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { exists: false };

      const data = await res.json() as Record<string, unknown>;

      return {
        exists: true,
        // TikTok oEmbed doesn't return view counts directly,
        // but the endpoint returning 200 confirms the post is live.
        // For view tracking, we'd need the TikTok Research API (requires approval).
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

      // https://www.tiktok.com/@username/video/1234567890
      if (parsed.hostname.includes('tiktok.com')) {
        const videoMatch = parsed.pathname.match(/\/video\/(\d+)/);
        if (videoMatch) return videoMatch[1];

        // Short URL: https://vm.tiktok.com/ABC123/
        // These redirect — extract the path as the ID
        if (parsed.hostname === 'vm.tiktok.com') {
          const shortId = parsed.pathname.replace(/\//g, '');
          if (shortId) return shortId;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  getPostUrl(platformChannelId: string, platformPostId: string): string {
    return `https://www.tiktok.com/@${platformChannelId}/video/${platformPostId}`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    const handle = username || platformChannelId;
    return `https://www.tiktok.com/@${handle}`;
  }
}
