# Implementation Checklist — PRD Phases for Website

## Phase B: Preview Image Pipeline

### B.1 — Generate Base Photos (Non-Code)
- [ ] Create Person A (young adult, warm brown skin, short natural hair, grey background)
  - Target: 1024×1024, JPEG
  - Save to: `/docs/assets/sample-photos/person_a.jpg`
- [ ] Create Person B (middle-aged, light skin, park background, 3/4 angle)
  - Target: 1024×1024, JPEG
  - Save to: `/docs/assets/sample-photos/person_b.jpg`
- [ ] Create Person C (older adult, dark skin, professional blazer, white background)
  - Target: 1024×1024, JPEG
  - Save to: `/docs/assets/sample-photos/person_c.jpg`
- [ ] Mark all as fictional/synthetic in metadata

### B.2 — Create Batch Preview Generation Script
- [ ] Create `/scripts/generate_previews.js`
  - [ ] Read `filters-index.json` to get all filter IDs
  - [ ] Initialize progress tracker
  - [ ] For each filter × each person (615 total):
    - [ ] Call `/api/transform` with filter params + person image
    - [ ] Save result as WebP (quality 80): `filter-previews/{slug}_after_{a|b|c}.webp`
    - [ ] Copy+resize input: `filter-previews/{slug}_before_{a|b|c}.webp`
    - [ ] Skip if files already exist (resumable)
    - [ ] Log progress: `filter 45/205 — grinch-ify [✓ a, ✓ b, ✗ c (error)]`
  - [ ] Rate-limit: 1 second between requests
  - [ ] Handle client-side effects (10 filters) with canvas package
  - [ ] Output final summary and timing

### B.3 — Update Filter Schema
- [ ] Modify `/docs/filters-index.json`
  - [ ] Add `previewImages` field to each filter:
    ```json
    "previewImages": [
      { "before": "assets/filter-previews/slug_before_a.webp", 
        "after": "assets/filter-previews/slug_after_a.webp", 
        "personLabel": "a" }
    ]
    ```
  - [ ] Run B.2 to generate all previews
  - [ ] Verify all previewImages paths exist
  - [ ] Test filters-index.json remains valid JSON

### B.4 — Update Filter Card Rendering (site.mjs)
- [ ] Modify `renderFilterCard()` function (line 460)
  - [ ] Check if `filter.previewImages?.length > 0`
  - [ ] If yes: use `previewImages[0].after` as card image src
  - [ ] If no: fall back to placeholder icon (current behavior)
  - [ ] Add lazy-loading attributes: `loading="lazy"`
  - [ ] Add width/height attributes to prevent layout shift
  - [ ] Add hover/tap behavior: swap to `before` image, swap back on mouseout
  - [ ] Test on desktop (hover) and mobile (tap/long-press)

### B.5 — Update Try Page Preview Example
- [ ] Modify `/try.html` and `/assets/try.js`
  - [ ] When no user photo yet: show preview example
  - [ ] Use `previewImages[0]` for before/after
  - [ ] Add person picker (A/B/C buttons) to swap examples
  - [ ] Display caption: "Example — upload your own photo to try it"
  - [ ] On user photo upload: replace example with actual result

### B.6 — Update Browse Page
- [ ] Modify `/browse.html` and `/assets/browse.js`
  - [ ] Show `previewImages[0].after` as card thumbnail by default
  - [ ] On hover/tap: swap to `before` image
  - [ ] Swap back on mouseout
  - [ ] Test lazy-loading on slow networks

### B.7 — Validation
- [ ] [ ] Run: `npm run check:backend` (syntax validation)
- [ ] [ ] Verify: `grep -c 'previewImages' docs/filters-index.json` = 205
- [ ] [ ] Visual: Load try.html, verify preview shows
- [ ] [ ] Visual: Load browse.html, hover cards and see before/after swap
- [ ] [ ] Visual: Upload photo on try.html, verify preview disappears
- [ ] [ ] Performance: Check filter card images load with lazy-loading

---

## Phase D: BYOK (Bring Your Own Key) on Website

### D.1 — Add BYOK Panel to Try Page
- [ ] Modify `/try.html` HTML structure
  - [ ] Add collapsible `<details>` section in upload panel
  - [ ] Summary: "Use your own API key for unlimited transforms"
  - [ ] Add mode toggle (radio/checkbox): Demo mode vs Live mode
  - [ ] Add input fields (visible only in Live mode):
    - [ ] Account ID input: `<input type="text" id="cfAccountId" placeholder="...">`
    - [ ] API Token input: `<input type="password" id="cfApiToken" placeholder="...">`
  - [ ] Add "Get your free API token" link → `/docs/cloudflare-setup.html`
  - [ ] Add helper text: "Your credentials are never sent to our servers"
  - [ ] Store values in `sessionStorage`, never `localStorage`

- [ ] Modify `/docs/assets/style.css`
  - [ ] Style `.byok-panel` container
  - [ ] Hide/show fields based on mode toggle
  - [ ] Style input fields with reveal toggle for password field
  - [ ] Mobile responsive styling

### D.2 — Direct Browser → Cloudflare API Calls
- [ ] Modify `/assets/try.js` in `uploadAndTransform()` function (line 52)
  - [ ] Check if `sessionStorage.cfApiToken && sessionStorage.cfAccountId` are set
  - [ ] If set: bypass `/api/transform`, call Cloudflare API directly:
    ```javascript
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${filter.model}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: filter.prompt,
        negative_prompt: filter.negativePrompt,
        image: Array.from(imageBytes),
        strength: filter.strength,
        guidance: filter.guidance,
        width: filter.outputWidth,
        height: filter.outputHeight
      })
    });
    ```
  - [ ] Return response blob with `kind: 'direct-cf'`
  - [ ] Handle errors: 401 (invalid token), 429 (rate limit), 503 (service unavailable)
  - [ ] If error: show appropriate message, prompt for credential update

### D.3 — Session Usage Tracking
- [ ] Modify `/assets/try.js`
  - [ ] Initialize `sessionStorage.gicPF = { neuronsUsed: 0 }`
  - [ ] After each successful transform: update `sessionStorage.gicPF.neuronsUsed`
  - [ ] Display in usage panel: "Session: 450 neurons used"
  - [ ] Calculate remaining transforms: `limit / neuronsPerModel`
  - [ ] Show estimate: "~22 more Grinch-ify transforms with this model"

### D.4 — Demo Mode Safeguard
- [ ] Modify `/assets/try.js`
  - [ ] When no API key entered: don't show Transform button
  - [ ] Instead show preview examples (from Phase B)
  - [ ] Display text: "Enter your own API key above for live transforms"
  - [ ] Add CTA button: "Get the App for unlimited transforms" → `/about.html#app-availability`

### D.5 — Create Cloudflare Setup Guide
- [ ] Create `/docs/cloudflare-setup.html`
  - [ ] 5-step wizard with breadcrumb progress indicator
  - [ ] Step 1: "Do you need BYOK?" → Explain demo vs live tradeoffs
  - [ ] Step 2: "Create a Cloudflare Account" → Link to signup
  - [ ] Step 3: "Enable Workers AI" → Dashboard navigation
  - [ ] Step 4: "Create an API Token" → Screenshots/guidance
  - [ ] Step 5: "Enter credentials on Try page" → Back to try.html
  - [ ] Include annotated screenshots/SVG diagrams for each step
  - [ ] Add support link: `/contact.html` if stuck

### D.6 — Validation
- [ ] [ ] Run: `npm run check:backend` (syntax validation)
- [ ] [ ] Visual: Load try.html, expand BYOK panel
- [ ] [ ] Test: Enter invalid account ID → see error message
- [ ] [ ] Test: Enter invalid API token → see 401 error
- [ ] [ ] Test: Enter valid credentials → transform works without /api/transform
- [ ] [ ] Test: Clear sessionStorage → credentials forgotten
- [ ] [ ] Test: Refresh page → credentials cleared (sessionStorage clears)
- [ ] [ ] Visual: Check demo mode shows preview examples, not transform button
- [ ] [ ] Visual: Check usage counter updates after each transform in live mode

---

## Phase E: Sharing (Site & App)

### E.1 — Share Result Panel
- [ ] Modify `/try.html`
  - [ ] Replace simple share button with modal/panel trigger
  - [ ] Modal shows:
    - [ ] Copy link button (filter URL)
    - [ ] Download PNG button
    - [ ] Share to Twitter/X link
    - [ ] Share to WhatsApp link
    - [ ] QR code (generated client-side)
    - [ ] Native share button (if `navigator.share` available)
    - [ ] (Optional) Share result URL (if R2 enabled)

- [ ] Modify `/assets/try.js`
  - [ ] Add `showSharePanel()` function
  - [ ] Generate Twitter intent: `https://twitter.com/intent/tweet?text=${filter.shareText}&url=${filterUrl}`
  - [ ] Generate WhatsApp link: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + filterUrl)}`
  - [ ] Import `qrcode.js` library
  - [ ] Generate QR code for filter URL (client-side)
  - [ ] Add to share panel on open
  - [ ] Handle native share fallback
  - [ ] Track shares in analytics

- [ ] Modify `/docs/assets/style.css`
  - [ ] Style `.share-panel` modal/overlay
  - [ ] Button grid layout for share options
  - [ ] QR code display (~200px × 200px)
  - [ ] Mobile-responsive layout (stack buttons vertically)

### E.2 — Filter Share Button
- [ ] Modify `/browse.html` and `/assets/browse.js`
  - [ ] Add share icon button to each filter card
  - [ ] On click: show share panel with filter URL
  - [ ] Share URL: `https://photofilters.gic.mx/try.html?id={filterId}`

- [ ] Modify `/try.html` and `/assets/try.js`
  - [ ] Add share button in filter summary section
  - [ ] Same share panel as E.1
  - [ ] Share URL: `https://photofilters.gic.mx/try.html?id={filterId}`

### E.3 — Add QR Code Library
- [ ] Download `qrcode.min.js` (from CDN or npm)
  - [ ] Add to `/docs/assets/qrcode.min.js`
  - [ ] File size: ~5KB minified
  - [ ] Library: `https://github.com/davidshimjs/qrcodejs`

### E.4 — Validation
- [ ] [ ] Run: `npm run check:backend` (syntax validation)
- [ ] [ ] Visual: Click share button on try page result
- [ ] [ ] Visual: Share panel shows all options (5+ buttons/options)
- [ ] [ ] Test: Copy link → URL in clipboard
- [ ] [ ] Test: Download PNG → browser downloads image
- [ ] [ ] Test: Twitter link → opens Twitter with pre-filled text
- [ ] [ ] Test: WhatsApp link → opens WhatsApp with message
- [ ] [ ] Test: QR code → scans to filter URL
- [ ] [ ] Mobile: Native share sheet appears (iOS/Android)
- [ ] [ ] Performance: Share panel opens <200ms

---

## Phase G: Help Documentation

### G.1 — Generate Help Docs (Bulk)
- [ ] Create `/scripts/generate_help_docs.py`
  - [ ] Read `filters-index.json`
  - [ ] For each filter, generate markdown:
    ```markdown
    # {Filter Name}
    
    ## What It Does
    {promptSummary or generated description from prompt}
    
    ## Best Results
    - Use a clear, well-lit photo
    - Forward-facing or 3/4 angle works best
    - Avoid busy backgrounds
    - Minimum recommended resolution: 512×512
    
    ## Tips
    {Filter-specific tip based on type}
    
    ## About the Model
    This filter uses {modelName}. {One sentence on what it's good at}.
    
    ## Share Text
    "{shareText from manifest}"
    ```
  - [ ] Output to `/docs/categories/{category}/{slug}_help.md`
  - [ ] Mark as auto-generated: `<!-- auto-generated, review before publishing -->`
  - [ ] Skip if file already exists (resumable)

### G.2 — Manual Review (Demo Filters Only)
- [ ] Review all 31 filters with `isDemoFilter: true`
  - [ ] Improve descriptions: Make them user-friendly
  - [ ] Personalize tips: Add specific, actionable guidance
  - [ ] Test prompts: Verify they make sense
  - [ ] Fix any auto-generated markdown issues
  - [ ] Update `/docs/categories/{category}/{slug}_help.md` files

### G.3 — Load Help Content on Try Page
- **Option A (Simple)**: Bundle into filters-index.json
  - [ ] Add `helpMarkdown` field to each filter in index
  - [ ] Update catalog generator to include help text inline
  - [ ] No extra endpoint needed
  - [ ] Loads with catalog (cached)

- **Option B (Scalable)**: API endpoint
  - [ ] Create `/functions/api/help/[filterId].js`
  - [ ] Read corresponding `.md` file from filesystem
  - [ ] Return as HTML or markdown
  - [ ] Cache responses in browser

- [ ] Modify `/assets/try.js`
  - [ ] Fetch help content after loading filter
  - [ ] Update Help tab with loaded content
  - [ ] Render as HTML (sanitize markdown)
  - [ ] Show loading state while fetching

### G.4 — Validation
- [ ] [ ] Run: `npm run check:backend` (syntax validation)
- [ ] [ ] Verify: `ls docs/categories/*/*.md | wc -l` = 205+
- [ ] [ ] Verify: All 31 demo filters have custom (non-auto-generated) help
- [ ] [ ] Visual: Load try.html, check Help tab shows content
- [ ] [ ] Visual: Content is readable, no markdown formatting artifacts
- [ ] [ ] Performance: Help loads in <500ms

---

## Phase H: Mobile Camera Capture

### H.1 — Add Camera Button to Try Page
- [ ] Modify `/try.html`
  - [ ] Add file input (hidden): `<input type="file" id="cameraInput" accept="image/*" capture="user" hidden>`
  - [ ] Add button (mobile-only): "📷 Take a Selfie"
  - [ ] Button calls: `document.getElementById('cameraInput').click()`
  - [ ] Styling: Mobile-only with media query

- [ ] Modify `/docs/assets/style.css`
  - [ ] Desktop: Hide camera button (`@media (min-width: 768px) { display: none; }`)
  - [ ] Mobile: Show and style button
  - [ ] Button styling: Match "Choose Photo" button

- [ ] Modify `/assets/try.js`
  - [ ] Reuse existing `handleFile()` function
  - [ ] No new logic needed; standard `<input capture>` handles camera access

### H.2 — Validation
- [ ] [ ] Visual (mobile): Load try.html, see camera button
- [ ] [ ] Visual (desktop): Load try.html, camera button hidden
- [ ] [ ] Test (iOS): Tap button, native camera app opens
- [ ] [ ] Test (Android): Tap button, native camera app opens
- [ ] [ ] Test: Take photo, transform works as expected
- [ ] [ ] Test: Cancel camera, no crash or error

---

## Phase I: Error State Improvements

### I.1 — Categorized Error Messages
- [ ] Modify `/assets/try.js`
  - [ ] Create error message map:
    ```javascript
    const ERROR_MESSAGES = {
      'daily_limit': {
        message: 'Daily free limit reached (10/10). Use your own Cloudflare account for unlimited.',
        action: 'expand-byok',
        actionText: 'Add API Key'
      },
      'api_error': {
        message: 'The AI service is temporarily busy. Try again in a moment.',
        action: 'retry',
        actionText: 'Retry Transform'
      },
      'network_error': {
        message: 'No internet connection. Check your connection and try again.',
        action: 'retry',
        actionText: 'Retry'
      },
      '401': {
        message: 'Your API token is invalid or expired.',
        action: 'update-byok',
        actionText: 'Update Token'
      },
      '429': {
        message: 'Rate limit reached. Try again in a moment.',
        action: 'retry',
        actionText: 'Retry'
      }
    };
    ```
  - [ ] Update error handler to use map
  - [ ] Show actionable button based on error type

### I.2 — R2 Direct Mode Banner
- [ ] Modify `/assets/try.js`
  - [ ] Call `/api/health` on page load
  - [ ] If `r2Available: false`: show banner message
  - [ ] Banner text: "Results are generated on-the-fly. Download now for offline access. [Enable R2 →](/docs/r2-setup.html)"
  - [ ] Show banner above result preview

- [ ] Modify `/docs/assets/style.css`
  - [ ] Style `.direct-mode-banner`
  - [ ] Warning color (yellow/orange)
  - [ ] Dismissible (if user prefers)

### I.3 — Validation
- [ ] [ ] Run: `npm run check:backend` (syntax validation)
- [ ] [ ] Test: Trigger daily_limit error → see BYOK prompt
- [ ] [ ] Test: Invalid API token → see "invalid token" message
- [ ] [ ] Test: Network error → see appropriate message
- [ ] [ ] Test: Click action button → appropriate action happens
- [ ] [ ] Visual: R2 disabled → see "generated on-the-fly" banner

---

## Final QA Checklist

### Cross-Browser Testing
- [ ] Desktop: Chrome, Firefox, Safari
- [ ] Mobile: iOS Safari, Chrome Android
- [ ] Test all new features in each browser

### Performance
- [ ] Preview images load with lazy-loading
- [ ] Share panel opens <200ms
- [ ] Help content loads <500ms
- [ ] No layout shift when images load
- [ ] Lighthouse score remains >90

### Accessibility
- [ ] All buttons have text labels (not just icons)
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works (Tab through buttons)
- [ ] Share panel is screen-reader friendly
- [ ] Mobile camera input has proper label

### Security
- [ ] BYOK credentials never logged or cached
- [ ] BYOK credentials cleared on tab close (sessionStorage)
- [ ] API tokens not visible in network logs
- [ ] CORS headers correct for direct CF API calls
- [ ] XSS prevention in HTML rendering (sanitize markdown)

### SEO & Analytics
- [ ] GA4 tracking for all new interactions
- [ ] Track share button clicks
- [ ] Track BYOK panel expansions
- [ ] Track help tab views
- [ ] Meta tags updated (canonical, og:url, etc.)

### Documentation
- [ ] Update README with new features
- [ ] Document BYOK setup process
- [ ] Document preview generation script usage
- [ ] Add comments in code for complex logic
- [ ] Update feature list on marketing site

---

## Sign-Off

- [ ] All tests pass: `npm run check:backend`
- [ ] Manual testing complete on desktop & mobile
- [ ] Code review completed
- [ ] Performance validated
- [ ] Accessibility validated
- [ ] Ready for production deployment

