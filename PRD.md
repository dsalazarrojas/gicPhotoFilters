# PRD — Sprint: March 12, 2026

**Product:** GIC Photo Filters (Site + iOS App)
**Builds on:** `PRD202603121254.md` (original spec) and `PRD202603121557.md` (remaining-work tracker)
**Reference app:** `gicFormsForCloudflare` (card-based Settings, setup wizard, ExpandableKeyField, entitlements)
**Date:** March 12, 2026
**Revised:** March 12, 2026 — security architecture, onboarding wizard, UX decisions

---

## Scope of This PRD

This document covers **seven work streams** that must land before anything else in the backlog:

| # | Stream | Why |
|---|--------|-----|
| S0 | Website + App — Cloudflare Setup Wizard | New users cannot use BYOK without step-by-step guidance; wizard is required before any BYOK feature is useful |
| S1 | iOS App — Sandbox / Networking Entitlements Fix | App cannot make any network request on macOS; crashes with `networkd_settings_read_from_file` sandbox denial |
| S2 | iOS App — Card-Based Settings Redesign | Settings is still a plain `Form`; must match `gicFormsForCloudflare` quality |
| S3 | iOS App — 401/429 Error Messages & Before/After Previews | Missing categorized error handling and visual previews |
| S4 | Website — Bring Your Own Key (BYOK) Settings Dialog | Users need a full settings panel to enter keys, see neuron balance, and understand demo limits |
| S5 | Website + App — Custom Filter Builder (Design & Test Your Own Prompt) | The *centerpiece* feature: users design a prompt, pick a model, test it on a photo, and share the result |
| S6 | Before/After Sample Photos — Generate AI Portrait + Preview Script | Create 1 base portrait, generate 1 before/after per filter in daily batches using the free neuron allotment |

---

## S0 — Cloudflare Setup Wizard (Website + App)

### Problem

All BYOK features — custom filter building, full settings, unlimited transforms — require users to:

1. Create a free Cloudflare account
2. Enable Workers AI on that account
3. Generate an API token with the correct permissions
4. Find their Account ID

Without guided onboarding, most users hit a blank text field and give up. This wizard must exist on both the website and the iOS app before the BYOK settings dialog (S4) or filter builder (S5) are shipped.

**Check `gicFormsForCloudflare` first:** If a setup wizard already exists there, adapt it directly rather than building from scratch.

---

### Website: `docs/cloudflare-setup.html`

#### S0.1 — Setup Wizard Page

A dedicated page with a **4-step progress indicator** at the top (Step 1 of 4 · Step 2 of 4 · …). Each step is a card with clear instructions, screenshots or illustrations, and a CTA. The page can be used standalone *or* opened as a modal overlay from try.html / build.html so the user never loses their work.

Accessible from:
- Settings dialog → "Get your free Cloudflare API token →" link
- The "No key" status banner on try.html and build.html → "Set up in 2 minutes" button
- The site footer → "Using your own key"

---

**Step 1 — Create Your Free Account**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1 of 4 — Create a free Cloudflare account             │
│─────────────────────────────────────────────────────────────│
│ Cloudflare's free plan includes Workers AI with enough     │
│ capacity for hundreds of photo transforms per day.         │
│ No credit card required.                                   │
│                                                             │
│ [Open Cloudflare Sign-Up ↗]   Already have one? Skip →    │
└─────────────────────────────────────────────────────────────┘
```

- "Open Cloudflare Sign-Up" opens `cloudflare.com/sign-up` in a new tab
- "Already have one? Skip →" advances to Step 2

---

**Step 2 — Enable Workers AI**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 2 of 4 — Enable Workers AI                            │
│─────────────────────────────────────────────────────────────│
│  1. Log in to dash.cloudflare.com                          │
│  2. In the left sidebar, click "AI"                        │
│  3. Click "Enable Workers AI"                              │
│                                                             │
│ Workers AI is free. You get 10,000 neurons/day at no cost. │
│                                        [Done, next step →] │
└─────────────────────────────────────────────────────────────┘
```

Each numbered step has a screenshot thumbnail (expandable on click).

---

**Step 3 — Find Your Account ID**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 3 of 4 — Find your Account ID                         │
│─────────────────────────────────────────────────────────────│
│ Your Account ID is a 32-character string shown in the      │
│ right sidebar of your Cloudflare dashboard.                │
│                                                             │
│ [Screenshot: dashboard with arrow pointing to Account ID]  │
│                                                             │
│ Account ID: [________________________________] [Save]      │
│             ✓ That looks right — 32 characters             │
│             ✗ Account IDs are 32 characters — check again  │
│                                        [Next →]            │
└─────────────────────────────────────────────────────────────┘
```

- Inline validation: check for exactly 32 hex characters
- "Save" stores the Account ID to localStorage immediately (no need to re-enter in Step 4)
- "Next" is only enabled after validation passes

---

**Step 4 — Create an API Token**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 4 of 4 — Create your API token                        │
│─────────────────────────────────────────────────────────────│
│ This token lets GIC Photo Filters run transforms on your   │
│ behalf. It can only access Workers AI — nothing else.      │
│                                                             │
│  1. Go to dash.cloudflare.com/profile/api-tokens           │
│  2. Click "Create Token"                                   │
│  3. Choose "Workers AI Read & Write" template              │
│     (or manually add scopes: ai:read, ai:write)            │
│  4. Click "Continue to summary" → "Create Token"           │
│  5. Copy the token — it's shown only once!                 │
│                                                             │
│ API Token: [🔑 ______________________________] [👁]        │
│                                                             │
│ [Save & Test Connection]                                   │
│  ✓ Connected — 8,200 neurons available today               │
│  ✗ Invalid token — check it in your Cloudflare dashboard   │
│  ✗ Account not found — verify your Account ID in Step 3   │
│  ✗ Workers AI not enabled — complete Step 2 first         │
│                                                             │
│ [🎉 Done — Try a Filter!]  (enabled after test passes)    │
└─────────────────────────────────────────────────────────────┘
```

- "Save & Test Connection" calls `GET /api/health` (see health endpoint spec below) — no neurons spent
- Shows the specific error message returned by the health check
- "Done — Try a Filter!" links to try.html and is only shown after a successful test

---

#### S0.2 — Inline "No Key" Status Banner

When no Cloudflare credentials are configured, show a friendly inline banner above the transform button on **both try.html and build.html** — never a harsh error:

```
┌───────────────────────────────────────────────────────────┐
│ 🔑  Using demo mode — 3 free transforms left today       │
│     Add your free Cloudflare key for unlimited access.   │
│                              [Set up in 2 minutes →]     │
└───────────────────────────────────────────────────────────┘
```

- "Set up in 2 minutes →" opens the setup wizard as a **modal overlay** — the uploaded photo and all current settings are preserved underneath
- Counter ("3 free transforms left today") reflects the rate-limited GIC demo proxy
- When credentials are configured: replace banner with "🟢 Your Cloudflare key · 8,200 neurons available · [Settings]"

---

### iOS App: Setup Wizard

#### S0.3 — First-Launch Wizard Sheet

**Check `gicFormsForCloudflare` for an existing wizard sheet — if it exists, adapt it directly.**

If building new: a SwiftUI multi-step `.sheet()` that appears automatically on first launch when no credentials are saved, or when the user taps "Set up Cloudflare" in the Settings card. Uses the same 4-step flow as the website.

**Step 1 — Welcome**
- Illustration + headline: "Connect your free Cloudflare account"
- Body: "Get hundreds of photo transforms per day at no cost."
- Buttons: "I have a Cloudflare account →" / "Create a free account ↗" (opens Safari)
- Link: "Skip for now (use demo mode)" — dismisses sheet, shows demo banner in app

**Step 2 — Enable Workers AI**
- Numbered instruction list with a "Open Cloudflare Dashboard ↗" button
- "Done, next →" advances to Step 3

**Step 3 — Account ID**
- Screenshot/illustration
- `TextField` with live 32-char hex validation
- Inline feedback: "Looks good ✓" or "Should be 32 characters"
- "Next →" enabled only after validation passes

**Step 4 — API Token**
- Numbered instructions
- `SecureField` with reveal toggle
- "Test Connection" button → calls `/api/health` via the app's network layer → shows inline result:
  - ✅ "Connected — 8,200 neurons available today"
  - ❌ "Invalid token — check your Cloudflare dashboard" (tappable for full error)
- "You're all set! →" (enabled after test passes) → dismisses sheet, opens filter gallery

#### S0.4 — Trigger Points in the App

| Trigger | Behavior |
|---|---|
| First launch, no saved credentials | Wizard sheet appears automatically |
| Settings card → "Connect Cloudflare" button | Opens wizard sheet |
| Transform attempt with no credentials | Shows banner: "Add your Cloudflare key — [Set up, 2 min]" → tapping opens wizard **as a sheet**, not navigation |
| Transform 429 / demo limit hit | Shows banner with "Add your key" CTA → opens wizard as a sheet |

**Critical:** Never navigate away from the current screen. The wizard always opens as a sheet/modal so the user's photo and filter selection are preserved.

---

### `/api/health` Endpoint Spec

This new Cloudflare Function endpoint is used by both S0 (wizard "Test Connection") and S4.1 ("Test connection" button in settings). It verifies credentials and returns neuron balance **without spending any neurons**.

**Request:**
```
GET /api/health
X-CF-Account-ID: <32-char account ID>
X-CF-API-Token: <Cloudflare API token>
```

**Worker implementation:**
1. Read `X-CF-Account-ID` and `X-CF-API-Token` headers
2. If either is missing: return `{ "ok": false, "error": "No credentials provided", "status": 400 }`
3. Call `GET https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/usage` with `Authorization: Bearer {apiToken}`
4. If Cloudflare returns success: return `{ "ok": true, "neuronsUsed": 1800, "neuronsLimit": 10000, "neuronsRemaining": 8200 }`
5. On error from Cloudflare: parse the error and return a user-friendly message:
   - 401 → `{ "ok": false, "error": "Invalid API token — check it in your Cloudflare dashboard" }`
   - 403 → `{ "ok": false, "error": "Token doesn't have Workers AI permission — re-create with ai:read scope" }`
   - 404 → `{ "ok": false, "error": "Account not found — verify your Account ID" }`
   - Other → `{ "ok": false, "error": "Cloudflare error: <original message>" }`

**Never** log or store the user's token in any Cloudflare KV, log, or analytics.

---

## S1 — iOS App: Sandbox & Networking Entitlements Fix

### Problem

When built for **macOS** (Mac Catalyst / native macOS target), the app fails every network call with:

```
networkd_settings_read_from_file Sandbox is preventing this process from reading
  networkd settings file at "/Library/Preferences/com.apple.networkd.plist"
nw_resolver_can_use_dns_xpc_block_invoke Sandbox does not allow access to com.apple.dnssd.service
NSURLErrorDomain Code=-1003 "A server with the specified hostname could not be found."
```

The root cause: the Xcode project **has no entitlements file**. On macOS, App Sandbox is on by default for new projects, and without an explicit `com.apple.security.network.client = true` entitlement, all outgoing HTTP requests are blocked by the sandbox.

The reference app `gicFormsForCloudflare` already has this solved:

```xml
<!-- gicFormsForCloudflare.entitlements -->
<key>com.apple.security.app-sandbox</key>    <true/>
<key>com.apple.security.network.client</key> <true/>
```

### Tasks

#### S1.1 — Create Entitlements File

Create `GIC Photo Filters/GIC Photo Filters/GIC_Photo_Filters.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

Entitlements included:

| Entitlement | Why |
|---|---|
| `com.apple.security.app-sandbox` | Required for App Store distribution |
| `com.apple.security.network.client` | **Fixes the DNS/network sandbox denial** — allows outgoing HTTP to `photofilters.gic.mx` |
| `com.apple.security.files.user-selected.read-write` | Allows saving transformed photos via the file picker / share sheet |

#### S1.2 — Wire Entitlements in Xcode Project

In the `GIC Photo Filters.xcodeproj/project.pbxproj`, add `CODE_SIGN_ENTITLEMENTS` for **both** the Debug and Release build configurations of the macOS target:

```
CODE_SIGN_ENTITLEMENTS = "GIC Photo Filters/GIC_Photo_Filters.entitlements";
```

#### S1.3 — Verify Fix

1. Clean build (`Cmd+Shift+K`)
2. Run on macOS (My Mac destination)
3. Confirm `filters-index.json` downloads successfully from `https://photofilters.gic.mx/docs/filters-index.json`
4. Confirm no `networkd_settings_read_from_file` errors in Xcode console
5. Confirm transforms can reach the backend

---

## S2 — iOS App: Card-Based Settings Redesign

### Problem

The current `SettingsView.swift` is a plain `Form { Section { ... } }` — no visual hierarchy, no model picker, no account ID field, no usage display. The reference `gicFormsForCloudflare/SettingsView.swift` uses a `ScrollView + VStack` with `settingsCard()` helpers, tinted SF Symbol icons, and polished card styling.

### Reference Architecture (gicFormsForCloudflare)

```swift
// Pattern from gicFormsForCloudflare/SettingsView.swift
ScrollView {
    VStack(alignment: .leading, spacing: 20) {
        settingsCard(title: "Cloudflare", systemImage: "cloud.fill", tint: .orange) {
            ExpandableKeyField(key: .cloudflareAPIToken, icon: "cloud.fill", color: .orange)
            ExpandableKeyField(key: .cloudflareAccountID, icon: "number", color: .orange)
            // ...
        }
    }
}
```

### Tasks

#### S2.1 — Create `settingsCard()` Helper

Add a `settingsCard` ViewBuilder function (either as a method on `SettingsView` or a standalone `SettingsCard` View), matching the reference app's pattern:

```swift
@ViewBuilder
func settingsCard<Content: View>(
    title: String,
    systemImage: String,
    tint: Color,
    @ViewBuilder content: () -> Content
) -> some View {
    VStack(alignment: .leading, spacing: 12) {
        Label(title, systemImage: systemImage)
            .font(.headline)
            .foregroundStyle(tint)
        content()
    }
    .padding(16)
    .background(.secondarySystemGroupedBackground)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
}
```

#### S2.2 — Replace Form with ScrollView + Card Layout

Replace the current `Form { ... }` body with `ScrollView { VStack(spacing: 20) { ... } .padding() }` and build these cards:

| Card | Icon | Tint | Content |
|------|------|------|---------|
| **Catalog** | `shippingbox.fill` | `.accentColor` | Remote toggle, remote URL field, last sync date, Refresh button |
| **Cloudflare Connection** | `cloud.fill` | `.orange` | API token (SecureField + reveal toggle), Account ID field, "Test Connection" button, Clear token, Save button |
| **AI Model** | `cpu` | `.blue` | Model picker (see S2.3) |
| **Usage Today** | `chart.bar.fill` | `.green` | Neuron progress bar, raw numbers, estimated remaining transforms |
| **Deep Links** | `link` | `.secondary` | Deep link examples list |

#### S2.3 — Add Model Picker

Add `preferredModel: String` (default `"default"`) to `AppSettingsSnapshot`. Display as a `Picker` or button grid inside the AI Model card:

| Display Name | Model ID |
|---|---|
| Use filter default | `default` |
| FLUX.2 Klein 9B (Recommended) | `flux2-klein-9b` |
| FLUX.2 Klein 4B | `flux2-klein-4b` |
| SD v1.5 img2img | `sd15-img2img` |
| SD v1.5 Inpainting | `sd15-inpainting` |

#### S2.4 — Add Cloudflare Account ID Field

Add `cloudflareAccountID` to `AppSettingsSnapshot` (stored in Keychain alongside the token). Show an Account ID text field in the Cloudflare Connection card with helper text and a "Open dashboard ↗" link.

#### S2.5 — Add "Test Connection" Button in Settings Card

The Cloudflare Connection card includes a "Test Connection" button that calls `/api/health` (see S0 endpoint spec) and shows inline result:
- ✅ "Connected — 8,200 neurons available today (resets midnight UTC)"
- ❌ Specific error from the health endpoint (tappable to expand full technical detail)

This is the same `/api/health` call used by the setup wizard. No neurons are spent.

#### S2.6 — Add Usage Tracking Display

Add a "Usage Today" card with:
- `ProgressView(value: used, total: limit)` for neurons
- Raw numbers: "1,200 / 10,000 neurons"
- Estimated remaining transforms at the selected model's cost
- "Resets at midnight UTC"
- "Refresh usage" button (calls `/api/health` and updates the display)

---

## S3 — iOS App: 401/429 Error Messages & Before/After Preview Images

### S3.1 — Categorized Error Messages

In `TransformComposerView.swift` and `TransformResultView.swift`, replace generic error alerts with specific, actionable messages. **Note: the 429 message is different for the app (user is already in the app) vs. the website.**

| HTTP Status | Context | User-Facing Message | Action |
|---|---|---|---|
| 401 Unauthorized | App + Site | "Your API token is invalid or expired. Update it in Settings." | "Open Settings" button |
| 429 Rate Limited | **App** | "Daily limit reached. Add your own free Cloudflare key in Settings for unlimited access." | "Open Settings" button |
| 429 Rate Limited | **Website** | "Daily free limit reached. Get the iOS app for unlimited access, or add your own Cloudflare key." | "Get App" link + "Add key" link |
| -1003 (DNS / no server found) | App | "Cannot reach the transform service. Check your internet connection or verify the URL in Settings." | "Open Settings" + Retry |
| 503 / API error | App + Site | "The AI service is temporarily unavailable. Try again in a moment." | Retry button |
| Image too large | App + Site | "Photo too large. Please use an image under 5MB." | — |

Make the error view tappable to expand the full technical error for debugging.

### S3.2 — Before/After Preview Images in Filter Cards

In `FilterDetailView.swift`:
- When `previewImages` is available in the filter JSON, download and display `previewImages[0].after` as the card thumbnail using `AsyncImage`
- Show a swipeable before/after comparison using `GeometryReader` + drag gesture
- Cache thumbnails via standard `URLSession` caching

---

## S4 — Website: Full BYOK Settings Dialog

### Problem

The current try page has a minimal `<details>` accordion with just Account ID and API Token fields. Users need a proper settings panel — keys, model selection, neuron balance, storage options — so they can **design and test their own filters** on the website.

### Security Architecture for All Transforms

**All transform requests — whether using the user's BYOK key or GIC's demo proxy — flow through `photofilters.gic.mx/api/transform`.** The browser never calls the Cloudflare API directly (which would expose the token in DevTools and violate CORS policy).

The routing logic in the Worker:
1. Check for `X-CF-Account-ID` and `X-CF-API-Token` request headers
2. **If headers are present** → use the user's credentials for the Workers AI call (charged to their free quota)
3. **If headers are absent** → fall back to GIC's own token, rate-limited to **3 requests per IP per day** (demo mode)
4. Never log, echo, or store user tokens

This pattern means the user's API token travels **only as a request header over HTTPS**, is never in a URL, never in a response body, and is never stored server-side.

### Tasks

#### S4.1 — Create Settings Modal

A `<dialog>` element (or fixed-overlay modal) accessible from the settings gear icon in the site header. Opens without page navigation so the user never loses their current photo or filter state.

**Section 1 — Cloudflare Workers AI**

- Account ID (`text` input, 32-char hex validation with inline "Looks good ✓" / "Should be 32 characters")
- API Token (`password` input with reveal toggle and a clear button)
- "Test Connection" button → calls `GET /api/health` with current credentials (no neurons spent) → shows:
  - ✅ "Connected — 8,200 neurons available today (resets midnight UTC)"
  - ❌ Specific human-readable error (see `/api/health` spec in S0)
- Link: "Don't have a key? Set up in 2 minutes →" opens the S0 setup wizard as a nested modal
- **Photo privacy notice** (shown directly below the API token field):
  > 📷 Your photos are processed and immediately discarded — never stored on our servers.

**Section 2 — External AI Providers** (collapsible, for advanced users)
- Replicate API Token
- fal.ai API Key
- OpenAI API Key (for future DALL-E integration)
- Each with `password` input + reveal toggle + clear button

**Section 3 — AI Model Preference**
- Model picker matching the app's choices:
  - Use filter default
  - FLUX.2 Klein 9B
  - FLUX.2 Klein 4B
  - SD v1.5 img2img
  - SD v1.5 Inpainting

**Section 4 — Usage & Storage**

- Neuron counter: "8,200 / 10,000 neurons available today" (populated after test connection)
- "Clear all credentials" button (with confirmation)
- Storage toggle:
  ```
  [●──] Store in this browser (recommended)
        Your credentials are saved in localStorage — private to this browser,
        never sent to our servers. Clear them any time with the button above.

  [──●] Session only
        Credentials are cleared when you close this tab.
  ```
- Default: **localStorage** (the toggle defaults to "Store in this browser")

#### S4.2 — Update Site Header Nav

In `site.mjs` `renderHeader()`, add a ⚙ gear icon button at the right end of the nav that opens the settings modal. Show a small green dot on the gear icon when credentials are configured.

#### S4.3 — Connect Settings to Transform Pipeline (Secure Proxy Pattern)

When the user triggers a transform:

1. Read credentials from the settings store (localStorage or sessionStorage per the user's toggle)
2. **Always POST to `https://photofilters.gic.mx/api/transform`** — never directly to Cloudflare
3. If BYOK credentials are configured: include headers `X-CF-Account-ID: <id>` and `X-CF-API-Token: <token>`
4. If no credentials: send without those headers → Worker uses GIC's rate-limited demo proxy
5. If external provider credentials exist: include `X-Replicate-Token`, `X-Fal-Key`, etc., and the Worker routes accordingly

The user's token is protected by HTTPS transport encryption. It is visible only in the browser's own DevTools (which only the user can access), not to any third party or to our servers beyond the single request handling.

#### S4.4 — Update BYOK Status Indicator on Try Page

Replace the current minimal BYOK accordion with a condensed status bar that opens the settings modal on click:

```
🟢 Your Cloudflare key · 8,200 neurons available  [Settings ⚙]
⚪ Demo mode · 3 free transforms left today        [Add your key →]
```

Demo mode (⚪) reflects GIC's rate-limited proxy (Option B): **3 transforms per IP per day**. This is clearly communicated so users understand it is a sample experience, not the full product. The "Add your key →" link opens the S0 setup wizard modal.

---

## S5 — Custom Filter Builder (Centerpiece Feature)

### Problem

Neither the website nor the app has a way to **design, test, and share a custom prompt with a chosen model**. This is the centerpiece of both platforms.

### Page Layout Decision

The filter builder is a **single scrollable page** (not a step-by-step wizard). All sections are visible at once; users scroll through and fill them in at their own pace. A section completion indicator (colored dot or checkmark) shows which sections are done. A **sticky "Run Test" button** appears at the bottom of the viewport once Sections 1 (prompt) and 2 (model) are filled in.

---

### Website: `build.html`

#### S5.1 — Create Build Page

A new page accessible from the primary nav ("Build"). All sections are stacked as cards on a scrollable page.

---

**Section 1 — Write Your Prompt**
- `<textarea>` for the main transformation prompt (max 500 chars, live character counter)
- `<textarea>` for the negative prompt (max 300 chars, collapsible by default)
- "Need inspiration?" expandable panel: rotating suggestions from existing filter prompts (3 at a time, shuffle button)
- "Tips for great prompts" expandable: describe the style, not the subject; add lighting and medium cues; use negative prompts to reduce artifacts

---

**Section 2 — Choose Your Model**

Visual model cards (not a plain dropdown):

| Model Card | Tagline | Best for |
|---|---|---|
| FLUX.2 Klein 9B ⭐ Recommended | "Highest quality" | Character transforms, faces, artistic styles |
| FLUX.2 Klein 4B | "Faster results" | Style transfers, abstract effects |
| SD v1.5 img2img | "Classic look" | Painterly and retro artistic styles |
| SD v1.5 Inpainting | "Add or replace" | Specific region changes, accessories |
| *(shown only if external keys set)* Replicate / fal.ai models | — | — |

Clicking a card selects it (highlighted border). Section 2 is marked complete.

---

**Section 3 — Set Parameters**
- **Strength** slider (0.3–1.0), labeled "Subtle ← → Dramatic", with numeric readout
- **Guidance** slider (3–15), labeled "Creative ← → Faithful", with numeric readout
- **Dimensions** button group: 512×512 / 768×768 / 1024×1024
- **Variants** toggle: 1 or 2 results

---

**Section 4 — Test With a Photo**

**State preservation rule:** If the user clicks "Run Test" with no credentials, open the Settings modal as an overlay — **do not navigate away**. When the modal is closed, the user is exactly where they were with photo and settings intact.

```
┌──────────────────────────────────────────────────┐
│ Upload a photo to test your filter               │
│                                                  │
│     [Drag & drop, click, or paste a photo]      │
│                                                  │
│ [Run Test ▶]   (enabled once prompt + model set)│
└──────────────────────────────────────────────────┘
```

**Loading state during transform (15–40 seconds typical):**

| Time | What the user sees |
|---|---|
| 0–1s | "Run Test" button changes to spinner + "Starting…" |
| 1s+ | Animated progress bar (indeterminate) + "Transforms usually take 15–30 seconds…" |
| 45s | Message updates to "Still working — complex transforms can take up to a minute…" |
| 90s | Shows: "This is taking longer than usual." + **[Cancel]** button + **[Keep waiting]** button |
| 120s | Auto-cancel: "The transform timed out. Check your connection and try again." + **[Retry]** button |

**Cancel behavior:** Uses `AbortController` to cancel the fetch. The photo and all settings remain exactly as they were. The user can adjust the prompt or parameters and retry immediately.

**No credentials state:**
```
┌──────────────────────────────────────────────────┐
│ ⚠️  You need a Cloudflare API key to run tests  │
│     (Demo mode doesn't support the builder)     │
│                     [Add your key — 2 minutes →]│
└──────────────────────────────────────────────────┘
```
"Add your key" opens the S0 setup wizard as a **modal overlay** — the build page stays loaded underneath.

**After successful test:**
- Before/after side-by-side comparison with a drag handle
- "Adjust and rerun" — change sliders/prompt, click Run Test again
- Section 4 marked complete → Section 6 (Share) becomes active

---

**Section 5 — Name and Describe**
- Filter name (max 40 chars, required to share)
- Short description (max 120 chars)
- Category picker (15 categories matching the filter catalog)
- Tags input (comma-separated, max 8 tags)

---

**Section 6 — Share Your Filter**

Grayed out with message "Run a test first to generate a shareable result" until Section 4 has been successfully run at least once.

Once active:
- "Share Filter" button → generates: `photofilters.gic.mx/try.html?custom={base64_encoded_filter_json}`
- Copy link button
- Native Share button (`navigator.share()` where supported)
- QR code (generated client-side)
- Note: "Anyone with this link can use your filter — they'll need their own Cloudflare key or can use demo mode."
- Future: `POST /api/filters/publish` for server-stored filters (Phase L)

---

#### S5.2 — Add Build Nav Item

In `site.mjs renderHeader()`, add "Build" to the primary nav between "Browse" and "About".

#### S5.3 — URL-Based Custom Filter Sharing

Support `try.html?custom={base64_encoded_filter_json}` that loads a custom filter definition directly into the try page. The JSON payload:

```json
{
  "name": "My Filter",
  "prompt": "Transform into a watercolor painting...",
  "negativePrompt": "blurry, low quality",
  "model": "flux2-klein-9b",
  "strength": 0.75,
  "guidance": 7.5,
  "width": 768,
  "height": 768
}
```

No server-side storage needed for v1 — the entire filter definition lives in the URL.

---

### iOS App: Filter Builder Tab

#### S5.4 — Add "Build" Tab

Add a third tab to `ContentView.swift`'s `TabView` (between Gallery and Settings):
- Tab icon: `wand.and.stars`
- Tab label: "Build"

#### S5.5 — Create `FilterBuilderView.swift`

A `ScrollView` with the same 6-section layout as the website, using the card-based style from S2. All sections visible at once (scrollable, not wizard).

1. **Prompt card** — `TextEditor` for prompt + collapsible negative prompt, character counters
2. **Model card** — Same picker as S2.3, displayed as a segmented control or button grid
3. **Parameters card** — Sliders for strength, guidance; segmented control for dimensions
4. **Test card**:
   - Photo picker button + image preview
   - "Run Test" button (enabled once prompt + model are set)
   - **Loading state** (mirrors website):
     - Immediately: button disabled, spinner shown
     - After 1s: `ProgressView(style: .linear)` + "Usually takes 15–30 seconds…"
     - After 45s: "Still working…"
     - After 90s: Alert with Cancel / Keep Waiting options
     - After 120s: Auto-cancel with retry prompt
   - **No credentials**: show inline banner + "Set up Cloudflare" button that opens the S0 wizard as a `.sheet()` — the builder view stays in memory, photo and all settings preserved
   - Before/after comparison with `GeometryReader` + drag gesture after successful test
5. **Details card** — Name, description, category picker (`Picker`), tags
6. **Share card** — Disabled until at least one test has succeeded; shows share sheet with deep link URL and web URL

#### S5.6 — Create `FilterPublisherService.swift`

Service that:
- Encodes the custom filter definition as JSON → base64
- Generates a `gicphotofilters://build?filter={base64}` deep link for in-app sharing
- Generates a web URL: `photofilters.gic.mx/try.html?custom={base64}`
- Future: calls `POST /api/filters/publish` when the server endpoint exists

---

## S6 — Before/After Sample Photos: AI-Generated Portrait

### Problem

Every filter card on the site and in the app shows zero visual content. We need before/after examples for filters without spending the full neuron budget at once.

### Strategy

Generate **1 base portrait** (`portrait_a`). Use it to generate **1 before/after pair per filter**, starting with the 20 most popular/featured filters, then generating the remaining 185 over time using the free daily allotment (~200 neurons/run, leaving headroom for demos).

### Tasks

#### S6.1 — Generate 1 Base Portrait Image

Use the installed Gemini CLI to generate **one clearly fictional AI portrait image** to use as the base "before" photo for all filter previews.

| ID | Description | Pose / Framing |
|---|---|---|
| `portrait_a` | Young adult, warm brown skin, short natural hair, neutral expression | Forward-facing, shoulders up, clean grey studio background |

**Specs:** 1024×1024, JPEG, clearly AI-generated/fictional.
**Output:** `docs/assets/sample-photos/portrait_a.jpg`

#### S6.2 — Create a Resumable Before/After Generation Script

Create `scripts/generate-previews.js` that:

1. Reads `docs/filters-index.json` for all 205 filter definitions
2. Accepts a `--batch` flag: `node generate-previews.js --batch 20` to limit the run to N filters
3. For each filter (starting with the `featured: true` ones first, then alphabetical):
   - Calls `POST https://photofilters.gic.mx/api/transform` with:
     - Headers: `X-CF-Account-ID` and `X-CF-API-Token` from env vars (`CF_ACCOUNT_ID`, `CF_API_TOKEN`)
     - Body: `portrait_a.jpg` resized to 512×512, plus the filter's prompt/model/strength/guidance
   - Saves result as `docs/assets/filter-previews/{filter_slug}_after.webp` (400×400, WebP quality 80)
   - Copies the resized input as `{filter_slug}_before.webp`
4. For client-side canvas effects: applies the effect using Node.js `canvas` and saves — no API call needed
5. **Resumable:** skips filters that already have both `_before.webp` and `_after.webp`
6. **Rate limiting:** 2-second delay between API calls; stops if it receives a 429
7. **Daily budget:** stops after 150 API calls per run (leaves buffer for demo traffic)
8. Progress log: `[12/205] grinch-ify ✓  |  [13/205] santa-claus … timed out, skipping`

**Run daily** (manual or cron) until all 205 filters have previews.

#### S6.3 — Wire Preview Images to Filter Cards

**Website:** In `site.mjs`, update `renderFilterCard()` to show `previewImages[0].after` as the card thumbnail, with hover-swap to `previewImages[0].before`. If no preview exists, show a gradient placeholder with the filter's category color.

**App:** In `FilterDetailView.swift`, use `AsyncImage` to load the after-image thumbnail. In the detail view, show a swipeable before/after comparison.

---

## Dependency Graph

```
S0 (Setup Wizard) ──► S4 (BYOK Settings) ──► S5 (Custom Builder)
                             │
S1 (Entitlements) ──► S2 (Settings Redesign) ──► S3 (Error Messages + Previews)
                                                        │
S6 (Portrait + Script) ─────────────────────────► S3 (needs photos for previews)
                                                   S5 (portrait available for builder testing)
```

**Recommended execution order:**

| Order | Stream | Effort | Blocks |
|---|---|---|---|
| 1 | S1 — Entitlements fix | 30 min | Everything in the iOS app |
| 2 | S0 — Setup wizard (website + app) | 1 day | S4 and S5 usability |
| 3 | S2 — Card-based Settings + `/api/health` endpoint | 1 day | S3 previews need settings working |
| 4 | S4 — Website BYOK Settings + proxy security update | 1 day | S5 builder needs credentials |
| 5 | S6 — Generate portrait + preview script (first 20 filters) | 0.5 day | S3 and S5 testing |
| 6 | S3 — Error messages + before/after previews | 1 day | — |
| 7 | S5 — Custom Filter Builder | 3 days | — |

**Total estimated effort: ~8 days**

---

## What's Already Done (No Work Needed)

- ✅ Static site: homepage, browse, try, 15 category pages, about, contact, privacy, terms
- ✅ `filters-index.json` with 205 filters live at `photofilters.gic.mx/docs/filters-index.json`
- ✅ 5 Cloudflare Functions: transform, upload, status, usage, image serving
- ✅ `assets/effects.js` — 16 client-side Canvas effects
- ✅ iOS app: gallery, filter detail, transform composer, result view, keychain, deep links
- ✅ GA4, Schema.org, OG/Twitter tags
- ✅ Domain fix: `photofilters.gic.mx` (was `gicPhotoFilters.gic.mx`) — corrected in all static files
- ✅ Basic BYOK accordion on try page (Account ID + API Token fields)
- ✅ Dark mode, responsive layout, loading skeletons
- ✅ Live BYOK web transform flow

## What's Deferred to After This Sprint

- Phase L from PRD.md — Server-side custom filter publishing (`POST /api/filters/publish`)
- Phase M — App filter builder (full server-integrated version)
- Phase N — Sticker packs & text overlays
- Phase J — App Store metadata & screenshots
- Phase K — Cross-promotion with other GIC sites
- Phase O — Final launch QA checklist
- S6 remaining portraits (portraits b–f) and multi-portrait per filter — generate over time as needed
# SUPERSEDED — execution moved to [TODO_PRODUCT_V1_FOCUSED.md](TODO_PRODUCT_V1_FOCUSED.md).
