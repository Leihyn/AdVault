import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { submitCreativeSchema, revisionSchema } from '../schemas/index.js';
import * as creativeService from '../../services/creative.service.js';

export async function creativeRoutes(app: FastifyInstance) {
  // Submit or update creative draft
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative',
    { preHandler: authMiddleware },
    async (request) => {
      const body = submitCreativeSchema.parse(request.body);
      return creativeService.submitCreative(
        Number(request.params.id),
        request.telegramUser.id,
        body,
      );
    },
  );

  // Approve creative (advertiser)
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative/approve',
    { preHandler: authMiddleware },
    async (request) => {
      return creativeService.approveCreative(
        Number(request.params.id),
        request.telegramUser.id,
      );
    },
  );

  // Request revision (advertiser)
  app.post<{ Params: { id: string } }>(
    '/api/deals/:id/creative/revision',
    { preHandler: authMiddleware },
    async (request) => {
      const body = revisionSchema.parse(request.body);
      return creativeService.requestRevision(
        Number(request.params.id),
        request.telegramUser.id,
        body.notes,
      );
    },
  );

  // Get creatives for a deal
  app.get<{ Params: { id: string } }>(
    '/api/deals/:id/creatives',
    { preHandler: authMiddleware },
    async (request) => {
      return creativeService.getCreatives(Number(request.params.id));
    },
  );
}
