import { z } from 'zod';

// --- Channel Schemas ---
export const createChannelSchema = z.object({
  telegramChatId: z.coerce.bigint(),
  title: z.string().min(1),
  description: z.string().optional(),
  username: z.string().optional(),
  language: z.string().optional(),
  category: z.string().optional(),
});

export const updateChannelSchema = z.object({
  description: z.string().optional(),
  language: z.string().optional(),
  category: z.string().optional(),
});

export const channelFiltersSchema = z.object({
  minSubscribers: z.coerce.number().optional(),
  maxSubscribers: z.coerce.number().optional(),
  language: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export const addAdFormatSchema = z.object({
  formatType: z.enum(['POST', 'FORWARD', 'STORY', 'CUSTOM']),
  label: z.string().min(1),
  description: z.string().optional(),
  priceTon: z.number().positive(),
});

export const addAdminSchema = z.object({
  userId: z.number().int().positive(),
  canManageDeals: z.boolean().optional(),
  canManagePricing: z.boolean().optional(),
});

// --- Campaign Schemas ---
export const createCampaignSchema = z.object({
  title: z.string().min(1),
  brief: z.string().min(1),
  budgetTon: z.number().positive(),
  targetSubscribersMin: z.number().int().optional(),
  targetSubscribersMax: z.number().int().optional(),
  targetLanguage: z.string().optional(),
  targetCategory: z.string().optional(),
});

export const updateCampaignSchema = z.object({
  title: z.string().min(1).optional(),
  brief: z.string().min(1).optional(),
  budgetTon: z.number().positive().optional(),
  targetSubscribersMin: z.number().int().optional(),
  targetSubscribersMax: z.number().int().optional(),
  targetLanguage: z.string().optional(),
  targetCategory: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
});

export const campaignFiltersSchema = z.object({
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  targetLanguage: z.string().optional(),
  targetCategory: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export const applyToCampaignSchema = z.object({
  channelId: z.number().int().positive(),
  proposedPriceTon: z.number().positive(),
  message: z.string().optional(),
});

// --- Deal Schemas ---
export const createDealSchema = z.object({
  channelId: z.number().int().positive(),
  adFormatId: z.number().int().positive(),
  campaignId: z.number().int().positive().optional(),
  amountTon: z.number().positive(),
});

export const scheduleDealSchema = z.object({
  scheduledPostAt: z.string().datetime(),
});

export const disputeDealSchema = z.object({
  reason: z.string().min(1),
});

// --- Creative Schemas ---
export const submitCreativeSchema = z.object({
  contentText: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['photo', 'video', 'document']).optional(),
});

export const revisionSchema = z.object({
  notes: z.string().min(1),
});

// --- User Schemas ---
export const updateUserSchema = z.object({
  role: z.enum(['OWNER', 'ADVERTISER', 'BOTH']).optional(),
  tonWalletAddress: z.string().optional(),
});

// Pagination helper
export const paginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});
