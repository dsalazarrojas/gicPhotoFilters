# PRD — Focused Photo Journey

- Version: 1.0
- Date: 2026-07-17
- Status: Proposed for implementation
- Supersedes (as product direction): `PRDViral.md`, `PRD.md`, `PRD202603121254.md`, `PRD202603121557.md` (kept as reference; do not delete)
- Companion execution plan: `TODO_PRODUCT_V1_FOCUSED.md`
- iOS companion plan: `../gicPhotoFiltersApp/gicPhotoFilters/TODO_IOS_V1_FOCUSED.md`

## 1. Decision Summary

One promise, everything else supports it:

> **Pick a trend, upload your photo, get your real transformed image and share it — in 60 seconds, no account, no API keys.**

The product is two connected layers:

- **Viral acquisition layer** — trend cards, before/after share collages carrying referral links, and SEO category pages. Every shared result is an ad for the site.
- **Conversion layer** — the `try.html` loop: photo in → real AI image out → share. This loop is the product.

The 205-filter catalog, the custom filter builder, BYOK, and the R2 pipeline are strategic assets. They must not dominate the UI or dilute the promise.

**Decisions locked in (do not re-litigate during implementation):**

1. **Free tier serves real AI transforms.** Demo-placeholder behavior is removed. Free users get real Workers AI (FLUX) output via the bound `env.AI`, with tight caps. The fake canvas "preview mode" fallback is deleted — a fake result silently breaks the promise and poisons every share.
2. **Share is the primary action on a result.** Download is secondary. The collage + referral link is the growth engine, not a nice-to-have.
3. **BYOK is the power path, not the default path.** It is repositioned as "unlimited, your own Cloudflare account" under an Advanced surface.
4. **iOS V1 ships without the Build tab** (Gallery + Transform + Share only). See the iOS plan.

## 2. Product Problem

The foundation is strong — 205 filters across 11 live categories, working Workers AI FLUX transforms, BYOK proxy, referral tracking, share collages — but the experience is disjointed:

1. **The core promise is broken.** With `DEMO_MODE=true` (`wrangler.toml`), `functions/api/transform.js` blocks non-demo filters for free users; the frontend then silently substitutes a synthetic canvas "preview" (`generatePreviewVariants` in `docs/assets/site.mjs`). The button says "Transform — FREE ✨" but most free users never receive a real AI image. Users notice. Nobody shares a fake.
2. **Three competing front doors.** `index.html`, `trends.html`, and `browse.html` all present filter grids at roughly equal importance, and the home hero offers three parallel CTAs (Join a trend / Try your own / Build a template) with no primary path.
3. **Power features presented as co-equal.** The custom builder (`build.html`) and BYOK setup sit next to the consumer loop, adding decisions the 60-second user should never see.
4. **Trust leaks.** The "Session usage / neurons" dashboard shows fictional numbers (`fetchCloudflareUsage` in `functions/_lib/cloudflare.js` returns null neuron counts). 82 of 205 filters lack real preview images and fall back to SVG placeholders. The dead `/assets/` JS tree confuses maintenance.
5. **Four overlapping PRDs** pull implementation in different directions.

## 3. Product Objective

### 3.1 North-star outcome

A first-time visitor lands on a trend, uploads a photo, receives a **real** AI-transformed image, and shares the before/after collage with their referral link — inside 60 seconds, on a phone.

### 3.2 Primary metrics

- **Time to first real transform** (landing → real AI image rendered): target under 60s median on mobile.
- **Real-transform rate**: % of transform attempts that return real AI output (not an error, never a fake). Target: 100% of golden-path attempts within budget.
- **Share rate**: % of results where the user triggers Share. This is the growth metric.
- **Referral loop closure**: % of shared links that produce a new visitor who transforms.

### 3.3 Quality constraints

- No result surface may ever display a synthetic placeholder as if it were the user's transform.
- Free-tier caps are shown honestly before and after they bind ("2 of 3 free transforms left today · share to earn more").
- The photo never leaves the transform pipeline; no server-side storage in direct mode. State this plainly.

## 4. Target Users and Jobs

### 4.1 Primary user

Someone who saw a trend (a movie moment, a holiday challenge, a meme wave) and wants to be in it. On their phone, in a social context, zero patience for setup. They will do exactly one thing: try it on their own photo. If it delights, they share.

### 4.2 Primary jobs

1. Turn my photo into the trend image everyone is posting.
2. Share it where my people are, fast.
3. Do it again for the next trend (return visit — seasonal calendar and notifications serve this).

### 4.3 Advanced user

Wants unlimited transforms or their own custom filters. Serves themselves via BYOK (their Cloudflare account, their neurons) and the builder — discoverable under Advanced, never blocking the primary journey.

## 5. Product Architecture

### 5.1 Viral acquisition layer (public, indexable, shareable)

- **Trend launcher (home)**: active `viralTags` from `catalog-config.json` as ranked trend cards, seasonal highlights surfaced by `seasonalMonthsBySlug`. One primary CTA per card: "Try this trend".
- **Share artifacts**: before/after collage (`createShareCollage`) + per-filter `shareText` + referral-coded URL (`buildTryShareUrl`, `buildReferralCode`). Every share lands the recipient directly in `try.html?id=<filter>&ref=<code>` — one tap from transforming their own photo.
- **SEO category pages** (`/categories/*.html`): 15 landing pages remain the long-tail acquisition channel; they link into the loop, never into the builder.

### 5.2 Conversion layer (the loop)

- `try.html` + `site.mjs` `runTransform` → `POST /api/transform` → bound `env.AI` (free) or BYOK proxy (`functions/_lib/cloudflare.js`).
- Free-tier governor: per-IP daily transform cap + `MAX_FREE_NEURONS_PER_DAY` site circuit breaker (KV, `functions/_lib/usage.js`), extended only by referral bonuses (`functions/api/usage.js`: threshold 3, bonus 5, cap 5/day).
- Result stage: Share primary, Download secondary, "Try another trend" tertiary.

## 6. Focused User Journey

### 6.1 Home (trend launcher)

One screen, one question: *which trend?* Ranked trend cards with real before/after previews. Single primary CTA each. Catalog and Build live in secondary navigation. `trends.html` merges into home; `browse.html` becomes the single full-catalog page.

### 6.2 Try (the loop)

Arriving with `?id=` preselects the filter and shows its real preview pair. Upload via camera, photo picker, drag, or paste (all exist today). Client resizes to 1024px (exists). One button: **Transform**. Progress is honest (model actually running). 

### 6.3 Result

The transformed image fills the stage. Primary: **Share** — opens the share overlay with collage + trend copy + referral link (native share sheet on mobile). Secondary: Download. Below: remaining free transforms, phrased as an invitation ("Share to earn 5 more").

### 6.4 Out of budget

When caps bind, the user sees a clear, honest state: what happened, when it resets, the two ways forward (share-to-earn, or BYOK under Advanced). Never a fake image. Never a silent failure.

### 6.5 Advanced surface

BYOK setup (`docs/cloudflare-setup.html`, `byok.mjs`), the custom builder (`build.html`), and health/usage detail live behind one "Advanced" entry. Their quality bar is unchanged; their visibility is demoted.

## 7. Design Constitution

Visible-choice budgets (count every tappable decision on the screen):

- Home: 1 primary action per trend card; ≤2 global nav items beyond cards.
- Try: 1 primary action (Transform); filter switcher is secondary.
- Result: 1 primary action (Share); ≤2 secondary.
- No surface shows YAML-equivalents (model IDs, neuron math, account IDs) outside Advanced.
- Copy: verbs a 12-year-old understands. "Try this trend", not "Execute transform pipeline".

## 8. Golden Journey (release gate)

**Scenario**: A person on mobile Safari receives a shared collage link for an active trend filter (e.g. a top-priority `viralTags` entry). They tap it, land on `try.html` with the filter preselected, take a selfie with the camera flow, tap Transform, receive a **real FLUX output**, tap Share, and post the collage. Their referral attribution registers (`/api/usage` `?ref=` flow), and after 3 referred visitors they receive 5 bonus transforms.

**Outcome contract**:
- Real AI image in under 30s from Transform tap.
- Zero fake previews reachable anywhere on this path.
- Share collage renders correctly on mobile Safari and Chrome.
- Referral counter verifiably increments in `USAGE_KV`.

This journey passing end-to-end on mobile Safari + Chrome is the ship gate for every release.

## 9. Analytics Events

Minimal, KV-counter-based (no analytics platform): `trend_card_tap`, `photo_selected`, `transform_requested`, `transform_real_success`, `transform_budget_blocked`, `share_opened`, `share_completed`, `referral_landed`, `referral_bonus_granted`, `byok_configured`. GA4 (already installed) may mirror these; KV counters are the source of truth for the loop metrics.

## 10. Free-Tier Economics

- `DEMO_MODE` retired as a concept; replaced by explicit budget config.
- Per-IP: 3–5 real transforms/day (tune `MAX_FREE_TRANSFORMS_PER_IP` down from 10 since transforms are now all real).
- Site-wide: `MAX_FREE_NEURONS_PER_DAY` as the hard circuit breaker; when exhausted, the out-of-budget state appears site-wide with reset time.
- Referral bonuses are the only free expansion (existing thresholds stand).
- `clientSideOnly` filters (19) remain free and unlimited — they cost nothing and keep the site alive even when the AI budget is spent.
- BYOK: unlimited, user's own account, zero cost to GIC.

This mirrors the oneTimeApps model: a bounded, honest free wow; unlimited on the user's own infrastructure.

## 11. Explicit Non-goals (V1)

1. **No R2 / async job pipeline.** Direct mode is sufficient at current scale; `upload.js`, `status/[jobId].js`, `image/[key].js` stay dormant.
2. **No payments/Stripe, no accounts/auth.** Free + referral + BYOK is the whole model for V1.
3. **No builder investment.** `build.html` keeps working as-is under Advanced; no new features.
4. **No new filter categories.** The 4 "planned" empty categories stay hidden until populated.
5. **No CLI skill for this product.** The skill/agent-deploy strategy (see the ecosystem note in `TODO_PRODUCT_V1_FOCUSED.md` §10) applies to oneTimeApps/forms, where the deliverable is a URL an agent can hand off. Photo filters is a consumer camera-roll product; its "skill" is the share link itself. Revisit only if an API-consumer use case appears organically.
6. **No video generation.** Teaching/demo videos about the product are a separate workstream, not a product feature here.

## 12. Release Gates

- Golden journey (§8) passes on mobile Safari and Chrome.
- Zero code paths can render a synthetic image in a result stage (the `generatePreviewVariants` fallback is deleted, not just disabled).
- All golden-path filters (active trends + top popular) have real before/after preview images.
- Out-of-budget and error states are designed screens, not raw errors.
- Lighthouse mobile performance on home and try ≥ 85.

## 13. Recommended Rollout

- **Release A — Honest loop**: real free transforms, fake-preview deletion, honest budget states. (Phases 1–2 of the TODO.)
- **Release B — Share-first**: result-stage redesign, referral verification end-to-end.
- **Release C — Focused shell**: one home, one catalog, Advanced surface, dead-code deletion, preview coverage.
- **Release D — Return loop**: seasonal calendar surfacing, iOS app launch cross-promotion.
