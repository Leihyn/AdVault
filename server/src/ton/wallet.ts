import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { WalletContractV4, TonClient, Address, internal, toNano, fromNano } from '@ton/ton';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config.js';

function getTonClient(): TonClient {
  const endpoint = config.TON_NETWORK === 'mainnet'
    ? 'https://toncenter.com/api/v2/jsonRPC'
    : 'https://testnet.toncenter.com/api/v2/jsonRPC';

  return new TonClient({
    endpoint,
    apiKey: config.TON_API_KEY || undefined,
  });
}

/**
 * Encrypts a mnemonic phrase using AES-256-GCM.
 */
function encryptMnemonic(mnemonic: string[]): string {
  const key = Buffer.from(config.ESCROW_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = mnemonic.join(' ');
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Format: iv:tag:ciphertext
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a mnemonic phrase from AES-256-GCM format.
 */
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

/**
 * Generates a new escrow wallet for a deal.
 * Returns the wallet address and encrypted mnemonic.
 */
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
 */
export async function getEscrowBalance(address: string): Promise<bigint> {
  const client = getTonClient();

  try {
    const balance = await client.getBalance(Address.parse(address));
    return balance;
  } catch (error) {
    console.error(`Failed to get balance for ${address}:`, error);
    return 0n;
  }
}

/**
 * Transfers funds from an escrow wallet to a target address.
 * Returns the transaction hash (or a placeholder if unavailable).
 */
export async function transferFunds(
  encryptedMnemonic: string,
  toAddress: string,
  amountTon: number,
): Promise<string> {
  const client = getTonClient();
  const mnemonic = decryptMnemonic(encryptedMnemonic);
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = client.open(wallet);
  const seqno = await contract.getSeqno();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: Address.parse(toAddress),
        value: toNano(amountTon.toString()),
        bounce: false,
      }),
    ],
  });

  // TON doesn't return a tx hash on send — we derive an ID from the params
  const txId = `${wallet.address.toRawString()}_${seqno}`;
  return txId;
}

/**
 * Transfers funds from the platform master wallet to a target address.
 *
 * This is the second hop in the relay:
 *   Escrow Wallet → Master Wallet → Owner/Advertiser
 *
 * On-chain, observers see payouts coming from the same master wallet
 * for all deals, breaking the link between a specific escrow and
 * the recipient.
 */
export async function transferFromMaster(
  toAddress: string,
  amountTon: number,
): Promise<string> {
  if (!config.TON_MASTER_MNEMONIC) {
    throw new Error('Master wallet mnemonic not configured');
  }

  const client = getTonClient();
  const mnemonic = config.TON_MASTER_MNEMONIC.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = client.open(wallet);
  const seqno = await contract.getSeqno();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: Address.parse(toAddress),
        value: toNano(amountTon.toString()),
        bounce: false,
      }),
    ],
  });

  const txId = `master_${seqno}`;
  return txId;
}
