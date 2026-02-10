import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from '../utils/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('sets message and default status code', () => {
      const err = new AppError('something broke');
      expect(err.message).toBe('something broke');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('AppError');
    });

    it('accepts custom status code', () => {
      const err = new AppError('not found', 404);
      expect(err.statusCode).toBe(404);
    });

    it('accepts custom error code', () => {
      const err = new AppError('bad', 400, 'CUSTOM_CODE');
      expect(err.code).toBe('CUSTOM_CODE');
    });

    it('is an instance of Error', () => {
      const err = new AppError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('sets 404 and resource name', () => {
      const err = new NotFoundError('Channel');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Channel not found');
      expect(err.name).toBe('NotFoundError');
    });

    it('works with different resources', () => {
      expect(new NotFoundError('Deal').message).toBe('Deal not found');
      expect(new NotFoundError('User').message).toBe('User not found');
      expect(new NotFoundError('Creative').message).toBe('Creative not found');
    });

    it('is instance of AppError', () => {
      expect(new NotFoundError('X')).toBeInstanceOf(AppError);
    });
  });

  describe('UnauthorizedError', () => {
    it('sets 401 with default message', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Unauthorized');
    });

    it('accepts custom message', () => {
      const err = new UnauthorizedError('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('sets 403 with default message', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toBe('Forbidden');
    });

    it('accepts custom message', () => {
      const err = new ForbiddenError('Not channel owner');
      expect(err.message).toBe('Not channel owner');
    });
  });

  describe('ConflictError', () => {
    it('sets 409', () => {
      const err = new ConflictError('Already registered');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.message).toBe('Already registered');
    });
  });

  describe('Error hierarchy', () => {
    it('all errors are catchable as AppError', () => {
      const errors = [
        new NotFoundError('X'),
        new UnauthorizedError(),
        new ForbiddenError(),
        new ConflictError('X'),
      ];
      for (const err of errors) {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toBeInstanceOf(Error);
      }
    });

    it('has stack traces', () => {
      const err = new NotFoundError('Test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('NotFoundError');
    });
  });
});
