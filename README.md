# AdVault

Telegram channel ads are a trust problem. Advertisers pay upfront and hope the post goes live. Channel owners deliver first and hope the payment clears. Both sides lose when the other ghosts.

In traditional advertising, escrow solves this. In Telegram? Nothing exists. Advertisers in the $20B+ Telegram ad market rely on screenshots, good faith, and intermediaries who take 30% cuts.

AdVault fixes this with TON-based escrow. Funds lock on-chain until the ad is posted, verified, and the hold period passes. No trust required.

## Quick Start

```bash
# 1. Start infrastructure (Postgres + Redis)
cd AdVault
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

## Deploy (Render + Redis Cloud)

A fully free deployment using Render (web service + Postgres) and Redis Cloud (managed Redis). No credit card required.

### Step 1: Create a Redis Cloud database

1. Go to [redis.com/try-free](https://redis.com/try-free/) and sign up (GitHub or email)
2. Create a free database — pick any region, 30MB is plenty
3. Copy the **public endpoint** and **password** from the database details page
4. Your `REDIS_URL` is: `redis://default:<password>@<endpoint>:<port>`

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **"New"** → **"Web Service"** → connect your `advault` repo
3. Render auto-detects the `Dockerfile`
4. Set **Name** to `advault`
5. Pick the **Free** instance type
6. Under **Environment Variables**, add:

```env
BOT_TOKEN=your-bot-token-from-botfather
MINI_APP_URL=https://advault.onrender.com
TON_NETWORK=testnet
TON_MASTER_MNEMONIC=word1 word2 word3 ...
TON_MASTER_WALLET_ADDRESS=EQA...
ESCROW_ENCRYPTION_KEY=64-char-hex
REDIS_URL=redis://default:password@host:port
PLATFORM_FEE_PERCENT=5
PURGE_AFTER_DAYS=30
NODE_ENV=production
```

Generate the encryption key with `openssl rand -hex 32` if you don't have one.

7. Click **"Create Web Service"** — Render builds the Dockerfile and deploys

### Step 3: Add Postgres on Render

1. In the Render dashboard, click **"New"** → **"PostgreSQL"**
2. Name it `advault-db`, pick the **Free** tier
3. After creation, copy the **Internal Database URL** from the database info page
4. Go back to your web service → **Environment** → add `DATABASE_URL` with the internal URL
5. Render redeploys automatically after adding the variable

### Step 4: Run database migration

After the deploy succeeds, go to your web service → **Shell** tab and run:

```bash
cd /app/server && npx prisma db push
```

### Step 5: Keep it alive with UptimeRobot

Render's free tier sleeps after 15 minutes of no inbound requests. Fix this with a free uptime monitor:

1. Go to [uptimerobot.com](https://uptimerobot.com) and sign up (free)
2. Click **"Add New Monitor"**
3. Set type to **HTTP(s)**, URL to `https://advault.onrender.com/api/health`
4. Set interval to **5 minutes**
5. Save — UptimeRobot pings your app every 5 min, keeping it awake 24/7

### Step 6: Verify

- Check Render deploy logs for `Server running on port 3000` and `Bot @yourbot started`
- Open Telegram, send `/start` to your bot
- Test `/help`, `/addchannel`, `/mychannels`
- Open `https://advault.onrender.com` to verify the Mini App loads

Optional: `YOUTUBE_API_KEY` (for YouTube channel support), `TON_API_KEY` / `TON_API_KEY_FALLBACK` (TonCenter rate limits).

## How It Works

**For advertisers:**
1. Browse channels in the Mini App -- filter by platform, language, category
2. Create a deal -- the platform generates a unique TON escrow wallet
3. Send the exact TON amount to lock funds on-chain
4. Review and approve the creative draft from the channel owner
5. Post goes live automatically at the scheduled time (Telegram) or manually (YouTube)
6. After 24h verification (post still intact), funds release to the channel owner

**For channel owners:**
1. Register your channel via `/addchannel` in the bot (Telegram) or via the API (YouTube, others)
2. Set ad formats and pricing (post, forward, story, video, reel, tweet, custom)
3. Apply to campaigns or receive direct deals from advertisers
4. Submit creative drafts for advertiser approval (revision loop supported)
5. Bot auto-posts at the scheduled time (Telegram) or you post manually and submit the URL (YouTube)
6. Funds release after 24h hold period

**What happens if things go wrong:**
- Advertiser never pays? Deal times out after 24h, no action needed.
- Post gets deleted during hold period? Platform auto-detects, flags as disputed.
- Channel owner never submits creative? Deal times out, funds auto-refund.
- Either party wants out? Cancel anytime before posting; funded deals get refunded.

## Cross-Platform Support

The marketplace supports channels across multiple platforms. Each platform implements the `IPlatformAdapter` interface -- the deal/escrow/payment logic stays identical regardless of where the ad runs.

| Platform | Status | Posting | Verification |
|---|---|---|---|
| **Telegram** | Full | Auto-post via bot | Bot checks message exists |
| **YouTube** | Proof-of-concept | Manual (owner uploads video, submits URL) | YouTube Data API v3 checks video exists |
| **Instagram** | Stub | Coming soon | Coming soon |
| **Twitter/X** | Stub | Coming soon | Coming soon |

All users authenticate via Telegram Mini App regardless of which platform their channel is on. Notifications are Telegram-only.

```
IPlatformAdapter
  fetchChannelInfo()    -- get title, subscribers, description
  canPost()             -- check if bot can auto-post
  publishPost()         -- post content to the channel
  verifyPostExists()    -- check if a post is still live
  getPostUrl()          -- public URL for a post
  getChannelUrl()       -- public URL for the channel
```

Adding a new platform means implementing this interface and registering it in the platform registry. No changes to deals, escrow, or payments.

## Deal State Machine

Every deal progresses through a validated state machine. Invalid transitions are rejected.

```
                                    +------------------+
                                    |  PENDING_PAYMENT  | (24h timeout)
                                    +--------+---------+
                                             | TON received
                                    +--------v---------+
                                    |      FUNDED       |
                                    +--------+---------+
                                             | auto-advance
                                    +--------v---------+
                               +---->| CREATIVE_PENDING  |
                               |    +--------+---------+
                               |             | owner submits
                               |    +--------v---------+
                               |    |CREATIVE_SUBMITTED |
                               |    +---+--------+-----+
                               |        |        |
                    revision <-+   approve    revise
                                        |        |
                               +--------v--+  +--v---------------+
                               | CREATIVE   |  |CREATIVE_REVISION |
                               | APPROVED   |  +-----------------+
                               +--------+---+        ^ (loops back)
                                        |
                               +--------v---------+
                               |    SCHEDULED      |
                               +--------+---------+
                                        | auto-post
                               +--------v---------+
                               |      POSTED       | (24h hold)
                               +--------+---------+
                                        | verified
                               +--------v---------+
                               |     VERIFIED      |
                               +--------+---------+
                                        | funds released
                               +--------v---------+
                               |    COMPLETED      |
                               +-------------------+

  Side paths:
  - Any active state --> CANCELLED (by either party)
  - Funded + cancelled --> REFUNDED (auto)
  - Timeout exceeded --> TIMED_OUT --> REFUNDED (if funded)
  - Post deleted --> DISPUTED --> REFUNDED or COMPLETED (manual)
```

14 states total. Every transition is logged as a DealEvent with actor, timestamp, and metadata.

## Architecture

```
AdVault/
  docker-compose.yml            <- Postgres + Redis
  server/
    src/
      index.ts                  <- Fastify + grammy bot + BullMQ workers boot
      config.ts                 <- Env validation (Zod)
      api/
        middleware/auth.ts      <- Telegram initData validation
        routes/                 <- REST endpoints (channels, campaigns, deals, creatives, users, stats)
        schemas/                <- Zod request/response schemas
      bot/
        commands/               <- /start, /mychannels, /mydeals, /help
        conversations/          <- /addchannel, /createcampaign, deal chat
        middleware/auth.ts      <- Auto-create user on first message
      platforms/
        types.ts                <- IPlatformAdapter interface + Platform enum
        registry.ts             <- Singleton adapter registry
        telegram.adapter.ts     <- Wraps telegram.service.ts
        youtube.adapter.ts      <- YouTube Data API v3
        instagram.adapter.ts    <- Stub
        twitter.adapter.ts      <- Stub
      services/                 <- Business logic
        deal.service.ts         <- State machine + transitions
        escrow.service.ts       <- Escrow wallet lifecycle
        creative.service.ts     <- Content versioning + encryption
        posting.service.ts      <- Platform-agnostic posting
        notification.service.ts <- User notifications (Telegram)
        telegram.service.ts     <- Telegram-specific API calls
      workers/                  <- BullMQ background jobs
        payment.worker.ts       <- Monitors escrow wallets (every 30s)
        posting.worker.ts       <- Auto-posts via platform adapter (every 30s)
        verify.worker.ts        <- Confirms post integrity via platform adapter (every 10min)
        timeout.worker.ts       <- Auto-cancels stale deals (every 5min)
        purge.worker.ts         <- GDPR-style data cleanup (every 60min)
        recovery.worker.ts      <- Retries failed two-hop transfers (every 2min)
      ton/
        wallet.ts               <- Per-deal wallet generation (WalletContractV4)
        transfer.ts             <- Two-hop fund relay (escrow -> master -> recipient)
        monitor.ts              <- Balance polling
      utils/
        privacy.ts              <- Identity masking, content encryption
        errors.ts               <- Custom error classes
        decimal.ts              <- TON decimal helpers
    prisma/
      schema.prisma             <- Full data model (13 models)
    vitest.config.ts

  web/
    src/
      main.tsx                  <- AppRoot (telegram-ui theme) + React Query + Router
      App.tsx                   <- Route definitions
      api/client.ts             <- Fetch wrapper with Telegram auth headers
      hooks/useTelegram.ts      <- WebApp SDK hook (graceful fallback)
      pages/                    <- 10 pages (Home, Channels, ChannelDetail, Campaigns, CampaignDetail, Deals, DealDetail, Profile, MyChannels, MyCampaigns)
      components/               <- 7 components (Layout, ChannelCard, CampaignCard, DealStatus, CreativeEditor, Icons)
```

### Background Workers

Workers drive the platform. Without them, deals don't progress.

**Payment monitor** checks escrow wallets every 30 seconds via TonCenter RPC. When the expected amount arrives, the deal auto-advances to FUNDED then CREATIVE_PENDING.

**Posting worker** finds deals past their `scheduledPostAt` timestamp, decrypts the creative content (AES-256-GCM), and dispatches to the correct platform adapter based on `channel.platform`. For Telegram, posts via the bot. For YouTube, throws (manual posting). Records the `postedMessageId` for verification.

**Verify worker** runs every 10 minutes. For deals in POSTED state that have been up for 24 hours, it dispatches to the platform adapter to check the post still exists. If intact, funds auto-release. If the post was deleted, the deal transitions to DISPUTED.

**Timeout worker** auto-cancels deals that exceed their deadline (24h for payment, configurable for creative submission). Funded deals get auto-refunded.

**Purge worker** handles data retention. After 30 days in a terminal state, sensitive data (creative content, escrow mnemonics, events) is deleted. A SHA-256 DealReceipt preserves proof of completion without PII.

**Recovery worker** retries failed two-hop transfers every 2 minutes. If hop 1 (escrow -> master) succeeds but hop 2 (master -> recipient) fails, recovery picks up where it left off.

## Privacy & Security

**Identity masking** -- Advertisers and channel owners never see each other's Telegram identity. Each party sees a random alias ("Buyer #1234" / "Seller #5678").

**Content encryption** -- Creative drafts and escrow mnemonics are encrypted at rest with AES-256-GCM. Decrypted only for authorized parties.

**Two-hop fund relay** -- Funds move escrow wallet -> master wallet -> recipient. This breaks on-chain linkage between advertiser and channel owner.

**Data purge** -- After the retention period (default 30 days), sensitive deal data is destroyed. A SHA-256 hash receipt remains as proof of completion.

**Auth** -- Mini App requests are authenticated via Telegram's `initData` (HMAC-SHA256 signature). Bot interactions are authenticated natively by Telegram.

## API Reference

All Mini App routes validate Telegram `initData` via the `x-telegram-init-data` header. In development, use `x-dev-secret` + `x-dev-user-id` headers for testing.

**Channels**
- `GET /api/channels` -- browse listings (filters: `platform`, `minSubscribers`, `language`, `category`, `maxPrice`)
- `GET /api/channels/:id` -- channel detail + stats + ad formats
- `POST /api/channels` -- register channel (`platform`, `platformChannelId` or `telegramChatId`, `title`)
- `PUT /api/channels/:id` -- update channel (owner only)
- `POST /api/channels/:id/formats` -- add ad format (POST, FORWARD, STORY, CUSTOM, VIDEO, REEL, TWEET, COMMUNITY_POST)
- `GET /api/channels/:id/admins` -- list channel admins

**Campaigns**
- `GET /api/campaigns` -- browse campaigns (filters: `minBudget`, `targetLanguage`, `status`)
- `GET /api/campaigns/:id` -- campaign detail
- `POST /api/campaigns` -- create campaign
- `POST /api/campaigns/:id/apply` -- channel owner applies

**Deals**
- `GET /api/deals` -- user's deals (filter by `role`: owner/advertiser)
- `GET /api/deals/:id` -- deal detail (identity-masked)
- `POST /api/deals` -- create deal
- `POST /api/deals/:id/pay` -- get escrow wallet address
- `POST /api/deals/:id/cancel` -- cancel deal
- `POST /api/deals/:id/dispute` -- dispute (requires `reason`)
- `GET /api/deals/:id/receipt` -- hash receipt (after purge)

**Creatives**
- `POST /api/deals/:id/creative` -- submit creative
- `POST /api/deals/:id/creative/approve` -- approve creative
- `POST /api/deals/:id/creative/revision` -- request revision (with `notes`)
- `POST /api/deals/:id/creative/schedule` -- set `scheduledPostAt`
- `GET /api/deals/:id/creatives` -- all creative versions

**Users & Stats**
- `GET /api/users/me` -- current user profile
- `PUT /api/users/me` -- update profile (wallet address)
- `GET /api/users/me/channels` -- my channels
- `GET /api/users/me/campaigns` -- my campaigns
- `GET /api/stats` -- platform aggregate stats

## Bot Commands

- `/start` -- onboarding + role selection (Owner, Advertiser, or Both)
- `/addchannel` -- register a channel (interactive conversation flow)
- `/createcampaign` -- create a campaign brief (interactive conversation flow)
- `/mychannels` -- list your channels with subscriber counts
- `/mydeals` -- view active deals with status
- `/msg <deal_id> <text>` -- message the other party in a deal
- `/help` -- command reference

## Tech Stack

- **Backend**: Fastify + TypeScript
- **Bot**: grammy (with conversations plugin)
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis
- **Frontend**: React 19 + Vite + TanStack Query + `@telegram-apps/telegram-ui`
- **Blockchain**: TON (WalletContractV4 per-deal escrow)
- **Platforms**: googleapis (YouTube Data API v3)
- **Validation**: Zod (API schemas + env config)
- **Infra**: Docker Compose (Postgres + Redis)

## Testing

731 tests covering the full stack:

```bash
cd server
npm test           # run all tests
npm run test:watch # watch mode
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
DATABASE_URL="postgresql://escrow:escrow_dev@localhost:5432/advault"
REDIS_URL="redis://localhost:6379"

# Telegram
BOT_TOKEN="your-bot-token-from-botfather"
MINI_APP_URL="https://your-domain.com"

# TON Blockchain
TON_NETWORK="testnet"                # or "mainnet"
TON_API_KEY=""                       # optional TonCenter API key
TON_API_KEY_FALLBACK=""              # fallback TonCenter key
TON_MASTER_MNEMONIC="word1 word2 ..." # master wallet mnemonic (24 words)
TON_MASTER_WALLET_ADDRESS="EQA..."   # master wallet address
ESCROW_ENCRYPTION_KEY="64-char-hex"  # 32-byte key for AES-256-GCM

# Platform APIs
YOUTUBE_API_KEY=""                   # YouTube Data API v3 key (for YouTube channels)

# Settings
PLATFORM_FEE_PERCENT="5"
PURGE_AFTER_DAYS="30"
PORT="3000"
NODE_ENV="development"
DEV_BYPASS_SECRET=""                 # dev auth bypass (development only)
```

## Troubleshooting

**"Missing Telegram initData" on API calls**
You're calling the API outside of the Telegram Mini App. In development, set `DEV_BYPASS_SECRET` in `.env` and send `x-dev-secret` + `x-dev-user-id` headers.

**Bot doesn't respond to commands**
Make sure `BOT_TOKEN` is set correctly in `.env`. The bot needs to be running (`npm run dev` in the server directory).

**"Channel not found" when registering**
For Telegram: the channel must be public with a username. Private channels can't be looked up by username. Enter the username without the @ prefix.
For YouTube: use the YouTube channel ID (starts with `UC`), not the channel URL or handle.

**Payment not detected**
The payment monitor checks every 30s. Verify: (1) you sent to the correct escrow address, (2) the amount matches exactly, (3) Redis is running for the BullMQ workers.

**Auto-post fails**
For Telegram: the bot must be an admin in the target channel with permission to post messages. Check the `botIsAdmin` field on the channel record.
For YouTube: auto-posting is not supported. Upload the video manually and submit the URL.

**Workers not running**
Workers need Redis. Make sure `docker compose up -d` is running and `REDIS_URL` is correct in `.env`.

**Build fails with peer dependency warning**
The `@telegram-apps/telegram-ui` package declares React 18 as a peer dependency. Install with `--legacy-peer-deps` flag -- React 19 is fully compatible.

**"Unauthorized" from escrow operations**
The `ESCROW_ENCRYPTION_KEY` must be a valid 64-character hex string (32 bytes). Generate one with: `openssl rand -hex 32`.

**YouTube channel info fails**
Set `YOUTUBE_API_KEY` in `.env`. Get a key from the [Google Cloud Console](https://console.cloud.google.com/) with YouTube Data API v3 enabled.
