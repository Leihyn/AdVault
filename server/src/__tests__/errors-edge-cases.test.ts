import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.js';

describe('Error Classes — Edge Cases', () => {
  // ==================== Special characters in messages ====================
  describe('special characters in error messages', () => {
    it('handles newlines in message', () => {
      const err = new AppError('line1\nline2\nline3');
      expect(err.message).toBe('line1\nline2\nline3');
    });

    it('handles tabs in message', () => {
      const err = new AppError('col1\tcol2');
      expect(err.message).toBe('col1\tcol2');
    });

    it('handles unicode in message', () => {
      const err = new AppError('Error: 🔥 서버 오류');
      expect(err.message).toBe('Error: 🔥 서버 오류');
    });

    it('handles HTML in message', () => {
      const err = new AppError('<b>Error</b>');
      expect(err.message).toBe('<b>Error</b>');
    });

    it('handles empty string message', () => {
      const err = new AppError('');
      expect(err.message).toBe('');
    });

    it('handles very long message', () => {
      const longMsg = 'x'.repeat(100000);
      const err = new AppError(longMsg);
      expect(err.message).toHaveLength(100000);
    });
  });

  // ==================== Status code edge cases ====================
  describe('status code edge cases', () => {
    it('accepts 0 as status code', () => {
      const err = new AppError('test', 0);
      expect(err.statusCode).toBe(0);
    });

    it('accepts negative status code', () => {
      const err = new AppError('test', -1);
      expect(err.statusCode).toBe(-1);
    });

    it('accepts 999 as status code', () => {
      const err = new AppError('test', 999);
      expect(err.statusCode).toBe(999);
    });

    it('accepts floating point status code', () => {
      const err = new AppError('test', 400.5);
      expect(err.statusCode).toBe(400.5);
    });
  });

  // ==================== Error code edge cases ====================
  describe('error code edge cases', () => {
    it('code defaults to undefined when not provided', () => {
      const err = new AppError('test');
      expect(err.code).toBeUndefined();
    });

    it('code defaults to undefined with just status code', () => {
      const err = new AppError('test', 400);
      expect(err.code).toBeUndefined();
    });

    it('accepts empty string as code', () => {
      const err = new AppError('test', 400, '');
      expect(err.code).toBe('');
    });
  });

  // ==================== Prototype chain ====================
  describe('prototype chain integrity', () => {
    it('NotFoundError instanceof chain: Error → AppError → NotFoundError', () => {
      const err = new NotFoundError('Test');
      expect(err instanceof Error).toBe(true);
      expect(err instanceof AppError).toBe(true);
      expect(err instanceof NotFoundError).toBe(true);
      expect(err instanceof UnauthorizedError).toBe(false);
    });

    it('UnauthorizedError is not instanceof ForbiddenError', () => {
      const err = new UnauthorizedError();
      expect(err instanceof ForbiddenError).toBe(false);
    });

    it('ConflictError is not instanceof NotFoundError', () => {
      const err = new ConflictError('test');
      expect(err instanceof NotFoundError).toBe(false);
    });
  });

  // ==================== Error.name preservation ====================
  describe('error name preservation', () => {
    it('AppError.name is "AppError"', () => {
      expect(new AppError('x').name).toBe('AppError');
    });

    it('NotFoundError.name is "NotFoundError"', () => {
      expect(new NotFoundError('X').name).toBe('NotFoundError');
    });

    it('UnauthorizedError.name is "UnauthorizedError"', () => {
      expect(new UnauthorizedError().name).toBe('UnauthorizedError');
    });

    it('ForbiddenError.name is "ForbiddenError"', () => {
      expect(new ForbiddenError().name).toBe('ForbiddenError');
    });

    it('ConflictError.name is "ConflictError"', () => {
      expect(new ConflictError('x').name).toBe('ConflictError');
    });
  });

  // ==================== Stack trace ====================
  describe('stack trace quality', () => {
    it('stack trace includes the error type', () => {
      const err = new NotFoundError('Deal');
      expect(err.stack).toContain('NotFoundError');
    });

    it('stack trace includes the message', () => {
      const err = new NotFoundError('Deal');
      expect(err.stack).toContain('Deal not found');
    });

    it('stack trace includes the test file path', () => {
      const err = new AppError('test');
      expect(err.stack).toContain('errors-edge-cases');
    });
  });

  // ==================== Error as JSON ====================
  describe('JSON serialization', () => {
    it('JSON.stringify includes statusCode and code (TS public fields are enumerable)', () => {
      const err = new NotFoundError('Channel');
      const json = JSON.stringify(err);
      const parsed = JSON.parse(json);
      // TypeScript public constructor params create enumerable properties
      expect(parsed.statusCode).toBe(404);
      expect(parsed.code).toBe('NOT_FOUND');
    });

    it('JSON.stringify includes name but not message or stack', () => {
      const err = new AppError('test', 400, 'CUSTOM');
      const json = JSON.stringify(err);
      const parsed = JSON.parse(json);
      expect(parsed.statusCode).toBe(400);
      expect(parsed.code).toBe('CUSTOM');
      expect(parsed.name).toBe('AppError');
      // message is set via super() which makes it non-enumerable
      // stack is also non-enumerable
      expect(parsed.message).toBeUndefined();
      expect(parsed.stack).toBeUndefined();
    });
  });

  // ==================== Throwing and catching ====================
  describe('throw and catch behavior', () => {
    it('can be caught as AppError from any subclass', () => {
      const errors = [
        () => { throw new NotFoundError('X'); },
        () => { throw new UnauthorizedError(); },
        () => { throw new ForbiddenError(); },
        () => { throw new ConflictError('X'); },
      ];

      for (const throwFn of errors) {
        try {
          throwFn();
        } catch (e) {
          expect(e).toBeInstanceOf(AppError);
          expect((e as AppError).statusCode).toBeGreaterThanOrEqual(400);
        }
      }
    });

    it('catch block can access statusCode and code', () => {
      try {
        throw new NotFoundError('Deal');
      } catch (e) {
        if (e instanceof AppError) {
          expect(e.statusCode).toBe(404);
          expect(e.code).toBe('NOT_FOUND');
          expect(e.message).toBe('Deal not found');
        } else {
          // Should not reach here
          expect(true).toBe(false);
        }
      }
    });

    it('works in async context', async () => {
      async function failingOp(): Promise<never> {
        throw new ForbiddenError('Not allowed');
      }

      await expect(failingOp()).rejects.toThrow(ForbiddenError);
      await expect(failingOp()).rejects.toThrow('Not allowed');
    });
  });

  // ==================== Resource name variations for NotFoundError ====================
  describe('NotFoundError resource name variations', () => {
    const resources = ['Deal', 'Channel', 'User', 'Creative', 'Campaign', 'Transaction', 'AdFormat'];

    for (const resource of resources) {
      it(`formats "${resource}" correctly`, () => {
        const err = new NotFoundError(resource);
        expect(err.message).toBe(`${resource} not found`);
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
      });
    }

    it('handles empty resource name', () => {
      const err = new NotFoundError('');
      expect(err.message).toBe(' not found');
    });

    it('handles resource name with spaces', () => {
      const err = new NotFoundError('Deal Receipt');
      expect(err.message).toBe('Deal Receipt not found');
    });
  });
});
