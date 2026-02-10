import { describe, it, expect } from 'vitest';
import { DealStatus } from '@prisma/client';

// Replicate from deal.service.ts for isolated testing
const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  PENDING_PAYMENT: ['FUNDED', 'CANCELLED', 'TIMED_OUT'],
  FUNDED: ['CREATIVE_PENDING', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_PENDING: ['CREATIVE_SUBMITTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_SUBMITTED: ['CREATIVE_APPROVED', 'CREATIVE_REVISION', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_REVISION: ['CREATIVE_SUBMITTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_APPROVED: ['SCHEDULED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  SCHEDULED: ['POSTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  POSTED: ['VERIFIED', 'DISPUTED', 'TIMED_OUT'],
  VERIFIED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
  DISPUTED: ['REFUNDED', 'COMPLETED'],
  TIMED_OUT: ['REFUNDED'],
};

const STATUS_TIMEOUTS: Partial<Record<DealStatus, number>> = {
  PENDING_PAYMENT: 24,
  FUNDED: 72,
  CREATIVE_PENDING: 72,
  CREATIVE_SUBMITTED: 96,
  CREATIVE_REVISION: 72,
};

const ALL_STATUSES: DealStatus[] = Object.keys(VALID_TRANSITIONS) as DealStatus[];

const TERMINAL_STATUSES: DealStatus[] = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'];

const REFUNDABLE_STATUSES: DealStatus[] = [
  'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED',
  'CREATIVE_REVISION', 'CREATIVE_APPROVED', 'SCHEDULED',
];

function canTransition(from: DealStatus, to: DealStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

describe('Deal State Machine — Edge Cases', () => {
  // ==================== Transition matrix completeness ====================
  describe('transition matrix completeness', () => {
    it('every transition target is a valid DealStatus', () => {
      for (const [status, targets] of Object.entries(VALID_TRANSITIONS)) {
        for (const target of targets) {
          expect(ALL_STATUSES).toContain(target);
        }
      }
    });

    it('no status has itself as a valid target', () => {
      for (const [status, targets] of Object.entries(VALID_TRANSITIONS)) {
        expect(targets).not.toContain(status);
      }
    });

    it('no duplicate targets in any transition list', () => {
      for (const [status, targets] of Object.entries(VALID_TRANSITIONS)) {
        const unique = new Set(targets);
        expect(unique.size).toBe(targets.length);
      }
    });

    it('total number of statuses is exactly 14', () => {
      expect(ALL_STATUSES).toHaveLength(14);
    });

    it('terminal statuses have no outgoing transitions except TIMED_OUT and DISPUTED', () => {
      // COMPLETED, CANCELLED, REFUNDED have zero transitions
      expect(VALID_TRANSITIONS['COMPLETED']).toHaveLength(0);
      expect(VALID_TRANSITIONS['CANCELLED']).toHaveLength(0);
      expect(VALID_TRANSITIONS['REFUNDED']).toHaveLength(0);
      // TIMED_OUT has exactly one: REFUNDED
      expect(VALID_TRANSITIONS['TIMED_OUT']).toHaveLength(1);
    });
  });

  // ==================== Fee calculation logic ====================
  describe('fee calculation logic (isolated)', () => {
    function calculatePayout(amountTon: number, feePercent: number) {
      const fee = amountTon * (feePercent / 100);
      return amountTon - fee;
    }

    it('5% fee on 100 TON = 95 TON payout', () => {
      expect(calculatePayout(100, 5)).toBe(95);
    });

    it('0% fee = full amount', () => {
      expect(calculatePayout(100, 0)).toBe(100);
    });

    it('100% fee = zero payout', () => {
      expect(calculatePayout(100, 100)).toBe(0);
    });

    it('negative fee = payout exceeds amount (config vulnerability)', () => {
      const payout = calculatePayout(100, -5);
      expect(payout).toBe(105);
      expect(payout).toBeGreaterThan(100);
    });

    it('fee > 100% = negative payout', () => {
      const payout = calculatePayout(100, 150);
      expect(payout).toBeLessThan(0);
    });

    it('floating point precision: 5% of 1.0 TON', () => {
      const payout = calculatePayout(1.0, 5);
      expect(payout).toBeCloseTo(0.95);
    });

    it('floating point precision: 5% of 0.1 TON', () => {
      const payout = calculatePayout(0.1, 5);
      expect(payout).toBeCloseTo(0.095);
    });

    it('floating point precision: 3% of 33.33 TON', () => {
      const payout = calculatePayout(33.33, 3);
      expect(payout).toBeCloseTo(32.3301, 3);
    });

    it('very small amount: 5% of 0.000001 TON', () => {
      const payout = calculatePayout(0.000001, 5);
      expect(payout).toBeCloseTo(0.00000095);
    });
  });

  // ==================== Timeout logic ====================
  describe('timeout duration consistency', () => {
    it('only non-terminal statuses have timeouts', () => {
      for (const status of TERMINAL_STATUSES) {
        expect(STATUS_TIMEOUTS[status]).toBeUndefined();
      }
    });

    it('timeout durations are all positive', () => {
      for (const [status, hours] of Object.entries(STATUS_TIMEOUTS)) {
        expect(hours).toBeGreaterThan(0);
      }
    });

    it('PENDING_PAYMENT has shortest timeout', () => {
      const values = Object.values(STATUS_TIMEOUTS) as number[];
      expect(STATUS_TIMEOUTS['PENDING_PAYMENT']).toBe(Math.min(...values));
    });

    it('CREATIVE_SUBMITTED has longest timeout (more review time)', () => {
      const values = Object.values(STATUS_TIMEOUTS) as number[];
      expect(STATUS_TIMEOUTS['CREATIVE_SUBMITTED']).toBe(Math.max(...values));
    });

    it('statuses beyond creative phase have no timeout (verified by absence)', () => {
      expect(STATUS_TIMEOUTS['CREATIVE_APPROVED']).toBeUndefined();
      expect(STATUS_TIMEOUTS['SCHEDULED']).toBeUndefined();
      expect(STATUS_TIMEOUTS['POSTED']).toBeUndefined();
      expect(STATUS_TIMEOUTS['VERIFIED']).toBeUndefined();
    });

    it('timeout calculation produces future date', () => {
      const now = Date.now();
      for (const [status, hours] of Object.entries(STATUS_TIMEOUTS)) {
        const timeoutAt = new Date(now + (hours as number) * 60 * 60 * 1000);
        expect(timeoutAt.getTime()).toBeGreaterThan(now);
      }
    });
  });

  // ==================== Dispute resolution paths ====================
  describe('dispute resolution paths', () => {
    it('DISPUTED has exactly 2 resolution paths', () => {
      expect(VALID_TRANSITIONS['DISPUTED']).toHaveLength(2);
    });

    it('DISPUTED resolves to either REFUNDED or COMPLETED (no other options)', () => {
      expect(VALID_TRANSITIONS['DISPUTED']).toContain('REFUNDED');
      expect(VALID_TRANSITIONS['DISPUTED']).toContain('COMPLETED');
    });

    it('dispute can be raised from all funded non-terminal statuses', () => {
      const disputeableStatuses: DealStatus[] = [
        'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED',
        'CREATIVE_REVISION', 'CREATIVE_APPROVED', 'SCHEDULED', 'POSTED',
      ];
      for (const status of disputeableStatuses) {
        expect(canTransition(status, 'DISPUTED')).toBe(true);
      }
    });

    it('cannot dispute from PENDING_PAYMENT (no funds at risk)', () => {
      expect(canTransition('PENDING_PAYMENT', 'DISPUTED')).toBe(false);
    });

    it('cannot dispute from VERIFIED (too late, about to complete)', () => {
      expect(canTransition('VERIFIED', 'DISPUTED')).toBe(false);
    });

    it('cannot dispute from terminal states', () => {
      for (const terminal of TERMINAL_STATUSES) {
        expect(canTransition(terminal, 'DISPUTED')).toBe(false);
      }
    });
  });

  // ==================== Refundable status consistency ====================
  describe('refundable status consistency', () => {
    it('all refundable statuses can transition to REFUNDED', () => {
      for (const status of REFUNDABLE_STATUSES) {
        expect(canTransition(status, 'REFUNDED')).toBe(true);
      }
    });

    it('PENDING_PAYMENT is not refundable (no funds to refund)', () => {
      expect(REFUNDABLE_STATUSES).not.toContain('PENDING_PAYMENT');
      expect(canTransition('PENDING_PAYMENT', 'REFUNDED')).toBe(false);
    });

    it('POSTED is not directly refundable (must dispute first)', () => {
      expect(canTransition('POSTED', 'REFUNDED')).toBe(false);
    });

    it('TIMED_OUT can be refunded (separate from normal refund flow)', () => {
      expect(canTransition('TIMED_OUT', 'REFUNDED')).toBe(true);
    });
  });

  // ==================== Path analysis ====================
  describe('path analysis — shortest and longest', () => {
    function findShortestPath(from: DealStatus, to: DealStatus): DealStatus[] | null {
      const queue: DealStatus[][] = [[from]];
      const visited = new Set<DealStatus>();

      while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1];

        if (current === to) return path;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const next of VALID_TRANSITIONS[current]) {
          queue.push([...path, next]);
        }
      }
      return null;
    }

    it('shortest path to COMPLETED from PENDING_PAYMENT is 4 steps (via DISPUTED)', () => {
      // PENDING_PAYMENT → FUNDED → DISPUTED → COMPLETED
      const path = findShortestPath('PENDING_PAYMENT', 'COMPLETED');
      expect(path).not.toBeNull();
      expect(path!).toHaveLength(4);
      expect(path!).toEqual(['PENDING_PAYMENT', 'FUNDED', 'DISPUTED', 'COMPLETED']);
    });

    it('shortest path to CANCELLED from PENDING_PAYMENT is 2 steps', () => {
      const path = findShortestPath('PENDING_PAYMENT', 'CANCELLED');
      expect(path).toEqual(['PENDING_PAYMENT', 'CANCELLED']);
    });

    it('shortest path to REFUNDED from FUNDED is 2 steps', () => {
      const path = findShortestPath('FUNDED', 'REFUNDED');
      expect(path).toEqual(['FUNDED', 'REFUNDED']);
    });

    it('shortest path to COMPLETED through DISPUTED is 4 steps minimum', () => {
      // PENDING_PAYMENT → FUNDED → DISPUTED → COMPLETED
      const path = findShortestPath('PENDING_PAYMENT', 'COMPLETED');
      // The shortest through DISPUTED would be:
      // PENDING_PAYMENT → FUNDED → DISPUTED → COMPLETED = 4 steps
      // But normal happy path is shorter (9 steps) — check both exist
      expect(path).not.toBeNull();

      // Also verify the dispute path exists
      expect(canTransition('FUNDED', 'DISPUTED')).toBe(true);
      expect(canTransition('DISPUTED', 'COMPLETED')).toBe(true);
    });

    it('REFUNDED is reachable from every funded status', () => {
      const fundedStatuses: DealStatus[] = [
        'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED',
        'CREATIVE_REVISION', 'CREATIVE_APPROVED', 'SCHEDULED',
      ];
      for (const status of fundedStatuses) {
        const path = findShortestPath(status, 'REFUNDED');
        expect(path).not.toBeNull();
      }
    });

    it('COMPLETED is unreachable from CANCELLED (terminal)', () => {
      const path = findShortestPath('CANCELLED', 'COMPLETED');
      expect(path).toBeNull();
    });

    it('COMPLETED is unreachable from REFUNDED (terminal)', () => {
      const path = findShortestPath('REFUNDED', 'COMPLETED');
      expect(path).toBeNull();
    });
  });

  // ==================== Symmetry analysis ====================
  describe('transition symmetry analysis', () => {
    it('the only bidirectional transition is CREATIVE_SUBMITTED ↔ CREATIVE_REVISION', () => {
      const bidirectional: [DealStatus, DealStatus][] = [];

      for (const from of ALL_STATUSES) {
        for (const to of VALID_TRANSITIONS[from]) {
          if (canTransition(to, from)) {
            bidirectional.push([from, to]);
          }
        }
      }

      // Should only find the revision loop (both directions)
      expect(bidirectional).toHaveLength(2);
      expect(bidirectional).toContainEqual(['CREATIVE_SUBMITTED', 'CREATIVE_REVISION']);
      expect(bidirectional).toContainEqual(['CREATIVE_REVISION', 'CREATIVE_SUBMITTED']);
    });
  });

  // ==================== Edge: TIMED_OUT behavior ====================
  describe('TIMED_OUT behavior', () => {
    it('all active statuses can transition to TIMED_OUT', () => {
      const activeStatuses: DealStatus[] = [
        'PENDING_PAYMENT', 'FUNDED', 'CREATIVE_PENDING',
        'CREATIVE_SUBMITTED', 'CREATIVE_REVISION', 'CREATIVE_APPROVED',
        'SCHEDULED', 'POSTED',
      ];
      for (const status of activeStatuses) {
        expect(canTransition(status, 'TIMED_OUT')).toBe(true);
      }
    });

    it('VERIFIED cannot time out (almost done)', () => {
      expect(canTransition('VERIFIED', 'TIMED_OUT')).toBe(false);
    });

    it('TIMED_OUT is quasi-terminal: can only go to REFUNDED', () => {
      expect(VALID_TRANSITIONS['TIMED_OUT']).toEqual(['REFUNDED']);
      expect(canTransition('TIMED_OUT', 'CANCELLED')).toBe(false);
      expect(canTransition('TIMED_OUT', 'COMPLETED')).toBe(false);
      expect(canTransition('TIMED_OUT', 'DISPUTED')).toBe(false);
    });
  });

  // ==================== Exhaustive invalid transition test ====================
  describe('exhaustive invalid transitions for terminal states', () => {
    for (const terminal of ['COMPLETED', 'CANCELLED', 'REFUNDED'] as DealStatus[]) {
      it(`${terminal} has no outgoing transitions at all`, () => {
        for (const target of ALL_STATUSES) {
          expect(canTransition(terminal, target)).toBe(false);
        }
      });
    }
  });

  // ==================== Guard: POSTED restrictions ====================
  describe('POSTED status restrictions', () => {
    it('POSTED cannot be cancelled (post already published)', () => {
      expect(canTransition('POSTED', 'CANCELLED')).toBe(false);
    });

    it('POSTED cannot be refunded directly (must dispute first)', () => {
      expect(canTransition('POSTED', 'REFUNDED')).toBe(false);
    });

    it('POSTED can only go to VERIFIED, DISPUTED, or TIMED_OUT', () => {
      expect(VALID_TRANSITIONS['POSTED']).toEqual(['VERIFIED', 'DISPUTED', 'TIMED_OUT']);
    });
  });
});
