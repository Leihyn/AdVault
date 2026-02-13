import { AdFormatType } from '@prisma/client';

export const DEFAULT_FORMATS: Record<string, { formatType: AdFormatType; label: string; description: string }[]> = {
  TELEGRAM: [
    { formatType: 'POST', label: 'Post', description: 'Sponsored post in the channel' },
    { formatType: 'FORWARD', label: 'Forward', description: 'Forward a message to the channel' },
    { formatType: 'STORY', label: 'Story', description: 'Channel story (24h visibility)' },
  ],
  YOUTUBE: [
    { formatType: 'VIDEO', label: 'Video', description: 'Dedicated sponsored video' },
    { formatType: 'COMMUNITY_POST', label: 'Community Post', description: 'Sponsored community tab post' },
  ],
  INSTAGRAM: [
    { formatType: 'POST', label: 'Post', description: 'Sponsored feed post' },
    { formatType: 'STORY', label: 'Story', description: 'Sponsored story (24h visibility)' },
    { formatType: 'REEL', label: 'Reel', description: 'Sponsored reel' },
  ],
  TWITTER: [
    { formatType: 'TWEET', label: 'Tweet', description: 'Sponsored tweet' },
  ],
  TIKTOK: [
    { formatType: 'VIDEO', label: 'Video', description: 'Sponsored TikTok video' },
    { formatType: 'STORY', label: 'Story', description: 'Sponsored TikTok story (24h visibility)' },
  ],
};
