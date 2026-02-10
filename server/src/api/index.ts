import { FastifyInstance } from 'fastify';
import { channelRoutes } from './routes/channels.js';
import { campaignRoutes } from './routes/campaigns.js';
import { dealRoutes } from './routes/deals.js';
import { creativeRoutes } from './routes/creatives.js';
import { userRoutes } from './routes/users.js';
import { statsRoutes } from './routes/stats.js';
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

export async function registerRoutes(app: FastifyInstance) {
  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code || 'APP_ERROR',
        message: error.message,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.flatten().fieldErrors,
      });
    }

    console.error('Unhandled error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
  });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Register all route modules
  await app.register(channelRoutes);
  await app.register(campaignRoutes);
  await app.register(dealRoutes);
  await app.register(creativeRoutes);
  await app.register(userRoutes);
  await app.register(statsRoutes);
}
