import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { validateInitData, TelegramInitData } from '../../utils/telegram.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { config } from '../../config.js';

const prisma = new PrismaClient();

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser: {
      id: number;
      telegramId: bigint;
      username?: string;
      firstName?: string;
    };
  }
}

/**
 * Fastify preHandler that validates Telegram Mini App initData.
 * Extracts the user from initData and upserts them in the database.
 * Attaches the user to request.telegramUser.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // In development, allow a header-based bypass for testing
  if (config.NODE_ENV === 'development') {
    const devUserId = request.headers['x-dev-user-id'];
    if (devUserId) {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(devUserId as string) },
      });
      if (user) {
        request.telegramUser = {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username || undefined,
          firstName: user.firstName || undefined,
        };
        return;
      }
    }
  }

  const initDataRaw = request.headers['x-telegram-init-data'] as string;
  if (!initDataRaw) {
    throw new UnauthorizedError('Missing Telegram initData');
  }

  const initData = validateInitData(initDataRaw);
  if (!initData) {
    throw new UnauthorizedError('Invalid Telegram initData');
  }

  // Upsert the user — create if first visit, update name/username if changed
  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(initData.user.id) },
    update: {
      username: initData.user.username || undefined,
      firstName: initData.user.first_name,
    },
    create: {
      telegramId: BigInt(initData.user.id),
      username: initData.user.username || undefined,
      firstName: initData.user.first_name,
    },
  });

  request.telegramUser = {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username || undefined,
    firstName: user.firstName || undefined,
  };
}
