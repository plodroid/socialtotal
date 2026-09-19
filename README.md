# SocialTotal

SocialTotal is a social publishing dashboard demo for spreading one upload across supported social platforms.

## Demo plans

- **Free — $0/mo:** YouTube + TikTok, supported ad placements.
- **Spread — $1/mo:** YouTube + TikTok + Instagram + Facebook, supported ad placements.
- **Total — $2/mo:** all supported platforms, no ads.

## What is real in this demo

- Browser media inspection for file type, dimensions, aspect ratio, duration, and size.
- Compatibility decisions based on the uploaded media.
- Google Identity Services integration hook for Google sign-in and YouTube OAuth.
- YouTube OAuth scopes for channel access and video uploads.
- A real browser-side YouTube resumable-upload path when a valid OAuth client ID/token is available.
- Platform connection, publishing, pricing, ads, history, and billing UX.

## What remains demo-only until provider credentials/backend are configured

TikTok, Instagram, Facebook, Discord sign-in, email authentication, payments, and durable account/token storage need a production backend. OAuth client secrets and long-lived platform tokens must never be committed to a public frontend repository.

TikTok Content Posting also requires an approved developer app; unaudited Direct Post clients are restricted by TikTok. Meta publishing similarly needs production app configuration and server-accessible media for common publishing flows.

## Local configuration

Copy values into `config.js`. Public OAuth client IDs may be placed there, but **never put client secrets in this repository**.

For Google:
1. Create a Google Cloud OAuth 2.0 Web Client.
2. Add your local / deployed origin under Authorized JavaScript origins.
3. Enable the YouTube Data API v3.
4. Put the public client ID in `config.js`.

## Deployment note

This repository deliberately contains no GitHub Actions workflows. It is a static demo and can be served from any static host.

For a commercial production SaaS, use a normal application host and a private backend. GitHub Pages is intended for static sites and GitHub documents restrictions around using Pages as commercial SaaS hosting.

## Source visibility

Frontend code delivered to browsers can always be inspected, even when the Git repository itself is private. Keep the valuable/secret parts of SocialTotal — OAuth client secrets, refresh tokens, billing webhooks, publishing queues, fraud limits, and provider credentials — on a private backend.
