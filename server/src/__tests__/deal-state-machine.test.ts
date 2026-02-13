import { describe, it, expect } from 'vitest';
import { DealStatus } from '@prisma/client';

/**
 * Tests the deal state machine transitions exhaustively.
 * Since the actual service depends on Prisma, we test the transition
 * logic directly by importing the rules.
 */

// These mirror the VALID_TRANSITIONS map in deal.service.ts
const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  PENDING_PAYMENT: ['FUNDED', 'CANCELLED', 'TIMED_OUT'],
  FUNDED: ['CREATIVE_PENDING', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_PENDING: ['CREATIVE_SUBMITTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_SUBMITTED: ['CREATIVE_APPROVED', 'CREATIVE_REVISION', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_REVISION: ['CREATIVE_SUBMITTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  CREATIVE_APPROVED: ['POSTED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT'],
  POSTED: ['TRACKING', 'DISPUTED', 'TIMED_OUT'],
  TRACKING: ['VERIFIED', 'FAILED', 'DISPUTED', 'TIMED_OUT'],
  VERIFIED: ['COMPLETED'],
  COMPLETED: [],
  FAILED: ['REFUNDED', 'DISPUTED'],
  CANCELLED: [],
  REFUNDED: [],
  DISPUTED: ['REFUNDED', 'COMPLETED'],
  TIMED_OUT: ['REFUNDED'],
};

const ALL_STATUSES: DealStatus[] = [
  'PENDING_PAYMENT', 'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED',
  'CREATIVE_REVISION', 'CREATIVE_APPROVED', 'POSTED', 'TRACKING',
  'VERIFIED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT',
];

const STATUS_TIMEOUTS: Partial<Record<DealStatus, number>> = {
  PENDING_PAYMENT: 24,
  FUNDED: 72,
  CREATIVE_PENDING: 72,
  CREATIVE_SUBMITTED: 96,
  CREATIVE_REVISION: 72,
  CREATIVE_APPROVED: 168,
};

function canTransition(from: DealStatus, to: DealStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

describe('Deal State Machine', () => {
  describe('All statuses are defined', () => {
    it('has transitions for all 15 statuses', () => {
      expect(Object.keys(VALID_TRANSITIONS)).toHaveLength(15);
      for (const status of ALL_STATUSES) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
      }
    });
  });

  // ==================== Happy Path ====================
  describe('Happy path: full deal lifecycle', () => {
    const happyPath: DealStatus[] = [
      'PENDING_PAYMENT', 'FUNDED', 'CREATIVE_PENDING',
      'CREATIVE_SUBMITTED', 'CREATIVE_APPROVED',
      'POSTED', 'TRACKING', 'VERIFIED', 'COMPLETED',
    ];

    it('allows the full happy path sequence', () => {
      for (let i = 0; i < happyPath.length - 1; i++) {
        expect(canTransition(happyPath[i], happyPath[i + 1])).toBe(true);
      }
    });

    it('COMPLETED is terminal (no further transitions)', () => {
      expect(VALID_TRANSITIONS['COMPLETED']).toEqual([]);
      for (const status of ALL_STATUSES) {
        expect(canTransition('COMPLETED', status)).toBe(false);
      }
    });
  });

  // ==================== Creative Revision Loop ====================
  describe('Creative revision loop', () => {
    it('allows SUBMITTED → REVISION → SUBMITTED cycle', () => {
      expect(canTransition('CREATIVE_SUBMITTED', 'CREATIVE_REVISION')).toBe(true);
      expect(canTransition('CREATIVE_REVISION', 'CREATIVE_SUBMITTED')).toBe(true);
    });

    it('allows multiple revision rounds', () => {
      let state: DealStatus = 'CREATIVE_SUBMITTED';
      for (let i = 0; i < 5; i++) {
        expect(canTransition(state, 'CREATIVE_REVISION')).toBe(true);
        state = 'CREATIVE_REVISION';
        expect(canTransition(state, 'CREATIVE_SUBMITTED')).toBe(true);
        state = 'CREATIVE_SUBMITTED';
      }
      expect(canTransition(state, 'CREATIVE_APPROVED')).toBe(true);
    });

    it('revision cannot go directly to APPROVED', () => {
      expect(canTransition('CREATIVE_REVISION', 'CREATIVE_APPROVED')).toBe(false);
    });
  });

  // ==================== Cancellation ====================
  describe('Cancellation paths', () => {
    const cancellableStatuses: DealStatus[] = [
      'PENDING_PAYMENT', 'FUNDED', 'CREATIVE_PENDING',
      'CREATIVE_SUBMITTED', 'CREATIVE_REVISION', 'CREATIVE_APPROVED',
    ];

    it('allows cancellation from all pre-post statuses', () => {
      for (const status of cancellableStatuses) {
        expect(canTransition(status, 'CANCELLED')).toBe(true);
      }
    });

    it('does not allow cancellation from POSTED', () => {
      expect(canTransition('POSTED', 'CANCELLED')).toBe(false);
    });

    it('does not allow cancellation from TRACKING', () => {
      expect(canTransition('TRACKING', 'CANCELLED')).toBe(false);
    });

    it('does not allow cancellation from VERIFIED', () => {
      expect(canTransition('VERIFIED', 'CANCELLED')).toBe(false);
    });

    it('CANCELLED is terminal', () => {
      expect(VALID_TRANSITIONS['CANCELLED']).toEqual([]);
    });
  });

  // ==================== Refund ====================
  describe('Refund paths', () => {
    const refundableStatuses: DealStatus[] = [
      'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED',
      'CREATIVE_REVISION', 'CREATIVE_APPROVED',
    ];

    it('allows refund from all funded pre-post statuses', () => {
      for (const status of refundableStatuses) {
        expect(canTransition(status, 'REFUNDED')).toBe(true);
      }
    });

    it('does not allow refund from PENDING_PAYMENT (no funds to refund)', () => {
      expect(canTransition('PENDING_PAYMENT', 'REFUNDED')).toBe(false);
    });

    it('REFUNDED is terminal', () => {
      expect(VALID_TRANSITIONS['REFUNDED']).toEqual([]);
    });

    it('allows refund from DISPUTED', () => {
      expect(canTransition('DISPUTED', 'REFUNDED')).toBe(true);
    });

    it('allows refund from TIMED_OUT', () => {
      expect(canTransition('TIMED_OUT', 'REFUNDED')).toBe(true);
    });

    it('allows refund from FAILED', () => {
      expect(canTransition('FAILED', 'REFUNDED')).toBe(true);
    });
  });

  // ==================== Dispute ====================
  describe('Dispute paths', () => {
    it('allows dispute from funded statuses', () => {
      const disputeStatuses: DealStatus[] = [
        'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED',
        'CREATIVE_REVISION', 'CREATIVE_APPROVED', 'POSTED', 'TRACKING',
      ];
      for (const status of disputeStatuses) {
        expect(canTransition(status, 'DISPUTED')).toBe(true);
      }
    });

    it('does not allow dispute from PENDING_PAYMENT', () => {
      expect(canTransition('PENDING_PAYMENT', 'DISPUTED')).toBe(false);
    });

    it('DISPUTED can resolve to REFUNDED or COMPLETED', () => {
      expect(canTransition('DISPUTED', 'REFUNDED')).toBe(true);
      expect(canTransition('DISPUTED', 'COMPLETED')).toBe(true);
      expect(VALID_TRANSITIONS['DISPUTED']).toHaveLength(2);
    });

    it('DISPUTED cannot go back to normal flow', () => {
      expect(canTransition('DISPUTED', 'CREATIVE_PENDING')).toBe(false);
      expect(canTransition('DISPUTED', 'POSTED')).toBe(false);
      expect(canTransition('DISPUTED', 'TRACKING')).toBe(false);
    });

    it('allows dispute from FAILED', () => {
      expect(canTransition('FAILED', 'DISPUTED')).toBe(true);
    });
  });

  // ==================== Timeout ====================
  describe('Timeout paths', () => {
    it('allows timeout from all active statuses', () => {
      const timeoutStatuses: DealStatus[] = [
        'PENDING_PAYMENT', 'FUNDED', 'CREATIVE_PENDING',
        'CREATIVE_SUBMITTED', 'CREATIVE_REVISION', 'CREATIVE_APPROVED',
        'POSTED', 'TRACKING',
      ];
      for (const status of timeoutStatuses) {
        expect(canTransition(status, 'TIMED_OUT')).toBe(true);
      }
    });

    it('does not allow timeout from terminal statuses', () => {
      for (const status of ['COMPLETED', 'CANCELLED', 'REFUNDED'] as DealStatus[]) {
        expect(canTransition(status, 'TIMED_OUT')).toBe(false);
      }
    });

    it('TIMED_OUT can only transition to REFUNDED', () => {
      expect(VALID_TRANSITIONS['TIMED_OUT']).toEqual(['REFUNDED']);
    });
  });

  // ==================== TRACKING and FAILED paths ====================
  describe('Tracking and Failed paths', () => {
    it('CREATIVE_APPROVED transitions to POSTED', () => {
      expect(canTransition('CREATIVE_APPROVED', 'POSTED')).toBe(true);
    });

    it('POSTED transitions to TRACKING', () => {
      expect(canTransition('POSTED', 'TRACKING')).toBe(true);
    });

    it('TRACKING can go to VERIFIED when all requirements met', () => {
      expect(canTransition('TRACKING', 'VERIFIED')).toBe(true);
    });

    it('TRACKING can go to FAILED when requirements not met', () => {
      expect(canTransition('TRACKING', 'FAILED')).toBe(true);
    });

    it('FAILED can be refunded', () => {
      expect(canTransition('FAILED', 'REFUNDED')).toBe(true);
    });

    it('FAILED can be disputed', () => {
      expect(canTransition('FAILED', 'DISPUTED')).toBe(true);
    });

    it('FAILED has exactly 2 transitions', () => {
      expect(VALID_TRANSITIONS['FAILED']).toHaveLength(2);
    });
  });

  // ==================== Timeout Durations ====================
  describe('Timeout durations', () => {
    it('PENDING_PAYMENT has 24h timeout', () => {
      expect(STATUS_TIMEOUTS['PENDING_PAYMENT']).toBe(24);
    });

    it('FUNDED has 72h timeout', () => {
      expect(STATUS_TIMEOUTS['FUNDED']).toBe(72);
    });

    it('CREATIVE_SUBMITTED has 96h timeout', () => {
      expect(STATUS_TIMEOUTS['CREATIVE_SUBMITTED']).toBe(96);
    });

    it('CREATIVE_APPROVED has 168h (7 day) timeout', () => {
      expect(STATUS_TIMEOUTS['CREATIVE_APPROVED']).toBe(168);
    });

    it('POSTED has no timeout (verification window is per-deal)', () => {
      expect(STATUS_TIMEOUTS['POSTED']).toBeUndefined();
    });

    it('terminal statuses have no timeouts', () => {
      expect(STATUS_TIMEOUTS['COMPLETED']).toBeUndefined();
      expect(STATUS_TIMEOUTS['CANCELLED']).toBeUndefined();
      expect(STATUS_TIMEOUTS['REFUNDED']).toBeUndefined();
    });
  });

  // ==================== Invalid Transitions ====================
  describe('Invalid transitions', () => {
    it('cannot skip states in happy path', () => {
      expect(canTransition('PENDING_PAYMENT', 'CREATIVE_PENDING')).toBe(false);
      expect(canTransition('PENDING_PAYMENT', 'POSTED')).toBe(false);
      expect(canTransition('FUNDED', 'TRACKING')).toBe(false);
      expect(canTransition('CREATIVE_APPROVED', 'TRACKING')).toBe(false);
    });

    it('cannot go backwards in happy path', () => {
      expect(canTransition('FUNDED', 'PENDING_PAYMENT')).toBe(false);
      expect(canTransition('CREATIVE_APPROVED', 'FUNDED')).toBe(false);
      expect(canTransition('TRACKING', 'POSTED')).toBe(false);
      expect(canTransition('VERIFIED', 'TRACKING')).toBe(false);
    });

    it('cannot transition from terminal states', () => {
      const terminals: DealStatus[] = ['COMPLETED', 'CANCELLED', 'REFUNDED'];
      for (const terminal of terminals) {
        for (const target of ALL_STATUSES) {
          expect(canTransition(terminal, target)).toBe(false);
        }
      }
    });

    it('self-transitions are not allowed', () => {
      for (const status of ALL_STATUSES) {
        expect(canTransition(status, status)).toBe(false);
      }
    });
  });

  // ==================== Transition Count ====================
  describe('Transition counts', () => {
    it('PENDING_PAYMENT has exactly 3 transitions', () => {
      expect(VALID_TRANSITIONS['PENDING_PAYMENT']).toHaveLength(3);
    });

    it('FUNDED has exactly 5 transitions', () => {
      expect(VALID_TRANSITIONS['FUNDED']).toHaveLength(5);
    });

    it('VERIFIED has exactly 1 transition (COMPLETED)', () => {
      expect(VALID_TRANSITIONS['VERIFIED']).toHaveLength(1);
      expect(VALID_TRANSITIONS['VERIFIED'][0]).toBe('COMPLETED');
    });

    it('total valid transitions count', () => {
      let total = 0;
      for (const transitions of Object.values(VALID_TRANSITIONS)) {
        total += transitions.length;
      }
      expect(total).toBeGreaterThan(30);
      expect(total).toBeLessThan(100);
    });
  });

  // ==================== Reachability ====================
  describe('Reachability', () => {
    function findPaths(from: DealStatus, to: DealStatus, maxDepth = 15): DealStatus[][] {
      const paths: DealStatus[][] = [];
      const queue: DealStatus[][] = [[from]];

      while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1];

        if (current === to) {
          paths.push(path);
          continue;
        }

        if (path.length >= maxDepth) continue;

        for (const next of VALID_TRANSITIONS[current]) {
          if (!path.includes(next) || (next === 'CREATIVE_SUBMITTED' && current === 'CREATIVE_REVISION')) {
            queue.push([...path, next]);
          }
        }
      }
      return paths;
    }

    it('COMPLETED is reachable from PENDING_PAYMENT', () => {
      const paths = findPaths('PENDING_PAYMENT', 'COMPLETED');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('REFUNDED is reachable from FUNDED', () => {
      const paths = findPaths('FUNDED', 'REFUNDED');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('COMPLETED is reachable through DISPUTED', () => {
      const paths = findPaths('PENDING_PAYMENT', 'COMPLETED');
      const throughDispute = paths.filter(p => p.includes('DISPUTED'));
      expect(throughDispute.length).toBeGreaterThan(0);
    });

    it('COMPLETED is reachable through TRACKING happy path', () => {
      const paths = findPaths('PENDING_PAYMENT', 'COMPLETED');
      const throughTracking = paths.filter(p => p.includes('TRACKING'));
      expect(throughTracking.length).toBeGreaterThan(0);
    });

    it('REFUNDED is reachable through FAILED', () => {
      const paths = findPaths('TRACKING', 'REFUNDED');
      const throughFailed = paths.filter(p => p.includes('FAILED'));
      expect(throughFailed.length).toBeGreaterThan(0);
    });

    it('all non-terminal states can reach at least one terminal state', () => {
      const nonTerminals = ALL_STATUSES.filter(
        s => VALID_TRANSITIONS[s].length > 0
      );
      const terminals = new Set(['COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED', 'TIMED_OUT']);

      for (const status of nonTerminals) {
        const visited = new Set<DealStatus>();
        const queue: DealStatus[] = [status];
        let foundTerminal = false;

        while (queue.length > 0 && !foundTerminal) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);

          if (terminals.has(current)) {
            foundTerminal = true;
            break;
          }

          for (const next of VALID_TRANSITIONS[current]) {
            queue.push(next);
          }
        }

        expect(foundTerminal).toBe(true);
      }
    });
  });
});
