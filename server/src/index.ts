import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { registerRoutes } from './api/index.js';
import { createBot } from './bot/index.js';
import { createWorkers } from './workers/index.js';

async function main() {
  // --- Fastify server ---
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerRoutes(app);

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
