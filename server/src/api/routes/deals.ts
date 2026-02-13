import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  createDealSchema, submitPostProofSchema, schedulePostSchema,
  disputeDealSchema, disputeEvidenceSchema, disputeProposalSchema,
  adminResolveSchema, parseParamId,
} from '../schemas/index.js';
import * as dealService from '../../services/deal.service.js';
import * as proofService from '../../services/proof.service.js';
import * as disputeService from '../../services/dispute.service.js';
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

  // Open a dispute on a deal
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/dispute',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = disputeDealSchema.parse(request.body);
      return disputeService.openDispute(id, request.telegramUser.id, body.reason);
    },
  );

  // Get dispute details
  app.get<{ Params: { id: string } }>(
    '/api/deals/:id/dispute',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      return disputeService.getDispute(id, request.telegramUser.id);
    },
  );

  // Submit evidence for a dispute
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/dispute/evidence',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = disputeEvidenceSchema.parse(request.body);
      return disputeService.submitEvidence(id, request.telegramUser.id, body.description, body.url);
    },
  );

  // Propose a resolution
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/dispute/propose',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = disputeProposalSchema.parse(request.body);
      return disputeService.proposeResolution(
        id, request.telegramUser.id, body.outcome as any, body.splitPercent,
      );
    },
  );

  // Accept the other party's proposal
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/dispute/accept',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      return disputeService.acceptProposal(id, request.telegramUser.id);
    },
  );

  // Schedule auto-post for a deal (either party can set the time)
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/schedule-post',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = schedulePostSchema.parse(request.body);
      // Verify user is a party to this deal
      await dealService.getDeal(id, request.telegramUser.id);
      return dealService.setScheduledPostTime(id, new Date(body.scheduledPostAt));
    },
  );

  // Submit post proof (creator submits URL of their published post)
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/post-proof',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = submitPostProofSchema.parse(request.body);
      return proofService.submitPostProof(id, request.telegramUser.id, body.postUrl);
    },
  );

  // Waive a requirement (advertiser)
  app.post<{ Params: { id: string; reqId: string } }>(
    '/api/deals/:id/requirements/:reqId/waive',
    { preHandler: authMiddleware },
    async (request) => {
      const dealId = parseParamId(request.params.id);
      const reqId = parseParamId(request.params.reqId);
      return proofService.waiveRequirement(dealId, reqId, request.telegramUser.id);
    },
  );

  // Confirm a CUSTOM requirement (advertiser)
  app.post<{ Params: { id: string; reqId: string } }>(
    '/api/deals/:id/requirements/:reqId/confirm',
    { preHandler: authMiddleware },
    async (request) => {
      const dealId = parseParamId(request.params.id);
      const reqId = parseParamId(request.params.reqId);
      return proofService.confirmRequirement(dealId, reqId, request.telegramUser.id);
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
