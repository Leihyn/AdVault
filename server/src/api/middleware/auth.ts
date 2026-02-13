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

function setUser(request: FastifyRequest, user: AuthUser) {
  request.telegramUser = user;
  request.user = user;
}

/**
 * Try dev bypass — returns true if handled.
 * In dev mode, parses the real Telegram user from initData (unverified)
 * or falls back to a hardcoded dev user ID.
 */
async function tryDevBypass(request: FastifyRequest): Promise<boolean> {
  if (config.NODE_ENV !== 'development' || !config.DEV_BYPASS_SECRET) return false;

  const devSecret = request.headers['x-dev-secret'] as string;
  if (!devSecret || devSecret !== config.DEV_BYPASS_SECRET) return false;

  // Try to extract real Telegram user from initData (skip signature check)
  const initDataRaw = request.headers['x-telegram-init-data'] as string;
  if (initDataRaw) {
    try {
      const params = new URLSearchParams(initDataRaw);
      const userData = params.get('user');
      if (userData) {
        const tgUser = JSON.parse(userData);
        if (tgUser.id) {
          const user = await prisma.user.upsert({
            where: { telegramId: BigInt(tgUser.id) },
            update: {
              username: tgUser.username || undefined,
              firstName: tgUser.first_name,
            },
            create: {
              telegramId: BigInt(tgUser.id),
              username: tgUser.username || undefined,
              firstName: tgUser.first_name,
            },
          });
          setUser(request, {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username || undefined,
            firstName: user.firstName || undefined,
          });
          return true;
        }
      }
    } catch {
      // Fall through to hardcoded dev user
    }
  }

  // Fallback: use hardcoded dev user ID
  const devUserId = request.headers['x-dev-user-id'] as string;
  if (devUserId) {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(devUserId) },
      update: {},
      create: {
        telegramId: BigInt(devUserId),
        firstName: 'Dev User',
      },
    });
    setUser(request, {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username || undefined,
      firstName: user.firstName || undefined,
    });
    return true;
  }

  return false;
}

/**
 * Fastify preHandler that validates Telegram Mini App initData.
 * In development: tries real validation first, falls back to dev bypass.
 * In production: requires valid initData signature.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const initDataRaw = request.headers['x-telegram-init-data'] as string;

  // Try real Telegram validation first
  if (initDataRaw) {
    const initData = validateInitData(initDataRaw);
    if (initData) {
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
      setUser(request, {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username || undefined,
        firstName: user.firstName || undefined,
      });
      return;
    }
  }

  // Real validation failed or no initData — try dev bypass
  if (await tryDevBypass(request)) return;

  // Nothing worked
  if (!initDataRaw) {
    throw new UnauthorizedError('Missing Telegram initData');
  }
  throw new UnauthorizedError('Invalid Telegram initData');
}
