import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { validateInitData, TelegramInitData } from '../../utils/telegram.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { config } from '../../config.js';

const prisma = new PrismaClient();

interface AuthUser {
  id: number;
  telegramId: bigint;
  username?: string;
  firstName?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser: AuthUser;
    /** Platform-agnostic alias for telegramUser */
    user: AuthUser;
  }
}

/**
 * Fastify preHandler that validates Telegram Mini App initData.
 * Extracts the user from initData and upserts them in the database.
 * Attaches the user to request.telegramUser.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Dev bypass: requires BOTH development mode AND an explicit secret.
  // The secret prevents accidental exploitation if NODE_ENV is misconfigured.
  if (config.NODE_ENV === 'development' && config.DEV_BYPASS_SECRET) {
    const devSecret = request.headers['x-dev-secret'] as string;
    const devUserId = request.headers['x-dev-user-id'] as string;
    if (devSecret && devUserId && devSecret === config.DEV_BYPASS_SECRET) {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(devUserId) },
      });
      if (user) {
        request.telegramUser = {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username || undefined,
          firstName: user.firstName || undefined,
        };
        request.user = request.telegramUser;
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
  request.user = request.telegramUser;
}
