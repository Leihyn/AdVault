import { PrismaClient } from '@prisma/client';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { transitionDeal } from './deal.service.js';
import { encryptField, decryptField } from '../utils/privacy.js';
import { verifyChannelAdmin } from '../utils/adminGuard.js';

const prisma = new PrismaClient();

/**
 * Decrypts the encrypted fields of a creative for API responses.
 * Returns the creative with plaintext content visible to authorized parties.
 */
function decryptCreative<T extends { contentText?: string | null; mediaUrl?: string | null }>(creative: T): T {
  return {
    ...creative,
    contentText: creative.contentText ? decryptField(creative.contentText) : creative.contentText,
    mediaUrl: creative.mediaUrl ? decryptField(creative.mediaUrl) : creative.mediaUrl,
  };
}

export async function submitCreative(
  dealId: number,
  userId: number,
  data: { contentText?: string; mediaUrl?: string; mediaType?: string },
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { channel: true },
  });
  if (!deal) throw new NotFoundError('Deal');
  if (deal.channel.ownerId !== userId) throw new ForbiddenError('Only channel owner can submit creatives');

  // Re-verify admin status before proceeding
  await verifyChannelAdmin(deal.channelId, userId);

  if (!['CREATIVE_PENDING', 'CREATIVE_REVISION'].includes(deal.status)) {
    throw new AppError('Cannot submit creative in current deal status');
  }

  // Get latest version number
  const latest = await prisma.creative.findFirst({
    where: { dealId },
    orderBy: { version: 'desc' },
  });
  const version = (latest?.version || 0) + 1;

  const creative = await prisma.creative.create({
    data: {
      dealId,
      contentText: data.contentText ? encryptField(data.contentText) : undefined,
      mediaUrl: data.mediaUrl ? encryptField(data.mediaUrl) : undefined,
      mediaType: data.mediaType,
      version,
      submittedById: userId,
      status: 'SUBMITTED',
    },
  });

  await transitionDeal(dealId, 'CREATIVE_SUBMITTED', userId);
  // Return decrypted version to the caller
  return decryptCreative(creative);
}

export async function approveCreative(dealId: number, userId: number) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new NotFoundError('Deal');
  if (deal.advertiserId !== userId) throw new ForbiddenError('Only advertiser can approve creatives');
  if (deal.status !== 'CREATIVE_SUBMITTED') throw new AppError('No creative to approve');

  const creative = await prisma.creative.findFirst({
    where: { dealId, status: 'SUBMITTED' },
    orderBy: { version: 'desc' },
  });
  if (!creative) throw new NotFoundError('Creative');

  await prisma.creative.update({
    where: { id: creative.id },
    data: { status: 'APPROVED' },
  });

  await transitionDeal(dealId, 'CREATIVE_APPROVED', userId);
  return decryptCreative(creative);
}

export async function requestRevision(dealId: number, userId: number, notes: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new NotFoundError('Deal');
  if (deal.advertiserId !== userId) throw new ForbiddenError('Only advertiser can request revisions');
  if (deal.status !== 'CREATIVE_SUBMITTED') throw new AppError('No creative to review');

  const creative = await prisma.creative.findFirst({
    where: { dealId, status: 'SUBMITTED' },
    orderBy: { version: 'desc' },
  });
  if (!creative) throw new NotFoundError('Creative');

  await prisma.creative.update({
    where: { id: creative.id },
    data: { status: 'REVISION_REQUESTED', reviewerNotes: notes },
  });

  await transitionDeal(dealId, 'CREATIVE_REVISION', userId);
  return decryptCreative(creative);
}

export async function getCreatives(dealId: number) {
  const creatives = await prisma.creative.findMany({
    where: { dealId },
    orderBy: { version: 'desc' },
    include: {
      submittedBy: { select: { id: true, username: true, firstName: true } },
    },
  });
  return creatives.map(decryptCreative);
}

/**
 * Gets the approved creative with decrypted content for posting.
 * Used by the posting worker — needs plaintext to send to Telegram.
 */
export async function getDecryptedCreativeForPosting(dealId: number) {
  const creative = await prisma.creative.findFirst({
    where: { dealId, status: 'APPROVED' },
    orderBy: { version: 'desc' },
  });
  if (!creative) return null;
  return decryptCreative(creative);
}
