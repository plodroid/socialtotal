# SocialTotal setup

This demo is deliberately safe-by-default: it works without secrets, and real provider features activate only when you configure the matching public identifiers/backend.

## 1. Google sign-in + YouTube

SocialTotal uses Google Identity Services in the browser.

1. Open Google Cloud Console and create/select a project.
2. Enable **YouTube Data API v3**.
3. Configure the OAuth consent screen.
4. Create an **OAuth 2.0 Client ID → Web application**.
5. Add the origin you use for testing under **Authorized JavaScript origins**.
6. Put the public Web Client ID in `config.js`:

```js
window.SOCIALTOTAL_CONFIG = {
  googleClientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  tiktokClientKey: "",
  backendBaseUrl: "",
  discordClientId: "",
  adsenseClient: "",
  adsenseSlot: "",
  demoMode: true
};
```

Requested YouTube scopes:
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube.upload`

The client ID is public by design. **Never commit a Google client secret.**

When configured, SocialTotal can:
- use Google's official sign-in UI;
- open Google's real OAuth consent prompt when connecting YouTube;
- read the connected channel name;
- perform a YouTube resumable upload from the browser.

For a public production launch, complete any Google OAuth/app verification required for the scopes you request.

## 2. TikTok

A real TikTok integration needs a TikTok developer app and a private backend for durable authorization/token handling.

The current TikTok Content Posting API supports direct video posting and photo posting. TikTok requires creator-info checks and user consent in the posting flow. Unaudited Direct Post clients are restricted to private visibility, so finish TikTok's audit before treating this as a public posting product.

Set `backendBaseUrl` once your backend implements:
- `GET /auth/tiktok/start`
- `POST /api/publish/tiktok`

## 3. Instagram + Facebook

Use a private backend for Meta authorization and publishing.

Recommended backend contract:
- `GET /auth/instagram/start`
- `POST /api/publish/instagram`
- `GET /auth/facebook/start`
- `POST /api/publish/facebook`

Instagram API publishing is intended for supported professional accounts. Common Meta publishing flows also require provider-accessible media URLs/server processing, so do not put long-lived tokens or app secrets in this frontend.

## 4. Discord + email sign-in

The demo currently simulates these sign-in methods locally.

Production backend routes can use:
- `GET /auth/discord/start`
- your preferred email magic-link/session endpoints.

Do not store OAuth client secrets in `config.js`.

## 5. Ads

Create approved ad units with your ad provider. For Google AdSense, place the public publisher and slot IDs in `config.js`:

```js
adsenseClient: "ca-pub-XXXXXXXXXXXX",
adsenseSlot: "1234567890"
```

Free and Spread show the configured ad slots. Total hides SocialTotal ad placements.

Ad approval, consent requirements, policy compliance, and actual earnings are controlled by the ad provider.

## 6. Payments

The pricing page is intentionally demo billing. It changes the plan in local browser storage and never asks for a card.

For production, use a payment provider's hosted checkout or secure payment components plus backend webhooks. The backend — not the browser — must be the source of truth for the user's paid plan.

## 7. Production hosting

The repository contains no GitHub Actions workflows.

A static host is enough for this demo. For the actual paid SaaS, deploy the frontend to a normal app/static host and deploy the private OAuth/publishing/payment backend separately.

## Compatibility logic in the demo

SocialTotal reads the actual selected file in the browser:
- MIME family (image/video)
- pixel width and height
- aspect ratio
- video duration
- file size

Current product routing requested for this demo:
- image → TikTok, Instagram, Facebook
- short vertical/square video → appropriate short-form destinations plus YouTube/TikTok
- vertical video around 60 seconds → all four
- longer landscape video → YouTube + TikTok

Provider limits evolve. Production should combine this local detector with live creator/account capability checks returned by each provider API.
