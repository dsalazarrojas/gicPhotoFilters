# GIC Photo Filters Skill

Transform a photo with an AI trend filter from the terminal: pick a catalog
filter, send a photo, get the transformed image back as a file. Follows the
shared GIC skill shape (`forms/docs/GIC_SKILL_SHAPE.md`).

## Prerequisites / Auth

**No GIC key needed** — the free tier is anonymous with an IP-based daily
allowance (check it with `usage`).

**Custom filters** (your own prompt) require your own Cloudflare credentials
(BYOK), sent only as HTTPS request headers and never stored server-side:
```bash
export CF_ACCOUNT_ID=...   # dashboard sidebar
export CF_API_TOKEN=...    # token with Workers AI access
```
Or store them once in `~/.config/gic/credentials.json` (chmod 600):
```json
{ "cloudflare": { "accountId": "...", "apiToken": "..." } }
```
This is the **same pair** used by GIC OnePageApps BYO deploys — one Cloudflare
onboarding covers both products. Setup guide:
https://photofilters.gic.mx/docs/cloudflare-setup.html

## Commands

### List the filter catalog
```bash
node $CLAUDE_PROJECT_PATH/cli/gic-photofilters.js listFilters
# → [{ "id": "grinch-ify--holiday_seasonal", "name": "Grinch-ify", "category": "holiday_seasonal", ... }]
# Add --full for the complete catalog entries.
```

### Transform with a catalog filter (free, anonymous)
```bash
node $CLAUDE_PROJECT_PATH/cli/gic-photofilters.js transform photo.jpg \
  --filter anime-portrait--artistic_styles --out result.png
# → { "ok": true, "savedTo": "result.png", ... }
```

### Transform with a custom prompt (requires BYOK)
```bash
node $CLAUDE_PROJECT_PATH/cli/gic-photofilters.js transformCustom photo.jpg \
  --prompt "1970s polaroid look, warm faded colors" \
  --strength 0.65 --guidance 7.5 --out result.png
```

### Check today's free allowance
```bash
node $CLAUDE_PROJECT_PATH/cli/gic-photofilters.js usage
# → { "used": 1, "limit": 5, "remaining": 4, ... }
```

## Workflow example — the golden run

User: *"Make me look like an anime character and save it here."*

```bash
node cli/gic-photofilters.js listFilters | grep -i anime          # find the id
node cli/gic-photofilters.js transform selfie.jpg --filter anime-portrait--artistic_styles --out anime-me.png
# Hand back: "Saved to anime-me.png. You have N free transforms left today —
#  the share page for this filter is https://photofilters.gic.mx/try.html?id=<filterId>"
```

## Errors

| Status | Meaning | What to do |
|---|---|---|
| 400 `filter_required` / `custom_filter_invalid` | Bad request shape | Fix the flag/JSON and retry |
| 403 `custom_filter_requires_byok` | Custom prompt without Cloudflare creds | Walk the user through BYOK setup (guide URL above) |
| 429 | Daily allowance exhausted | Be honest: the free tier is a shared, capped demo budget — it resets daily. BYOK custom filters use the user's own quota instead |
| 502 | AI provider failure or the site's daily neuron budget is exhausted | Report honestly; retry once later. Not a request error |

## How Claude Should Use This Skill

1. No auth check needed for catalog filters; for `transformCustom`, check `CF_ACCOUNT_ID`/`CF_API_TOKEN` (env, then creds file) and guide setup if missing.
2. Find the filter id with `listFilters` before transforming.
3. Run the CLI via Bash; results save to `--out` (default `transformed-<ts>.png`).
4. Always report the saved file path and the remaining free allowance.
5. On error, map through the table above; never present a failure as a success.

## Finding the CLI Path

The CLI is at `cli/gic-photofilters.js` relative to the gicPhotoFilters project root.
```bash
find . -name "gic-photofilters.js" -path "*/cli/*" 2>/dev/null | head -1
```
