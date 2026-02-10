import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { updateUserSchema } from '../schemas/index.js';
import * as channelService from '../../services/channel.service.js';
import * as campaignService from '../../services/campaign.service.js';

const prisma = new PrismaClient();

export async function userRoutes(app: FastifyInstance) {
  // Get current user profile
  app.get('/api/users/me', { preHandler: authMiddleware }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.telegramUser.id },
    });
    return user;
  });

  // Update user profile
  app.put('/api/users/me', { preHandler: authMiddleware }, async (request) => {
    const body = updateUserSchema.parse(request.body);
    return prisma.user.update({
      where: { id: request.telegramUser.id },
      data: body,
    });
  });

  // Get user's channels
  app.get('/api/users/me/channels', { preHandler: authMiddleware }, async (request) => {
    return channelService.getChannelsByOwner(request.telegramUser.id);
  });

  // Get user's campaigns
  app.get('/api/users/me/campaigns', { preHandler: authMiddleware }, async (request) => {
    return campaignService.getCampaignsByAdvertiser(request.telegramUser.id);
  });
}
