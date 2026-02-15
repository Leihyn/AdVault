# AdVault — Enhancements & TODOs

Tracked issues, planned features, and UX improvements discovered during testing.

## P0 — Must Fix

### Payment detection tolerance
- **Status**: Fixed
- TON deducts gas from transfers to uninitialized wallets (e.g., 0.2 TON arrives as 0.1996)
- Added 5% tolerance in `checkEscrowFunding()` so the worker accepts slightly less than the exact amount

### Empty JSON body on POST requests
- **Status**: Fixed
- Fastify rejects POST requests with `Content-Type: application/json` but no body
- `payDeal()`, `cancelDeal()`, `approveCreative()` were sending bodyless POSTs
- Fixed by sending `body: '{}'` in the API client

### isAdvertiser not passed to frontend
- **Status**: Fixed
- `DealDetail.tsx` compared `deal.advertiser.telegramId` to Telegram user ID, but the API never returned `telegramId` (privacy masking)
- Payment button, creative approval, and other role-gated actions were invisible
- Fixed by adding `isAdvertiser` / `isOwner` booleans to the API response

## P1 — Should Build

### TON Connect integration
- **Status**: Done
- Integrated `@tonconnect/ui-react` with `TonConnectUIProvider` wrapping the app
- DealDetail: "Pay X TON" button sends transaction via connected wallet (Tonkeeper/MyTonWallet)
- Profile: "Connect TON Wallet" button with auto-save of wallet address
- Manual address copy preserved as fallback
- Manifest at `/tonconnect-manifest.json`

### Copy-to-clipboard on escrow address
- **Status**: Done
- Both escrow and payment addresses are tappable with "Tap to copy" hint
- Uses `navigator.clipboard.writeText()` with haptic feedback
- Visual "Copied!" confirmation with 2s auto-reset

### Error toasts / feedback
- **Status**: Done
- Global `ToastProvider` using `@telegram-apps/telegram-ui` Snackbar component
- `MutationCache.onError` catches all unhandled mutation errors and shows toast
- `useToast()` hook for manual success/info/error toasts
- Key actions (approve, cancel) show success toasts

### Shorten verification hold for testnet
- **Status**: Done
- Added `VERIFY_HOLD_HOURS` env var to config (default 24)
- `deal.service.ts` uses config value instead of hardcoded 24
- Set to 0 or 1 in `.env` for testing

### Deal notifications in Telegram
- **Status**: Done
- Added `notifyStatusChange()` convenience function using global bot singleton
- All services now send DM notifications on state changes:
  - `creative.service.ts`: CREATIVE_SUBMITTED, CREATIVE_APPROVED, CREATIVE_REVISION
  - `escrow.service.ts`: FUNDED, COMPLETED, REFUNDED
  - `deal.service.ts`: CANCELLED
  - `dispute.service.ts`: DISPUTED, COMPLETED, REFUNDED
  - `proof.service.ts`: POSTED, TRACKING
- Safe to call in tests (silently skips if bot not initialized)

### Deal split transfers
- **Status**: Done
- `splitFunds()` in escrow.service.ts implements proper two-party split
- Escrow -> Master (full amount), then Master -> Owner + Master -> Advertiser
- Each hop-2 transfer has its own PendingTransfer for recovery
- Dispute resolution SPLIT case now uses actual split instead of all-or-nothing

## P2 — Nice to Have

### Wallet balance display
- Show the user's TON balance in the Mini App header (requires TON Connect)
- Show it on the Profile page

### QR code for escrow address
- Generate a TON payment QR code (ton://transfer/ADDRESS?amount=NANOTONS)
- Fallback for users who prefer scanning from a desktop wallet

### Deal chat
- In-app messaging between advertiser and channel owner within a deal
- Currently only `/msg <deal_id>` bot command exists

### Campaign discovery improvements
- Channel owner can browse campaigns and apply
- Add filtering by language, category, budget range
- Sort by newest / highest budget

### Analytics dashboard
- Total volume processed
- Number of completed deals
- Average deal completion time
- Platform fee revenue

### Multi-language support
- Detect user's Telegram language via `initDataUnsafe.user.language_code`
- Support English, Russian, Chinese (biggest Telegram markets)

### Rate limiting on API
- Add per-user rate limiting to prevent abuse
- Especially on deal creation and payment endpoints

### Creative preview
- Show a mockup of how the ad will look in the channel before posting
- Different preview for POST vs STORY vs VIDEO formats

## P3 — Future / Post-MVP

### TON Connect wallet-based auth
- Replace Telegram initData auth with TON Connect wallet signatures
- Enables non-Telegram access (web dashboard)

### Multi-chain escrow
- Support USDT on TON, or bridge to EVM chains
- Stablecoin option removes price volatility during deal lifecycle

### Reputation system
- Track deal completion rate per user
- Display trust score on channel listings
- Penalize frequent cancellations

### Automated dispute resolution
- If post is deleted before 24h hold, auto-refund
- If channel owner disputes, require screenshot proof
- Arbitration flow for edge cases

### Revenue sharing / referral program
- Referral links for channels
- Reduced platform fee for high-volume users
