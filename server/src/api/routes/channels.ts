import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  channelFiltersSchema,
  createChannelSchema,
  updateChannelSchema,
  addAdFormatSchema,
  addAdminSchema,
} from '../schemas/index.js';
import * as channelService from '../../services/channel.service.js';

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

  // Register a new channel
  app.post('/api/channels', { preHandler: authMiddleware }, async (request) => {
    const body = createChannelSchema.parse(request.body);
    return channelService.createChannel({
      ...body,
      ownerId: request.telegramUser.id,
    });
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

  // Refresh channel stats from Telegram
  app.post<{ Params: { id: string } }>(
    '/api/channels/:id/refresh-stats',
    { preHandler: authMiddleware },
    async (request) => {
      // Stats refresh happens via the bot — this endpoint triggers it
      // The actual implementation uses telegram.service but needs bot reference
      // For now, return the channel with current stats
      return channelService.getChannel(Number(request.params.id));
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
}
