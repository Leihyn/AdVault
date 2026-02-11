import { z } from 'zod';

// --- Channel Schemas ---
export const platformEnum = z.enum(['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER']);

export const createChannelSchema = z.object({
  platform: platformEnum.default('TELEGRAM'),
  platformChannelId: z.string().max(255).optional(),
  telegramChatId: z.coerce.bigint().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  username: z.string().max(255).optional(),
  language: z.string().max(10).optional(),
  category: z.string().max(50).optional(),
}).refine(
  (data) => {
    if (data.platform === 'TELEGRAM') return data.telegramChatId != null || data.platformChannelId != null;
    return data.platformChannelId != null;
  },
  { message: 'platformChannelId is required (or telegramChatId for Telegram channels)' },
);

export const updateChannelSchema = z.object({
  description: z.string().max(2000).optional(),
  language: z.string().max(10).optional(),
  category: z.string().max(50).optional(),
});

export const channelFiltersSchema = z.object({
  platform: platformEnum.optional(),
  minSubscribers: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
  maxSubscribers: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
  language: z.string().max(10).optional(),
  category: z.string().max(50).optional(),
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
export const createDealSchema = z.object({
  channelId: z.number().int().positive(),
  adFormatId: z.number().int().positive(),
  campaignId: z.number().int().positive().optional(),
  amountTon: z.number().positive().max(1_000_000),
});

export const scheduleDealSchema = z.object({
  scheduledPostAt: z.string().datetime(),
});

export const disputeDealSchema = z.object({
  reason: z.string().min(1).max(2000),
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
