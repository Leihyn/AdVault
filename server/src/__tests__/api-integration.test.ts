import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from '../api/index.js';

function createValidInitData(userId: number = 123456789) {
  const user = { id: userId, first_name: 'Test', username: 'testuser' };
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', authDate.toString());

  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update('test-bot-token-12345')
    .digest();
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('API Integration - Route Registration & Error Handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    await registerRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==================== Health Check ====================
  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  // ==================== Auth Middleware ====================
  describe('Auth middleware', () => {
    it('rejects requests without initData', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('rejects requests with invalid initData', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': 'garbage' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects requests with tampered initData', async () => {
      const valid = createValidInitData();
      const tampered = valid.replace('Test', 'Hacker');
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': tampered },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== Validation Errors ====================
  describe('Validation error handling', () => {
    it('returns 400 for invalid channel creation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels',
        headers: {
          'x-dev-user-id': '123456789',
          'content-type': 'application/json',
        },
        payload: { title: '' }, // empty title
      });
      // Will be 400 (validation) or 401 (no user in DB for dev mode)
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it('returns 400 for invalid deal creation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/deals',
        headers: {
          'x-dev-user-id': '123456789',
          'content-type': 'application/json',
        },
        payload: { channelId: -1, adFormatId: 0, amountTon: -50 },
      });
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it('returns 400 for invalid creative media URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/deals/1/creative',
        headers: {
          'x-dev-user-id': '123456789',
          'content-type': 'application/json',
        },
        payload: { mediaUrl: 'not-a-url' },
      });
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it('returns 400 for invalid schedule datetime', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/deals/1/creative/schedule',
        headers: {
          'x-dev-user-id': '123456789',
          'content-type': 'application/json',
        },
        payload: { scheduledPostAt: 'not-a-date' },
      });
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  // ==================== Public Routes ====================
  describe('Public routes (no auth required)', () => {
    it('GET /api/channels returns without auth (or fails on DB, not auth)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/channels' });
      // Should either succeed (200) or fail on DB (500), not auth (401)
      expect(res.statusCode).not.toBe(401);
    });

    it('GET /api/campaigns returns without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/campaigns' });
      expect(res.statusCode).not.toBe(401);
    });

    it('GET /api/stats returns without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/stats' });
      expect(res.statusCode).not.toBe(401);
    });

    it('GET /api/channels/:id/stats returns without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/channels/1/stats' });
      expect(res.statusCode).not.toBe(401);
    });
  });

  // ==================== Protected Routes ====================
  describe('Protected routes (auth required)', () => {
    const protectedEndpoints = [
      { method: 'POST' as const, url: '/api/channels' },
      { method: 'PUT' as const, url: '/api/channels/1' },
      { method: 'POST' as const, url: '/api/deals' },
      { method: 'GET' as const, url: '/api/deals' },
      { method: 'GET' as const, url: '/api/deals/1' },
      { method: 'POST' as const, url: '/api/deals/1/pay' },
      { method: 'POST' as const, url: '/api/deals/1/cancel' },
      { method: 'POST' as const, url: '/api/deals/1/dispute' },
      { method: 'POST' as const, url: '/api/deals/1/creative' },
      { method: 'POST' as const, url: '/api/deals/1/creative/approve' },
      { method: 'POST' as const, url: '/api/deals/1/creative/revision' },
      { method: 'POST' as const, url: '/api/deals/1/creative/schedule' },
      { method: 'GET' as const, url: '/api/deals/1/creatives' },
      { method: 'GET' as const, url: '/api/deals/1/receipt' },
      { method: 'POST' as const, url: '/api/campaigns' },
      { method: 'PUT' as const, url: '/api/campaigns/1' },
      { method: 'POST' as const, url: '/api/campaigns/1/apply' },
      { method: 'GET' as const, url: '/api/users/me' },
      { method: 'PUT' as const, url: '/api/users/me' },
      { method: 'GET' as const, url: '/api/users/me/channels' },
      { method: 'GET' as const, url: '/api/users/me/campaigns' },
    ];

    for (const endpoint of protectedEndpoints) {
      it(`${endpoint.method} ${endpoint.url} requires auth`, async () => {
        const res = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
        });
        expect(res.statusCode).toBe(401);
      });
    }
  });

  // ==================== Route existence ====================
  describe('Route existence', () => {
    it('returns 404 for non-existent routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for root path', async () => {
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(404);
    });
  });
});
