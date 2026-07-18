# GIC Photo Filters — Website PRD Phase Exploration & Implementation Plan

## Executive Summary

The website repo has a **strong foundation** with working backend APIs, frontend rendering, and filter catalog infrastructure. However, several **P0/P1 features from the PRD are partially or completely unimplemented**. This document identifies:

1. **What exists** — Key files, components, and working implementations
2. **What's missing** — Unimplemented PRD phases  
3. **Decomposition strategy** — Concrete, sequenced implementation TODOs that minimize file conflicts
4. **Validation commands** — Tests already available in the repo

---

## PHASE ANALYSIS: P0 & P1 Features Affecting Website

### 🔴 P0: Fix 2 — Wrong Domain Throughout the Website

**Status:** ✅ PARTIALLY FIXED

#### Already Implemented
- ✅ `docs/assets/site.mjs` line 2: `baseUrl: 'https://photofilters.gic.mx'` — **CORRECT**
- ✅ `try.html`, `index.html`, `browse.html` all use correct domain in meta tags
- ✅ No old `gicphotofilters.gic.mx` references found in HTML files

#### Still Needed
- ⚠️ **Verify production deployment**: Ensure GA4 property `G-83V6L45H2P` is registered for `photofilters.gic.mx`
- ⚠️ **Submit sitemap** to Google Search Console (manual task, not code)

#### Key Files
- `/wrangler.toml` — deployment config
- `/docs/assets/site.mjs` — **defines SITE.baseUrl globally**
- `/docs/assets/site-config.json` — GA4 measurement ID

#### Validation Command
```bash
npm run check:backend  # Validates all functions/*.js syntax
```

---

### 🟠 P1: Phase B — Before/After Example Photos & Preview Pipeline

**Status:** ⚠️ NOT IMPLEMENTED

#### Current State
- ❌ No preview images directory: `/docs/assets/filter-previews/` **does not exist**
- ❌ No preview schema in `filters-index.json` — filters have `shareText` but **no `previewImages` field**
- ❌ Try page shows placeholder icons, not actual filter results
- ❌ No batch generation script for previews

#### Key Existing Components That Support Previews
```javascript
// docs/assets/site.mjs — ALREADY HAS PREVIEW RENDERING READY
function generatePreviewData(filter, phase = 'before') {
  // Lines 415-458: Generates placeholder URLs
  // Will use previewImages once available
  return `...filter-previews/${filter.slug}_${phase}_a.webp`
}

function renderFilterCard(filter, options = {}) {
  // Lines 460-491: Renders filter cards
  // Missing: image src should come from previewImages[0].after
}
```

#### Implementation TODOs

**B.1 — Generate Base Photos** (NO CODE, external task)
- Create 3 synthetic base persons (Person A/B/C) using DALL-E 3 or FLUX
- Save to `/docs/assets/sample-photos/person_a.jpg|b|c` (1024×1024)
- Mark as fictional/synthetic in metadata

**B.2 — Create Batch Generation Script**
- Create `/scripts/generate_previews.js` (Node.js, ~150 lines)
  - Read `filters-index.json` → get all 205 filter IDs
  - For each filter × each person (615 total transforms):
    - Call `/api/transform` endpoint with filter params + person image
    - Save result to `/docs/assets/filter-previews/{slug}_after_{a|b|c}.webp`
    - Copy input resized to `/docs/assets/filter-previews/{slug}_before_{a|b|c}.webp`
  - Handle resumability (skip existing files)
  - Rate-limit: 1 sec delay between requests
  - Output progress log
  - Handle client-side effects (10 filters) using canvas package

**B.3 — Update Filter Schema**
- Modify `/docs/filters-index.json` structure
- Add to each filter entry:
  ```json
  "previewImages": [
    { "before": "assets/filter-previews/grinch-ify_before_a.webp", "after": "..._after_a.webp", "personLabel": "a" }
  ]
  ```
- Update index generator script to detect and populate this

**B.4 — Update Filter Cards in site.mjs**
- Modify `renderFilterCard()` (line 460):
  - `if (filter.previewImages?.length) { img.src = previewImages[0].after }`
  - Add hover/tap behavior: swap to `before` image
- Add lazy-loading: `loading="lazy"` + width/height attributes

**B.5 — Update Try Page (try.html / assets/try.js)**
- Show preview example in upload panel when no user photo yet
- Use `previewImages[0]` as before/after example
- Add person picker (A/B/C) to swap examples

**B.6 — Update Browse Page**
- Cards show `after` image thumbnail by default
- On hover/tap: swap to `before` to show transformation

#### Key Files to Create/Modify
```
Create:
  /scripts/generate_previews.js          (~150 lines, Node.js)
  /docs/assets/sample-photos/person_*.jpg (external)
  /docs/assets/filter-previews/*.webp   (generated)

Modify:
  /docs/filters-index.json               (schema + data)
  /docs/assets/site.mjs:renderFilterCard() (~30 lines)
  /assets/try.js                          (~20 lines)
  /browse.html / /assets/browse.js        (~20 lines)
```

---

### 🟠 P1: Phase C — R2 Optional / Direct Mode

**Status:** ✅ MOSTLY IMPLEMENTED

#### Already Implemented
- ✅ `functions/api/transform.js` (lines 78-100): Detects storage mode, returns direct image or R2 URL
- ✅ `functions/_lib/storage.js`: `putImageObject()` handles R2 storage with TTL
- ✅ `wrangler.toml` (line 22): `STORAGE_MODE = "direct"` as default
- ✅ `/api/health` endpoint returns `storage.mode` and `r2Available` flags
- ✅ Try page detects response type (image/png vs JSON) automatically (try.js line 63-68)

#### Partially Done
- ⚠️ `/docs/r2-setup.html` exists but **may need content review**

#### Still Needed (Low Priority)
- ⚠️ Direct mode banner: "Results are generated on-the-fly" — display when R2 unavailable
- ⚠️ Provision GIC's own R2 bucket in production account

#### Key Files
```
/functions/api/transform.js           (lines 78-100: mode detection)
/functions/_lib/storage.js            (PHOTO_BUCKET binding)
/wrangler.toml                        (STORAGE_MODE, R2_BUCKETS)
/functions/api/health.js              (storage status reporting)
```

---

### 🟠 P1: Phase D — BYOK (Bring Your Own Key) on Website

**Status:** ⚠️ PARTIALLY IMPLEMENTED

#### Already Implemented
- ✅ Backend API accepts `apiKey` parameter (request.js line 27)
- ✅ `transform.js` checks for apiKey in demo mode (line 23)
- ✅ Backend validation exists for restricting non-demo filters in demo mode

#### NOT Implemented
- ❌ **Try page UI** — No BYOK panel, no account ID / API token inputs
- ❌ **Direct Cloudflare API calls** — Currently only backend proxy supported
- ❌ **Session usage tracking** — `sessionStorage` for neurons used this session
- ❌ **Demo mode static examples** — Should show previewImages only, not GIC key
- ❌ `/docs/cloudflare-setup.html` — Guide for getting API token

#### Implementation TODOs

**D.1 — Add BYOK Panel to Try Page**
- File: `/try.html` + `/assets/try.js`
- Add collapsible section in upload panel:
  - Toggle: "Demo mode" vs "Live mode"
  - Live mode inputs:
    - Account ID (`sessionStorage: cfAccountId`)
    - API Token (`sessionStorage: cfApiToken`)
  - Helper text: "Your credentials are never sent to our servers"
  - Link to `docs/cloudflare-setup.html`
- Styling: ~50 lines HTML, ~30 lines CSS

**D.2 — Direct Browser → Cloudflare API**
- File: `/assets/try.js` `uploadAndTransform()` function (line 52)
- Add branch:
  ```javascript
  if (sessionStorage.cfApiToken && sessionStorage.cfAccountId) {
    // Call Cloudflare API directly, bypass /api/transform
    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${filter.model}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfApiToken}`, ... },
      body: JSON.stringify({ prompt: filter.prompt, image: imageBytes, ... })
    });
    return { kind: 'direct-cf', blob: await resp.blob() };
  }
  ```

**D.3 — Session Usage Tracking**
- Track in `sessionStorage.gicPF.neuronsUsed`
- Update after each transform
- Display in usage panel

**D.4 — Demo Mode Safeguard**
- When no API key entered: show previewImages examples only
- Text: "Enter your API key above for live transforms"
- CTA: "Get the App for unlimited transforms"

**D.5 — Create Cloudflare Setup Guide**
- File: `/docs/cloudflare-setup.html` (new)
- 5-step guide with screenshots/diagrams
- Link from BYOK panel

#### Key Files
```
Create:
  /docs/cloudflare-setup.html           (~200 lines, static HTML)

Modify:
  /try.html                             (+50 lines HTML)
  /assets/try.js                        (+80 lines, D.2 + D.3)
  /docs/assets/style.css                (+30 lines for BYOK panel)
```

#### Dependencies
- **Requires**: filters-index.json to include `model` field for each filter (✅ already present)
- **Blocks**: Phase E (sharing) if using BYOK results

---

### 🟠 P1: Phase E — Sharing (Site & App)

**Status:** ⚠️ PARTIALLY IMPLEMENTED

#### Already Implemented
- ✅ Try page has share button (try.js lines 166-175)
- ✅ `navigator.share()` native share sheet on mobile
- ✅ Fallback to clipboard copy: `shareText + URL`
- ✅ All filters have `shareText` field in catalog

#### NOT Implemented
- ❌ Share panel UI with multiple options (Twitter, WhatsApp, QR code, download)
- ❌ QR code generation for filter URLs
- ❌ Share the filter (not just result) — separate share button on browse page
- ❌ Download PNG button (try.html has it, but no UI polish)
- ❌ Share image result to social media (copy image, not just link)

#### Implementation TODOs

**E.1 — Share Result Panel**
- File: `/try.html` + `/assets/try.js` + `/docs/assets/style.css`
- Replace simple share button with modal/panel showing:
  - Copy link (existing clipboard fallback)
  - Download PNG (try.js line 158 already does this)
  - Twitter/X: `https://twitter.com/intent/tweet?text=${shareText}&url=${filterUrl}`
  - WhatsApp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + filterUrl)}`
  - QR code: Use `qrcode.js` library (~5KB minified)
  - Native share (if available)
  - (Optional) Share result URL if R2 enabled
- Logic: ~80 lines JS, ~40 lines CSS

**E.2 — Filter Share Button**
- Add share icon button to:
  - Browse page filter cards
  - Try page filter summary
- Shares: `https://photofilters.gic.mx/try.html?id={filterId}`
- Same share panel as E.1

**E.3 — QR Code Library**
- Add `qrcode.js` to `/docs/assets/` (copy from CDN or npm)
- Import in try.js, generate on share panel open

#### Key Files
```
Modify:
  /try.html                             (+30 lines HTML for share panel)
  /assets/try.js                        (+80 lines for E.1 + E.2)
  /docs/assets/style.css                (+40 lines for share panel styling)
  /browse.html / /assets/browse.js      (+20 lines for filter share button)
  
Add:
  /docs/assets/qrcode.min.js            (external, ~5KB)
```

---

### 🟡 P2: Phase G — Help Documentation

**Status:** ❌ NOT IMPLEMENTED

#### Current State
- ✅ Catalog has `helpPath` field pointing to `{category}/{slug}_help.md`
- ⚠️ **200+ help files DO NOT EXIST** — all referenced paths are broken
- ✅ Try page has Help tab, but only shows inline `promptSummary` (try.js line 89)
- ❌ No help content loading from filesystem

#### Implementation TODOs

**G.1 — Generate Help Docs (Bulk)**
- Create `/scripts/generate_help_docs.py` (~100 lines, Python)
  - Read `filters-index.json`
  - For each filter, generate markdown file:
    ```markdown
    # {Filter Name}
    
    ## What It Does
    {promptSummary or generated description}
    
    ## Best Results
    - Clear, well-lit photo
    - Forward-facing or 3/4 angle
    - Minimum 512×512
    
    ## Tips
    {Filter-specific tip based on type}
    
    ## About the Model
    This uses {modelName}...
    
    ## Share Text
    "{shareText}"
    ```
  - Output to `/docs/categories/{category}/{slug}_help.md`
  - Mark with `<!-- auto-generated -->` comment

**G.2 — Manual Review (High Priority Filters)**
- Review & improve help docs for all 31 demo filters (isDemoFilter: true)
- Personalize tips, improve descriptions

**G.3 — Load Help Content on Try Page**
- Option A (simpler): Bundle all help markdown into `filters-index.json` as inline `helpMarkdown` field
  - Requires updating catalog generator to include help text
  - One-time generation cost
  - No extra endpoint needed
  
- Option B (scalable): Create `/functions/api/help/[filterId].js` endpoint
  - Reads `.md` file from filesystem
  - Returns markdown HTML

**G.4 — Update Try Page UI**
- File: `/assets/try.js`
- Replace inline help (line 89) with dynamic content:
  - Fetch from `/api/help/{filterId}` or use bundled markdown
  - Render as HTML in Help tab

#### Key Files
```
Create:
  /scripts/generate_help_docs.py        (~100 lines)
  /docs/categories/{cat}/{slug}_help.md (205 files, auto-generated)

Modify:
  /docs/filters-index.json              (add helpMarkdown field or reference)
  /assets/try.js                        (~30 lines to load & render help)
  /functions/api/help/[filterId].js     (if Option B: ~50 lines)
```

#### Dependencies
- Low priority — does not block launch, improves SEO & UX

---

### 🟡 P2: Phase H — Mobile Camera Capture

**Status:** ❌ NOT IMPLEMENTED

#### Implementation TODOs

**H.1 — Try Page: Camera Button**
- File: `/try.html` + `/assets/try.js`
- Add button (mobile-only, `@media` query or JS check):
  ```html
  <button onclick="document.getElementById('camera-input').click()">📷 Take a Selfie</button>
  <input type="file" id="camera-input" accept="image/*" capture="user" hidden>
  ```
- Handler reuses existing `handleFile()` function
- ~15 lines HTML + CSS, ~5 lines JS

#### Key Files
```
Modify:
  /try.html                             (+15 lines HTML)
  /docs/assets/style.css                (+10 lines CSS mobile button)
  /assets/try.js                        (+5 lines event handler)
```

#### Dependencies
- Minimal — uses standard HTML5 `<input capture>` attribute
- No new endpoints or APIs needed

---

### 🟡 P2: Phase I — Error State Improvements

**Status:** ⚠️ PARTIALLY IMPLEMENTED

#### Already Implemented
- ✅ Backend returns categorized error codes (`daily_limit`, `api_error`, etc.)
- ✅ Try page handles some errors (try.js line 137: `error.message`)
- ✅ Status display updates with error tone (try.js line 13-17)

#### Still Needed
- ⚠️ Better error messages for each code type
- ⚠️ Actionable buttons per error (Retry, Open Settings, etc.)

#### Implementation TODOs

**I.1 — Error Message Map**
- File: `/assets/try.js`
- Add mapping for error codes → user messages + actions:
  ```javascript
  const ERROR_MESSAGES = {
    'daily_limit': { message: 'Daily free transforms reached...', action: 'expand-byok' },
    'api_error': { message: 'AI service temporarily unavailable...', action: 'retry' },
    'network_error': { message: 'No internet connection...', action: 'retry' },
  };
  ```
- Update error handler to use this map

**I.2 — R2 Direct Mode Banner**
- If `r2Available: false` → show banner: "Results are generated on-the-fly. Download now."
- Requires health check endpoint (already exists)

#### Key Files
```
Modify:
  /assets/try.js                        (+40 lines error handling)
  /docs/assets/style.css                (+20 lines error banner styling)
```

---

### 🟢 P3: Phase K — Cross-Promotion Updates

**Status:** ❌ NOT IMPLEMENTED (External, Low Priority)

**Notes:** Requires changes to `forms.gic.mx` and `onePageApps.gic.mx` — out of scope for this repo. Mark as external task.

---

## CROSS-CUTTING CONCERNS

### Dependencies Between Phases

```
Independent (No Blockers):
  ✓ C (R2 mode) — Already works
  ✓ I (Error states) — Can improve anytime
  ✓ H (Mobile camera) — Standalone feature

Depends On Preview Pipeline (Phase B):
  → D.4 (Demo mode examples) — Needs previewImages
  → E (Sharing) — Shows preview images in share
  → G (Help) — References example images

Depends On BYOK (Phase D):
  → E.1 (Share result) — For BYOK mode transforms

Recommended Implementation Order:
  1. Phase B (Preview pipeline) — Unblocks 3+ features, highest UX impact
  2. Phase D (BYOK) — Enables unlimited transforms
  3. Phase E (Sharing) — Growth mechanism
  4. Phase H (Mobile camera) — Mobile UX improvement
  5. Phase G (Help) — Documentation, SEO
  6. Phase I (Errors) — Polish
```

---

## FILE CONFLICT MITIGATION

### High-Risk Conflicts (Same Files Modified)

**`/assets/try.js`** (currently 181 lines)
- Phase B: `uploadAndTransform()` - add preview display
- Phase D: Add BYOK logic, direct CF API calls
- Phase E: Add share panel
- Phase G: Add help loading
- Phase I: Add error mapping
- Phase H: Add camera handler

**Mitigation**: Extract concerns into separate modules:
```javascript
// assets/try-byok.js (new, ~60 lines)
export { initByokPanel, transformWithByok, getSessionUsage }

// assets/try-share.js (new, ~80 lines)
export { showSharePanel, generateQrCode }

// assets/try-help.js (new, ~40 lines)
export { loadHelpContent, renderHelp }

// assets/try-errors.js (new, ~40 lines)
export { ERROR_MESSAGES, formatError }
```

Then `/assets/try.js` imports and orchestrates these.

**`/docs/assets/style.css`** (global stylesheet)
- Phase B: Filter card images, hover effects
- Phase D: BYOK panel styling
- Phase E: Share panel styling
- Phase H: Mobile camera button
- Phase I: Error banner styling

**Mitigation**: Use CSS modules or separate namespaced sections:
```css
/* Filter Card Images (Phase B) */
.filter-card__image { ... }

/* BYOK Panel (Phase D) */
.byok-panel { ... }

/* Share Panel (Phase E) */
.share-panel { ... }
```

**`/try.html`** (HTML structure)
- Phase B: Preview example display
- Phase D: BYOK input section
- Phase E: Share button/panel
- Phase H: Camera button

**Mitigation**: Keep HTML minimal, use JS to inject major components. Structure:
```html
<aside class="upload-panel">
  <div id="byok-section"></div>     <!-- Injected by D.1 -->
  <div id="preview-example"></div>   <!-- Injected by B.5 -->
  <div id="camera-button"></div>     <!-- Injected by H.1 -->
</aside>
<div id="share-panel"></div>         <!-- Injected by E.1 -->
```

### Low-Risk Files (Mostly Isolated)

- `/docs/filters-index.json` — Add fields safely (previewImages, helpMarkdown)
- `/scripts/generate_previews.js` — New file
- `/scripts/generate_help_docs.py` — New file
- `/docs/cloudflare-setup.html` — New file
- `/docs/assets/qrcode.min.js` — New external library

---

## VALIDATION COMMANDS

### Existing Commands

```bash
# Backend syntax check (validate functions)
npm run check:backend

# Manual checks
# Check site.mjs has correct baseUrl:
grep "baseUrl:" /Volumes/2tb\ Mac\ Pro\ M2/GitHub/gicPhotoFilters/docs/assets/site.mjs

# Validate filters-index.json syntax:
node -e "console.log(JSON.parse(require('fs').readFileSync('/path/to/filters-index.json')))"

# Check for broken preview image references:
grep -o '"before":"[^"]*"' docs/filters-index.json | wc -l  # Should be 0 initially

# Check share buttons in HTML:
grep -c "data-share" try.html  # Should find all share targets
```

### Recommended New Commands (package.json)

```json
{
  "scripts": {
    "check:backend": "find functions -name '*.js' -print0 | xargs -0 -n1 node --check",
    "check:html": "html-validate index.html try.html browse.html about.html",
    "check:catalog": "node scripts/validate-catalog.js",
    "check:links": "node scripts/check-broken-links.js",
    "generate:previews": "node scripts/generate_previews.js",
    "generate:help": "python3 scripts/generate_help_docs.py",
    "build:catalog": "node scripts/generate_filters_index.py"
  }
}
```

---

## IMPLEMENTATION SUMMARY TABLE

| Phase | Feature | Status | Files | Complexity | Est. LOC | Priority |
|-------|---------|--------|-------|------------|----------|----------|
| P0 Fix 2 | Domain fix | ✅ 95% | wrangler.toml, site.mjs | Low | 0 | 🔴 |
| P1-B | Preview pipeline | ❌ 0% | 5 files | High | 450 | 🔴 |
| P1-C | R2/Direct mode | ✅ 90% | 3 files | Low | 20 | 🟡 |
| P1-D | BYOK website | ❌ 10% | 4 files | High | 180 | 🔴 |
| P1-E | Sharing | ⚠️ 40% | 4 files | Medium | 200 | 🟠 |
| P2-G | Help docs | ❌ 0% | 5 files | Medium | 300 | 🟡 |
| P2-H | Mobile camera | ❌ 0% | 3 files | Low | 30 | 🟢 |
| P2-I | Error states | ⚠️ 50% | 2 files | Low | 100 | 🟡 |

**Legend**: ❌ = Not started, ⚠️ = Partial, ✅ = Complete

---

## RECOMMENDATIONS

### Immediate Next Steps (Week 1)

1. **Phase B (Previews)** — Generate base photos, run batch script
   - Highest UX impact for users browsing filters
   - Unblocks Phase D.4, E, downstream features
   - No backend changes needed

2. **Phase D (BYOK)** — Add try page panel + help docs
   - Enables unlimited transforms without app
   - Completes the "Try" experience
   - Direct CF API integration is pure frontend

### Medium Term (Weeks 2-3)

3. **Phase E (Sharing)** — Share panel with QR codes
4. **Phase G (Help)** — Auto-generate + manually review demo filters
5. **Phase H (Mobile camera)** — Add camera button

### Long Term (Quality Polish)

6. **Phase I (Error states)** — Better messages per error code
7. Cross-promo updates (external dependencies)

### Architecture Notes

- **Modularize `try.js`** into separate concern modules (byok.js, share.js, help.js, errors.js)
- **Namespace CSS** to avoid conflicts as features expand
- **Keep HTML minimal**, inject major UI components via JS
- **Bundle or API-load help content** — avoid 205+ filesystem requests
- **Cache preview images** in service worker for offline support (future)

---

## FINAL CHECKLIST FOR LAUNCH

- [ ] Domain correctly set to `photofilters.gic.mx` everywhere
- [ ] Preview images generated for all 205 filters (3 examples each)
- [ ] BYOK panel works on try page with sessionStorage credentials
- [ ] Share button with QR code generation
- [ ] Mobile camera capture button on try page
- [ ] Help content for all demo filters reviewed + polished
- [ ] Error messages categorized and user-friendly
- [ ] R2 bucket provisioned in GIC account (C.9)
- [ ] GA4 property updated for correct domain
- [ ] Sitemap submitted to Google Search Console
- [ ] App Store metadata completed (J.1-J.3)
