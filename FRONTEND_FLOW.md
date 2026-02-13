# AdVault — Frontend User Flow

## Open the App

1. Open Telegram, go to **@bbuuiilldd_bot**
2. Type `/start`, tap **"Open Marketplace"**

## Bottom Nav

```
  Home  |  Browse  |  + New  |  Activity  |  Profile
```

---

## Flow A: Register a Channel (Earn)

```
Home → tap "Earn"
  → Pick platform: YouTube, Instagram, Twitter/X, or TikTok
  → YouTube: paste channel URL (e.g. youtube.com/@YourChannel)
  → Instagram/Twitter/TikTok: enter username
  → Pick up to 3 categories + language
  → Tap "Register Channel"
  → Redirects to Manage Channel
  → Tap "Add All [Platform] Formats" (if no formats exist)
  → Set prices on each format → toggle to "Live"
  → (Optional) Verify account ownership via profile link
  → Channel now appears in Browse marketplace
```

Telegram channels are registered through the bot (`/addchannel`), not the web UI.

## Flow B: Browse & Book an Ad (Advertise)

```
Home → tap "Advertise" (or Browse tab)
  → Filter by platform (Telegram, YouTube, Instagram, Twitter/X, TikTok)
  → Filter by category + language
  → Tap a channel card
  → Pick an ad format (Post, Video, Story, etc.)
  → Set verification requirements (views, likes, post stays live)
  → Set verification window (24h, 48h, 7 days)
  → Optionally add a brief + creative assets
  → Tap "Create Deal" → TON locks in escrow
  → Redirects to Deal Detail
```

## Flow C: Create a Campaign

```
+ New tab → "Create Campaign" (or Campaigns list → "+ Create Campaign")
  → Fill title + brief
  → Set budget (TON) — presets: 10, 25, 50, 100, 250, 500
  → Pick up to 3 target categories + language
  → Tap "Post Campaign"
  → Channel owners can browse and apply to your campaign
```

## Flow D: Check Your Stuff (Activity)

```
Activity tab → 3 sub-tabs:

  Deals:
    → See all your deals (as buyer or seller)
    → Tap any deal to see full detail + progress

  Channels:
    → See your registered channels
    → "+ Register Channel" button at top
    → Tap a channel to manage formats/pricing/verification

  Campaigns:
    → See your campaign briefs
    → Tap a campaign to see applications
```

## Flow E: Profile & Wallet

```
Profile tab
  → See Telegram name, username, role (Advertiser / Owner / Both)
  → Connect or edit TON wallet address
```

## Flow F: Quick Create (+ New)

```
+ New tab → 3 actions:
  → Register Channel — YouTube, Instagram, Twitter/X, or TikTok
  → Create Campaign — post a brief for channel owners
  → Browse & Book Ad — find a channel and create a deal
```

---

## Deal Lifecycle

```
PENDING_PAYMENT → advertiser sends TON to escrow wallet
  → FUNDED → channel owner submits creative
  → CREATIVE_PENDING → CREATIVE_SUBMITTED
  → advertiser reviews → approve or request revision
  → CREATIVE_APPROVED → creator posts ad and submits proof URL
  → POSTED → platform verifies (post existence, views, likes)
  → TRACKING → automated checks every 5 minutes
  → VERIFIED → escrow releases TON to channel owner
  → COMPLETED
```

Either party can **cancel** (before posting) or **dispute** (after funding).

---

## Ad Formats (Creator Rates)

Ad formats are your **price list as a channel owner**. Each format is a type of ad placement you offer with a price in TON:

| Platform   | Default Formats              |
|------------|------------------------------|
| Telegram   | Post, Forward, Story         |
| YouTube    | Video, Community Post        |
| Instagram  | Post, Story, Reel            |
| Twitter/X  | Tweet                        |
| TikTok     | Video, Story                 |

Set a price and toggle to "Live" for each format you want to offer. Advertisers see your live formats when browsing your channel.

---

## Post Verification (How Ads Get Checked)

After a deal is funded and the creative is approved, the channel owner posts the ad on their platform and submits the post URL as proof.

**Phase 1 — Existence checks (all platforms):**
- Owner submits post URL → server parses platform-specific post ID
- Server verifies the post exists (oEmbed / platform API)
- Automated checks every 5 minutes during verification window
- If post is deleted → deal fails → automatic refund
- Advertiser can manually approve or waive requirements

**Phase 2 — Automated metrics (platform-dependent):**

| Platform  | Metrics Available             | Method           |
|-----------|-------------------------------|------------------|
| YouTube   | Views, Likes, Comments        | YouTube Data API |
| Telegram  | Post existence only           | Bot API          |
| Instagram | Post existence only           | oEmbed API       |
| Twitter/X | Post existence only           | oEmbed API       |
| TikTok    | Post existence only           | oEmbed API       |

Requirements (views, likes, etc.) are tracked automatically where APIs support it. When targets are met, funds are auto-released.

---

## Account Verification

Channel owners can verify they own their platform accounts:

```
Manage Channel → Account Verification
  → Tap "Start Verification"
  → Copy the unique verification link
  → Add it to your platform profile (bio, website, or about section)
  → Tap "Check Now"
  → If link is found → account gets verified badge
```

Verified accounts rank higher in marketplace search results.
