import { releaseFunds, refundFunds } from '../services/escrow.service.js';

/**
 * Releases escrowed funds to the channel owner.
 * Wrapper around escrow.service for use by workers.
 */
export async function releaseEscrow(dealId: number): Promise<string> {
  return releaseFunds(dealId);
}

/**
 * Refunds escrowed funds to the advertiser.
 * Wrapper around escrow.service for use by workers.
 */
export async function refundEscrow(dealId: number): Promise<string> {
  return refundFunds(dealId);
}
