import { PrismaClient, CampaignStatus, ApplicationStatus } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, AppError } from '../utils/errors.js';

const prisma = new PrismaClient();

export interface CampaignFilters {
  minBudget?: number;
  maxBudget?: number;
  targetLanguage?: string;
  targetCategory?: string;
  status?: CampaignStatus;
}

export async function listCampaigns(filters: CampaignFilters, page = 1, limit = 20) {
  const where: any = { status: filters.status || 'ACTIVE' };

  if (filters.minBudget) where.budgetTon = { ...where.budgetTon, gte: filters.minBudget };
  if (filters.maxBudget) where.budgetTon = { ...where.budgetTon, lte: filters.maxBudget };
  if (filters.targetLanguage) where.targetLanguage = filters.targetLanguage;
  if (filters.targetCategory) where.targetCategory = filters.targetCategory;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        advertiser: { select: { id: true, username: true, firstName: true } },
        _count: { select: { applications: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.campaign.count({ where }),
  ]);

  return { campaigns, total, page, limit };
}

export async function getCampaign(id: number) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      advertiser: { select: { id: true, username: true, firstName: true } },
      applications: {
        include: {
          channel: {
            select: { id: true, title: true, username: true, subscribers: true },
          },
        },
      },
    },
  });
  if (!campaign) throw new NotFoundError('Campaign');
  return campaign;
}

export async function createCampaign(data: {
  advertiserId: number;
  title: string;
  brief: string;
  budgetTon: number;
  targetSubscribersMin?: number;
  targetSubscribersMax?: number;
  targetLanguage?: string;
  targetCategory?: string;
}) {
  return prisma.campaign.create({ data });
}

export async function updateCampaign(
  id: number,
  userId: number,
  data: {
    title?: string;
    brief?: string;
    budgetTon?: number;
    targetSubscribersMin?: number;
    targetSubscribersMax?: number;
    targetLanguage?: string;
    targetCategory?: string;
    status?: CampaignStatus;
  },
) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new NotFoundError('Campaign');
  if (campaign.advertiserId !== userId) throw new ForbiddenError('Not campaign owner');

  return prisma.campaign.update({ where: { id }, data });
}

export async function applyToCampaign(data: {
  campaignId: number;
  channelId: number;
  proposedPriceTon: number;
  message?: string;
  userId: number;
}) {
  const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
  if (!campaign) throw new NotFoundError('Campaign');
  if (campaign.status !== 'ACTIVE') throw new AppError('Campaign is not active');

  // Verify the user owns the channel
  const channel = await prisma.channel.findUnique({ where: { id: data.channelId } });
  if (!channel) throw new NotFoundError('Channel');
  if (channel.ownerId !== data.userId) throw new ForbiddenError('Not channel owner');

  const existing = await prisma.campaignApplication.findUnique({
    where: { campaignId_channelId: { campaignId: data.campaignId, channelId: data.channelId } },
  });
  if (existing) throw new ConflictError('Already applied to this campaign');

  return prisma.campaignApplication.create({
    data: {
      campaignId: data.campaignId,
      channelId: data.channelId,
      proposedPriceTon: data.proposedPriceTon,
      message: data.message,
    },
  });
}

export async function updateApplicationStatus(
  applicationId: number,
  userId: number,
  status: ApplicationStatus,
) {
  const application = await prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    include: { campaign: true },
  });
  if (!application) throw new NotFoundError('Application');
  if (application.campaign.advertiserId !== userId) throw new ForbiddenError('Not campaign owner');

  return prisma.campaignApplication.update({
    where: { id: applicationId },
    data: { status },
  });
}

export async function getCampaignsByAdvertiser(advertiserId: number) {
  return prisma.campaign.findMany({
    where: { advertiserId },
    include: { _count: { select: { applications: true, deals: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
