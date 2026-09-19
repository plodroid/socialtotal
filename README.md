# DropImage

DropImage is a static, privacy-first image workspace that runs in the browser.

## What it does

- Drag/drop multiple images.
- Read real dimensions, file size and format locally.
- Resize with max width / height while preserving aspect ratio.
- Convert to WebP, JPEG or PNG.
- Adjust export quality.
- Add padding, background and rounded corners.
- Rotate and flip images.
- Strip common embedded image metadata by redrawing processed output to Canvas.
- Detect exact duplicate files with SHA-256 when Web Crypto is available.
- Batch rename with tokens.
- Group ZIP exports by orientation, output format or resolution.
- Sort and export a clean ZIP.
- Monetisation-ready ad inventory: top leaderboard, desktop side rails, two in-content slots and a footer billboard.

There is no login, database, OAuth, upload server, or GitHub Actions workflow.

## Privacy model

Image files are processed in the browser. The app creates temporary local object URLs for previews and does not intentionally upload image contents to DropImage servers.

The page loads JSZip from jsDelivr for ZIP generation. Configured advertising providers may make their own network requests under their policies.

## Ads

Put your approved AdSense publisher ID and ad-unit slot IDs in `config.js`. Empty values leave clearly-labelled demo ad placeholders.

Actual ad earnings require an approved ad account, valid ad units, policy-compliant traffic and advertiser demand. No frontend code can guarantee revenue.
