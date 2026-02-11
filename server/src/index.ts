import 'dotenv/config';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { registerRoutes } from './api/index.js';
import { createBot } from './bot/index.js';
import { createWorkers } from './workers/index.js';

async function main() {
  // --- Fastify server ---
  const app = Fastify({ logger: true });

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'telegram.org', '*.telegram.org'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  });

  // CORS — restrict to known origins in production
  const allowedOrigins = config.NODE_ENV === 'production'
    ? [config.MINI_APP_URL]
    : [config.MINI_APP_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
  await app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Rate limiting — per-IP, with tighter limits on mutation endpoints
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use Telegram user ID if available, otherwise IP
      return (request.headers['x-telegram-init-data'] as string)?.slice(0, 32)
        || request.ip;
    },
  });

  await registerRoutes(app);

  // --- Static file serving (production) ---
  if (config.NODE_ENV === 'production') {
    const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');

    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        reply.status(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  // --- Telegram bot ---
  const bot = createBot();

  // --- Background workers ---
  const workers = createWorkers(bot);
  await workers.scheduleJobs();

  // --- Start server ---
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`Server running on port ${config.PORT}`);

  // --- Start bot polling ---
  bot.start({
    onStart: (info) => console.log(`Bot @${info.username} started`),
  });

  // --- Graceful shutdown ---
  const shutdown = async () => {
    console.log('Shutting down...');
    await bot.stop();
    await workers.shutdown();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
