# escrowBUILD

Telegram channel ads are a trust problem. Advertisers pay upfront and hope the post goes live. Channel owners deliver first and hope the payment clears. Both sides lose when the other ghosts.

In traditional advertising, escrow solves this. In Telegram? Nothing exists. Advertisers in the $20B+ Telegram ad market rely on screenshots, good faith, and intermediaries who take 30% cuts.

escrowBUILD fixes this with TON-based escrow. Funds lock on-chain until the ad is posted, verified, and the hold period passes. No trust required.

## Quick Start

```bash
# 1. Start infrastructure (Postgres + Redis)
cd escrowBUILD
docker compose up -d

# 2. Configure environment
cp .env.example .env
# Edit .env with your BOT_TOKEN, TON_MASTER_MNEMONIC, and other values

# 3. Set up database
cd server
npm install
npx prisma db push
npx tsx prisma/seed.ts  # optional: seed test data

# 4. Start server (bot + API + workers)
npm run dev

# 5. Start frontend (separate terminal)
cd ../web
npm install
npm run dev
```

The server runs on port 3000, the frontend on port 5173 (Vite proxies `/api` to the server).

## How It Works

**For advertisers:**
1. Browse channels in the Mini App or create a campaign brief
2. Create a deal — the platform generates a unique TON escrow wallet
3. Send the exact TON amount to lock funds on-chain
4. Review and approve the creative draft from the channel owner
5. Post goes live automatically at the scheduled time
6. After 24h verification (post still intact), funds release to the channel owner

**For channel owners:**
1. Register your channel via `/addchannel` in the bot
2. Set ad formats and pricing (post, forward, story, custom)
3. Apply to campaigns or receive direct deals from advertisers
4. Submit creative drafts for advertiser approval (revision loop supported)
5. Bot auto-posts at the scheduled time
6. Funds release after 24h hold period

**What happens if things go wrong:**
- Advertiser never pays? Deal times out after 24h, no action needed.
- Post gets deleted during hold period? Platform auto-detects, flags as disputed.
- Channel owner never submits creative? Deal times out, funds auto-refund.
- Either party wants out? Cancel anytime before posting; funded deals get refunded.

## Deal State Machine

Every deal progresses through a validated state machine. Invalid transitions are rejected.

```
                                    ┌──────────────────┐
                                    │  PENDING_PAYMENT  │ (24h timeout)
                                    └────────┬─────────┘
                                             │ TON received
                                    ┌────────▼─────────┐
                                    │      FUNDED       │
                                    └────────┬─────────┘
                                             │ auto-advance
                                    ┌────────▼─────────┐
                               ┌───►│ CREATIVE_PENDING  │
                               │    └────────┬─────────┘
                               │             │ owner submits
                               │    ┌────────▼─────────┐
                               │    │CREATIVE_SUBMITTED │
                               │    └───┬────────┬─────┘
                               │        │        │
                    revision ◄─┘   approve    revise
                                        │        │
                               ┌────────▼──┐  ┌──▼──────────────┐
                               │ CREATIVE   │  │CREATIVE_REVISION│
                               │ APPROVED   │  └─────────────────┘
                               └────────┬───┘        ▲ (loops back)
                                        │
                               ┌────────▼─────────┐
                               │    SCHEDULED      │
                               └────────┬─────────┘
                                        │ auto-post
                               ┌────────▼─────────┐
                               │      POSTED       │ (24h hold)
                               └────────┬─────────┘
                                        │ verified
                               ┌────────▼─────────┐
                               │     VERIFIED      │
                               └────────┬─────────┘
                                        │ funds released
                               ┌────────▼─────────┐
                               │    COMPLETED      │
                               └───────────────────┘

  Side paths:
  ─ Any active state ──► CANCELLED (by either party)
  ─ Funded + cancelled ──► REFUNDED (auto)
  ─ Timeout exceeded ──► TIMED_OUT ──► REFUNDED (if funded)
  ─ Post deleted ──► DISPUTED ──► REFUNDED or COMPLETED (manual)
```

14 states total. Every transition is logged as a DealEvent with actor, timestamp, and metadata.

## Architecture

```
escrowBUILD/
  docker-compose.yml            ← Postgres + Redis
  server/
    src/
      index.ts                  ← Fastify + grammY bot + BullMQ workers boot
      config.ts                 ← Env validation (Zod)
      api/
        middleware/auth.ts      ← Telegram initData validation
        routes/                 ← REST endpoints (channels, campaigns, deals, creatives, users, stats)
        schemas/                ← Zod request/response schemas
      bot/
        commands/               ← /start, /mychannels, /mydeals, /help
        conversations/          ← /addchannel, /createcampaign, deal chat
        middleware/auth.ts      ← Auto-create user on first message
      services/                 ← Business logic
        deal.service.ts         ← State machine + transitions
        escrow.service.ts       ← Escrow wallet lifecycle
        creative.service.ts     ← Content versioning + encryption
        posting.service.ts      ← Telegram channel posting
        notification.service.ts ← User notifications
      workers/                  ← BullMQ background jobs
        payment.worker.ts       ← Monitors escrow wallets (every 30s)
        posting.worker.ts       ← Auto-posts at scheduled time (every 30s)
        verify.worker.ts        ← Confirms post integrity (every 10min for 24h)
        timeout.worker.ts       ← Auto-cancels stale deals (every 5min)
        purge.worker.ts         ← GDPR-style data cleanup (every 60min)
      ton/
        wallet.ts               ← Per-deal wallet generation (WalletContractV4)
        transfer.ts             ← Two-hop fund relay (escrow → master → recipient)
        monitor.ts              ← Balance polling
      utils/
        privacy.ts              ← Identity masking, content encryption
        errors.ts               ← Custom error classes
    prisma/
      schema.prisma             ← Full data model (9 models)
    vitest.config.ts

  web/
    src/
      main.tsx                  ← AppRoot (telegram-ui theme) + React Query + Router
      App.tsx                   ← Route definitions
      api/client.ts             ← Fetch wrapper with Telegram auth headers
      hooks/useTelegram.ts      ← WebApp SDK hook (graceful fallback)
      pages/                    ← 9 pages (Home, Channels, ChannelDetail, Campaigns, Deals, DealDetail, Profile, MyChannels, MyCampaigns)
      components/               ← 6 components (Layout, ChannelCard, CampaignCard, DealStatus, CreativeEditor, FilterBar)
```

### Background Workers

Workers drive the platform. Without them, deals don't progress.

**Payment monitor** checks escrow wallets every 30 seconds via TonCenter RPC. When the expected amount arrives, the deal auto-advances to FUNDED then CREATIVE_PENDING.

**Posting worker** finds deals past their `scheduledPostAt` timestamp, decrypts the creative content (AES-256-GCM), and posts to the Telegram channel via the bot. Records the `postedMessageId` for verification.

**Verify worker** runs every 10 minutes. For deals in POSTED state that have been up for 24 hours, it checks the message still exists. If intact, funds auto-release. If the post was deleted, the deal transitions to DISPUTED.

**Timeout worker** auto-cancels deals that exceed their deadline (24h for payment, configurable for creative submission). Funded deals get auto-refunded.

**Purge worker** handles data retention. After 30 days in a terminal state, sensitive data (creative content, escrow mnemonics, events) is deleted. A SHA-256 DealReceipt preserves proof of completion without PII.

## Privacy & Security

**Identity masking** — Advertisers and channel owners never see each other's Telegram identity. Each party sees a random alias ("Buyer #1234" / "Seller #5678").

**Content encryption** — Creative drafts and escrow mnemonics are encrypted at rest with AES-256-GCM. Decrypted only for authorized parties.

**Two-hop fund relay** — Funds move escrow wallet → master wallet → recipient. This breaks on-chain linkage between advertiser and channel owner.

**Data purge** — After the retention period (default 30 days), sensitive deal data is destroyed. A SHA-256 hash receipt remains as proof of completion.

**Auth** — Mini App requests are authenticated via Telegram's `initData` (HMAC-SHA256 signature). Bot interactions are authenticated natively by Telegram.

## API Reference

All Mini App routes validate Telegram `initData` via the `x-telegram-init-data` header. In development, use `x-dev-user-id: <telegram_id>` header for testing.

**Channels**
- `GET /api/channels` — browse listings (filters: `minSubscribers`, `language`, `category`, `maxPrice`)
- `GET /api/channels/:id` — channel detail + stats + ad formats
- `POST /api/channels` — register channel
- `PUT /api/channels/:id` — update channel (owner only)
- `POST /api/channels/:id/formats` — add ad format
- `GET /api/channels/:id/admins` — list channel admins

**Campaigns**
- `GET /api/campaigns` — browse campaigns (filters: `minBudget`, `targetLanguage`, `status`)
- `GET /api/campaigns/:id` — campaign detail
- `POST /api/campaigns` — create campaign
- `POST /api/campaigns/:id/apply` — channel owner applies

**Deals**
- `GET /api/deals` — user's deals (filter by `role`: owner/advertiser)
- `GET /api/deals/:id` — deal detail (identity-masked)
- `POST /api/deals` — create deal
- `POST /api/deals/:id/pay` — get escrow wallet address
- `POST /api/deals/:id/cancel` — cancel deal
- `POST /api/deals/:id/dispute` — dispute (requires `reason`)
- `GET /api/deals/:id/receipt` — hash receipt (after purge)

**Creatives**
- `POST /api/deals/:id/creative` — submit creative
- `POST /api/deals/:id/creative/approve` — approve creative
- `POST /api/deals/:id/creative/revision` — request revision (with `notes`)
- `POST /api/deals/:id/creative/schedule` — set `scheduledPostAt`
- `GET /api/deals/:id/creatives` — all creative versions

**Users & Stats**
- `GET /api/users/me` — current user profile
- `PUT /api/users/me` — update profile (wallet, role)
- `GET /api/stats` — platform aggregate stats

## Bot Commands

- `/start` — onboarding + role selection (Owner, Advertiser, or Both)
- `/addchannel` — register a channel (interactive conversation flow)
- `/createcampaign` — create a campaign brief (interactive conversation flow)
- `/mychannels` — list your channels with subscriber counts
- `/mydeals` — view active deals with status
- `/msg <deal_id> <text>` — message the other party in a deal
- `/help` — command reference

## Tech Stack

- **Backend**: Fastify + TypeScript
- **Bot**: grammY (with conversations plugin)
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis
- **Frontend**: React 19 + Vite + TanStack Query + `@telegram-apps/telegram-ui`
- **Blockchain**: TON (WalletContractV4 per-deal escrow)
- **Validation**: Zod (API schemas + env config)
- **Infra**: Docker Compose (Postgres + Redis)

## Testing

559+ tests covering the full stack:

```bash
cd server
npm test        # run all tests
npm run test:watch  # watch mode
```

**Test coverage includes:**
- Deal state machine transitions (all 14 states, valid + invalid transitions)
- Database integration (Prisma operations, constraints, cascades)
- API integration (route handlers, auth, validation)
- Service layer (business logic, edge cases)
- Telegram auth (initData validation, HMAC verification)
- Privacy (encryption/decryption, identity masking)
- Zod schema validation (all request/response shapes)
- Worker logic (payment detection, posting, verification, timeouts, purge)
- TON operations (wallet generation, transfers, monitoring)
- Edge cases (concurrent deals, partial payments, deleted posts)

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://escrow:escrow_dev@localhost:5432/escrowbuild"
REDIS_URL="redis://localhost:6379"

# Telegram
BOT_TOKEN="your-bot-token-from-botfather"
MINI_APP_URL="https://your-domain.com"

# TON Blockchain
TON_NETWORK="testnet"              # or "mainnet"
TON_API_KEY=""                     # optional TonCenter API key
TON_MASTER_MNEMONIC="word1 word2 ..."  # master wallet mnemonic
TON_MASTER_WALLET_ADDRESS="EQA..."     # master wallet address
ESCROW_ENCRYPTION_KEY="64-char-hex"    # 32-byte key for AES-256-GCM

# Platform
PLATFORM_FEE_PERCENT="5"
PURGE_AFTER_DAYS="30"
PORT="3000"
NODE_ENV="development"
```

## Troubleshooting

**"Missing Telegram initData" on API calls**
You're calling the API outside of the Telegram Mini App. In development, add `x-dev-user-id: <telegram_id>` header instead.

**Bot doesn't respond to commands**
Make sure `BOT_TOKEN` is set correctly in `.env`. The bot needs to be running (`npm run dev` in the server directory).

**"Channel not found" when registering**
The channel must be public with a username. Private channels can't be looked up by username. Enter the username without the @ prefix.

**Payment not detected**
The payment monitor checks every 30s. Verify: (1) you sent to the correct escrow address, (2) the amount matches exactly, (3) Redis is running for the BullMQ workers.

**Auto-post fails**
The bot must be an admin in the target channel with permission to post messages. Check the `botIsAdmin` field on the channel record.

**Workers not running**
Workers need Redis. Make sure `docker compose up -d` is running and `REDIS_URL` is correct in `.env`.

**Build fails with peer dependency warning**
The `@telegram-apps/telegram-ui` package declares React 18 as a peer dependency. Install with `--legacy-peer-deps` flag — React 19 is fully compatible.

**"Unauthorized" from escrow operations**
The `ESCROW_ENCRYPTION_KEY` must be a valid 64-character hex string (32 bytes). Generate one with: `openssl rand -hex 32`.
