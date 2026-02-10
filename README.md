# escrowBUILD

Telegram channel ads are a trust problem. Advertisers pay upfront and hope the post goes live. Channel owners deliver first and hope the payment clears. Both sides lose when the other ghosts.

escrowBUILD fixes this with TON-based escrow. Funds lock on-chain until the ad is posted, verified, and the hold period passes. No trust required.

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Set up environment
cp .env.example .env
# Edit .env with your BOT_TOKEN and other values

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

The server runs on port 3000, the frontend on port 5173 (proxied to the API).

## How It Works

**For channel owners:**
1. Register your channel via `/addchannel` in the bot
2. Set ad formats and pricing (post, forward, story)
3. Receive deals from advertisers or apply to campaigns
4. Submit creative drafts for advertiser approval
5. Bot auto-posts at scheduled time
6. Funds release after 24h verification

**For advertisers:**
1. Browse channels or create a campaign brief
2. Create a deal and send TON to the escrow wallet
3. Review and approve the creative
4. Post goes live, verified automatically
5. Funds release to channel owner after hold period

**The escrow flow:**
```
Deal Created → Payment Sent → Funds Locked
→ Creative Submitted → Approved → Scheduled
→ Auto-Posted → Verified (24h) → Funds Released
```

Each deal gets a unique TON wallet. Funds only move when the deal completes or when a timeout/cancellation triggers a refund.

## Architecture

```
server/
  src/
    index.ts          ← Fastify + bot + workers boot
    config.ts         ← Env validation (Zod)
    bot/              ← grammY bot (commands, conversations)
    api/              ← Fastify routes + auth middleware
    services/         ← Business logic (deal state machine, escrow, creative flow)
    ton/              ← TON wallet generation, monitoring, transfers
    workers/          ← BullMQ jobs (payment check, posting, verification, timeouts)
    utils/            ← initData validation, error classes
  prisma/
    schema.prisma     ← Full data model

web/
  src/
    pages/            ← React pages (channels, campaigns, deals, profile)
    components/       ← Reusable UI (cards, status badges, filters)
    api/client.ts     ← API client with Telegram auth
    hooks/            ← useTelegram hook
```

**Deal state machine** — 14 states covering the full lifecycle from payment through verification. Every transition is validated, logged as an event, and triggers notifications.

**Background workers** (BullMQ + Redis):
- Payment monitor: checks escrow wallets every 30s
- Posting: auto-posts at scheduled time
- Verification: confirms post integrity every 10min for 24h
- Timeout: auto-cancels stale deals with refund

## API Routes

All Mini App routes validate Telegram `initData` via the `x-telegram-init-data` header. In development, use `x-dev-user-id` header for testing.

- `GET /api/channels` — browse listings (filters: subscribers, price, language, category)
- `GET /api/channels/:id` — channel detail + stats + ad formats
- `POST /api/channels` — register channel
- `GET /api/campaigns` — browse campaigns
- `POST /api/campaigns` — create campaign
- `POST /api/campaigns/:id/apply` — channel owner applies
- `POST /api/deals` — create deal
- `GET /api/deals` — user's deals
- `POST /api/deals/:id/pay` — get escrow wallet address
- `POST /api/deals/:id/creative` — submit creative
- `POST /api/deals/:id/creative/approve` — approve creative
- `POST /api/deals/:id/creative/schedule` — set post time
- `GET /api/users/me` — current user profile
- `GET /api/stats` — platform stats

## Bot Commands

- `/start` — onboarding + role selection
- `/addchannel` — register a channel (interactive flow)
- `/createcampaign` — create a campaign brief (interactive flow)
- `/mychannels` — list your channels
- `/mydeals` — view active deals
- `/msg <deal_id> <text>` — message the other party about a deal
- `/help` — command reference

## Stack

- **Backend**: Fastify + TypeScript
- **Bot**: grammY
- **Database**: PostgreSQL + Prisma
- **Frontend**: React + Vite + TanStack Query
- **Blockchain**: TON (@ton/ton, @ton/crypto)
- **Jobs**: BullMQ + Redis
- **Infra**: Docker Compose

## Troubleshooting

**"Missing Telegram initData" on API calls**
You're calling the API outside of the Telegram Mini App. In development, add `x-dev-user-id: <telegram_id>` header instead.

**Bot doesn't respond to /addchannel**
Make sure `BOT_TOKEN` is set correctly in `.env`. The bot needs to be running (`npm run dev`).

**"Channel not found" when registering**
The channel must be public and the username must be correct (without @). Private channels can't be looked up by username.

**Payment not detected**
The payment monitor checks every 30s. Verify: (1) you sent to the correct address, (2) the amount matches exactly, (3) Redis is running for BullMQ workers.

**Auto-post fails**
The bot must be an admin in the target channel with permission to post messages. Check `botIsAdmin` field on the channel.

**Workers not running**
Workers need Redis. Make sure `docker compose up -d` is running and `REDIS_URL` is correct in `.env`.
