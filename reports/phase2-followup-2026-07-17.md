# Phase 2 follow-up evidence — SHR-202 / SHR-203

SHR-202: NOT verified — automated webkit/chromium capture was attempted once, but all six runs timed out before Share enabled and produced no screenshots.
SHR-203: NOT verified — tooling and runbook ready, requires a human running the two-network manual test; still pending.

## Scope and exact run commands

The capture script targets the deployed site only and consumes up to six real transforms. It must be run once, without retries:

```text
PHOTO_FILTERS_BASE_URL=https://gicphotofilters.pages.dev npm run verify:collage
```

The referral KV baseline dump:

```text
node scripts/dump-referral-kv.mjs
```

## SHR-203 manual two-network runbook

Use this exact referral URL:

```text
https://gicphotofilters.pages.dev/try.html?id=grinch-ify--holiday_seasonal&ref=shr203-followup-20260717&src=shr203-followup
```

1. On device A, open the URL on one network, such as a laptop on Wi-Fi. Complete a real transform and use Share so the referral owner is registered.
2. On device B, open the same URL on a genuinely different egress network, such as an iPhone with Wi-Fi disabled on cellular data. Do not use spoofed headers or a VPN profile that exits through the same IP.
3. Repeat with a third and fourth genuinely different network if testing the threshold of 3 unique referral visitors. The owner should receive the +5 bonus only at the threshold.
4. After the visits, run:

```text
node scripts/dump-referral-kv.mjs
```

5. Paste the unedited JSON lines for the `usage:v1:referral:code:*` record and the `usage:v1:referral:visit:*` records below. This session cannot perform the two-network portion and therefore does not mark SHR-203 passed.

## Raw output — local regression checks

```text
> node --check scripts/verify-collage-devices.mjs
> node --check scripts/dump-referral-kv.mjs
> npm run check:backend
> node --check docs/assets/site.mjs
> git diff --check
PASS — no output from syntax or diff checks.
```

## Raw output — SHR-202

```text
> PHOTO_FILTERS_BASE_URL=https://gicphotofilters.pages.dev npm run verify:collage
> verify:collage
> node scripts/verify-collage-devices.mjs
{"engine":"webkit","orientation":"portrait","error":"locator.waitFor: Timeout 60000ms exceeded. Call log: waiting for locator('#share-result-button:not([disabled])') to be visible"}
{"engine":"webkit","orientation":"landscape","error":"locator.waitFor: Timeout 60000ms exceeded. Call log: waiting for locator('#share-result-button:not([disabled])') to be visible"}
{"engine":"webkit","orientation":"square","error":"locator.waitFor: Timeout 60000ms exceeded. Call log: waiting for locator('#share-result-button:not([disabled])') to be visible"}
{"engine":"chromium","orientation":"portrait","error":"locator.waitFor: Timeout 60000ms exceeded. Call log: waiting for locator('#share-result-button:not([disabled])') to be visible"}
{"engine":"chromium","orientation":"landscape","error":"locator.waitFor: Timeout 60000ms exceeded. Call log: waiting for locator('#share-result-button:not([disabled])') to be visible"}
{"engine":"chromium","orientation":"square","error":"locator.waitFor: Timeout 60000ms exceeded. Call log: waiting for locator('#share-result-button:not([disabled])') to be visible"}
exit code: 1
```

Screenshot directory output after the one permitted run:

```text
(empty — no screenshot was produced)
```

Post-run raw production state:

```json
{"path":"/api/usage","status":200,"body":{"ok":true,"data":{"used":0,"limit":6,"remaining":6,"neuronsUsed":0,"neuronsLimit":10000,"siteTransformsUsed":0}}}
{"path":"/api/health?view=site","status":200,"body":{"ok":true,"data":{"status":"ok","bindings":{"AI":true,"USAGE_KV":true},"storage":{"mode":"direct","shareableResults":false},"limits":{"maxFreeTransformsPerIp":5,"maxFreeNeuronsPerDay":10000},"issues":[]}}}
```

The zero transform usage confirms this one run did not consume FLUX budget; the failure occurred before a successful transform result enabled Share. The script was patched afterward to wait for the upload's `Ready to transform` state before clicking Transform. Per the constraint, the suite was not rerun.

Expected evidence files:

```text
reports/collage-screenshots/webkit-portrait.png
reports/collage-screenshots/webkit-landscape.png
reports/collage-screenshots/webkit-square.png
reports/collage-screenshots/chromium-portrait.png
reports/collage-screenshots/chromium-landscape.png
reports/collage-screenshots/chromium-square.png
```

## Raw output — SHR-203 baseline KV dump

```text
Using "CF_ACCOUNT_ID" environment variable. This is deprecated. Please use "CLOUDFLARE_ACCOUNT_ID", instead.
Using "CF_ACCOUNT_ID" environment variable. This is deprecated. Please use "CLOUDFLARE_ACCOUNT_ID", instead.
{"key":"usage:v1:referral:code:2026-07-18:shr205-20260717","value":"{\"code\":\"shr205-20260717\",\"dateKey\":\"2026-07-18\",\"uniqueVisits\":1,\"sources\":{\"phase2-production\":1},\"trendId\":\"\",\"updatedAt\":\"2026-07-18T03:00:15.274Z\"}"}
Using "CF_ACCOUNT_ID" environment variable. This is deprecated. Please use "CLOUDFLARE_ACCOUNT_ID", instead.
{"key":"usage:v1:referral:visit:2026-07-18:69.67.148.37","value":"{\"code\":\"shr205-20260717\",\"trendId\":\"\",\"source\":\"phase2-production\",\"dateKey\":\"2026-07-18\",\"updatedAt\":\"2026-07-18T03:00:15.274Z\"}"}
```

## Raw output — SHR-203 post-test KV dump

```text
PENDING — requires a human two-network run; no post-test output is claimed here.
```
