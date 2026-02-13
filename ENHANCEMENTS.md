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
- **Priority**: High
- **Why**: Current flow shows a raw TON address and asks users to manually send from an external wallet. This is confusing and error-prone.
- **What**: Integrate `@tonconnect/ui-react` so users can:
  1. Tap "Pay 0.2 TON"
  2. Tonkeeper / MyTonWallet opens inside Telegram
  3. One-tap confirm
  4. Done — no copy-pasting addresses
- Also gives us the user's wallet address for free (refunds, profile)
- Standard for all TON Mini Apps

### Copy-to-clipboard on escrow address
- Tapping the escrow address should copy it (until TON Connect replaces this flow)
- Use `navigator.clipboard.writeText()` with haptic feedback via `Telegram.WebApp.HapticFeedback`

### Error toasts / feedback
- API errors fail silently in the Mini App (e.g., the "Get Payment Address" button did nothing when the server returned 500)
- Add a global error toast/notification component
- Show user-friendly messages for common errors

### Shorten verification hold for testnet
- 24-hour post verification hold is too long for testing
- Add an env var `VERIFY_HOLD_HOURS` (default 24, set to 0 or 1 for testing)

### Deal notifications in Telegram
- Bot should DM both parties on key state changes:
  - Payment received (FUNDED)
  - Creative submitted / approved / revision requested
  - Post scheduled / posted / verified
  - Deal completed / cancelled / refunded

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
