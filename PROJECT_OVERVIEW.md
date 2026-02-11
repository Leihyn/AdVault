# Project Overview

## What It Is

Telegram channel advertising runs on trust — advertisers pay upfront hoping posts go live, channel owners deliver hoping payment clears, and intermediaries take 30% cuts. escrowBUILD replaces all of that with TON-based escrow: funds lock on-chain until the ad is posted, verified after 24 hours, and automatically released. No middlemen, no trust required.

The platform is a Telegram Mini App with a bot interface. It supports cross-platform ad deals — Telegram channels (full automation), YouTube (manual posting with API verification), and stubs for Instagram and Twitter.

## Architecture

Single Node.js monolith running Fastify (REST API), grammY (Telegram bot), and BullMQ workers — all in one process. The frontend is a React SPA served as static files in production.

**Core abstractions:**

- **Platform adapter pattern** — each platform (Telegram, YouTube, Instagram, Twitter) implements `IPlatformAdapter` with `fetchChannelInfo()`, `publishPost()`, `verifyPostExists()`, etc. Deal logic is platform-agnostic. Adding a new platform means one adapter file and a registry entry.

- **Deal state machine** — 14 states with validated transitions. Every state change is logged as a `DealEvent` with actor, timestamp, and metadata. Invalid transitions are rejected at the service layer.

- **Per-deal escrow wallets** — each deal gets its own TON WalletContractV4 with an encrypted mnemonic. Funds are isolated. Payouts use a two-hop relay (escrow -> master -> recipient) to break on-chain linkage between parties.

- **6 BullMQ workers** — payment detection (30s), auto-posting (30s), post verification (10min), deal timeouts (5min), data purge (60min), and transfer recovery (2min). Each runs on its own Redis queue.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for sequence diagrams, data model details, and scalability analysis.

## Key Decisions

**Why a monolith?** One process, one deploy, no inter-service latency. The service layer is cleanly separated — splitting into API/bot/workers later is a config change, not a rewrite. BullMQ already supports remote workers.

**Why per-deal wallets?** Isolates funds per deal. A compromised wallet affects one deal, not the whole platform. Simpler accounting — one wallet, one balance, one deal.

**Why two-hop relay?** On-chain observers see all payouts originating from the master wallet. They can't trace which advertiser deposit funded which channel owner payout. Privacy without a mixer.

**Why BullMQ?** Need reliable background jobs with retries, backoff, and job locking. BullMQ on Redis gives all of that with zero config. Workers are independent — can scale horizontally by running more instances.

**Why platform adapter pattern?** The marketplace vision is cross-platform. All deal/escrow/payment logic is identical regardless of where the ad runs. The adapter handles platform-specific API calls (posting, verifying, fetching channel info). New platforms are additive, not invasive.

## Future Thoughts

- **Webhook mode for bot** — switch from long polling to `bot.api.setWebhook()`. grammY supports both; one config change.
- **Process splitting** — separate deploys for API server, bot, and workers. BullMQ already supports this architecture.
- **Multi-chain support** — the wallet/transfer layer is abstracted. Could add Ethereum, Solana, or other chains behind the same interface.
- **Instagram & Twitter** — adapters are stubbed. Need API access and auth flows to implement `publishPost()` and `verifyPostExists()`.
- **Admin dashboard** — DealEvent audit trail is already logged. Needs a UI for dispute resolution, user management, and platform stats.
- **Dispute arbitration** — currently disputes are flagged but resolved manually. Could add voting, evidence submission, or automated rules.
- **Reputation system** — deal completion history is tracked. Could surface completion rates, average response times, and reviews.
- **Media uploads** — currently creative media uses external URLs. Could add S3/R2 storage for direct uploads.

## Known Limitations

- **Polling-based payment detection** — escrow wallets are checked every 30s via TonCenter RPC. Not webhook-driven. Works fine under ~1000 concurrent deals, but adds latency to payment confirmation.
- **No media upload** — creative content references external URLs only. No file upload to the platform.
- **No admin panel** — disputes, user management, and platform configuration require direct database access.
- **Manual YouTube posting** — the YouTube adapter can verify posts exist via the Data API, but can't auto-upload videos. Channel owners upload manually and submit the URL.
- **Instagram & Twitter are stubs** — adapters exist but throw "not implemented" on posting/verification. Channel registration and deal creation work.
- **Single-process deployment** — API, bot, and all workers run in one Node.js process. Fine for a contest demo, needs splitting for production traffic.
- **No rate limiting on mutations** — the global rate limiter covers all endpoints equally. Write-heavy endpoints (deal creation, creative submission) could use tighter per-endpoint limits.
- **No webhook mode for bot** — uses long polling, which is simpler but less efficient than webhooks for production.

## AI Disclosure

Approximately 70% of the code was written by AI (Claude), with human direction throughout.

**What was human-directed:**
- Architecture decisions (monolith vs microservices, per-deal wallets, two-hop relay, platform adapter pattern)
- Data model design (Prisma schema, state machine states and transitions)
- Security model (identity masking approach, encryption strategy, fund privacy design)
- Feature prioritization and scope (what to build, what to stub)
- Code review and iteration (catching edge cases, fixing logic errors, improving naming)
- All deployment and infrastructure decisions

**What was AI-generated:**
- Implementation of services, routes, workers, and bot commands
- Prisma schema and migrations
- React frontend pages and components
- Test suite (647+ tests)
- Zod validation schemas
- TON wallet integration code
- Platform adapter implementations
- Documentation (README, ARCHITECTURE.md)

The human served as architect and reviewer; the AI served as implementer. Every piece of generated code was reviewed and iterated on before acceptance.
