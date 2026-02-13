import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { platformRegistry } from '../platforms/registry.js';

const prisma = new PrismaClient();

/**
 * Generates a unique verification token for a channel.
 * The creator adds a link containing this token to their platform profile.
 */
export async function generateVerificationToken(channelId: number, userId: number) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new NotFoundError('Channel');
  if (channel.ownerId !== userId) throw new ForbiddenError('Only the channel owner can verify');
  if (channel.isVerified) throw new AppError('Channel is already verified');

  // Reuse existing token or generate new one
  const token = channel.verificationToken || `bld-${crypto.randomBytes(8).toString('hex')}`;

  if (!channel.verificationToken) {
    await prisma.channel.update({
      where: { id: channelId },
      data: { verificationToken: token },
    });
  }

  // Build the verification URL the user needs to add to their profile
  const verifyUrl = `https://bbuuiilldd.com/verify/${token}`;

  return {
    token,
    verifyUrl,
    instructions: getVerificationInstructions(channel.platform, verifyUrl),
  };
}

/**
 * Checks if the verification link is present in the creator's public profile.
 * Uses platform-specific methods to fetch the profile page and search for the token.
 */
export async function checkVerification(channelId: number, userId: number) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new NotFoundError('Channel');
  if (channel.ownerId !== userId) throw new ForbiddenError('Only the channel owner can verify');
  if (channel.isVerified) return { verified: true, alreadyVerified: true };
  if (!channel.verificationToken) throw new AppError('Generate a verification token first');

  const platformChannelId = channel.platformChannelId || String(channel.telegramChatId);
  const found = await checkProfileForToken(
    channel.platform,
    platformChannelId,
    channel.username || undefined,
    channel.verificationToken,
  );

  if (found) {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    return { verified: true, alreadyVerified: false };
  }

  return { verified: false, alreadyVerified: false };
}

/**
 * Fetches the public profile page and checks for the verification token.
 * Uses simple HTTP fetch — no API keys required.
 */
async function checkProfileForToken(
  platform: string,
  platformChannelId: string,
  username: string | undefined,
  token: string,
): Promise<boolean> {
  try {
    const adapter = platformRegistry.get(platform);
    const profileUrl = adapter.getChannelUrl(platformChannelId, username);

    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AdVault/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return false;

    const html = await res.text();
    // Check for the token anywhere in the page (profile link, bio, about)
    return html.includes(token);
  } catch {
    return false;
  }
}

function getVerificationInstructions(platform: string, verifyUrl: string): string {
  switch (platform) {
    case 'YOUTUBE':
      return `Go to YouTube Studio > Customization > Basic info > Links. Add "${verifyUrl}" as a link, then tap "Check" here.`;
    case 'INSTAGRAM':
      return `Go to your Instagram profile > Edit Profile > Website. Paste "${verifyUrl}", then tap "Check" here.`;
    case 'TWITTER':
      return `Go to your X profile > Edit Profile > Website. Paste "${verifyUrl}", then tap "Check" here.`;
    case 'TIKTOK':
      return `Go to your TikTok profile > Edit Profile > Bio or Website. Add "${verifyUrl}", then tap "Check" here.`;
    case 'TELEGRAM':
      return `Add "${verifyUrl}" to your channel description, then tap "Check" here.`;
    default:
      return `Add "${verifyUrl}" to your profile, then tap "Check" here.`;
  }
}
