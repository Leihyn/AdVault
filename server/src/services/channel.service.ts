import { PrismaClient, AdFormatType, Platform } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

const prisma = new PrismaClient();

export interface ChannelFilters {
  platform?: Platform;
  minSubscribers?: number;
  maxSubscribers?: number;
  language?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export async function listChannels(filters: ChannelFilters, page = 1, limit = 20) {
  const where: any = { isVerified: true };

  if (filters.platform) where.platform = filters.platform;
  if (filters.minSubscribers) where.subscribers = { ...where.subscribers, gte: filters.minSubscribers };
  if (filters.maxSubscribers) where.subscribers = { ...where.subscribers, lte: filters.maxSubscribers };
  if (filters.language) where.language = filters.language;
  if (filters.category) where.category = filters.category;

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      include: {
        adFormats: { where: { isActive: true } },
        owner: { select: { id: true, username: true, firstName: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { subscribers: 'desc' },
    }),
    prisma.channel.count({ where }),
  ]);

  return { channels, total, page, limit };
}

export async function getChannel(id: number) {
  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      adFormats: { where: { isActive: true } },
      owner: { select: { id: true, username: true, firstName: true } },
      admins: {
        include: { user: { select: { id: true, username: true, firstName: true } } },
      },
    },
  });
  if (!channel) throw new NotFoundError('Channel');
  return channel;
}

export async function createChannel(data: {
  platform?: Platform;
  platformChannelId?: string;
  telegramChatId?: bigint;
  ownerId: number;
  title: string;
  description?: string;
  username?: string;
  subscribers?: number;
  avgViews?: number;
  avgReach?: number;
  language?: string;
  category?: string;
}) {
  const platform = data.platform || 'TELEGRAM';

  // For Telegram channels, derive platformChannelId from telegramChatId if not provided
  const platformChannelId = data.platformChannelId
    || (data.telegramChatId != null ? String(data.telegramChatId) : '');

  // Check for duplicate on composite (platform, platformChannelId)
  const existing = await prisma.channel.findUnique({
    where: { platform_platformChannelId: { platform, platformChannelId } },
  });
  if (existing) throw new ConflictError('Channel already registered');

  return prisma.channel.create({
    data: {
      platform,
      platformChannelId,
      telegramChatId: data.telegramChatId || (platform === 'TELEGRAM' ? BigInt(platformChannelId) : null),
      ownerId: data.ownerId,
      title: data.title,
      description: data.description,
      username: data.username,
      subscribers: data.subscribers,
      avgViews: data.avgViews,
      avgReach: data.avgReach,
      language: data.language,
      category: data.category,
    },
  });
}

export async function updateChannel(
  id: number,
  userId: number,
  data: {
    description?: string;
    language?: string;
    category?: string;
  },
) {
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) throw new NotFoundError('Channel');
  if (channel.ownerId !== userId) throw new ForbiddenError('Not channel owner');

  return prisma.channel.update({ where: { id }, data });
}

export async function updateChannelStats(
  id: number,
  stats: {
    subscribers?: number;
    avgViews?: number;
    avgReach?: number;
    premiumPercentage?: number;
    botIsAdmin?: boolean;
  },
) {
  return prisma.channel.update({
    where: { id },
    data: { ...stats, statsUpdatedAt: new Date() },
  });
}

export async function getChannelsByOwner(ownerId: number) {
  return prisma.channel.findMany({
    where: { ownerId },
    include: {
      adFormats: true,
      _count: { select: { deals: true } },
    },
  });
}

export async function addAdFormat(
  channelId: number,
  userId: number,
  data: { formatType: AdFormatType; label: string; description?: string; priceTon: number },
) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new NotFoundError('Channel');
  if (channel.ownerId !== userId) throw new ForbiddenError('Not channel owner');

  return prisma.adFormat.create({ data: { ...data, channelId } });
}

export async function getChannelAdmins(channelId: number) {
  return prisma.channelAdmin.findMany({
    where: { channelId },
    include: { user: { select: { id: true, username: true, firstName: true } } },
  });
}

export async function addChannelAdmin(
  channelId: number,
  ownerId: number,
  data: { userId: number; canManageDeals?: boolean; canManagePricing?: boolean },
) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new NotFoundError('Channel');
  if (channel.ownerId !== ownerId) throw new ForbiddenError('Not channel owner');

  return prisma.channelAdmin.create({
    data: { channelId, ...data },
  });
}
