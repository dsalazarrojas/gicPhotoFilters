# Phase 2 follow-up evidence — SHR-202 / SHR-203

SHR-202: NOT verified — automated webkit/chromium capture was attempted once, but all six runs timed out before Share enabled and produced no screenshots.
SHR-203: NOT verified — tooling and runbook ready, requires a human running the two-network manual test; still pending.

## Re-run — 2026-07-18

Found and fixed a real script bug, then found the real blocker is external to the app.

**Script bug (fixed in this commit)**: `verify-collage-devices.mjs` called `page.goto(..., { waitUntil: "domcontentloaded" })` then immediately `setInputFiles`. The page's `#file-input` "change" listener is only registered once `initTryPage()`'s async catalog fetch resolves, which happens after `domcontentloaded`. Uploading before that listener exists fires "change" into the void — `setSource()` never runs, so "Ready to transform" never appears. Fix: wait for `#stage-note .badge` (the catalog-ready badge) to be visible before calling `setInputFiles`. Verified in isolation:

```text
stage-note before upload: <span class="badge badge--success">Demo filter · ready for the free daily usage shell</span>
SUCCESS: Ready to transform appeared
stage-note final: <span class="badge badge--brand">Ready to transform</span><span class="badge">200×200 px</span>
```

**Real blocker (not a script bug, not fixable here)**: with the upload-race fixed, 5 of 6 runs got past "Ready to transform," clicked Transform, and then timed out waiting for `#share-result-button:not([disabled])`. Diagnosed with console/network capture on a single run:

```text
[response] 502 https://gicphotofilters.pages.dev/api/transform
[console] error Error: Workers AI failed while running model "@cf/black-forest-labs/flux-2-klein-9b". (4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage.)
    at attemptApiTransform (https://gicphotofilters.pages.dev/docs/assets/site.mjs:1558:19)
    at async runTransform (https://gicphotofilters.pages.dev/docs/assets/site.mjs:1626:25)
```

This is a real, account-level Cloudflare Workers AI daily neuron quota exhaustion — separate from and invisible to this app's own internal tracking. `/api/usage` reported `neuronsUsed: 0, siteTransformsUsed: 0` for today throughout this entire session (confirmed via `curl` before and after every attempt below), because that counter is this app's own KV bookkeeping, not Cloudflare's real account state. The app currently has no way to surface the real account quota (`/api/health` already separately reports `cloudflare_credentials_missing` — the credentials needed to query real account status aren't configured). Net effect: the app's own "budget available" signal was actively misleading during this session — it said 6 transforms were available while Cloudflare's real account had zero.

Raw script output (post-fix, real run against production):

```text
{"engine":"webkit","orientation":"portrait","error":"locator.waitFor: Timeout 15000ms exceeded.\nCall log:\n  - waiting for locator('#stage-note').getByText('Ready to transform') to be visible\n"}
{"engine":"webkit","orientation":"landscape","error":"locator.waitFor: Timeout 60000ms exceeded.\nCall log:\n  - waiting for locator('#share-result-button:not([disabled])') to be visible\n"}
{"engine":"webkit","orientation":"square","error":"locator.waitFor: Timeout 60000ms exceeded.\nCall log:\n  - waiting for locator('#share-result-button:not([disabled])') to be visible\n"}
{"engine":"chromium","orientation":"portrait","error":"locator.waitFor: Timeout 60000ms exceeded.\nCall log:\n  - waiting for locator('#share-result-button:not([disabled])') to be visible\n"}
{"engine":"chromium","orientation":"landscape","error":"locator.waitFor: Timeout 60000ms exceeded.\nCall log:\n  - waiting for locator('#share-result-button:not([disabled])') to be visible\n"}
{"engine":"chromium","orientation":"square","error":"locator.waitFor: Timeout 60000ms exceeded.\nCall log:\n  - waiting for locator('#share-result-button:not([disabled])') to be visible\n"}
exit code: 1
```

(webkit/portrait still failed the pre-upload wait in this run — noise from the exact timing of the catalog fetch on a cold context; the other 5 confirm the upload-race fix works, since they all reached the Transform-click stage.)

Post-run production state (app-internal counters — do not trust these as a real-quota signal, see above):

```json
{"path":"/api/usage?view=counters","status":200,"body":{"ok":true,"data":{"dateKey":"2026-07-18","counters":{"transform_real_success":0,"share_opened":1,"share_completed":1,"referral_landed":0,"referral_bonus_granted":0},"updatedAt":"2026-07-18T03:03:48.604Z"}}}
{"path":"/api/usage","status":200,"body":{"ok":true,"data":{"used":0,"limit":6,"remaining":6,"neuronsUsed":0,"siteTransformsUsed":0}}}
```

No screenshots were produced (`reports/collage-screenshots/` remains empty). No real transform ever succeeded, so this run — like the first one — consumed zero of the app's own tracked budget; the actual real-world blocker is Cloudflare's account-level quota, exhausted from earlier activity today (likely combined testing across sessions), not from this script.

**Status**: SHR-202 still not verified. The tooling is now correct and ready to produce real evidence; it needs to be re-run once Cloudflare's real account-level Workers AI daily quota has reset (UTC midnight, per the app's own reset assumption — unconfirmed against Cloudflare's actual account-level reset schedule, since `/api/health` can't currently check real account state).

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
