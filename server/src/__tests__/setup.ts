// Vitest setup file — runs before any test module imports
// Sets all required env vars so config.ts doesn't call process.exit(1)

process.env.DATABASE_URL = 'postgresql://fake:fake@localhost:5432/fake';
process.env.BOT_TOKEN = 'test-bot-token-12345';
process.env.ESCROW_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.NODE_ENV = 'test';
