# GIC Photo Filters — Quick Reference for Website PRD Phases

## Status Summary

| Phase | Feature | Status | Start | Blocks | Complexity |
|-------|---------|--------|-------|--------|-----------|
| P0 Fix2 | Domain throughout site | ✅ 95% | Manual | None | Low |
| P1-B | Preview pipeline | ❌ 0% | **NOW** | D,E | High |
| P1-C | R2/Direct mode | ✅ 90% | Polish | None | Low |
| P1-D | BYOK website | ❌ 10% | After B | E | High |
| P1-E | Sharing | ⚠️ 40% | After D | None | Medium |
| P2-G | Help docs | ❌ 0% | Parallel | None | Medium |
| P2-H | Mobile camera | ❌ 0% | Parallel | None | Low |
| P2-I | Error states | ⚠️ 50% | Anytime | None | Low |

---

## Key Files by Phase

### Phase B — Preview Pipeline (HIGHEST PRIORITY)
```
Create:
  /scripts/generate_previews.js          (150 LOC, Node.js)
  /docs/assets/sample-photos/person_*.jpg (external images)

Modify:
  /docs/filters-index.json               (add previewImages field)
  /docs/assets/site.mjs:renderFilterCard() (30 LOC)
  /assets/try.js                         (20 LOC)
  /browse.html / /assets/browse.js       (20 LOC)
```

**Implementation**: Create base photos → Run batch script to generate 615 previews → Update index schema → Update UI to show images

---

### Phase D — BYOK (SECOND PRIORITY)
```
Create:
  /docs/cloudflare-setup.html            (200 LOC static HTML)

Modify:
  /try.html                              (+50 LOC HTML)
  /assets/try.js                         (+80 LOC logic)
  /docs/assets/style.css                 (+30 LOC styles)
```

**Implementation**: Add panel → Get CF API token → Store in sessionStorage → Call CF API directly from browser

---

### Phase E — Sharing (THIRD PRIORITY)
```
Create:
  /docs/assets/qrcode.min.js             (external, 5KB)

Modify:
  /try.html                              (+30 LOC HTML)
  /assets/try.js                         (+80 LOC)
  /docs/assets/style.css                 (+40 LOC)
  /browse.html / /assets/browse.js       (+20 LOC)
```

**Implementation**: Add share panel with Twitter/WhatsApp/QR options → Add filter share buttons

---

### Phase G — Help Docs (CAN RUN IN PARALLEL)
```
Create:
  /scripts/generate_help_docs.py         (100 LOC, Python)
  /docs/categories/{cat}/{slug}_help.md  (205 files auto-generated)

Modify:
  /docs/filters-index.json               (add helpMarkdown field)
  /assets/try.js                         (30 LOC to load content)
```

**Implementation**: Generate drafts → Review demo filters → Bundle or API-load → Update try page

---

### Phase H — Mobile Camera (CAN RUN IN PARALLEL)
```
Modify:
  /try.html                              (+15 LOC)
  /docs/assets/style.css                 (+10 LOC)
  /assets/try.js                         (+5 LOC)
```

**Implementation**: Add `<input capture="user">` → Reuse handleFile() → Mobile-only styling

---

## File Conflict Strategy

**`/assets/try.js`** will grow to ~300+ LOC. Avoid conflicts:
- Extract BYOK logic → `assets/try-byok.js` (60 LOC, exported functions)
- Extract share logic → `assets/try-share.js` (80 LOC, exported functions)  
- Extract help loading → `assets/try-help.js` (40 LOC, exported functions)
- Extract error handling → `assets/try-errors.js` (40 LOC, exported functions)
- Main `try.js` (~180 LOC) imports and orchestrates

**`/docs/assets/style.css`** — Use namespaced sections:
```css
/* Phase B: Filter Card Images */
.filter-card__image { ... }

/* Phase D: BYOK Panel */
.byok-panel { ... }

/* Phase E: Share Panel */
.share-panel { ... }

/* Phase H: Mobile Camera */
@media (max-width: 768px) { .camera-button { ... } }
```

**`/try.html`** — Keep minimal, inject via JS:
```html
<aside class="upload-panel">
  <div id="byok-section"></div>
  <div id="preview-example"></div>
</aside>
<div id="share-panel"></div>
```

---

## Validation Commands

```bash
# Backend JS syntax validation
npm run check:backend

# Verify site domain
grep "baseUrl:" docs/assets/site.mjs

# Check filters-index.json is valid JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('docs/filters-index.json')))"

# Count filter entries
grep -c '"id":' docs/filters-index.json  # Should be ~205

# Check for broken preview references (after Phase B)
grep -c 'previewImages' docs/filters-index.json  # Should be ~205

# Verify all share buttons linked
grep -c 'data-share' try.html  # Should find all targets
```

### Recommended package.json Scripts (to add)
```json
{
  "check:catalog": "node scripts/validate-catalog.js",
  "check:links": "node scripts/check-broken-links.js",
  "generate:previews": "node scripts/generate_previews.js",
  "generate:help": "python3 scripts/generate_help_docs.py",
  "generate:catalog": "node scripts/generate_filters_index.js"
}
```

---

## Current Implementation Status

### Already Working
- ✅ Domain fix (sites.mjs baseUrl correct)
- ✅ R2/Direct mode toggle (transform.js detects STORAGE_MODE)
- ✅ Backend API accepts apiKey parameter
- ✅ Share button basic functionality (navigator.share fallback)
- ✅ Usage tracking API endpoint
- ✅ Health check with storage mode status
- ✅ Error responses with categorized codes

### Partially Working
- ⚠️ Share button (clipboard works, no panel/QR)
- ⚠️ Help tab (shows promptSummary only, no loaded docs)
- ⚠️ Error messages (generic, not categorized)
- ⚠️ R2 setup docs (exists, may need review)

### Not Started
- ❌ Preview images (0 previews generated, no schema)
- ❌ BYOK panel UI (backend-ready, no frontend)
- ❌ Mobile camera button (no capture input)
- ❌ Help documentation (200+ files missing)
- ❌ Share panel UI with QR code
- ❌ Cloudflare setup guide

---

## Architecture Decisions

1. **Preview Images**: Bundle 3 examples per filter (615 total), regenerate quarterly
2. **BYOK**: Direct browser → Cloudflare API (no backend proxy), store in sessionStorage only
3. **Help**: Auto-generate drafts, bundle into filters-index.json for fast loading
4. **Sharing**: Client-side QR generation + native share sheet + social links
5. **Error Handling**: Map error codes to user messages + actionable buttons

---

## Recommended Implementation Order

**Week 1:**
1. Phase B: Generate previews (batch script setup)
2. Phase D: Add BYOK panel + direct CF calls

**Week 2:**
3. Phase E: Share panel + QR codes
4. Phase G: Auto-generate + review help docs (parallel with E)

**Week 3:**
5. Phase H: Mobile camera button
6. Phase I: Categorized error messages
7. QA + polish

---

## No-Code / External Tasks

These don't require code changes:
- Generate 3 synthetic base persons (Person A/B/C) using DALL-E 3
- Review + improve help docs for 31 demo filters
- Update GA4 property in dashboard for photofilters.gic.mx
- Submit sitemap to Google Search Console
- Update forms.gic.mx and onePageApps.gic.mx footer links (Phase K)
