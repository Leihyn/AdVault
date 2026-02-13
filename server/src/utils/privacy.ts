import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { config } from '../config.js';

/**
 * Generates a pseudonymous alias like "Seller-a7x3" or "Buyer-m9p2".
 * Deterministic aliases would leak identity across deals, so each deal
 * gets a fresh random alias.
 */
export function generateAlias(role: 'Seller' | 'Buyer'): string {
  const suffix = randomBytes(2).toString('hex');
  return `${role}-${suffix}`;
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns format: iv:tag:ciphertext (all hex).
 */
export function encryptField(plaintext: string): string {
  const key = Buffer.from(config.ESCROW_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a string from AES-256-GCM format (iv:tag:ciphertext).
 */
export function decryptField(encryptedStr: string): string {
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format');

  const [ivHex, tagHex, ciphertext] = parts;
  const key = Buffer.from(config.ESCROW_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Creates a SHA-256 hash of creative content for edit detection.
 * Used to detect if a posted message was modified after posting.
 */
export function hashCreativeContent(contentText: string, mediaUrl: string): string {
  const payload = `${contentText}|${mediaUrl}`;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Creates a SHA-256 hash of deal data for the receipt.
 * The receipt proves a deal existed and completed without storing the raw data.
 */
export function hashDealData(data: {
  dealId: number;
  channelId: number;
  advertiserId: number;
  amountTon: number | { toString(): string };
  finalStatus: string;
  escrowAddress?: string | null;
  completedAt: string;
}): string {
  const payload = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(payload).digest('hex');
}
