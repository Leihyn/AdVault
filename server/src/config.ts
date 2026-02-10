import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  BOT_TOKEN: z.string(),
  MINI_APP_URL: z.string().default('https://localhost:5173'),
  TON_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  TON_API_KEY: z.string().default(''),
  TON_MASTER_MNEMONIC: z.string().default(''),
  TON_MASTER_WALLET_ADDRESS: z.string().default(''),
  ESCROW_ENCRYPTION_KEY: z.string().default('0'.repeat(64)),
  PURGE_AFTER_DAYS: z.coerce.number().default(30),
  PLATFORM_FEE_PERCENT: z.coerce.number().default(5),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
