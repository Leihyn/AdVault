import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { WalletContractV4, TonClient, Address, internal, toNano, fromNano } from '@ton/ton';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SEQNO_POLL_INTERVAL_MS = 3000;
const SEQNO_POLL_TIMEOUT_MS = 60000;

function getTonClient(useFallback = false): TonClient {
  const isMainnet = config.TON_NETWORK === 'mainnet';
  const endpoint = isMainnet
    ? 'https://toncenter.com/api/v2/jsonRPC'
    : 'https://testnet.toncenter.com/api/v2/jsonRPC';

  const apiKey = useFallback && config.TON_API_KEY_FALLBACK
    ? config.TON_API_KEY_FALLBACK
    : config.TON_API_KEY || undefined;

  return new TonClient({ endpoint, apiKey });
}

/** Retry an async operation with exponential backoff, falling back to alternate RPC */
async function withRetry<T>(
  fn: (client: TonClient) => Promise<T>,
  operation: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const useFallback = attempt >= Math.ceil(MAX_RETRIES / 2);
    const client = getTonClient(useFallback);

    try {
      return await fn(client);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `TON RPC ${operation} attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
        lastError.message,
      );

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`TON RPC ${operation} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/** Wait for seqno to increment (confirms transaction was processed) */
async function waitForSeqnoChange(
  contract: ReturnType<TonClient['open']> extends infer T ? T : never,
  previousSeqno: number,
): Promise<void> {
  const deadline = Date.now() + SEQNO_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const currentSeqno = await (contract as any).getSeqno();
      if (currentSeqno > previousSeqno) return;
    } catch {
      // Ignore transient RPC errors during polling
    }
    await new Promise((r) => setTimeout(r, SEQNO_POLL_INTERVAL_MS));
  }

  throw new Error(`Transaction confirmation timed out (seqno did not advance from ${previousSeqno})`);
}

function encryptMnemonic(mnemonic: string[]): string {
  const key = Buffer.from(config.ESCROW_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = mnemonic.join(' ');
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptMnemonic(encryptedStr: string): string[] {
  const [ivHex, tagHex, ciphertext] = encryptedStr.split(':');
  const key = Buffer.from(config.ESCROW_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted.split(' ');
}

export async function generateWallet(dealId: number): Promise<{
  address: string;
  mnemonicEncrypted: string;
}> {
  const mnemonic = await mnemonicNew();
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const address = wallet.address.toString({
    bounceable: false,
    testOnly: config.TON_NETWORK === 'testnet',
  });

  const mnemonicEncrypted = encryptMnemonic(mnemonic);

  return { address, mnemonicEncrypted };
}

/**
 * Gets the balance of an escrow wallet in nanotons.
 * Throws on RPC failure instead of silently returning 0.
 */
export async function getEscrowBalance(address: string): Promise<bigint> {
  return withRetry(async (client) => {
    return client.getBalance(Address.parse(address));
  }, `getBalance(${address})`);
}

/**
 * Transfers funds from an escrow wallet to a target address.
 * Waits for seqno confirmation before returning.
 */
export async function transferFunds(
  encryptedMnemonic: string,
  toAddress: string,
  amountTonStr: string,
): Promise<string> {
  const mnemonic = decryptMnemonic(encryptedMnemonic);
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  return withRetry(async (client) => {
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(toAddress),
          value: toNano(amountTonStr),
          bounce: false,
        }),
      ],
    });

    // Wait for on-chain confirmation
    await waitForSeqnoChange(contract, seqno);

    const txId = `${wallet.address.toRawString()}_${seqno}`;
    return txId;
  }, 'transferFunds');
}

/**
 * Transfers funds from the platform master wallet.
 * Second hop in the privacy relay: Master -> Owner/Advertiser.
 */
export async function transferFromMaster(
  toAddress: string,
  amountTonStr: string,
): Promise<string> {
  if (!config.TON_MASTER_MNEMONIC) {
    throw new Error('Master wallet mnemonic not configured');
  }

  const mnemonic = config.TON_MASTER_MNEMONIC.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  return withRetry(async (client) => {
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(toAddress),
          value: toNano(amountTonStr),
          bounce: false,
        }),
      ],
    });

    await waitForSeqnoChange(contract, seqno);

    const txId = `master_${seqno}`;
    return txId;
  }, 'transferFromMaster');
}
