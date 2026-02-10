// Vitest setup file — runs before any test module imports
// Sets all required env vars so config.ts doesn't call process.exit(1)
//
// Uses real credentials where available (for e2e tests against live services).
// Falls back to safe test values for unit tests that never hit external APIs.

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (server/)
dotenvConfig({ path: resolve(__dirname, '../../.env') });

// Only set defaults if .env didn't provide them
process.env.DATABASE_URL ??= 'postgresql://machine@localhost:5432/escrowbuild';
process.env.BOT_TOKEN ??= 'test-bot-token-12345';
process.env.ESCROW_ENCRYPTION_KEY ??= 'a'.repeat(64);
process.env.NODE_ENV ??= 'test';
