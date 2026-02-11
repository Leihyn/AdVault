import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { submitCreativeSchema, revisionSchema, parseParamId } from '../schemas/index.js';
import * as creativeService from '../../services/creative.service.js';
import * as dealService from '../../services/deal.service.js';

export async function creativeRoutes(app: FastifyInstance) {
  // Submit or update creative draft
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = submitCreativeSchema.parse(request.body);
      return creativeService.submitCreative(id, request.telegramUser.id, body);
    },
  );

  // Approve creative (advertiser)
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative/approve',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      return creativeService.approveCreative(id, request.telegramUser.id);
    },
  );

  // Request revision (advertiser)
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative/revision',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      const body = revisionSchema.parse(request.body);
      return creativeService.requestRevision(id, request.telegramUser.id, body.notes);
    },
  );

  // Get creatives for a deal (authorization: must be a party)
  app.get<{ Params: { id: string } }>(
    '/api/deals/:id/creatives',
    { preHandler: authMiddleware },
    async (request) => {
      const id = parseParamId(request.params.id);
      // Verify user is a party to the deal (getDeal throws if not authorized)
      await dealService.getDeal(id, request.telegramUser.id);
      return creativeService.getCreatives(id);
    },
  );
}
