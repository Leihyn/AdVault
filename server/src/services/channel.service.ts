import { PrismaClient, AdFormatType, Platform } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { DEFAULT_FORMATS } from '../constants/defaultFormats.js';

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
  // Show channels that have at least one active (live) ad format
  const where: any = { adFormats: { some: { isActive: true } } };

  if (filters.platform) where.platform = filters.platform;
  if (filters.minSubscribers) where.subscribers = { ...where.subscribers, gte: filters.minSubscribers };
  if (filters.maxSubscribers) where.subscribers = { ...where.subscribers, lte: filters.maxSubscribers };
  if (filters.language) where.language = filters.language;
  if (filters.category) where.category = { contains: filters.category };

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
      adFormats: true,
      owner: { select: { id: true, username: true, firstName: true } },
      admins: {
        include: { user: { select: { id: true, username: true, firstName: true } } },
      },
      languageStats: { orderBy: { percentage: 'desc' } },
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
  botIsAdmin?: boolean;
  isVerified?: boolean;
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
      botIsAdmin: data.botIsAdmin,
      isVerified: data.isVerified,
      statsUpdatedAt: new Date(),
    },
  });
}

/**
 * Creates a channel with platform-specific default ad formats and upgrades user role if needed.
 * Wraps createChannel + adFormat creation + role upgrade in one call.
 */
export async function createChannelWithDefaults(data: {
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
  botIsAdmin?: boolean;
  isVerified?: boolean;
}) {
  const platform = data.platform || 'TELEGRAM';

  const channel = await createChannel(data);

  // Create default ad formats for the platform
  const defaults = DEFAULT_FORMATS[platform] || DEFAULT_FORMATS.TELEGRAM;
  const createdFormats = await prisma.adFormat.createMany({
    data: defaults.map((f) => ({
      channelId: channel.id,
      formatType: f.formatType,
      label: f.label,
      description: f.description,
      priceTon: 0,
      isActive: false,
    })),
  });

  // Upgrade user role from ADVERTISER to BOTH
  const user = await prisma.user.findUnique({ where: { id: data.ownerId } });
  if (user && user.role === 'ADVERTISER') {
    await prisma.user.update({
      where: { id: data.ownerId },
      data: { role: 'BOTH' },
    });
  }

  return { channel, formatsCreated: createdFormats.count, defaults };
}

export async function updateChannel(
  id: number,
  userId: number,
  data: {
    title?: string;
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
    languages?: Array<{ language: string; percentage: number }>;
  },
) {
  const { languages, ...channelData } = stats;

  return prisma.$transaction(async (tx) => {
    const channel = await tx.channel.update({
      where: { id },
      data: { ...channelData, statsUpdatedAt: new Date() },
    });

    // Upsert language stats if provided
    if (languages && languages.length > 0) {
      await tx.channelLanguageStat.deleteMany({ where: { channelId: id } });
      await tx.channelLanguageStat.createMany({
        data: languages.map((l) => ({
          channelId: id,
          language: l.language,
          percentage: l.percentage,
        })),
      });
    }

    return channel;
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

export async function updateAdFormat(
  formatId: number,
  userId: number,
  data: { label?: string; description?: string; priceTon?: number; isActive?: boolean },
) {
  const format = await prisma.adFormat.findUnique({
    where: { id: formatId },
    include: { channel: true },
  });
  if (!format) throw new NotFoundError('Ad format');
  if (format.channel.ownerId !== userId) throw new ForbiddenError('Not channel owner');

  return prisma.adFormat.update({ where: { id: formatId }, data });
}

export async function deleteAdFormat(formatId: number, userId: number) {
  const format = await prisma.adFormat.findUnique({
    where: { id: formatId },
    include: { channel: true, deals: { where: { status: { notIn: ['COMPLETED', 'REFUNDED', 'CANCELLED'] } } } },
  });
  if (!format) throw new NotFoundError('Ad format');
  if (format.channel.ownerId !== userId) throw new ForbiddenError('Not channel owner');
  if (format.deals.length > 0) throw new ConflictError('Cannot delete format with active deals');

  return prisma.adFormat.delete({ where: { id: formatId } });
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
