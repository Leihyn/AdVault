import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  campaignFiltersSchema,
  createCampaignSchema,
  updateCampaignSchema,
  applyToCampaignSchema,
} from '../schemas/index.js';
import * as campaignService from '../../services/campaign.service.js';

export async function campaignRoutes(app: FastifyInstance) {
  // Browse campaigns
  app.get('/api/campaigns', async (request) => {
    const query = campaignFiltersSchema.parse(request.query);
    const { page, limit, ...filters } = query;
    return campaignService.listCampaigns(filters, page, limit);
  });

  // Get campaign detail
  app.get<{ Params: { id: string } }>('/api/campaigns/:id', async (request) => {
    return campaignService.getCampaign(Number(request.params.id));
  });

  // Create campaign
  app.post('/api/campaigns', { preHandler: authMiddleware }, async (request) => {
    const body = createCampaignSchema.parse(request.body);
    return campaignService.createCampaign({
      ...body,
      advertiserId: request.telegramUser.id,
    });
  });

  // Update campaign
  app.put<{ Params: { id: string } }>(
    '/api/campaigns/:id',
    { preHandler: authMiddleware },
    async (request) => {
      const body = updateCampaignSchema.parse(request.body);
      return campaignService.updateCampaign(
        Number(request.params.id),
        request.telegramUser.id,
        body,
      );
    },
  );

  // Apply to campaign (channel owner)
  app.post<{ Params: { id: string } }>(
    '/api/campaigns/:id/apply',
    { preHandler: authMiddleware },
    async (request) => {
      const body = applyToCampaignSchema.parse(request.body);
      return campaignService.applyToCampaign({
        ...body,
        campaignId: Number(request.params.id),
        userId: request.telegramUser.id,
      });
    },
  );
}
