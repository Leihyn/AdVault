import { google } from 'googleapis';
import { Platform, IPlatformAdapter, PlatformChannelInfo, PostResult } from './types.js';
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

  getPostUrl(_platformChannelId: string, platformPostId: string): string {
    return `https://www.youtube.com/watch?v=${platformPostId}`;
  }

  getChannelUrl(platformChannelId: string, username?: string): string {
    if (username) return `https://www.youtube.com/@${username}`;
    return `https://www.youtube.com/channel/${platformChannelId}`;
  }
}
