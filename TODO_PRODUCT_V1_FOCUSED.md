# TODO — Product V1 Focused (executable, scope-cut)

- Date: 2026-07-17
- Source of vision: `PRD_FOCUSED_PHOTO_JOURNEY.md`
- This plan **replaces the sequencing** in `PRDViral.md`, `PRD.md`, `PRD202603121254.md`, `PRD202603121557.md` and the stale `.claude/` planning docs (which reference the dead `/assets/*.js` files). Those stay as reference; execute from here.

## 0. The one promise

> Pick a trend, upload your photo, get your **real** transformed image and share it — in 60 seconds, no account, no API keys.

## 1. Why this order

The viral PRD built sharing mechanics on top of a free tier that returns fake images. Reversed here: **make the free transform real first** — a share collage of a fake result is negative marketing. The loop (real transform → share → referral) is the product; the shell simplification is polish around it. This mirrors the forms reversal ("the publish → link → response loop is the product").

## 2. Verified repo facts (2026-07-17)

Frontend
- All pages load one bundle: `docs/assets/site.mjs` (3,576 lines, router keyed off `body[data-page]`). Plus `docs/assets/byok.mjs`, `docs/assets/settings-surface.mjs`.
- The entire `/assets/` directory (`try.js`, `browse.js`, `catalog.js`, `effects.js`, `home.js`, `category.js`, `theme.js`, `site.css`) is referenced by **no HTML page** — dead first implementation.
- Fake fallback: on 403 `filter_requires_demo_or_byok` / `custom_filter_requires_byok`, `runTransform` calls `generatePreviewVariants` and renders a synthetic canvas "preview" in the result stage.
- Share machinery already exists: `buildTryShareUrl`, `buildReferralCode`, `buildViralShareCopy`, `createShareCollage` (~line 1337), `#share-overlay` in `try.html`.

Backend (Pages Functions, same origin)
- `functions/api/transform.js` — gating lives here (`DEMO_MODE`, BYOK header check).
- `functions/_lib/cloudflare.js` — BYOK proxy to `api.cloudflare.com .../ai/run/{model}`; `fetchCloudflareUsage` returns null neuron counts (fictional dashboard).
- `functions/api/usage.js` — referral tracking works: `?ref=`/`?trend=`/`?src=`, per-IP/day dedupe in `USAGE_KV`, threshold 3 → bonus 5, cap 5/day.
- `wrangler.toml` — `DEMO_MODE="true"`, `STORAGE_MODE="direct"`, `MAX_FREE_TRANSFORMS_PER_IP="10"`, `MAX_FREE_NEURONS_PER_DAY="10000"`; `[ai]` binding live; KV wired; R2 commented out.

Catalog
- `docs/filters-index.json`: 205 filters, 11 live categories; 174 on `@cf/black-forest-labs/flux-2-klein-9b`; 19 `clientSideOnly`; 32 `isDemoFilter`.
- Previews: 254 `.webp` in `docs/assets/filter-previews/`, but only **123/205 filters** have `previewImages`; rest get SVG placeholders. Generator: `scripts/generate-previews.js` (budget-limited, state in `.preview-state.json`); review tools in `scripts/` + queue `modelsAI/review/work_items.json`.

## 3. Scope cuts (decided — do not re-litigate during implementation)

1. **No R2 / async pipeline.** Direct mode holds at current traffic. `upload.js`, `status/`, `image/` stay dormant; R2 stays commented out in `wrangler.toml`.
2. **No auth, no payments.** Free (capped) + referral bonus + BYOK is the entire model. No Stripe, no accounts.
3. **No analytics platform.** KV counters per event name (extend `functions/_lib/usage.js`); GA4 stays as-is.
4. **No builder work.** `build.html` is demoted to Advanced, otherwise untouched.
5. **Demoted, not deleted.** BYOK, builder, health detail move under one Advanced surface; their code is kept working.
6. **Lower the free cap when transforms become real.** 10 fake/day → 3–5 real/day. Referral bonus is the expansion path.

## 4. Phase 1 — Honest free transforms (~2–3 days)

The core fix. Ships alone.

- [ ] **HON-101** — `functions/api/transform.js`: remove `DEMO_MODE` gating for catalog filters. Any catalog filter runs on bound `env.AI` for free users within budget. Custom filters (`customFilter` JSON) still require BYOK.
- [ ] **HON-102** — `wrangler.toml`: retire `DEMO_MODE`; set `MAX_FREE_TRANSFORMS_PER_IP="5"` (tune later); keep `MAX_FREE_NEURONS_PER_DAY` as circuit breaker. Confirm caps actually enforce in `functions/_lib/usage.js` before flipping.
- [ ] **HON-103** — `site.mjs`: **delete** the fake-preview fallback in `runTransform` (`generatePreviewVariants` call path and the "Website shell preview mode" branch). A failed transform shows a designed error state, never synthetic art.
- [ ] **HON-104** — Designed out-of-budget states: per-IP cap hit ("You've used today's 5 free transforms — share to earn 5 more, resets at midnight UTC") and site budget hit ("Today's free budget is spent — come back tomorrow or use your own key"). Both link share-to-earn primary, Advanced/BYOK secondary.
- [ ] **HON-105** — Honest meter: show real KV-derived counts ("2 of 5 free transforms left today"). Remove the fictional neuron dashboard from the default surface (raw `fetchCloudflareUsage` detail can remain in Advanced for BYOK users where it is real).
- [ ] **HON-106** — Load/canary check: with real FLUX per transform, estimate neurons/transform from a manual run; verify `MAX_FREE_NEURONS_PER_DAY` covers the expected day at 5/IP; document the math in a comment in `wrangler.toml`.

Gate: on production, a fresh IP gets a real FLUX image on a non-demo filter with no BYOK; the 6th attempt gets the designed cap state; nothing anywhere renders a fake.

## 5. Phase 2 — Share-first result stage (~2–3 days)

- [ ] **SHR-201** — Result stage hierarchy in `try.html` + `site.mjs`: Share = primary button, Download = secondary, "Try another trend" = tertiary. Share opens the existing `#share-overlay` with collage preselected.
- [ ] **SHR-202** — Verify collage rendering (`createShareCollage`) on mobile Safari and Chrome with real transform output (portrait, landscape, square inputs).
- [ ] **SHR-203** — Referral end-to-end test: share from device A, open on device B (different IP), confirm `usage:v1:referral:*` increments in `USAGE_KV` and bonus grants at threshold. Fix anything broken; script the check if possible.
- [ ] **SHR-204** — Post-share nudge: after a completed share, show remaining-transforms state with earn-more framing.
- [ ] **SHR-205** — Loop analytics: KV counters for `transform_real_success`, `share_opened`, `share_completed`, `referral_landed`, `referral_bonus_granted` (extend `functions/_lib/usage.js`; a simple admin-ish `?view=counters` on `/api/usage` is enough to read them).

Gate: PRD §8 golden journey passes end-to-end on mobile Safari.

## 6. Phase 3 — Focused shell (~1 week)

- [ ] **SHL-301** — Home = trend launcher: merge `trends.html` content into `index.html`; ranked trend cards (active `viralTags` by priority + seasonal highlights), one primary CTA each. `trends.html` becomes a redirect to `/#trends` (keep the URL alive — it may be shared/indexed).
- [ ] **SHL-302** — `browse.html` is the single full-catalog page; home links to it once ("All 200+ filters").
- [ ] **SHL-303** — Advanced surface: one entry point (footer/nav "Advanced") housing BYOK setup, builder link, health/usage detail. Remove Build and BYOK from primary nav and from the home hero.
- [ ] **SHL-304** — Home hero: one primary CTA (top trend), not three parallel choices.
- [ ] **SHL-305** — Delete the dead `/assets/` tree (`try.js`, `browse.js`, `catalog.js`, `effects.js`, `home.js`, `category.js`, `theme.js`, `site.css`). Grep first to confirm zero references; git preserves history.
- [ ] **SHL-306** — Preview coverage for the golden path: every active-trend and top-20-popular filter has real `previewImages` (run `scripts/generate-previews.js` + review pipeline). Target 100% of golden-path filters; whole-catalog coverage (123→205) continues in the background.
- [ ] **SHL-307** — Category pages: ensure all 15 link into `try.html` flows, not the builder; card CTA copy = "Try this filter".
- [ ] **SHL-308** — Doc hygiene: add a superseded-by banner at the top of the four old PRDs pointing here; delete or archive stale `.claude/` planning docs that reference `/assets/*.js`; remove committed `.DS_Store` files and gitignore them.

Gate: PRD §7 choice budgets hold on home, try, result; no page links to a dead file.

## 7. Phase 4 — Trust & polish (~2–3 days)

- [ ] **POL-401** — Mobile camera flow QA on iOS Safari and Android Chrome (capture → resize → transform → share).
- [ ] **POL-402** — Error-state pass: model timeout, oversized upload, unsupported format, offline — each a designed state with a next step.
- [ ] **POL-403** — Performance: Lighthouse mobile ≥ 85 on home and try (defer non-critical JS, lazy-load previews, check `_headers` caching for `filter-previews/`).
- [ ] **POL-404** — Copy pass per PRD §7 (verbs, no jargon, honest numbers).

## 8. Deferred (V1.1+; do not build now)

- R2 async pipeline + result permalinks (needed only for server-hosted share images).
- Payments / Pro tier.
- Builder improvements; community/published custom filters.
- The 4 empty "planned" categories.
- Push/email trend notifications (web); native notifications land with the iOS app.
- CLI skill (see §10).

## 9. Golden journey (release gate — trimmed)

Mobile Safari, fresh user, shared link with `?id=<active-trend>&ref=<code>`:
1. Link opens try with filter preselected and real preview pair visible.
2. Camera selfie → Transform → real FLUX image < 30s.
3. Share → collage renders → native share sheet.
4. Referral registers in KV; sharer's bonus grants at threshold.
5. Sixth transform attempt that day → designed cap state, share-to-earn primary.

## 10. Ecosystem note — skills / agent deploys (context, not tasks)

The CLI-skill strategy (agent generates app → bridge deploys → URL back) belongs to **oneTimeApps and forms**, where the deliverable is a deployable artifact. The bridge with `/deploy`, AI create, and `X-GIC-API-Key` lives in `formsPrivate/cloudflare-bridge-worker.js` — not in oneTimeUseWebApp, and not here. Photo filters' equivalent of a skill is the **share link**: the artifact users hand each other is the collage URL. Do not build a skill for this product in V1; revisit only if API consumers appear.

## 11. Working agreement (for AI-assisted implementation)

- Execute phases in order; each phase's gate passes before the next starts.
- Ticket IDs (HON/SHR/SHL/POL) in commit messages.
- Never re-open the scope cuts in §3 mid-implementation; propose changes as edits to this file first.
- Verify on the deployed Pages site, not only locally — the AI binding and KV behave differently in production.
