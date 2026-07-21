---
name: gic-ad-generator
description: Generate local, on-brand GIC ad creatives with a Workers AI background and ImageMagick text/logo overlay.
---

# GIC ad generator

Generate on-brand draft ad creatives for GIC properties. It creates an AI background and composites a headline, supporting text, CTA, and logo overlay. Supported target sizes include 728x90 banners and 300x600 full-screen/interstitial creatives.

## Prerequisites

- ImageMagick must be installed and available as `magick`; check with `magick -version`.
- To generate backgrounds locally, set `AD_ADMIN_TOKEN` or add `adAdminToken` to `~/.config/gic/credentials.json`, matching the secret deployed with `wrangler pages secret put AD_ADMIN_TOKEN`.
- The account owner must manually deploy `functions/api/generate-background.js` (via `wrangler pages deploy` or by pushing to the Cloudflare Pages build branch) and set the production `AD_ADMIN_TOKEN` secret. These scripts never deploy anything.

## Usage

Generate a banner:

```sh
node scripts/generate-ad.js --template ad-templates/gic-collect-app.json --width 728 --height 90 --out generated-ads/gic-collect-728x90.png
```

Generate an interstitial:

```sh
node scripts/generate-ad.js --template ad-templates/forms-gic-mx.json --width 300 --height 600 --out generated-ads/forms-300x600.png
```

For a custom prompt, run the two stages directly:

```sh
node scripts/generate-ad-background.js --prompt "Professional navy geometric field-data background, no text, no words, no letters, no typography" --width 728 --height 90 --out generated-ads/custom-bg.png
node scripts/composite-ad.js --background generated-ads/custom-bg.png --headline "Tu titular" --subtext "Texto de apoyo" --cta "Conocer más" --width 728 --height 90 --out generated-ads/custom-ad.png
```

## Boundaries

Output always goes to `generated-ads/`, which is gitignored and is draft/staging only. Never write to or modify `Odk-Collect-for-IOS/docs/images` or any `banner.html` / `bannerFS.html` file. Promoting a creative to production is a manual human step outside this skill's scope. This skill never touches `functions/`, `wrangler.toml`, or live Worker/Pages Functions code.

Each successful wrapper run appends a JSON Lines entry to `generated-ads/manifest.jsonl`, recording the template, dimensions, output file, image prompt, and timestamp.
