import { Context, NextFunction } from 'grammy';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Ensures the Telegram user exists in our database.
 * Creates them on first interaction.
 */
export async function ensureUser(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();

  await prisma.user.upsert({
    where: { telegramId: BigInt(ctx.from.id) },
    update: {
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
    },
    create: {
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
    },
  });

  return next();
}
