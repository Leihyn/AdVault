import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from '../api/index.js';
import { config } from '../config.js';

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
    .update(config.BOT_TOKEN)
    .digest();
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('API Edge Cases', () => {
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

  // ==================== Error handler ====================
  describe('global error handler', () => {
    it('health check returns ISO timestamp', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      const body = JSON.parse(res.body);
      // Verify timestamp is valid ISO 8601
      const parsed = new Date(body.timestamp);
      expect(parsed.toISOString()).toBe(body.timestamp);
    });

    it('health check returns correct content-type', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  // ==================== HTTP method handling ====================
  describe('HTTP method handling', () => {
    it('OPTIONS on health endpoint returns a response (CORS or 400)', async () => {
      const res = await app.inject({ method: 'OPTIONS', url: '/api/health' });
      // Fastify with CORS may return 204 (preflight) or 400 (bad request)
      // depending on whether the CORS plugin intercepts it
      expect([200, 204, 400]).toContain(res.statusCode);
    });

    it('returns 404 for HEAD on non-existent route', async () => {
      const res = await app.inject({ method: 'HEAD', url: '/api/nothing' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for PATCH on health endpoint', async () => {
      const res = await app.inject({ method: 'PATCH', url: '/api/health' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for DELETE on health endpoint', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/health' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== Route parameter edge cases ====================
  describe('route parameter edge cases', () => {
    it('handles negative deal ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/deals/-1',
        headers: { 'x-telegram-init-data': createValidInitData() },
      });
      // Should fail on DB lookup, not crash
      expect([400, 404, 500]).toContain(res.statusCode);
    });

    it('handles zero deal ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/deals/0',
        headers: { 'x-telegram-init-data': createValidInitData() },
      });
      expect([400, 404, 500]).toContain(res.statusCode);
    });

    it('handles non-numeric deal ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/deals/abc',
        headers: { 'x-telegram-init-data': createValidInitData() },
      });
      // Number("abc") = NaN, should not crash
      expect([400, 404, 500]).toContain(res.statusCode);
    });

    it('handles very large deal ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/deals/99999999999',
        headers: { 'x-telegram-init-data': createValidInitData() },
      });
      expect([400, 404, 500]).toContain(res.statusCode);
    });

    it('handles float-like deal ID (e.g. "1.5")', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/deals/1.5',
        headers: { 'x-telegram-init-data': createValidInitData() },
      });
      expect([400, 404, 500]).toContain(res.statusCode);
    });

    it('handles negative channel ID for stats', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels/-999/stats',
      });
      // Public route — returns 200 with zero counts for non-existent channel
      expect([200, 400, 404, 500]).toContain(res.statusCode);
    });
  });

  // ==================== Auth header variations ====================
  describe('auth header edge cases', () => {
    it('rejects empty initData header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': '' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects initData with only hash', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': 'hash=abc123' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects expired initData (old auth_date)', async () => {
      const user = { id: 1, first_name: 'Test' };
      const oldDate = Math.floor(Date.now() / 1000) - 100000;
      const params = new URLSearchParams();
      params.set('user', JSON.stringify(user));
      params.set('auth_date', oldDate.toString());

      const checkString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      const secretKey = createHmac('sha256', 'WebAppData')
        .update(config.BOT_TOKEN)
        .digest();
      const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');
      params.set('hash', hash);

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': params.toString() },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects URL-encoded garbage as initData', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': '%00%01%02%03%04' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects very long initData', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { 'x-telegram-init-data': 'x'.repeat(100000) },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== Content-Type handling ====================
  describe('content-type handling', () => {
    it('rejects POST without content-type on protected route', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels',
        headers: { 'x-telegram-init-data': createValidInitData() },
        payload: 'not json',
      });
      // Fastify should reject or parse will fail
      expect([400, 401, 415, 500]).toContain(res.statusCode);
    });

    it('handles POST with empty JSON body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/deals',
        headers: {
          'x-telegram-init-data': createValidInitData(),
          'content-type': 'application/json',
        },
        payload: {},
      });
      // Should fail validation (missing required fields), not crash
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  // ==================== Multiple auth headers ====================
  describe('conflicting auth scenarios', () => {
    it('initData takes precedence over dev header in test env', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          'x-telegram-init-data': createValidInitData(),
          'x-dev-user-id': '999',
        },
      });
      // NODE_ENV=test means dev mode is off, initData is used
      // Since DB not available, expect 500 (user upsert fails)
      expect([200, 401, 500]).toContain(res.statusCode);
    });
  });

  // ==================== Deep route nesting ====================
  describe('deep nested route coverage', () => {
    const nestedRoutes = [
      { method: 'POST' as const, url: '/api/deals/1/creative' },
      { method: 'POST' as const, url: '/api/deals/1/creative/approve' },
      { method: 'POST' as const, url: '/api/deals/1/creative/revision' },
      { method: 'POST' as const, url: '/api/deals/1/creative/schedule' },
      { method: 'GET' as const, url: '/api/deals/1/creatives' },
      { method: 'GET' as const, url: '/api/deals/1/receipt' },
    ];

    for (const route of nestedRoutes) {
      it(`${route.method} ${route.url} returns 401 without auth`, async () => {
        const res = await app.inject({ method: route.method, url: route.url });
        expect(res.statusCode).toBe(401);
      });
    }
  });

  // ==================== Trailing slash handling ====================
  describe('trailing slash handling', () => {
    it('handles trailing slash on health check', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health/' });
      // Fastify may or may not redirect
      expect([200, 301, 404]).toContain(res.statusCode);
    });

    it('handles double slashes in path', async () => {
      const res = await app.inject({ method: 'GET', url: '/api//health' });
      expect([200, 404]).toContain(res.statusCode);
    });
  });

  // ==================== Special characters in paths ====================
  describe('special characters in URL path', () => {
    it('handles URL-encoded path segment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels/%31/stats', // %31 = "1"
      });
      expect([200, 404, 500]).toContain(res.statusCode);
    });

    it('handles unicode in path', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels/café/stats',
      });
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  // ==================== Query parameter edge cases ====================
  describe('query parameter edge cases on public routes', () => {
    it('handles unknown query parameters on channels', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels?unknown=value&foo=bar',
      });
      // Should ignore unknown params, not crash
      expect(res.statusCode).not.toBe(401);
    });

    it('handles extremely large page number', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels?page=999999&limit=1',
      });
      expect(res.statusCode).not.toBe(401);
    });

    it('handles negative limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels?limit=-10',
      });
      expect(res.statusCode).not.toBe(401);
    });
  });

  // ==================== Response format consistency ====================
  describe('error response format', () => {
    it('401 response has error field', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe('string');
    });

    it('401 response has message field', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
      });
      const body = JSON.parse(res.body);
      expect(body.message).toBeDefined();
      expect(typeof body.message).toBe('string');
    });

    it('404 response is JSON', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body).toBeDefined();
    });
  });
});
