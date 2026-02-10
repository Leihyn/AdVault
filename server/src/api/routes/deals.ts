import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { createDealSchema, scheduleDealSchema, disputeDealSchema } from '../schemas/index.js';
import * as dealService from '../../services/deal.service.js';
import { createEscrowWallet } from '../../services/escrow.service.js';

const prisma = new PrismaClient();

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
      return dealService.getDeal(Number(request.params.id), request.telegramUser.id);
    },
  );

  // Get escrow wallet address for payment
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/pay',
    { preHandler: authMiddleware },
    async (request) => {
      const dealId = Number(request.params.id);
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
      return dealService.cancelDeal(
        Number(request.params.id),
        request.telegramUser.id,
      );
    },
  );

  // Dispute a deal
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/dispute',
    { preHandler: authMiddleware },
    async (request) => {
      const body = disputeDealSchema.parse(request.body);
      return dealService.disputeDeal(
        Number(request.params.id),
        request.telegramUser.id,
        body.reason,
      );
    },
  );

  // Schedule a post
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative/schedule',
    { preHandler: authMiddleware },
    async (request) => {
      const body = scheduleDealSchema.parse(request.body);
      return dealService.setScheduledPostTime(
        Number(request.params.id),
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
      const receipt = await prisma.dealReceipt.findUnique({
        where: { dealId: Number(request.params.id) },
      });
      if (!receipt) {
        return { purged: false, message: 'Deal data still available or deal not found' };
      }
      return { purged: true, receipt };
    },
  );
}
