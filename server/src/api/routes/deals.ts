import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { createDealSchema, scheduleDealSchema, disputeDealSchema, parseParamId } from '../schemas/index.js';
import * as dealService from '../../services/deal.service.js';
import { createEscrowWallet } from '../../services/escrow.service.js';

export async function dealRoutes(app: FastifyInstance) {
  // Create a new deal
  app.post('/api/deals', { preHandler: authMiddleware }, async (request) => {
    const body = createDealSchema.parse(request.body);
    return dealService.createDeal({
      ...body,
      advertiserId: request.telegramUser.id,
    });
  });

  // Get user's deals
  app.get('/api/deals', { preHandler: authMiddleware }, async (request) => {
    const { role } = request.query as { role?: 'owner' | 'advertiser' };
    return dealService.getUserDeals(request.telegramUser.id, role);
  });

  // Get deal detail (identity-masked based on requesting user)
  app.get<{ Params: { id: string } }>(
    '/api/deals/:id',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      return dealService.getDeal(id, request.telegramUser.id);
    },
  );

  // Get escrow wallet address for payment
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/pay',
    { preHandler: authMiddleware },
    async (request) => {
      const dealId = parseParamId(request.params.id);
      const deal = await dealService.getDeal(dealId, request.telegramUser.id);

      if (deal.escrowAddress) {
        return { address: deal.escrowAddress, amountTon: deal.amountTon };
      }

      const address = await createEscrowWallet(dealId);
      return { address, amountTon: deal.amountTon };
    },
  );

  // Cancel a deal
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/cancel',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      return dealService.cancelDeal(id, request.telegramUser.id);
    },
  );

  // Dispute a deal
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/dispute',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = disputeDealSchema.parse(request.body);
      return dealService.disputeDeal(id, request.telegramUser.id, body.reason);
    },
  );

  // Schedule a post
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative/schedule',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = scheduleDealSchema.parse(request.body);
      return dealService.setScheduledPostTime(
        id,
        request.telegramUser.id,
        new Date(body.scheduledPostAt),
      );
    },
  );

  // Get deal receipt (proof of completion after purge)
  app.get<{ Params: { id: string } }>(
    '/api/deals/:id/receipt',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      // Authorization: verify the user is a party to this deal
      await dealService.getDeal(id, request.telegramUser.id);
      return dealService.getDealReceipt(id);
    },
  );
}
