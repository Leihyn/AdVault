import { z } from 'zod';

// --- Channel Schemas ---
export const platformEnum = z.enum(['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER', 'TIKTOK']);

export const createChannelSchema = z.object({
  platform: platformEnum.default('TELEGRAM'),
  platformChannelId: z.string().max(255).optional(),
  telegramChatId: z.coerce.bigint().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  username: z.string().max(255).optional(),
  language: z.string().max(10).optional(),
  category: z.string().max(100).optional(),
}).refine(
  (data) => {
    if (data.platform === 'TELEGRAM') return data.telegramChatId != null || data.platformChannelId != null;
    // For Instagram/Twitter/TikTok, accept username as identifier
    if (data.platform === 'INSTAGRAM' || data.platform === 'TWITTER' || data.platform === 'TIKTOK') {
      return data.platformChannelId != null || data.username != null;
    }
    return data.platformChannelId != null;
  },
  { message: 'platformChannelId is required (or telegramChatId for Telegram, username for Instagram/Twitter)' },
);

export const updateChannelSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  language: z.string().max(10).optional(),
  category: z.string().max(100).optional(),
});

export const channelFiltersSchema = z.object({
  platform: platformEnum.optional(),
  minSubscribers: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
  maxSubscribers: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
  language: z.string().max(10).optional(),
  category: z.string().max(100).optional(),
  minPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  maxPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const addAdFormatSchema = z.object({
  formatType: z.enum(['POST', 'FORWARD', 'STORY', 'CUSTOM', 'VIDEO', 'REEL', 'TWEET', 'COMMUNITY_POST']),
  label: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  priceTon: z.number().positive().max(1_000_000),
});

export const updateAdFormatSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  priceTon: z.number().nonnegative().max(1_000_000).optional(),
  isActive: z.boolean().optional(),
});

export const addAdminSchema = z.object({
  userId: z.number().int().positive(),
  canManageDeals: z.boolean().optional(),
  canManagePricing: z.boolean().optional(),
});

// --- Campaign Schemas ---
export const createCampaignSchema = z.object({
  title: z.string().min(1).max(255),
  brief: z.string().min(1).max(5000),
  budgetTon: z.number().positive().max(1_000_000),
  targetSubscribersMin: z.number().int().nonnegative().max(100_000_000).optional(),
  targetSubscribersMax: z.number().int().nonnegative().max(100_000_000).optional(),
  targetLanguage: z.string().max(10).optional(),
  targetCategory: z.string().max(50).optional(),
});

export const updateCampaignSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  brief: z.string().min(1).max(5000).optional(),
  budgetTon: z.number().positive().max(1_000_000).optional(),
  targetSubscribersMin: z.number().int().nonnegative().max(100_000_000).optional(),
  targetSubscribersMax: z.number().int().nonnegative().max(100_000_000).optional(),
  targetLanguage: z.string().max(10).optional(),
  targetCategory: z.string().max(50).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
});

export const campaignFiltersSchema = z.object({
  minBudget: z.coerce.number().nonnegative().max(1_000_000).optional(),
  maxBudget: z.coerce.number().nonnegative().max(1_000_000).optional(),
  targetLanguage: z.string().max(10).optional(),
  targetCategory: z.string().max(50).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const applyToCampaignSchema = z.object({
  channelId: z.number().int().positive(),
  proposedPriceTon: z.number().positive().max(1_000_000),
  message: z.string().max(2000).optional(),
});

// --- Deal Schemas ---
export const metricTypeEnum = z.enum(['POST_EXISTS', 'VIEWS', 'LIKES', 'COMMENTS', 'SHARES', 'CUSTOM']);

export const requirementSchema = z.object({
  metricType: metricTypeEnum,
  targetValue: z.number().int().positive(),
});

export const assetSchema = z.object({
  label: z.string().min(1).max(50),
  value: z.string().min(1).max(2000),
});

export const createDealSchema = z.object({
  channelId: z.number().int().positive(),
  adFormatId: z.number().int().positive(),
  campaignId: z.number().int().positive().optional(),
  amountTon: z.number().positive().max(1_000_000),
  verificationWindowHours: z.number().int().min(1).max(720).default(24),
  requirements: z.array(requirementSchema).max(10).optional(),
  brief: z.string().max(5000).optional(),
  assets: z.array(assetSchema).max(10).optional(),
});

export const submitPostProofSchema = z.object({
  postUrl: z.string().url(),
});

export const schedulePostSchema = z.object({
  scheduledPostAt: z.string().datetime(),
});

export const disputeDealSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const disputeEvidenceSchema = z.object({
  description: z.string().min(1).max(5000),
  url: z.string().url().max(2048).optional(),
});

export const disputeProposalSchema = z.object({
  outcome: z.enum(['RELEASE_TO_OWNER', 'REFUND_TO_ADVERTISER', 'SPLIT']),
  splitPercent: z.number().int().min(0).max(100).optional(),
});

export const adminResolveSchema = z.object({
  outcome: z.enum(['RELEASE_TO_OWNER', 'REFUND_TO_ADVERTISER', 'SPLIT']),
  reason: z.string().min(1).max(2000),
  splitPercent: z.number().int().min(0).max(100).optional(),
});

// --- Creative Schemas ---
export const submitCreativeSchema = z.object({
  contentText: z.string().max(10000).optional(),
  mediaUrl: z.string().url().max(2048).optional(),
  mediaType: z.enum(['photo', 'video', 'document']).optional(),
});

export const revisionSchema = z.object({
  notes: z.string().min(1).max(2000),
});

// --- User Schemas ---
// Role is NOT user-editable — derived from actions (registering a channel, creating a campaign)
export const updateUserSchema = z.object({
  tonWalletAddress: z.string().max(128).optional(),
});

// Pagination helper
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Safe param ID parser — rejects NaN, negative, non-integer */
export function parseParamId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid ID');
  }
  return id;
}
