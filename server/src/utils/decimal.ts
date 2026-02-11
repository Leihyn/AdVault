import { Decimal } from '@prisma/client/runtime/library';

/**
 * Safe Decimal arithmetic for financial calculations.
 * Prisma returns Decimal objects for @db.Decimal fields.
 * These helpers avoid floating-point precision loss.
 */

/** Convert a Decimal to nanotons (bigint) — 1 TON = 1e9 nanotons */
export function toNanotons(amount: Decimal): bigint {
  // Multiply by 1e9, then truncate to integer
  const nano = amount.mul(1_000_000_000).floor();
  return BigInt(nano.toString());
}

/** Convert a Decimal to a string safe for toNano() */
export function decimalToString(amount: Decimal): string {
  return amount.toFixed(9);
}

/** Subtract a percentage fee from an amount, returning { fee, payout } */
export function subtractFee(amount: Decimal, feePercent: number): { fee: Decimal; payout: Decimal } {
  const fee = amount.mul(feePercent).div(100);
  const payout = amount.sub(fee);
  return { fee, payout };
}

/** Convert a number to Decimal (for API inputs validated by Zod) */
export function toDecimal(value: number): Decimal {
  return new Decimal(value.toString());
}
