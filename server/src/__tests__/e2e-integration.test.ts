/**
 * End-to-end integration tests — hits real PostgreSQL, Redis, TON testnet,
 * and Telegram Bot API. Requires all infrastructure running and valid
 * credentials in .env / setup.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Bot } from 'grammy';
import IORedis from 'ioredis';
import { config } from '../config.js';

// TON modules
import { generateWallet, getEscrowBalance, transferFromMaster } from '../ton/wallet.js';
import { createEscrowWallet, checkEscrowFunding } from '../services/escrow.service.js';

// Services
import { createChannel } from '../services/channel.service.js';
import { createDeal, getDeal, transitionDeal } from '../services/deal.service.js';
import { addAdFormat } from '../services/channel.service.js';

const prisma = new PrismaClient();

async function cleanE2EData() {
  // Only delete rows created by this test (use a distinctive telegramId range)
  const testUsers = await prisma.user.findMany({
    where: { telegramId: { gte: 900000n, lte: 900099n } },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);
  if (userIds.length === 0) return;

  // Get deal IDs owned by test users (for tables that filter by dealId, not relation)
  const deals = await prisma.deal.findMany({
    where: { advertiserId: { in: userIds } },
    select: { id: true },
  });
  const dealIds = deals.map((d) => d.id);

  // Clean in FK order
  if (dealIds.length > 0) {
    await prisma.dealReceipt.deleteMany({ where: { dealId: { in: dealIds } } });
    await prisma.dealEvent.deleteMany({ where: { dealId: { in: dealIds } } });
    await prisma.transaction.deleteMany({ where: { dealId: { in: dealIds } } });
    await prisma.creative.deleteMany({ where: { dealId: { in: dealIds } } });
  }
  await prisma.deal.deleteMany({ where: { advertiserId: { in: userIds } } });
  await prisma.campaignApplication.deleteMany({ where: { channel: { ownerId: { in: userIds } } } });
  await prisma.campaign.deleteMany({ where: { advertiserId: { in: userIds } } });
  await prisma.adFormat.deleteMany({ where: { channel: { ownerId: { in: userIds } } } });
  await prisma.channelAdmin.deleteMany({ where: { channel: { ownerId: { in: userIds } } } });
  await prisma.channel.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ================================================================
// 1.  TON TESTNET
// ================================================================
describe('TON Testnet Integration', () => {
  it('generates a unique escrow wallet', async () => {
    const w1 = await generateWallet(99901);
    const w2 = await generateWallet(99902);

    expect(w1.address).toBeTruthy();
    expect(w2.address).toBeTruthy();
    expect(w1.address).not.toBe(w2.address);
    // Encrypted mnemonic is in iv:tag:ciphertext format
    expect(w1.mnemonicEncrypted.split(':')).toHaveLength(3);
  });

  it('checks balance of a fresh wallet (should be 0)', async () => {
    const { address } = await generateWallet(99903);
    const balance = await getEscrowBalance(address);
    expect(balance).toBe(0n);
  });

  it('checks master wallet balance (should be > 0 after faucet)', async () => {
    const masterAddress = config.TON_MASTER_WALLET_ADDRESS;
    expect(masterAddress).toBeTruthy();
    const balance = await getEscrowBalance(masterAddress);
    console.log(`Master wallet balance: ${balance} nanoton (${Number(balance) / 1e9} TON)`);
    expect(balance).toBeGreaterThan(0n);
  });
});

// ================================================================
// 2.  TELEGRAM BOT API
// ================================================================
describe('Telegram Bot API Integration', () => {
  let bot: Bot;

  beforeAll(() => {
    bot = new Bot(config.BOT_TOKEN);
  });

  it('authenticates with Telegram (getMe)', async () => {
    const me = await bot.api.getMe();
    expect(me.id).toBeGreaterThan(0);
    expect(me.is_bot).toBe(true);
    expect(me.username).toBeTruthy();
    console.log(`Bot authenticated: @${me.username} (id: ${me.id})`);
  });

  it('can get bot commands', async () => {
    // This just verifies the API connection works beyond getMe
    const commands = await bot.api.getMyCommands();
    expect(Array.isArray(commands)).toBe(true);
  });
});

// ================================================================
// 3.  REDIS / BULLMQ
// ================================================================
describe('Redis Integration', () => {
  let redis: IORedis;

  beforeAll(() => {
    redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('connects to Redis', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });

  it('can set and get a key', async () => {
    await redis.set('e2e_test_key', 'hello_escrow');
    const val = await redis.get('e2e_test_key');
    expect(val).toBe('hello_escrow');
    await redis.del('e2e_test_key');
  });

  it('BullMQ queue can be created', async () => {
    const { Queue } = await import('bullmq');
    const q = new Queue('e2e-test-queue', { connection: redis });
    const job = await q.add('test-job', { foo: 'bar' });
    expect(job.id).toBeTruthy();
    // Clean up
    await q.obliterate({ force: true });
    await q.close();
  });
});

// ================================================================
// 4.  POSTGRESQL (beyond basic — test Prisma connection pooling)
// ================================================================
describe('PostgreSQL Advanced', () => {
  it('handles concurrent queries', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => prisma.user.count()),
    );
    // All should return the same number
    expect(new Set(results).size).toBe(1);
  });

  it('raw query works', async () => {
    const result = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    expect(result[0].now).toBeInstanceOf(Date);
  });
});

// ================================================================
// 5.  FULL DEAL + ESCROW FLOW (DB + TON combined)
// ================================================================
describe('Full Deal + Escrow Flow', () => {
  let ownerId: number;
  let advertiserId: number;
  let channelId: number;
  let formatId: number;
  let dealId: number;

  beforeAll(async () => {
    await cleanE2EData();

    // Create test users
    const owner = await prisma.user.create({
      data: {
        telegramId: 900001n,
        username: 'e2e_owner',
        firstName: 'E2EOwner',
        role: 'OWNER',
        tonWalletAddress: config.TON_MASTER_WALLET_ADDRESS, // same wallet for testing
      },
    });
    ownerId = owner.id;

    const adv = await prisma.user.create({
      data: {
        telegramId: 900002n,
        username: 'e2e_advertiser',
        firstName: 'E2EAdv',
        role: 'ADVERTISER',
        tonWalletAddress: config.TON_MASTER_WALLET_ADDRESS,
      },
    });
    advertiserId = adv.id;

    // Create channel
    const channel = await createChannel({
      telegramChatId: -100900001n,
      ownerId,
      title: 'E2E Test Channel',
      username: 'e2echan',
      subscribers: 5000,
      language: 'en',
      category: 'crypto',
    });
    channelId = channel.id;

    // Add ad format
    const format = await addAdFormat(channelId, ownerId, {
      formatType: 'POST',
      label: '1/24 Post',
      priceTon: 0.5, // Small amount for testnet
    });
    formatId = format.id;
  });

  afterAll(async () => {
    await cleanE2EData();
    await prisma.$disconnect();
  });

  it('step 1: creates a deal in PENDING_PAYMENT', async () => {
    const deal = await createDeal({
      channelId,
      advertiserId,
      adFormatId: formatId,
      amountTon: 0.5,
    });
    dealId = deal.id;
    expect(deal.status).toBe('PENDING_PAYMENT');
    expect(deal.ownerAlias).toMatch(/^Seller-[0-9a-f]{4}$/);
    expect(deal.advertiserAlias).toMatch(/^Buyer-[0-9a-f]{4}$/);
  });

  it('step 2: creates an escrow wallet for the deal (TON testnet)', async () => {
    const address = await createEscrowWallet(dealId);
    expect(address).toBeTruthy();
    // Verify it was saved to DB
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal!.escrowAddress).toBe(address);
    expect(deal!.escrowMnemonicEncrypted).toBeTruthy();
    console.log(`Escrow wallet created: ${address}`);
  });

  it('step 3: escrow wallet has 0 balance (unfunded)', async () => {
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    const balance = await getEscrowBalance(deal!.escrowAddress!);
    expect(balance).toBe(0n);
  });

  it('step 4: checkEscrowFunding returns false for unfunded deal', async () => {
    const wasFunded = await checkEscrowFunding(dealId);
    expect(wasFunded).toBe(false);
    // Deal should still be PENDING_PAYMENT
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal!.status).toBe('PENDING_PAYMENT');
  });

  it('step 5: manually transition deal through happy path', async () => {
    // Simulate the full happy path after payment (without waiting for real TON transfer)
    await transitionDeal(dealId, 'FUNDED');
    let deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal!.status).toBe('FUNDED');

    await transitionDeal(dealId, 'CREATIVE_PENDING');
    deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal!.status).toBe('CREATIVE_PENDING');

    await transitionDeal(dealId, 'CREATIVE_SUBMITTED');
    await transitionDeal(dealId, 'CREATIVE_APPROVED');
    await transitionDeal(dealId, 'SCHEDULED');
    await transitionDeal(dealId, 'POSTED');
    await transitionDeal(dealId, 'VERIFIED');

    deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal!.status).toBe('VERIFIED');
  });

  it('step 6: getDeal returns full deal with all relations', async () => {
    const deal = await getDeal(dealId);
    expect(deal.channel.title).toBe('E2E Test Channel');
    expect(deal.advertiser.username).toBe('e2e_advertiser');
    expect(deal.adFormat).toBeDefined();
    expect(deal.events.length).toBeGreaterThanOrEqual(7); // At least 7 transitions
    expect(deal.escrowAddress).toBeTruthy();
  });

  it('step 7: identity masking works in getDeal', async () => {
    const forOwner = await getDeal(dealId, ownerId) as any;
    expect(forOwner.ownerLabel).toBe('You');
    expect(forOwner.advertiserLabel).toMatch(/^Buyer-/);

    const forAdv = await getDeal(dealId, advertiserId) as any;
    expect(forAdv.advertiserLabel).toBe('You');
    expect(forAdv.ownerLabel).toMatch(/^Seller-/);
  });
});

// ================================================================
// 6.  SERVER STARTUP (smoke test)
// ================================================================
describe('Server Startup Smoke Test', () => {
  it('Fastify server starts and responds to health check', async () => {
    const Fastify = (await import('fastify')).default;
    const cors = (await import('@fastify/cors')).default;
    const { registerRoutes } = await import('../api/index.js');

    const app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    await registerRoutes(app);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();

    await app.close();
  });

  it('Bot instance can be created without crashing', async () => {
    const { createBot } = await import('../bot/index.js');
    const bot = createBot();
    expect(bot).toBeDefined();
    // Don't start polling — just verify it constructs
  });

  it('Workers can connect to Redis without crashing', async () => {
    const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    const { Queue } = await import('bullmq');

    // Create a queue (like workers/index.ts does)
    const q = new Queue('e2e-smoke-payment', { connection: redis });
    expect(q.name).toBe('e2e-smoke-payment');

    await q.obliterate({ force: true });
    await q.close();
    await redis.quit();
  });
});
