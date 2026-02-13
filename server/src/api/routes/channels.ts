import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  channelFiltersSchema,
  createChannelSchema,
  updateChannelSchema,
  addAdFormatSchema,
  updateAdFormatSchema,
  addAdminSchema,
} from '../schemas/index.js';
import * as channelService from '../../services/channel.service.js';
import * as verificationService from '../../services/verification.service.js';
import { PrismaClient } from '@prisma/client';
import { platformRegistry } from '../../platforms/registry.js';
import { YouTubeAdapter } from '../../platforms/youtube.adapter.js';

const prisma = new PrismaClient();

export async function channelRoutes(app: FastifyInstance) {
  // Browse channel listings
  app.get('/api/channels', async (request) => {
    const query = channelFiltersSchema.parse(request.query);
    const { page, limit, ...filters } = query;
    return channelService.listChannels(filters, page, limit);
  });

  // Get channel detail
  app.get<{ Params: { id: string } }>('/api/channels/:id', async (request) => {
    return channelService.getChannel(Number(request.params.id));
  });

  // Register a new channel (supports all platforms)
  app.post('/api/channels', { preHandler: authMiddleware }, async (request) => {
    const body = createChannelSchema.parse(request.body);
    const platform = body.platform || 'TELEGRAM';

    let enrichedData: Record<string, any> = {
      ...body,
      ownerId: request.telegramUser.id,
    };

    // YouTube: resolve handle/URL → channel ID, fetch info, mark verified
    if (platform === 'YOUTUBE' && body.platformChannelId) {
      try {
        const ytAdapter = platformRegistry.get('YOUTUBE') as YouTubeAdapter;
        const channelId = await ytAdapter.resolveChannelId(body.platformChannelId);
        const info = await ytAdapter.fetchChannelInfo(channelId);
        enrichedData = {
          ...enrichedData,
          platformChannelId: channelId,
          title: info.title || body.title,
          description: info.description || body.description,
          username: info.username,
          subscribers: info.subscribers,
          isVerified: true,
        };
      } catch {
        // If YouTube API fails, still allow registration but unverified
        enrichedData.isVerified = false;
      }
    }

    // Instagram/Twitter/TikTok: manual registration, always unverified
    if (platform === 'INSTAGRAM' || platform === 'TWITTER' || platform === 'TIKTOK') {
      enrichedData.isVerified = false;
      // Use username as platformChannelId if not explicitly provided
      if (!enrichedData.platformChannelId && enrichedData.username) {
        enrichedData.platformChannelId = enrichedData.username;
      }
    }

    const { channel } = await channelService.createChannelWithDefaults(enrichedData as any);
    return channel;
  });

  // Update channel info
  app.put<{ Params: { id: string } }>(
    '/api/channels/:id',
    { preHandler: authMiddleware },
    async (request) => {
      const body = updateChannelSchema.parse(request.body);
      return channelService.updateChannel(
        Number(request.params.id),
        request.telegramUser.id,
        body,
      );
    },
  );

  // Refresh channel stats from platform API
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/refresh-stats',
    { preHandler: authMiddleware },
    async (request) => {
      const channelId = Number(request.params.id);
      const channel = await channelService.getChannel(channelId);

      // Only owner can refresh
      if (channel.ownerId !== request.telegramUser.id) {
        throw new Error('Only the channel owner can refresh stats');
      }

      const adapter = platformRegistry.get(channel.platform);
      const platformChannelId = channel.platformChannelId || String(channel.telegramChatId);

      const info = await adapter.fetchChannelInfo(platformChannelId);

      await channelService.updateChannelStats(channelId, {
        subscribers: info.subscribers,
        avgViews: info.avgViews,
        avgReach: info.avgReach,
        premiumPercentage: info.premiumPercentage,
        languages: info.languages,
      });

      return channelService.getChannel(channelId);
    },
  );

  // Add an ad format to a channel
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/formats',
    { preHandler: authMiddleware },
    async (request) => {
      const body = addAdFormatSchema.parse(request.body);
      return channelService.addAdFormat(
        Number(request.params.id),
        request.telegramUser.id,
        body,
      );
    },
  );

  // Update an ad format
  app.put<{ Params: { id: string; formatId: string } }>(
    '/api/channels/:id/formats/:formatId',
    { preHandler: authMiddleware },
    async (request) => {
      const body = updateAdFormatSchema.parse(request.body);
      return channelService.updateAdFormat(
        Number(request.params.formatId),
        request.telegramUser.id,
        body,
      );
    },
  );

  // Delete an ad format
  app.delete<{ Params: { id: string; formatId: string } }>(
    '/api/channels/:id/formats/:formatId',
    { preHandler: authMiddleware },
    async (request) => {
      return channelService.deleteAdFormat(
        Number(request.params.formatId),
        request.telegramUser.id,
      );
    },
  );

  // List channel admins
  app.get<{ Params: { id: string } }>(
    '/api/channels/:id/admins',
    { preHandler: authMiddleware },
    async (request) => {
      return channelService.getChannelAdmins(Number(request.params.id));
    },
  );

  // Add channel admin
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/admins',
    { preHandler: authMiddleware },
    async (request) => {
      const body = addAdminSchema.parse(request.body);
      return channelService.addChannelAdmin(
        Number(request.params.id),
        request.telegramUser.id,
        body,
      );
    },
  );

  // Sync admins from Telegram (owner only)
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/admins/sync',
    { preHandler: authMiddleware },
    async (request) => {
      const channelId = Number(request.params.id);
      const channel = await channelService.getChannel(channelId);

      if (channel.ownerId !== request.telegramUser.id) {
        throw new Error('Only the channel owner can sync admins');
      }

      const adapter = platformRegistry.get(channel.platform);
      if (!adapter.fetchAdmins) {
        throw new Error('Admin sync not supported for this platform');
      }

      const platformChannelId = channel.platformChannelId || String(channel.telegramChatId);
      const admins = await adapter.fetchAdmins(platformChannelId);

      const results: Array<{ username?: string; synced: boolean }> = [];

      for (const admin of admins) {
        let user = await prisma.user.findUnique({
          where: { telegramId: BigInt(admin.platformUserId) },
        });

        if (!user) {
          // Create a placeholder user for the admin
          user = await prisma.user.create({
            data: {
              telegramId: BigInt(admin.platformUserId),
              username: admin.username,
              firstName: admin.firstName,
              role: 'BOTH',
            },
          });
        }

        // Skip if this is the channel owner
        if (user.id === channel.ownerId) {
          results.push({ username: admin.username, synced: false });
          continue;
        }

        // Upsert channel admin record
        await prisma.channelAdmin.upsert({
          where: { channelId_userId: { channelId, userId: user.id } },
          create: {
            channelId,
            userId: user.id,
            canManageDeals: admin.canPostMessages,
            canManagePricing: admin.isCreator,
          },
          update: {
            canManageDeals: admin.canPostMessages,
            canManagePricing: admin.isCreator,
          },
        });

        results.push({ username: admin.username, synced: true });
      }

      return { synced: results.filter((r) => r.synced).length, admins: results };
    },
  );

  // Generate verification token for account ownership
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/verify/token',
    { preHandler: authMiddleware },
    async (request) => {
      return verificationService.generateVerificationToken(
        Number(request.params.id),
        request.telegramUser.id,
      );
    },
  );

  // Check if verification link is present in profile
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/verify/check',
    { preHandler: authMiddleware },
    async (request) => {
      return verificationService.checkVerification(
        Number(request.params.id),
        request.telegramUser.id,
      );
    },
  );
}
