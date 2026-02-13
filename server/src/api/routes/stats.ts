import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const prisma = new PrismaClient();

export async function statsRoutes(app: FastifyInstance) {
  // Get platform stats (public)
  app.get('/api/stats', async () => {
    const [channelCount, dealCount, completedDeals] = await Promise.all([
      prisma.channel.count(),
      prisma.deal.count(),
      prisma.deal.count({ where: { status: 'COMPLETED' } }),
    ]);

    const totalVolume = await prisma.deal.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amountTon: true },
    });

    return {
      channels: channelCount,
      deals: dealCount,
      completedDeals,
      totalVolumeTon: totalVolume._sum.amountTon || 0,
    };
  });

  // Get channel stats
  app.get<{ Params: { id: string } }>(
    '/api/channels/:id/stats',
    async (request) => {
      const channelId = Number(request.params.id);

      const [dealCount, completedDeals, totalRevenue] = await Promise.all([
        prisma.deal.count({ where: { channelId } }),
        prisma.deal.count({ where: { channelId, status: 'COMPLETED' } }),
        prisma.deal.aggregate({
          where: { channelId, status: 'COMPLETED' },
          _sum: { amountTon: true },
        }),
      ]);

      return {
        totalDeals: dealCount,
        completedDeals,
        totalRevenueTon: totalRevenue._sum.amountTon || 0,
      };
    },
  );
}
