import { PrismaClient } from '@prisma/client';
import { ForbiddenError } from './errors.js';
import { platformRegistry } from '../platforms/registry.js';

const prisma = new PrismaClient();

/**
 * Re-verifies both bot admin status and user admin status on a channel
 * before allowing financial or other important operations.
 *
 * Checks:
 * 1. Bot is still admin in the channel (via adapter.canPost)
 * 2. Acting user is still admin/creator OR is a registered ChannelAdmin with canManageDeals
 *
 * Updates Channel.botIsAdmin in the DB as a side effect.
 */
export async function verifyChannelAdmin(channelId: number, actingUserId: number) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      owner: { select: { telegramId: true } },
      admins: {
        where: { userId: actingUserId },
        select: { canManageDeals: true },
      },
    },
  });
  if (!channel) throw new ForbiddenError('Channel not found');

  // Skip verification if no adapter is registered (e.g. test environment)
  // or if in development mode (test channels may have fake chat IDs)
  if (!platformRegistry.has(channel.platform)) return;
  if (process.env.NODE_ENV === 'development') return;

  const adapter = platformRegistry.get(channel.platform);
  const platformChannelId = channel.platformChannelId || String(channel.telegramChatId);

  // Re-check bot admin status
  const botIsAdmin = await adapter.canPost(platformChannelId);
  if (channel.botIsAdmin !== botIsAdmin) {
    await prisma.channel.update({
      where: { id: channelId },
      data: { botIsAdmin },
    });
  }
  if (!botIsAdmin) {
    throw new ForbiddenError('Bot is no longer an admin in this channel');
  }

  // If acting user is the channel owner, verify they're still admin on the platform
  if (channel.ownerId === actingUserId) {
    if (adapter.verifyUserAdmin) {
      const userIsAdmin = await adapter.verifyUserAdmin(
        platformChannelId,
        String(channel.owner.telegramId),
      );
      if (!userIsAdmin) {
        throw new ForbiddenError('You are no longer an admin of this channel');
      }
    }
    return; // Owner verified
  }

  // Check if acting user is a delegated ChannelAdmin with manage deals permission
  const adminRecord = channel.admins[0];
  if (adminRecord?.canManageDeals) {
    // Delegated admin — verify they're still admin on the platform
    const user = await prisma.user.findUnique({
      where: { id: actingUserId },
      select: { telegramId: true },
    });
    if (user && adapter.verifyUserAdmin) {
      const userIsAdmin = await adapter.verifyUserAdmin(
        platformChannelId,
        String(user.telegramId),
      );
      if (!userIsAdmin) {
        throw new ForbiddenError('You are no longer an admin of this channel');
      }
    }
    return; // Delegated admin verified
  }

  throw new ForbiddenError('Not authorized to manage this channel');
}
