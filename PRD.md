# PRD — gicPhotoFilters.gic.mx

**Product:** AI Photo Filters & Transformations Showcase Site  
**Domain:** `gicPhotoFilters.gic.mx`  
**Repository:** `gicPhotoFilters` (Cloudflare Pages, same pattern as `forms` and `onePageApps`)  
**Companion App:** `gicPhotoFiltersApp` (iOS/macOS SwiftUI app)  
**Date:** March 11, 2026  

---

## 1. Executive Summary

Build a static site at `gicPhotoFilters.gic.mx` that showcases, lets users try, and distributes **200+ AI-powered photo transformation "mini-apps"** (fun filters, serious tools, seasonal themes). Each mini-app is a single-purpose Cloudflare Worker that takes a user's photo + a baked-in prompt and returns a transformed image via **Cloudflare Workers AI** (FLUX, Stable Diffusion img2img, inpainting) or external providers (Replicate/fal.ai via AI Gateway).

The site replicates the proven architecture of `forms.gic.mx` and `onePageApps.gic.mx`:

- **`gicPhotoFilters` repo** hosts the filter definitions (prompt manifests, worker scripts, help docs) organized by category folders.
- **Cloudflare Pages** serves the static site: homepage, browse page, live-try page, category SEO pages.
- **`filters-index.json`** is the central manifest the site reads (and the iOS app downloads).
- **`gicPhotoFiltersApp`** (iOS/macOS) fetches `filters-index.json` from the site to sync its filter gallery, exactly as `gicFormsForCloudflare` does with `forms-index.json`.

**Key differentiator:** Users upload a photo and get transformed results **in-browser** — no app install, no API key needed for demo filters. The site provides GIC's own API key for a curated set of "demo" and "seasonal" filters, while the app lets users bring their own keys for unlimited use.

---

## 2. Architecture Comparison: forms.gic.mx → gicPhotoFilters.gic.mx

| Aspect | forms.gic.mx | onePageApps.gic.mx | gicPhotoFilters.gic.mx |
|---|---|---|---|
| **Content unit** | YAML form + .xlsx + .help.md | .js worker + _help.md | filter manifest (.json) + .js worker + _help.md |
| **Content count** | 84,298 forms | 200 apps | 200+ filters (growing) |
| **Categories** | 418 (folder-based) | 17 (folder-based) | 15 (folder-based) |
| **Index file** | `forms-index.json` | `apps-index.json` | `filters-index.json` |
| **Browse page** | search, filter by category | search, filter by category/AI | search, filter by category/model/occasion |
| **Preview page** | renders YAML form | live demo iframe | **live photo upload + transform** |
| **Companion app** | `gicFormsForCloudflare` | `oneTimeUseWebApp` | `gicPhotoFiltersApp` |
| **Hosting** | GitHub Pages | GitHub Pages | **Cloudflare Pages** (needs Workers for AI) |
| **Backend** | None (static only) | None (static only) | **Cloudflare Worker** (AI inference endpoint) |
| **Design system** | Tailwind CDN, orange `#ec5b13` | Same | Same design system, camera/photo accent |

### Why Cloudflare Pages instead of GitHub Pages

Unlike forms and onePageApps (100% static), this project needs a **backend Worker** to call Workers AI models. Cloudflare Pages + Functions is the natural fit:

- Pages serves the static site (HTML, JS, CSS)
- Pages Functions (Workers under the hood) handle `/api/transform` endpoints
- Workers AI binding (`[ai]`) is natively available
- R2 binding for temporary image storage
- Same custom domain setup via Cloudflare DNS

---

## 3. Core Concept: Photo Filter Mini-Apps

Each "filter" is a **predefined transformation recipe** with:

1. **A baked-in prompt** (the creative direction — users never write prompts)
2. **A model selection** (which Workers AI or external model to use)
3. **Parameters** (strength, guidance, dimensions, mask strategy)
4. **A fun name and description** (e.g., "Grinch-ify", "Retro Yearbook '84", "Remove Background")

### Filter Types

| Type | Description | Model | Example |
|---|---|---|---|
| **img2img** | Transform the whole photo with a style prompt | FLUX.2 klein, SD v1.5 img2img | "Turn into Grinch", "Anime Portrait" |
| **inpainting** | Mask + replace specific regions | SD v1.5 Inpainting | "Add Santa Hat", "Change Background" |
| **style-transfer** | Apply artistic style while preserving content | FLUX.1 schnell, SDXL | "Pop Art", "Oil Painting", "Pixel Art" |
| **utility** | Practical photo tools | Workers AI or client-side | "Remove Background", "Upscale 2x", "Colorize B&W" |
| **overlay** | Client-side face detection + overlay (no AI cost) | MediaPipe + Canvas | "Santa Hat", "Sunglasses", "Party Hat" |

---

## 4. The 200 Filters — Full Catalog by Category

### 4.1 🎄 Holiday & Seasonal (25 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 1 | Grinch-ify | "Transform this person into a green furry Grinch character" | img2img | FLUX.2 klein |
| 2 | Santa Claus | "Transform this person into Santa Claus with white beard, red suit, and hat" | img2img | FLUX.2 klein |
| 3 | Mrs. Claus | "Transform into Mrs. Claus with spectacles, white hair, red dress" | img2img | FLUX.2 klein |
| 4 | Elf Workshop | "Transform into a cheerful Christmas elf with pointy ears and green outfit" | img2img | SD v1.5 img2img |
| 5 | Snowman Buddy | "Place person next to a photorealistic snowman in a winter wonderland" | inpainting | SD v1.5 Inpainting |
| 6 | Ugly Christmas Sweater | "Dress this person in the most garish ugly Christmas sweater" | img2img | FLUX.2 klein |
| 7 | Halloween Zombie | "Transform into a realistic zombie with torn clothes and pale skin" | img2img | FLUX.2 klein |
| 8 | Vampire Portrait | "Transform into an elegant vampire with fangs and dark cape" | img2img | SD v1.5 img2img |
| 9 | Witch/Wizard | "Transform into a magical witch/wizard with hat and glowing wand" | img2img | FLUX.2 klein |
| 10 | Day of the Dead | "Apply traditional Día de los Muertos face paint with marigold crown" | img2img | FLUX.2 klein |
| 11 | Easter Bunny | "Transform into the Easter Bunny with fluffy ears and pastel outfit" | img2img | SD v1.5 img2img |
| 12 | Cupid Valentine | "Transform into Cupid with wings, bow and arrow, pink theme" | img2img | FLUX.2 klein |
| 13 | Thanksgiving Pilgrim | "Dress as a classic Thanksgiving pilgrim with buckle hat" | img2img | SD v1.5 img2img |
| 14 | New Year Glam | "Add sparkly New Year's Eve outfit with confetti and champagne" | img2img | FLUX.2 klein |
| 15 | Fourth of July | "Patriotic transformation with stars, stripes, and fireworks backdrop" | img2img | SD v1.5 img2img |
| 16 | Chinese New Year Dragon | "Traditional Chinese New Year costume with dragon motifs" | img2img | FLUX.2 klein |
| 17 | Holi Festival Colors | "Cover person in vibrant Holi festival powder colors" | img2img | FLUX.2 klein |
| 18 | St. Patrick's Leprechaun | "Transform into a leprechaun with green suit and pot of gold" | img2img | SD v1.5 img2img |
| 19 | Mardi Gras Mask | "Add an ornate Mardi Gras mask with feathers and beads" | inpainting | SD v1.5 Inpainting |
| 20 | Spring Flower Crown | "Add a beautiful fresh flower crown and spring garden background" | inpainting | SD v1.5 Inpainting |
| 21 | Summer Beach Vibes | "Transform into a beach scene with tropical shirt and sunset" | img2img | FLUX.2 klein |
| 22 | Autumn Harvest | "Place in an autumn harvest scene with pumpkins and falling leaves" | img2img | SD v1.5 img2img |
| 23 | Winter Wonderland | "Transform into a magical winter scene with snow and ice" | img2img | FLUX.2 klein |
| 24 | Carnival Costume | "Elaborate carnival costume with feathers and sequins" | img2img | FLUX.2 klein |
| 25 | Diwali Festival | "Add Diwali festive attire with diyas and rangoli background" | img2img | FLUX.2 klein |

### 4.2 🎬 Pop Culture & Characters (25 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 26 | Superhero | "Transform into a superhero with cape and mask, comic book style" | img2img | FLUX.2 klein |
| 27 | Space Astronaut | "Person in a realistic NASA spacesuit with visor, space background" | img2img | FLUX.2 klein |
| 28 | Medieval Knight | "Transform into a medieval knight in shining armor" | img2img | SD v1.5 img2img |
| 29 | Pirate Captain | "Transform into a pirate captain with tricorn hat and eyepatch" | img2img | FLUX.2 klein |
| 30 | Cowboy/Cowgirl | "Wild West cowboy with hat, boots, and desert backdrop" | img2img | SD v1.5 img2img |
| 31 | Ninja Warrior | "Transform into a stealthy ninja with mask and dark outfit" | img2img | FLUX.2 klein |
| 32 | Viking Warrior | "Transform into a fierce Viking with braided hair and fur armor" | img2img | FLUX.2 klein |
| 33 | Egyptian Pharaoh | "Transform into an Egyptian pharaoh with golden headdress" | img2img | SD v1.5 img2img |
| 34 | Roman Gladiator | "Transform into a Roman gladiator in the Colosseum" | img2img | FLUX.2 klein |
| 35 | Samurai | "Transform into a samurai warrior with traditional armor and katana" | img2img | FLUX.2 klein |
| 36 | Steampunk Explorer | "Steampunk style with brass goggles, gears, and Victorian attire" | img2img | FLUX.2 klein |
| 37 | Cyberpunk Runner | "Cyberpunk aesthetic with neon lights, augmented reality implants" | img2img | FLUX.2 klein |
| 38 | Wizard of Oz | "Transform into a character from Oz with emerald city backdrop" | img2img | SD v1.5 img2img |
| 39 | Fairy Tale Princess/Prince | "Royal fairy tale attire with enchanted castle background" | img2img | FLUX.2 klein |
| 40 | Rock Star | "Transform into a rock star with leather jacket, guitar, stage lights" | img2img | FLUX.2 klein |
| 41 | Hip Hop Artist | "Transform with gold chains, snapback, graffiti backdrop" | img2img | SD v1.5 img2img |
| 42 | Disco Dancer | "1970s disco outfit with afro, sequins, dance floor" | img2img | FLUX.2 klein |
| 43 | Mad Scientist | "Lab coat, wild hair, bubbling beakers, lightning backdrop" | img2img | SD v1.5 img2img |
| 44 | Secret Agent | "Sleek black suit, dark sunglasses, spy gadgets" | img2img | FLUX.2 klein |
| 45 | Time Traveler | "Mix of clothing from different eras, time portal background" | img2img | FLUX.2 klein |
| 46 | Robot/Android | "Half-human half-robot transformation with metallic features" | img2img | FLUX.2 klein |
| 47 | Mermaid/Merman | "Underwater transformation with scales and ocean backdrop" | img2img | FLUX.2 klein |
| 48 | Dragon Rider | "Sitting atop a majestic dragon with fantasy landscape" | img2img | FLUX.2 klein |
| 49 | Jedi Knight | "Galactic warrior with hooded robe and glowing light blade" | img2img | FLUX.2 klein |
| 50 | Explorer/Archaeologist | "Indiana Jones-style adventurer with hat, whip, and ancient ruins" | img2img | SD v1.5 img2img |

### 4.3 🎨 Artistic Styles (25 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 51 | Oil Painting | "Classical oil painting style, rich colors, visible brushstrokes" | style-transfer | FLUX.2 klein |
| 52 | Watercolor | "Delicate watercolor painting with soft edges and flowing colors" | style-transfer | FLUX.2 klein |
| 53 | Pop Art (Warhol) | "Andy Warhol style pop art with bold colors and halftone dots" | style-transfer | FLUX.2 klein |
| 54 | Pencil Sketch | "Detailed pencil sketch with cross-hatching and shading" | style-transfer | SD v1.5 img2img |
| 55 | Charcoal Drawing | "Dramatic charcoal drawing with deep shadows and texture" | style-transfer | SD v1.5 img2img |
| 56 | Anime Portrait | "Japanese anime style with large eyes and colorful hair" | style-transfer | FLUX.2 klein |
| 57 | Manga Panel | "Black and white manga panel with speed lines and dramatic pose" | style-transfer | SD v1.5 img2img |
| 58 | Pixar/3D Cartoon | "Pixar-style 3D rendered character with exaggerated features" | style-transfer | FLUX.2 klein |
| 59 | Simpsons Character | "Yellow-skinned cartoon character in Simpsons animation style" | style-transfer | FLUX.2 klein |
| 60 | Studio Ghibli | "Studio Ghibli anime style with soft colors and magical atmosphere" | style-transfer | FLUX.2 klein |
| 61 | Comic Book | "Bold comic book style with thick outlines and Ben-Day dots" | style-transfer | FLUX.2 klein |
| 62 | Pixel Art 8-Bit | "Retro 8-bit pixel art sprite with limited color palette" | style-transfer | SD v1.5 img2img |
| 63 | Pixel Art 16-Bit | "16-bit SNES era pixel art with richer colors" | style-transfer | SD v1.5 img2img |
| 64 | Impressionist | "Monet-style impressionist painting with light dappled colors" | style-transfer | FLUX.2 klein |
| 65 | Cubist (Picasso) | "Cubist portrait in the style of Picasso with geometric shapes" | style-transfer | FLUX.2 klein |
| 66 | Art Nouveau | "Art Nouveau style with organic flowing lines and floral motifs" | style-transfer | FLUX.2 klein |
| 67 | Stained Glass | "Transform into a stained glass window artwork" | style-transfer | SD v1.5 img2img |
| 68 | Mosaic Tile | "Ancient Roman mosaic tile artwork made of small colored squares" | style-transfer | SD v1.5 img2img |
| 69 | Graffiti/Street Art | "Urban graffiti street art style with spray paint and bold colors" | style-transfer | FLUX.2 klein |
| 70 | Ukiyo-e Japanese | "Traditional Japanese Ukiyo-e woodblock print style" | style-transfer | FLUX.2 klein |
| 71 | Art Deco | "1920s Art Deco style with geometric shapes and gold accents" | style-transfer | FLUX.2 klein |
| 72 | Surrealist (Dalí) | "Surrealist landscape with melting clocks and dreamlike quality" | style-transfer | FLUX.2 klein |
| 73 | Minimalist Line Art | "Single continuous line drawing portrait, minimalist" | style-transfer | SD v1.5 img2img |
| 74 | Gothic Dark Art | "Dark gothic art style with dramatic lighting and ornate details" | style-transfer | FLUX.2 klein |
| 75 | Caricature | "Exaggerated caricature with humorous feature distortions" | style-transfer | FLUX.2 klein |

### 4.4 📷 Retro & Vintage (20 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 76 | Retro Yearbook '84 | "1984 school yearbook photo with soft focus and pastel backdrop" | img2img | FLUX.2 klein |
| 77 | Retro Yearbook '90s | "1990s yearbook with laser background and big hair" | img2img | FLUX.2 klein |
| 78 | VHS Glitch | "VHS tape distortion with scanlines, chroma bleed, tracking errors" | style-transfer | client-side |
| 79 | Polaroid Vintage | "Instant Polaroid photo with white border, faded warm tones" | style-transfer | client-side |
| 80 | 1920s Great Gatsby | "1920s flapper/gentleman style with sepia tones and art deco" | img2img | FLUX.2 klein |
| 81 | 1950s Pin-Up | "Classic 1950s pin-up style with vintage colors and pose" | img2img | SD v1.5 img2img |
| 82 | 1960s Psychedelic | "Psychedelic 1960s poster with swirling colors and peace signs" | style-transfer | FLUX.2 klein |
| 83 | 1970s Film Grain | "Warm 70s film photography with heavy grain and muted colors" | style-transfer | client-side |
| 84 | 1980s Neon | "80s synthwave aesthetic with neon grid, palm trees, sunset" | img2img | FLUX.2 klein |
| 85 | Daguerreotype | "Early 1840s daguerreotype photograph, silver-toned, formal pose" | style-transfer | SD v1.5 img2img |
| 86 | Civil War Tintype | "1860s tintype photograph, sepia, stoic expression" | style-transfer | SD v1.5 img2img |
| 87 | Victorian Portrait | "Formal Victorian-era studio portrait with ornate frame" | img2img | FLUX.2 klein |
| 88 | Roaring Twenties | "1920s speakeasy vibe with jazz-age fashion and atmosphere" | img2img | FLUX.2 klein |
| 89 | Old Hollywood | "Classic Old Hollywood glamour shot, black and white, dramatic lighting" | style-transfer | FLUX.2 klein |
| 90 | Wartime 1940s | "1940s wartime portrait with military or home-front attire" | img2img | SD v1.5 img2img |
| 91 | Woodstock '69 | "1969 Woodstock festival hippie with tie-dye and flowers" | img2img | FLUX.2 klein |
| 92 | Disco Fever '77 | "1977 disco era with bell-bottoms, platform shoes, mirror ball" | img2img | SD v1.5 img2img |
| 93 | MTV Era '85 | "1985 MTV music video style with bold makeup and fashion" | img2img | FLUX.2 klein |
| 94 | Grunge '93 | "1993 Seattle grunge with flannel, ripped jeans, moody lighting" | img2img | SD v1.5 img2img |
| 95 | Y2K Aesthetic | "Year 2000 aesthetic with butterfly clips, low-rise jeans, frosted tips" | img2img | FLUX.2 klein |

### 4.5 👨‍👩‍👧‍👦 Life Events & Milestones (20 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 96 | Wedding Day | "Transform into elegant wedding attire with romantic backdrop" | img2img | FLUX.2 klein |
| 97 | Graduation | "Academic cap and gown with confetti and diploma" | img2img | FLUX.2 klein |
| 98 | Baby Announcement | "Cute baby announcement card style with stork and pastels" | img2img | SD v1.5 img2img |
| 99 | Quinceañera | "Traditional quinceañera dress with tiara and ballroom" | img2img | FLUX.2 klein |
| 100 | Birthday Celebration | "Party hat, balloons, confetti, birthday cake background" | inpainting | SD v1.5 Inpainting |
| 101 | Retirement Party | "Gold watch, "Happy Retirement" banner, champagne toast" | img2img | SD v1.5 img2img |
| 102 | First Day of School | "Backpack, lunchbox, school bus background, "First Day" sign" | inpainting | SD v1.5 Inpainting |
| 103 | Prom Night | "Glamorous prom outfit with corsage and ballroom" | img2img | FLUX.2 klein |
| 104 | Sweet 16 | "Sweet 16 party style with sparkles and "16" decorations" | img2img | SD v1.5 img2img |
| 105 | Engagement | "Romantic engagement scene with ring and flowers" | img2img | FLUX.2 klein |
| 106 | Baby Shower | "Pastel baby shower theme with decorations and gifts" | img2img | SD v1.5 img2img |
| 107 | Mother's Day | "Beautiful floral Mother's Day portrait with warm colors" | img2img | FLUX.2 klein |
| 108 | Father's Day | "Classic Father's Day portrait with "World's Best Dad" theme" | img2img | SD v1.5 img2img |
| 109 | Anniversary (25th Silver) | "Silver anniversary celebration with elegant silver tones" | img2img | FLUX.2 klein |
| 110 | Anniversary (50th Gold) | "Golden anniversary with gold tones and "50 Years" motif" | img2img | FLUX.2 klein |
| 111 | Gender Reveal | "Gender reveal party with pink/blue smoke and excitement" | img2img | SD v1.5 img2img |
| 112 | Welcome Home | "Military homecoming or "Welcome Home" banner with balloons" | inpainting | SD v1.5 Inpainting |
| 113 | New Job Celebration | "Business attire with "Hired!" badge and office backdrop" | img2img | SD v1.5 img2img |
| 114 | Baptism/Christening | "White baptismal attire with church and dove backdrop" | img2img | FLUX.2 klein |
| 115 | Family Reunion | "Large family gathering scene with "Family Reunion" banner" | img2img | SD v1.5 img2img |

### 4.6 🐾 Pets & Animals (15 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 116 | Pet to Pixar | "Transform pet photo into Pixar 3D animated character" | style-transfer | FLUX.2 klein |
| 117 | Pet Royal Portrait | "Pet in royal Renaissance painting attire with crown" | img2img | FLUX.2 klein |
| 118 | Pet Superhero | "Pet wearing a superhero cape and mask" | img2img | SD v1.5 img2img |
| 119 | Pet in Space | "Pet as an astronaut floating in space" | img2img | FLUX.2 klein |
| 120 | Pet Christmas Card | "Pet with Santa hat and holiday card border" | inpainting | SD v1.5 Inpainting |
| 121 | Pet Anime | "Pet in Japanese anime style with sparkly eyes" | style-transfer | FLUX.2 klein |
| 122 | Pet Pop Art | "Pet in Andy Warhol pop art style, 4-color grid" | style-transfer | FLUX.2 klein |
| 123 | Pet Sticker | "Turn pet photo into a cute vinyl sticker with white border" | style-transfer | SD v1.5 img2img |
| 124 | Pet Oil Painting | "Pet as a classical oil painting in ornate gold frame" | style-transfer | FLUX.2 klein |
| 125 | Pet Birthday | "Pet with party hat, treats, and "Happy Birthday" banner" | inpainting | SD v1.5 Inpainting |
| 126 | Pet Halloween | "Pet in Halloween costume (vampire, pumpkin, ghost)" | img2img | SD v1.5 img2img |
| 127 | Pet Valentine | "Pet with heart-shaped sunglasses and "Be Mine" theme" | inpainting | SD v1.5 Inpainting |
| 128 | Pet Western | "Pet as a cowboy/cowgirl with hat and bandana" | img2img | SD v1.5 img2img |
| 129 | Pet Wizard | "Pet in wizard hat and robe with magic sparkles" | img2img | SD v1.5 img2img |
| 130 | Pet Graduation | "Pet in graduation cap and gown with diploma" | inpainting | SD v1.5 Inpainting |

### 4.7 💼 Professional & Business (15 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 131 | Professional Headshot | "Studio-quality professional headshot with neutral background" | img2img | FLUX.2 klein |
| 132 | LinkedIn Photo | "Polished LinkedIn profile photo with soft professional lighting" | img2img | FLUX.2 klein |
| 133 | Corporate Portrait | "Corporate portrait with suit/blazer and office bokeh background" | img2img | FLUX.2 klein |
| 134 | Author Photo | "Book jacket author photo with dramatic moody lighting" | img2img | FLUX.2 klein |
| 135 | Speaker/Keynote | "Conference speaker on stage with spotlight and audience" | img2img | SD v1.5 img2img |
| 136 | Chef Portrait | "Professional chef portrait with white chef coat and kitchen" | img2img | SD v1.5 img2img |
| 137 | Artist Portrait | "Creative artist portrait with paint splashes and studio" | img2img | FLUX.2 klein |
| 138 | Musician Portrait | "Musician portrait with instrument and moody stage lighting" | img2img | FLUX.2 klein |
| 139 | Athlete Portrait | "Sports athlete portrait with dynamic pose and stadium" | img2img | SD v1.5 img2img |
| 140 | Doctor/Nurse | "Medical professional portrait with white coat and stethoscope" | img2img | SD v1.5 img2img |
| 141 | Teacher Portrait | "Warm teacher portrait with classroom and chalkboard backdrop" | img2img | SD v1.5 img2img |
| 142 | Real Estate Agent | "Professional real estate agent with luxury home backdrop" | img2img | SD v1.5 img2img |
| 143 | Fitness Coach | "Fitness coach portrait with gym/outdoor workout backdrop" | img2img | FLUX.2 klein |
| 144 | Tech Founder | "Silicon Valley tech founder with modern office backdrop" | img2img | FLUX.2 klein |
| 145 | Podcast Host | "Podcast host with microphone, headphones, studio setup" | img2img | SD v1.5 img2img |

### 4.8 🌍 Travel & Places (15 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 146 | Paris Eiffel Tower | "Standing in front of the Eiffel Tower in Paris" | inpainting | SD v1.5 Inpainting |
| 147 | Tokyo Neon Streets | "Walking through neon-lit Tokyo streets at night" | img2img | FLUX.2 klein |
| 148 | New York Times Square | "Standing in Times Square with billboards and crowds" | inpainting | SD v1.5 Inpainting |
| 149 | Tropical Beach | "Standing on a pristine tropical beach with turquoise water" | inpainting | SD v1.5 Inpainting |
| 150 | Northern Lights | "Standing under the Aurora Borealis in Iceland" | inpainting | SD v1.5 Inpainting |
| 151 | Safari Adventure | "On an African safari with elephants and sunset savanna" | img2img | FLUX.2 klein |
| 152 | Mountain Summit | "Standing on a mountain peak with clouds below" | inpainting | SD v1.5 Inpainting |
| 153 | Ancient Ruins | "Exploring ancient Greek or Mayan ruins" | inpainting | SD v1.5 Inpainting |
| 154 | Venice Gondola | "Riding a gondola in Venice with canal and buildings" | img2img | SD v1.5 img2img |
| 155 | Great Wall of China | "Walking along the Great Wall of China" | inpainting | SD v1.5 Inpainting |
| 156 | Machu Picchu | "Standing at Machu Picchu with mist and mountains" | inpainting | SD v1.5 Inpainting |
| 157 | Santorini Greece | "Standing on a Santorini balcony with blue domes and sea" | inpainting | SD v1.5 Inpainting |
| 158 | Cherry Blossom Japan | "Under cherry blossom trees in Japan during spring" | inpainting | SD v1.5 Inpainting |
| 159 | Pyramids of Giza | "Standing before the Great Pyramids of Egypt" | inpainting | SD v1.5 Inpainting |
| 160 | Amazon Rainforest | "Exploring the lush Amazon rainforest" | inpainting | SD v1.5 Inpainting |

### 4.9 🛠️ Utility & Serious Tools (20 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 161 | Remove Background | "Remove background, output transparent PNG" | utility | Workers AI / client-side |
| 162 | Upscale 2x | "Enhance resolution 2x with AI upscaling" | utility | Workers AI |
| 163 | Upscale 4x | "Enhance resolution 4x with AI super-resolution" | utility | Workers AI |
| 164 | Colorize B&W | "Colorize a black and white photograph naturally" | utility | Workers AI |
| 165 | Restore Old Photo | "Restore and enhance damaged/faded old photograph" | utility | Workers AI |
| 166 | Denoise Photo | "Remove noise and grain from low-light photo" | utility | Workers AI |
| 167 | Sharpen & Enhance | "Sharpen blurry photo and enhance details" | utility | Workers AI |
| 168 | Face Retouch | "Subtle skin smoothing and blemish removal" | utility | Workers AI |
| 169 | Red Eye Fix | "Remove red-eye effect from flash photography" | utility | client-side |
| 170 | Auto Color Correct | "Automatic color balance and exposure correction" | utility | client-side |
| 171 | HDR Effect | "Apply HDR-like tone mapping for dramatic range" | utility | client-side |
| 172 | Blur Background (Bokeh) | "Apply professional depth-of-field blur to background" | utility | Workers AI |
| 173 | Change Background Color | "Replace background with a solid color of choice" | utility | Workers AI |
| 174 | Passport Photo | "Crop and format to passport photo specifications" | utility | client-side |
| 175 | ID Photo | "Format for official ID/visa photo requirements" | utility | client-side |
| 176 | Social Media Resize | "Smart crop and resize for Instagram/Twitter/LinkedIn" | utility | client-side |
| 177 | Watermark Remover | "AI-powered watermark removal" | utility | Workers AI |
| 178 | Object Removal | "Select and remove unwanted objects from photo" | inpainting | SD v1.5 Inpainting |
| 179 | Face Swap (2 photos) | "Swap faces between two uploaded photos" | utility | Workers AI |
| 180 | Age Progression | "Show how person might look 20-30 years older" | img2img | FLUX.2 klein |

### 4.10 🎉 Fun & Meme (15 filters)

| # | Filter Name | Prompt/Description | Type | Model |
|---|---|---|---|---|
| 181 | Bobblehead | "Exaggerated big head on tiny body, bobblehead style" | style-transfer | FLUX.2 klein |
| 182 | Action Figure | "Transform into an action figure in a toy box" | img2img | FLUX.2 klein |
| 183 | Magazine Cover | "Place on the cover of a glamorous magazine" | inpainting | SD v1.5 Inpainting |
| 184 | Wanted Poster | "Old West "WANTED" poster with vintage typography" | style-transfer | SD v1.5 img2img |
| 185 | Trading Card | "Sports or collectible trading card with stats" | style-transfer | SD v1.5 img2img |
| 186 | Money Bill Portrait | "Place face on a currency bill design" | style-transfer | SD v1.5 img2img |
| 187 | Stamp Portrait | "Transform into a postage stamp design" | style-transfer | SD v1.5 img2img |
| 188 | Lego Minifigure | "Transform into a Lego minifigure version" | style-transfer | FLUX.2 klein |
| 189 | Funko Pop | "Transform into a Funko Pop vinyl figure" | style-transfer | FLUX.2 klein |
| 190 | Renaissance Meme | "Classical Renaissance painting holding modern objects" | img2img | FLUX.2 klein |
| 191 | Alien/Extraterrestrial | "Transform into a friendly alien from another planet" | img2img | FLUX.2 klein |
| 192 | Underwater Portrait | "Floating underwater with bubbles and marine life" | img2img | FLUX.2 klein |
| 193 | Cloud Portrait | "Face formed in clouds in a blue sky" | style-transfer | FLUX.2 klein |
| 194 | Food Face | "Arcimboldo-style portrait made entirely of food" | style-transfer | FLUX.2 klein |
| 195 | Emoji Version | "Transform into a custom emoji/Memoji-style character" | style-transfer | FLUX.2 klein |

### 4.11 🌈 Effects & Filters (10 filters — client-side, no AI cost)

| # | Filter Name | Description | Type |
|---|---|---|---|
| 196 | Sepia Tone | Classic sepia/brown tone | overlay (Canvas) |
| 197 | Black & White | Desaturate to grayscale | overlay (Canvas) |
| 198 | Vignette | Dark edges, bright center | overlay (Canvas) |
| 199 | Duotone | Two-color gradient map | overlay (Canvas) |
| 200 | Glitch Art | Random pixel displacement and color channel shift | overlay (Canvas) |
| 201 | Mirror/Kaleidoscope | Symmetry mirror effect | overlay (Canvas) |
| 202 | Tilt Shift | Fake miniature effect with selective blur | overlay (Canvas) |
| 203 | Lomo/Lomography | Cross-processed colors with heavy vignette | overlay (Canvas) |
| 204 | Thermal/Infrared | False-color thermal camera look | overlay (Canvas) |
| 205 | Neon Glow | Edge-detected neon glow on dark background | overlay (Canvas) |

---

## 5. Category Summary

| # | Category | Slug | Count | Icon | AI Required |
|---|---|---|---|---|---|
| 1 | Holiday & Seasonal | `holiday_seasonal` | 25 | 🎄 `gift.fill` | Yes |
| 2 | Pop Culture & Characters | `pop_culture` | 25 | 🎬 `theatermasks.fill` | Yes |
| 3 | Artistic Styles | `artistic_styles` | 25 | 🎨 `paintbrush.fill` | Yes |
| 4 | Retro & Vintage | `retro_vintage` | 20 | 📷 `camera.vintage` | Mixed |
| 5 | Life Events & Milestones | `life_events` | 20 | 👨‍👩‍👧‍👦 `person.3.fill` | Yes |
| 6 | Pets & Animals | `pets_animals` | 15 | 🐾 `pawprint.fill` | Yes |
| 7 | Professional & Business | `professional` | 15 | 💼 `briefcase.fill` | Yes |
| 8 | Travel & Places | `travel_places` | 15 | 🌍 `globe.americas.fill` | Yes |
| 9 | Utility & Serious Tools | `utility_tools` | 20 | 🛠️ `wrench.and.screwdriver.fill` | Mixed |
| 10 | Fun & Meme | `fun_meme` | 15 | 🎉 `party.popper.fill` | Yes |
| 11 | Effects & Filters | `effects_filters` | 10 | 🌈 `sparkles` | No (client-side) |
| 12 | Social Media Templates | `social_media` | 5 | 📱 `apps.iphone` | Mixed |
| 13 | Food & Drink | `food_drink` | 5 | 🍕 `fork.knife` | Yes |
| 14 | Sports & Fitness | `sports_fitness` | 5 | ⚽ `sportscourt.fill` | Yes |
| 15 | Fantasy & Sci-Fi | `fantasy_scifi` | 5 | 🚀 `airplane` | Yes |
| | **Total** | | **205** | | |

---

## 6. `filters-index.json` Schema

The central manifest, analogous to `forms-index.json` and `apps-index.json`:

```json
{
  "generatedAt": "2026-03-11T12:00:00Z",
  "totalFilters": 205,
  "dailyFreeNeurons": 10000,
  "models": {
    "flux2-klein-9b": {
      "id": "@cf/black-forest-labs/flux-2-klein-9b",
      "name": "FLUX.2 Klein 9B",
      "neuronsPerRun": 150,
      "supportsImg2Img": true,
      "supportsInpainting": false
    },
    "sd15-img2img": {
      "id": "@cf/stabilityai/stable-diffusion-v1-5-img2img",
      "name": "Stable Diffusion v1.5 Img2Img",
      "neuronsPerRun": 100,
      "supportsImg2Img": true,
      "supportsInpainting": false
    },
    "sd15-inpainting": {
      "id": "@cf/stabilityai/stable-diffusion-v1-5-inpainting",
      "name": "Stable Diffusion v1.5 Inpainting",
      "neuronsPerRun": 120,
      "supportsImg2Img": false,
      "supportsInpainting": true
    },
    "client-side": {
      "id": "client-side",
      "name": "Browser (no AI)",
      "neuronsPerRun": 0,
      "supportsImg2Img": false,
      "supportsInpainting": false
    }
  },
  "filters": [
    {
      "id": "grinch_ify--holiday_seasonal",
      "name": "Grinch-ify",
      "slug": "grinch-ify",
      "category": "holiday_seasonal",
      "categoryDisplay": "Holiday & Seasonal",
      "description": "Transform yourself into the Grinch! Green fur, mischievous grin, and all.",
      "systemImage": "theatermasks.fill",
      "prompt": "Transform this person into a green furry Grinch character with green fur skin, mischievous grin, wearing a Santa hat, photorealistic, high detail, festive background",
      "negativePrompt": "blurry, low quality, deformed, extra limbs",
      "type": "img2img",
      "model": "flux2-klein-9b",
      "strength": 0.65,
      "guidance": 7.5,
      "outputWidth": 768,
      "outputHeight": 768,
      "variantCount": 2,
      "isDemoFilter": true,
      "isSeasonalHighlight": true,
      "seasonalMonths": [11, 12, 1],
      "requiresAI": true,
      "clientSideOnly": false,
      "estimatedNeurons": 150,
      "tags": ["christmas", "holiday", "fun", "grinch", "green"],
      "shareText": "I just Grinch-ified myself! 💚🎄 Try it free:",
      "helpPath": "holiday_seasonal/grinch_ify_help.md",
      "workerScriptName": "photo_transform",
      "scriptPath": "workers/photo_transform.js"
    }
  ]
}
```

### Key Schema Additions vs. apps-index.json

- **`prompt` / `negativePrompt`**: The baked-in creative prompt — users never see or edit this
- **`type`**: `img2img` | `inpainting` | `style-transfer` | `utility` | `overlay`
- **`model`**: Which Workers AI model to use
- **`strength` / `guidance`**: Model parameters per filter
- **`variantCount`**: How many variants to generate (1-4)
- **`isDemoFilter`**: Whether GIC provides its own API key for free demo use
- **`isSeasonalHighlight`**: Whether this filter is promoted during certain months
- **`seasonalMonths`**: Array of months (1-12) when this filter is highlighted
- **`estimatedNeurons`**: Estimated Neuron cost per run
- **`shareText`**: Pre-written share text for social media
- **`clientSideOnly`**: `true` for effects that run entirely in the browser

---

## 7. Repository Structure

```
gicPhotoFilters/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── request-a-filter.md
│   └── FUNDING.yml
├── docs/                                # Static site assets
│   ├── assets/
│   │   ├── social-preview.png
│   │   ├── sample-photos/              # Demo input photos for previews
│   │   └── filter-previews/            # Before/after thumbnails per filter
│   ├── filters-index.json              # Central manifest
│   ├── filters-index.json.gz           # Compressed for app download
│   └── last_updated.txt
├── workers/                            # Cloudflare Worker scripts
│   ├── photo_transform.js             # Main AI transform worker
│   ├── photo_transform_inpaint.js     # Inpainting variant
│   └── client_effects.js              # Client-side effects bundle
├── categories/                        # SEO category pages
│   ├── index.html
│   ├── holiday-seasonal.html
│   ├── pop-culture.html
│   ├── artistic-styles.html
│   ├── retro-vintage.html
│   ├── life-events.html
│   ├── pets-animals.html
│   ├── professional.html
│   ├── travel-places.html
│   ├── utility-tools.html
│   ├── fun-meme.html
│   ├── effects-filters.html
│   ├── social-media.html
│   ├── food-drink.html
│   ├── sports-fitness.html
│   └── fantasy-scifi.html
├── holiday_seasonal/                  # One folder per category
│   ├── meta.yaml
│   ├── grinch_ify.json               # Filter manifest
│   ├── grinch_ify_help.md
│   ├── santa_claus.json
│   ├── santa_claus_help.md
│   └── ...
├── pop_culture/
│   ├── meta.yaml
│   └── ...
├── artistic_styles/
│   └── ...
├── retro_vintage/
│   └── ...
├── life_events/
│   └── ...
├── pets_animals/
│   └── ...
├── professional/
│   └── ...
├── travel_places/
│   └── ...
├── utility_tools/
│   └── ...
├── fun_meme/
│   └── ...
├── effects_filters/
│   └── ...
├── social_media/
│   └── ...
├── food_drink/
│   └── ...
├── sports_fitness/
│   └── ...
├── fantasy_scifi/
│   └── ...
├── scripts/
│   ├── generate_index.js              # Builds filters-index.json
│   ├── generate_categories.js         # Builds category HTML pages
│   └── generate_previews.js           # Generates before/after thumbnails
├── functions/                         # Cloudflare Pages Functions
│   └── api/
│       ├── transform.js               # POST /api/transform — main AI endpoint
│       ├── status.js                   # GET /api/status/:jobId — job polling
│       ├── usage.js                    # GET /api/usage — daily Neuron usage
│       └── upload.js                   # POST /api/upload — R2 temp image upload
├── about.html
├── contact.html
├── privacy.html
├── terms.html
├── index.html                         # Homepage
├── browse.html                        # Browse/search all filters
├── try.html                           # Live photo transform page
├── robots.txt
├── sitemap.xml
├── wrangler.toml                      # Cloudflare Workers/Pages config
├── README.md
├── LICENSE-CODE                       # MIT
├── PRD.md                             # This file
├── CNAME                              # gicPhotoFilters.gic.mx (if needed)
└── .gitignore
```

---

## 8. `wrangler.toml` Configuration

```toml
name = "gic-photo-filters"
compatibility_date = "2026-03-01"
pages_build_output_dir = "./"

[ai]
binding = "AI"

[[r2_buckets]]
binding = "PHOTO_BUCKET"
bucket_name = "gic-photo-filters-temp"

[[kv_namespaces]]
binding = "USAGE_KV"
id = "..."        # Tracks daily Neuron usage per IP

[vars]
DEMO_MODE = "true"
MAX_FREE_NEURONS_PER_DAY = "10000"
MAX_FREE_TRANSFORMS_PER_IP = "10"
SEASONAL_FILTER = "grinch_ify"
```

---

## 9. Worker Architecture: `/api/transform`

The single most important backend endpoint. Handles all photo transformations.

```javascript
// functions/api/transform.js (Cloudflare Pages Function)
export async function onRequestPost(context) {
  const { request, env } = context;
  
  // 1. Rate limit check (per-IP daily usage)
  const ip = request.headers.get('CF-Connecting-IP');
  const today = new Date().toISOString().slice(0, 10);
  const usageKey = `${ip}:${today}`;
  const currentUsage = parseInt(await env.USAGE_KV.get(usageKey) || '0');
  
  if (currentUsage >= parseInt(env.MAX_FREE_TRANSFORMS_PER_IP)) {
    return new Response(JSON.stringify({
      error: 'daily_limit',
      message: 'Free daily limit reached. Get the app for unlimited transforms!',
      used: currentUsage,
      limit: parseInt(env.MAX_FREE_TRANSFORMS_PER_IP)
    }), { status: 429 });
  }
  
  // 2. Parse request
  const formData = await request.formData();
  const imageFile = formData.get('image');
  const filterId = formData.get('filterId');
  const userApiKey = formData.get('apiKey'); // Optional: user's own key
  
  // 3. Load filter manifest
  const filter = await getFilterManifest(filterId, env);
  
  // 4. Check if demo filter or user has own key
  const isDemo = filter.isDemoFilter && !userApiKey;
  
  // 5. Prepare image bytes
  const imageBytes = new Uint8Array(await imageFile.arrayBuffer());
  
  // 6. Route to correct model
  let result;
  switch (filter.type) {
    case 'img2img':
      result = await env.AI.run(filter.modelId, {
        prompt: filter.prompt,
        negative_prompt: filter.negativePrompt,
        image: [...imageBytes],
        strength: filter.strength,
        guidance: filter.guidance,
        width: filter.outputWidth,
        height: filter.outputHeight
      });
      break;
    case 'inpainting':
      result = await env.AI.run(filter.modelId, {
        prompt: filter.prompt,
        image: [...imageBytes],
        mask: [...generateMask(filter)], // Auto-generated mask
        guidance: filter.guidance
      });
      break;
  }
  
  // 7. Store result in R2 (24h TTL)
  const outputKey = `out/${crypto.randomUUID()}.png`;
  await env.PHOTO_BUCKET.put(outputKey, result, {
    httpMetadata: { contentType: 'image/png' },
    customMetadata: { expiresAt: new Date(Date.now() + 86400000).toISOString() }
  });
  
  // 8. Track usage
  await env.USAGE_KV.put(usageKey, String(currentUsage + 1), {
    expirationTtl: 86400
  });
  
  // 9. Return result URL
  return new Response(JSON.stringify({
    resultUrl: `/api/image/${outputKey}`,
    neuronsUsed: filter.estimatedNeurons,
    dailyUsage: currentUsage + 1,
    dailyLimit: parseInt(env.MAX_FREE_TRANSFORMS_PER_IP)
  }));
}
```

---

## 10. Neuron/Usage Tracking System

### Free Tier (Website Demo)
- **10,000 Neurons/day** from Cloudflare's free allowance
- **10 transforms/day per IP** (rate limited)
- Usage counter shown in the UI: "3/10 free transforms used today"
- GIC's own API key powers demo filters
- Client-side filters (Effects category) are **unlimited** — no Neurons consumed

### Paid Tier (Via App — User's Own Key)
- User enters their own Cloudflare API token in the app
- Transforms run against their Cloudflare account
- App tracks their personal Neuron usage via the Cloudflare API
- No per-IP limits; only Cloudflare's own billing limits apply

### Seasonal/Featured Demo
- GIC funds a "Filter of the Season" with higher daily limits
- E.g., "Grinch-ify" in December gets 50 transforms/day from GIC's key
- Featured prominently on homepage with "Try it FREE" badge

---

## 11. Detailed Task List

### Phase 0 — Repository & Infrastructure Setup

- [ ] **0.1** Initialize `gicPhotoFilters` Git repo with `.gitignore`, `README.md`, `LICENSE-CODE` (MIT).
- [ ] **0.2** Create `wrangler.toml` with AI binding, R2 bucket, KV namespace.
- [ ] **0.3** Set up Cloudflare Pages project linked to the repo.
- [ ] **0.4** Create R2 bucket `gic-photo-filters-temp` with lifecycle rule (auto-delete after 24h).
- [ ] **0.5** Create KV namespace for usage tracking.
- [ ] **0.6** Set up DNS record for `gicPhotoFilters.gic.mx` → Cloudflare Pages.
- [ ] **0.7** Create the full folder structure (all 15 category folders, `workers/`, `functions/api/`, `scripts/`, `docs/`, `categories/`).
- [ ] **0.8** Add `.github/ISSUE_TEMPLATE/request-a-filter.md`.
- [ ] **0.9** Add `.github/FUNDING.yml`.

### Phase 1 — Filter Manifest Content Creation

- [ ] **1.1** Create the 15 `meta.yaml` files (one per category folder):
  ```yaml
  name: "Holiday & Seasonal"
  slug: "holiday_seasonal"
  description: "Festive photo transformations for every holiday and season."
  icon: "gift.fill"
  emoji: "🎄"
  filterCount: 25
  ```
- [ ] **1.2** Create all 205 individual filter `.json` manifest files in their category folders. Each contains:
  ```json
  {
    "id": "grinch_ify--holiday_seasonal",
    "name": "Grinch-ify",
    "slug": "grinch-ify",
    "prompt": "Transform this person into a green furry Grinch...",
    "negativePrompt": "blurry, low quality, deformed...",
    "type": "img2img",
    "model": "flux2-klein-9b",
    "strength": 0.65,
    "guidance": 7.5,
    "outputWidth": 768,
    "outputHeight": 768,
    "variantCount": 2,
    "isDemoFilter": true,
    "isSeasonalHighlight": true,
    "seasonalMonths": [11, 12, 1],
    "tags": ["christmas", "holiday", "fun", "grinch"]
  }
  ```
- [ ] **1.3** Create all 205 `_help.md` files with:
  - What the filter does
  - Before/after description
  - Tips for best results (lighting, face angle, resolution)
  - Share text template
- [ ] **1.4** Curate the ~30 "demo filters" that GIC will provide free API key access for:
  - Top 2-3 from each category
  - All 10 client-side Effects filters (free by default)
  - Current seasonal highlight
- [ ] **1.5** Audit: verify all 205 filters have valid manifests + help docs.

### Phase 2 — Index Generation Pipeline

- [ ] **2.1** Write `scripts/generate_index.js`:
  - Walk all 15 category folders
  - Read each `.json` filter manifest + `meta.yaml`
  - Build `filters-index.json` with the schema from §6
  - Generate `filters-index.json.gz`
  - Write `last_updated.txt`
- [ ] **2.2** Write `scripts/generate_previews.js`:
  - For each filter, generate a before/after thumbnail pair
  - Store in `docs/assets/filter-previews/{filter_slug}_before.jpg` and `_after.jpg`
  - Use a set of 5-6 sample photos as input
- [ ] **2.3** Document the pipeline in `LOCAL_PIPELINE.md`.
- [ ] **2.4** Run pipeline, verify `filters-index.json` contains all 205 entries.

### Phase 3 — Core Worker (AI Transform Endpoint)

- [ ] **3.1** Write `functions/api/transform.js` (see §9):
  - Accept `image` (File) + `filterId` (string) + optional `apiKey` (string)
  - Load filter manifest, route to correct model
  - Return result URL + usage stats
- [ ] **3.2** Write `functions/api/upload.js`:
  - Accept image upload, store in R2, return temp key
  - Validate image format (JPEG, PNG, WebP) and size (max 5MB)
  - Resize to max 1024px before AI inference
- [ ] **3.3** Write `functions/api/status.js`:
  - For async/long-running transforms, poll job status
- [ ] **3.4** Write `functions/api/usage.js`:
  - Return current daily usage for the requesting IP
  - `{ used: 3, limit: 10, neuronsUsed: 450, neuronsLimit: 10000 }`
- [ ] **3.5** Write `functions/api/image/[key].js`:
  - Serve transformed images from R2
  - Add Cache-Control headers
- [ ] **3.6** Write `workers/client_effects.js`:
  - Bundle of client-side Canvas effects (sepia, B&W, vignette, etc.)
  - Runs entirely in browser, no API call needed
- [ ] **3.7** Test all endpoints locally with `wrangler pages dev`.

### Phase 4 — Homepage (`index.html`)

Replicate the `forms.gic.mx/index.html` structure, adapted for photo filters:

- [ ] **4.1** Sticky header with logo ("GIC Photo Filters"), nav (Browse, Try, Categories, Get App), dark mode toggle.
- [ ] **4.2** Hero section:
  - Badge: "AI-Powered Photo Transformations"
  - H1: "200+ Fun Photo Filters — Transform Yourself in Seconds"
  - Subtitle: "Turn into the Grinch, travel to Paris, get a professional headshot — all from one photo. Free to try, powered by AI."
  - CTA buttons: "Try a Filter" + "Get the App"
  - Stats row: 205 Filters / 15 Categories / Free to Try
  - Interactive before/after slider showing the "Filter of the Season"
- [ ] **4.3** "How It Works" section (3 steps):
  1. Upload Your Photo
  2. Pick a Filter (browse 200+ transformations)
  3. Download & Share (transformed image ready in seconds)
- [ ] **4.4** Seasonal Highlights section:
  - Dynamic: shows filters matching current month's `seasonalMonths`
  - Grid of 4-6 seasonal filter cards with before/after thumbnails
  - "Try Now — FREE" buttons
- [ ] **4.5** Category Highlights: top 6 categories as cards with emoji, name, filter count, sample before/after.
- [ ] **4.6** "Popular Filters" carousel: top 10 most-used filters (from analytics or curated).
- [ ] **4.7** App Suite section: card for `gicPhotoFiltersApp` with App Store link.
- [ ] **4.8** CTA section: "Upload a Photo, Pick a Filter, Share the Fun" with Try button.
- [ ] **4.9** Footer: matching GIC footer (Browse, GIC Apps, Legal, disclaimer).
- [ ] **4.10** Script block: load `filters-index.json`, populate seasonal + stats dynamically.
- [ ] **4.11** Dark mode support (same `gic-theme` localStorage key).

### Phase 5 — Browse Page (`browse.html`)

- [ ] **5.1** Search bar: full-text across filter name, description, tags, category.
- [ ] **5.2** Sidebar filters:
  - **Category**: 15 categories with filter counts
  - **Type**: img2img / inpainting / style-transfer / utility / overlay
  - **AI Required**: Yes / No (client-side) / All
  - **Demo Available**: Yes / No — shows which filters can be tried for free
  - **Seasonal**: Show only current-season filters
  - **Model**: FLUX / Stable Diffusion / Client-Side
- [ ] **5.3** Filter card grid:
  - Each card: before/after thumbnail (hover to swap), filter name, category badge, "FREE" badge if demo, "Try" + "Details" links
  - Cards link to `try.html?id={filter_id}`
- [ ] **5.4** Sort: Popular / A-Z / Category / Newest
- [ ] **5.5** URL hash state: `browse.html#category=holiday_seasonal&type=img2img`
- [ ] **5.6** "No results" state with filter request CTA.
- [ ] **5.7** Loading skeleton animation.

### Phase 6 — Try Page (`try.html`) — KEY DIFFERENTIATOR

This is the core experience. Users upload a photo and get it transformed **live in the browser**:

- [ ] **6.1** Load filter metadata from `filters-index.json` based on `?id=` param. If no param, show "Pick a Filter" with popular grid.
- [ ] **6.2** Filter info header: name, category badge, description, type badge, "FREE" badge, Neuron cost estimate.
- [ ] **6.3** Upload panel:
  - Drag-and-drop or click to upload
  - Camera capture on mobile
  - Paste from clipboard
  - Validate: JPEG/PNG/WebP, max 5MB
  - Client-side resize to max 1024px before upload
  - Face detection hint: "For best results, use a clear face photo"
- [ ] **6.4** Transform button:
  - If demo filter: "Transform — FREE ✨" (uses GIC's key)
  - If not demo: "Transform (uses your API key)" or "Get the App to try this filter"
  - Show daily usage counter: "3/10 free transforms today"
- [ ] **6.5** Loading state:
  - Progress indicator with fun messages ("Mixing the green paint...", "Adding the fur...")
  - Estimated time based on model
- [ ] **6.6** Result display:
  - Side-by-side or before/after slider (original vs. transformed)
  - If `variantCount > 1`: swipe between variants (Tinder-style cards)
  - "Download" button (PNG)
  - "Share" button with pre-filled text from `shareText`
  - "Try Another Photo" button
  - "Try Another Filter" button
- [ ] **6.7** Client-side filters (Effects category):
  - Run entirely in Canvas, no API call
  - Instant preview (< 100ms)
  - Slider controls for effect intensity
  - No daily limit
- [ ] **6.8** Usage dashboard (collapsible):
  - "Today: 3/10 free transforms used"
  - "Neurons: 450/10,000 used today"
  - "Get the app for unlimited transforms"
- [ ] **6.9** Help tab: render the filter's `_help.md` as formatted text.
- [ ] **6.10** Related filters section: 4-6 filters from same category.
- [ ] **6.11** Schema.org `SoftwareApplication` structured data.
- [ ] **6.12** Open Graph + Twitter Card with dynamic preview image.
- [ ] **6.13** Breadcrumb: Home > Category > Filter Name.

### Phase 7 — Category Pages (`categories/*.html`)

- [ ] **7.1** Category index (`categories/index.html`): grid of all 15 categories with emoji, name, description, filter count, sample before/after.
- [ ] **7.2** Individual category pages (15 pages): list all filters in that category as cards.
  - Header: emoji + name, description from `meta.yaml`, filter count.
  - Filter grid: same card component as browse, filtered to category.
  - SEO: unique title + meta description + canonical.
- [ ] **7.3** `scripts/generate_categories.js` to auto-generate from `filters-index.json` + `meta.yaml`.

### Phase 8 — Static Pages

- [ ] **8.1** `about.html` — About GIC Photo Filters, link to app, link to other GIC sites.
- [ ] **8.2** `contact.html` — Contact + GitHub Issues link.
- [ ] **8.3** `privacy.html` — Photos are processed by AI and deleted within 24h, no data retained. Client-side filters never leave the device.
- [ ] **8.4** `terms.html` — Terms of service, fair use policy (10 transforms/day free).
- [ ] **8.5** `robots.txt` + `sitemap.xml`.

### Phase 9 — iOS/macOS App (`gicPhotoFiltersApp`)

Build the companion app, based on `oneTimeUseWebApp`'s architecture:

- [ ] **9.1** Create Xcode project `gicPhotoFiltersApp` (SwiftUI, iOS 17+ / macOS 14+).
- [ ] **9.2** Core models:
  ```swift
  struct PhotoFilter: Codable, Identifiable {
      let id: String
      let name: String
      let slug: String
      let category: String
      let categoryDisplay: String
      let description: String
      let systemImage: String
      let prompt: String
      let negativePrompt: String
      let type: FilterType  // img2img, inpainting, style-transfer, utility, overlay
      let model: String
      let strength: Double
      let guidance: Double
      let outputWidth: Int
      let outputHeight: Int
      let variantCount: Int
      let isDemoFilter: Bool
      let isSeasonalHighlight: Bool
      let seasonalMonths: [Int]
      let requiresAI: Bool
      let clientSideOnly: Bool
      let estimatedNeurons: Int
      let tags: [String]
      let shareText: String
  }
  
  enum FilterType: String, Codable {
      case img2img, inpainting, styleTransfer = "style-transfer", utility, overlay
  }
  ```
- [ ] **9.3** `FilterGalleryView` — browse filters by category with search. Mirrors `TemplateGalleryView` from `oneTimeUseWebApp`.
- [ ] **9.4** `FilterDetailView` — shows filter info, before/after preview, "Transform" CTA.
- [ ] **9.5** `CameraView` — photo picker + camera capture for the input photo.
- [ ] **9.6** `TransformView` — sends photo to Workers AI, shows progress, displays results.
- [ ] **9.7** `ResultView` — before/after slider, variant swipe, download, share sheet, QR code.
- [ ] **9.8** `SettingsView` — Cloudflare API token entry, model preferences, usage tracking.
- [ ] **9.9** `RemoteFilterSync` service:
  - Fetch `filters-index.json.gz` from `gicPhotoFilters.gic.mx/docs/filters-index.json.gz`
  - Compare `generatedAt`, download if newer
  - Fallback to bundled `filters-index.json`
- [ ] **9.10** `UsageTracker`:
  - Track daily Neuron usage against user's Cloudflare account
  - Show usage dashboard in settings
  - For free tier: track demo transforms used
- [ ] **9.11** Keychain storage for Cloudflare API token.
- [ ] **9.12** Deep-link support: `gicphotofilters://filter/{filter_id}`.
- [ ] **9.13** "Open on Web" button that links to `gicPhotoFilters.gic.mx/try.html?id={filter_id}`.
- [ ] **9.14** App Store metadata + screenshots.

### Phase 10 — SEO & Analytics

- [ ] **10.1** Create GA4 property for `gicPhotoFilters.gic.mx`.
- [ ] **10.2** Add GA4 to all pages.
- [ ] **10.3** Track custom events:
  - `filter_view` (try page load)
  - `filter_transform` (transform initiated)
  - `filter_download` (result downloaded)
  - `filter_share` (share button clicked)
  - `category_browse` (category page view)
  - `search` (browse search query)
  - `daily_limit_reached` (user hit free limit)
  - `app_store_click` (app download CTA)
- [ ] **10.4** Schema.org structured data on all pages.
- [ ] **10.5** Open Graph + Twitter Card meta tags.
- [ ] **10.6** Submit sitemap to Google Search Console.
- [ ] **10.7** Canonical URLs.

### Phase 11 — Cross-Promotion & Ecosystem Links

- [ ] **11.1** Add "Photo Filters" link in `forms.gic.mx` footer.
- [ ] **11.2** Add "Photo Filters" link in `onePageApps.gic.mx` footer.
- [ ] **11.3** Add "Forms" + "One-Page Apps" links in `gicPhotoFilters.gic.mx` footer.
- [ ] **11.4** Update `gic.mx` product ecosystem.
- [ ] **11.5** Cross-promote seasonal filters in the other GIC apps.

### Phase 12 — Launch Checklist

- [ ] **12.1** Verify HTTPS + custom domain working on Cloudflare Pages.
- [ ] **12.2** Verify all 205 filters appear in browse page with correct metadata.
- [ ] **12.3** Test 5+ demo filters end-to-end (upload → transform → download).
- [ ] **12.4** Test 3+ client-side effects (instant, no API call).
- [ ] **12.5** Verify rate limiting works (10 transforms/day per IP).
- [ ] **12.6** Verify usage tracking shows correct Neuron counts.
- [ ] **12.7** Verify `filters-index.json` is accessible and parseable.
- [ ] **12.8** Verify iOS app can download and parse `filters-index.json`.
- [ ] **12.9** Lighthouse audit: Performance ≥ 85, Accessibility ≥ 90, SEO ≥ 90.
- [ ] **12.10** Test dark mode on all pages.
- [ ] **12.11** Test mobile responsiveness (upload, transform, result all work on phone).
- [ ] **12.12** Verify R2 auto-cleanup (images deleted after 24h).
- [ ] **12.13** Verify seasonal filter rotation works correctly.
- [ ] **12.14** Test error states (API down, daily limit, invalid image, oversized file).

---

## 12. Implementation Priority

| Priority | Phase | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | Phase 0 — Repo + infra setup | 1 day | Foundation |
| 🔴 P0 | Phase 1 — Filter manifests (start with 50) | 3 days | Content |
| 🔴 P0 | Phase 2 — Index pipeline | 1 day | Core pipeline |
| 🔴 P0 | Phase 3 — AI transform worker | 3 days | Core backend |
| 🔴 P0 | Phase 4 — Homepage | 2 days | Public face |
| 🔴 P0 | Phase 5 — Browse page | 2 days | Discovery |
| 🟡 P1 | Phase 6 — Try page | 4 days | **Key differentiator** |
| 🟡 P1 | Phase 7 — Category pages | 1 day | SEO |
| 🟡 P1 | Phase 8 — Static pages | 1 day | Legal/info |
| 🟡 P1 | Phase 9 — iOS app | 5 days | Ecosystem |
| 🟢 P2 | Phase 10 — SEO & analytics | 1 day | Growth |
| 🟢 P2 | Phase 11 — Cross-promotion | 0.5 day | Ecosystem |
| 🟢 P2 | Phase 12 — Launch checklist | 1 day | QA |

**Total estimated effort:** ~25 days

---

## 13. Model Selection Strategy

### Primary: Cloudflare Workers AI (Free Tier)

| Model | Best For | Neurons/Run | Speed |
|---|---|---|---|
| **FLUX.2 Klein 9B** | High-quality img2img, character transforms | ~150 | Fast (2-5s) |
| **FLUX.2 Klein 4B** | Lighter transforms, faster | ~80 | Very fast (1-3s) |
| **SD v1.5 Img2Img** | Style transfers, basic transforms | ~100 | Medium (3-8s) |
| **SD v1.5 Inpainting** | Targeted edits (add hat, change BG) | ~120 | Medium (3-8s) |
| **SDXL Base 1.0** | Highest quality text-to-image | ~200 | Slower (5-15s) |

### Fallback: External Providers (via Cloudflare AI Gateway)

| Provider | Integration | Use Case | Cost |
|---|---|---|---|
| **Replicate** | Via AI Gateway proxy | InstantID, IP-Adapter (face preservation) | ~$0.01/run |
| **fal.ai** | Via AI Gateway proxy | Fast FLUX variants, custom models | ~$0.005/run |

### Provider Selection Logic

```
1. If filter.clientSideOnly → Canvas/MediaPipe (FREE, instant)
2. If filter.model starts with "@cf/" → Workers AI (free tier Neurons)
3. If filter.model == "replicate/*" → Replicate via AI Gateway (paid)
4. If filter.model == "fal/*" → fal.ai via AI Gateway (paid)
```

---

## 14. Privacy & Security

- **Photos are ephemeral**: Uploaded photos and results are stored in R2 for max 24 hours, then auto-deleted.
- **Client-side effects** never leave the user's device.
- **No user accounts**: No registration required. Usage tracked by IP only.
- **API keys in app**: Stored in Keychain, never sent to GIC servers. Used directly against user's own Cloudflare account.
- **Content moderation**: NSFW detection before AI processing (can use Cloudflare's built-in content moderation).
- **No training**: User photos are NOT used for model training.
- **GDPR/CCPA compliant**: No PII stored, photos auto-delete, clear privacy policy.

---

## 15. Monetization Strategy

| Tier | Access | Cost | Limits |
|---|---|---|---|
| **Free (Website)** | Demo filters + all client-side effects | Free | 10 transforms/day per IP |
| **Free (App, own key)** | All 205 filters | User pays Cloudflare | Cloudflare's billing limits |
| **GIC Seasonal** | "Filter of the Season" with boosted limits | GIC-funded | 50/day |
| **Future: Premium Packs** | Exclusive filters, higher quality models | TBD | Unlimited |

---

## 16. Success Metrics

- Site live at `gicPhotoFilters.gic.mx` with all 205 filters browsable
- `filters-index.json` publicly accessible and parseable by the iOS app
- At least 30 "demo" filters work end-to-end on the website for free
- All 10 client-side effects work instantly with no AI cost
- iOS app syncs filter catalog from the site
- Google indexes the site within 2 weeks
- "Grinch-ify" or seasonal filter goes viral on social media
- < 5s average transform time for FLUX.2 Klein models

---

## 17. Future Work (Out of Scope for v1)

- [ ] User-submitted filter prompts via PR template
- [ ] Video transformations (AnimateDiff, Stable Video Diffusion)
- [ ] Batch processing (transform multiple photos at once)
- [ ] Before/after gallery wall (user-submitted, moderated)
- [ ] Sticker/overlay packs (client-side, no AI, downloadable)
- [ ] WhatsApp/iMessage sticker export
- [ ] AR/live camera filters (ARKit on iOS)
- [ ] Multi-face detection and individual face transforms
- [ ] Text overlay templates ("Happy Birthday!", "Congratulations!")
- [ ] Spanish/multi-language UI
- [ ] Premium subscription tier
- [ ] Cloudflare AI Gateway analytics dashboard
- [ ] Custom filter builder (let users write their own prompts)
- [ ] Integration with GIC Forms (photo transform as form question type)
