const SITE = {
  name: 'GIC Photo Filters',
  baseUrl: 'https://photofilters.gic.mx',
  catalogPath: '/docs/filters-index.json',
  appLink: '/about.html#app-availability',
  configPath: '/docs/assets/site-config.json',
};

const DEFAULT_SITE_CONFIG = Object.freeze({
  analytics: {
    googleAnalyticsMeasurementId: '',
  },
});

const CATEGORY_META = [
  { id: 'holiday_seasonal', slug: 'holiday-seasonal', emoji: '🎄', name: 'Holiday & Seasonal', count: 25, aiRequired: 'Yes', description: 'Festive looks for Christmas, spring celebrations, spooky nights, and every seasonal moment in between.' },
  { id: 'pop_culture', slug: 'pop-culture', emoji: '🎬', name: 'Pop Culture & Characters', count: 25, aiRequired: 'Yes', description: 'Become toy icons, animated legends, and fandom-inspired characters from one portrait.' },
  { id: 'artistic_styles', slug: 'artistic-styles', emoji: '🎨', name: 'Artistic Styles', count: 25, aiRequired: 'Yes', description: 'Painterly, illustrated, and gallery-ready interpretations for portraits and products.' },
  { id: 'retro_vintage', slug: 'retro-vintage', emoji: '📷', name: 'Retro & Vintage', count: 20, aiRequired: 'Mixed', description: 'Instant nostalgia with analog film, VHS textures, and throwback camera aesthetics.' },
  { id: 'life_events', slug: 'life-events', emoji: '👨‍👩‍👧‍👦', name: 'Life Events & Milestones', count: 20, aiRequired: 'Yes', description: 'Polished transformations for graduations, weddings, birthdays, and announcement photos.' },
  { id: 'pets_animals', slug: 'pets-animals', emoji: '🐾', name: 'Pets & Animals', count: 15, aiRequired: 'Yes', description: 'Pet-friendly scenes, animal-inspired portraits, and playful companions for shareable photos.' },
  { id: 'professional', slug: 'professional', emoji: '💼', name: 'Professional & Business', count: 15, aiRequired: 'Yes', description: 'Career-focused headshots, brand portraits, and polished business-ready visuals.' },
  { id: 'travel_places', slug: 'travel-places', emoji: '🌍', name: 'Travel & Places', count: 15, aiRequired: 'Yes', description: 'Teleport your portrait to postcard destinations, iconic landmarks, and dreamy city scenes.' },
  { id: 'utility_tools', slug: 'utility-tools', emoji: '🛠️', name: 'Utility & Serious Tools', count: 20, aiRequired: 'Mixed', description: 'Practical cleanup, composition, ratio, and image-prep tools for serious photo tasks.' },
  { id: 'fun_meme', slug: 'fun-meme', emoji: '🎉', name: 'Fun & Meme', count: 15, aiRequired: 'Yes', description: 'Internet-friendly, laugh-first concepts built for group chats, reactions, and quick shares.' },
  { id: 'effects_filters', slug: 'effects-filters', emoji: '🌈', name: 'Effects & Filters', count: 10, aiRequired: 'No', description: 'Instant browser-only effects that never leave your device and render in under a second.' },
  { id: 'social_media', slug: 'social-media', emoji: '📱', name: 'Social Media Templates', count: 5, aiRequired: 'Mixed', description: 'Profile, story, and cover-ready layouts designed for social publishing workflows.' },
  { id: 'food_drink', slug: 'food-drink', emoji: '🍕', name: 'Food & Drink', count: 5, aiRequired: 'Yes', description: 'Tasty edits, menu-ready compositions, and warm café-inspired transformations.' },
  { id: 'sports_fitness', slug: 'sports-fitness', emoji: '⚽', name: 'Sports & Fitness', count: 5, aiRequired: 'Yes', description: 'High-energy poster looks, stadium vibes, and performance-focused athletic visuals.' },
  { id: 'fantasy_scifi', slug: 'fantasy-scifi', emoji: '🚀', name: 'Fantasy & Sci-Fi', count: 5, aiRequired: 'Yes', description: 'Cinematic worlds full of neon futures, starships, magic, and sci-fi atmosphere.' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORY_META.map((category) => [category.id, category]));
const CATEGORY_TOTAL = CATEGORY_META.reduce((sum, category) => sum + category.count, 0);
const CATEGORY_PALETTES = {
  holiday_seasonal: ['#ec5b13', '#0f766e', '#f97316'],
  pop_culture: ['#7c3aed', '#ec4899', '#f59e0b'],
  artistic_styles: ['#f97316', '#38bdf8', '#a855f7'],
  retro_vintage: ['#b45309', '#7c2d12', '#fca5a5'],
  life_events: ['#ec4899', '#f97316', '#fde68a'],
  pets_animals: ['#f59e0b', '#10b981', '#60a5fa'],
  professional: ['#0f766e', '#1d4ed8', '#f59e0b'],
  travel_places: ['#0ea5e9', '#14b8a6', '#f97316'],
  utility_tools: ['#475569', '#0f766e', '#f97316'],
  fun_meme: ['#ef4444', '#f59e0b', '#8b5cf6'],
  effects_filters: ['#8b5cf6', '#06b6d4', '#ec4899'],
  social_media: ['#2563eb', '#7c3aed', '#ec4899'],
  food_drink: ['#f97316', '#facc15', '#14b8a6'],
  sports_fitness: ['#ef4444', '#2563eb', '#f59e0b'],
  fantasy_scifi: ['#0ea5e9', '#7c3aed', '#22c55e'],
};

const FALLBACK_CATALOG = {
  generatedAt: '2026-03-12T00:00:00Z',
  totalFilters: CATEGORY_TOTAL,
  dailyFreeNeurons: 10000,
  starterCatalog: true,
  filtersReady: 6,
  models: {
    'flux2-klein-9b': { id: '@cf/black-forest-labs/flux-2-klein-9b', name: 'FLUX.2 Klein 9B', neuronsPerRun: 150 },
    'sd15-img2img': { id: '@cf/stabilityai/stable-diffusion-v1-5-img2img', name: 'Stable Diffusion v1.5 Img2Img', neuronsPerRun: 100 },
    'sd15-inpainting': { id: '@cf/stabilityai/stable-diffusion-v1-5-inpainting', name: 'Stable Diffusion v1.5 Inpainting', neuronsPerRun: 120 },
    'client-side': { id: 'client-side', name: 'Browser (no AI)', neuronsPerRun: 0 },
  },
  filters: [
    {
      id: 'grinch_ify--holiday_seasonal',
      name: 'Grinch-ify',
      slug: 'grinch-ify',
      category: 'holiday_seasonal',
      description: 'Turn a clean selfie into a mischievous green holiday character with fur, grin, and festive styling.',
      type: 'img2img',
      model: 'flux2-klein-9b',
      variantCount: 2,
      isDemoFilter: true,
      isSeasonalHighlight: true,
      seasonalMonths: [11, 12, 1],
      requiresAI: true,
      clientSideOnly: false,
      estimatedNeurons: 150,
      tags: ['christmas', 'green', 'holiday', 'grinch'],
      shareText: 'I just Grinch-ified myself! 💚🎄 Try it free:',
      helpMarkdown: '## Tips\n- Use a clear face photo.\n- Leave some room above the head for the hat.\n- Expect the best results with bright lighting.',
    },
    {
      id: 'professional_headshot--professional',
      name: 'Professional Headshot',
      slug: 'professional-headshot',
      category: 'professional',
      description: 'Upgrade a casual portrait into a clean, studio-style business headshot with neutral lighting.',
      type: 'img2img',
      model: 'sd15-img2img',
      variantCount: 2,
      isDemoFilter: true,
      requiresAI: true,
      clientSideOnly: false,
      estimatedNeurons: 120,
      tags: ['headshot', 'linkedin', 'career', 'business'],
      shareText: 'Fresh headshot, zero studio booking. 📸',
      helpMarkdown: '## Best results\n- Use chest-up framing.\n- Neutral shirts work best.\n- Avoid heavy backlighting.',
    },
    {
      id: 'paris_postcard--travel_places',
      name: 'Paris Postcard',
      slug: 'paris-postcard',
      category: 'travel_places',
      description: 'Place a portrait into a warm golden-hour Paris scene with postcard-ready composition.',
      type: 'img2img',
      model: 'flux2-klein-9b',
      variantCount: 3,
      isDemoFilter: true,
      requiresAI: true,
      clientSideOnly: false,
      estimatedNeurons: 150,
      tags: ['travel', 'paris', 'eiffel tower', 'vacation'],
      shareText: 'Postcard mode unlocked. 🇫🇷✨',
      helpMarkdown: '## Travel notes\n- Portrait or half-body works great.\n- Busy backgrounds are okay; the scene gets remixed.',
    },
    {
      id: 'background_cleaner--utility_tools',
      name: 'Background Cleaner',
      slug: 'background-cleaner',
      category: 'utility_tools',
      description: 'Remove clutter and rebuild a clean backdrop for listings, IDs, and product-ready shots.',
      type: 'inpainting',
      model: 'sd15-inpainting',
      variantCount: 1,
      isDemoFilter: true,
      requiresAI: true,
      clientSideOnly: false,
      estimatedNeurons: 120,
      tags: ['cleanup', 'background', 'listing'],
      shareText: 'Clean background, cleaner presentation.',
      helpMarkdown: '## Workflow\n- Start with a centered subject.\n- Great for profile photos and marketplaces.\n- Export as PNG for easy reuse.',
    },
    {
      id: 'sunset_duotone--effects_filters',
      name: 'Sunset Duotone',
      slug: 'sunset-duotone',
      category: 'effects_filters',
      description: 'Apply an instant peach-to-plum duotone effect directly in the browser with a strength slider.',
      type: 'overlay',
      model: 'client-side',
      variantCount: 1,
      isDemoFilter: true,
      requiresAI: false,
      clientSideOnly: true,
      estimatedNeurons: 0,
      tags: ['duotone', 'sunset', 'instant', 'client-side'],
      shareText: 'Client-side glow, no upload required. 🌅',
      helpMarkdown: '## Instant effect\n- This effect runs entirely in your browser.\n- Increase intensity for punchier colors.\n- Unlimited runs, no daily cap.',
    },
    {
      id: 'cyberpunk_pulse--fantasy_scifi',
      name: 'Cyberpunk Pulse',
      slug: 'cyberpunk-pulse',
      category: 'fantasy_scifi',
      description: 'Wrap your photo in neon reflections, holographic accents, and a futuristic city mood.',
      type: 'style-transfer',
      model: 'flux2-klein-9b',
      variantCount: 3,
      isDemoFilter: false,
      requiresAI: true,
      clientSideOnly: false,
      estimatedNeurons: 180,
      tags: ['cyberpunk', 'neon', 'future'],
      shareText: 'Neon city energy from a single photo. 🌃⚡',
      helpMarkdown: '## Cyber hints\n- Nighttime portraits work best.\n- Glasses and reflective materials add extra flair.',
    },
  ],
};

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
const previewCache = new Map();
const toastTimers = new Set();
let runtimeConfig = DEFAULT_SITE_CONFIG;
let runtimeConfigPromise;
let analyticsPromise;
let healthSnapshotPromise;

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(value = '') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function normalizeSiteConfig(rawConfig = {}) {
  const measurementId = typeof rawConfig?.analytics?.googleAnalyticsMeasurementId === 'string'
    ? rawConfig.analytics.googleAnalyticsMeasurementId.trim()
    : '';
  return {
    analytics: {
      googleAnalyticsMeasurementId: measurementId,
    },
  };
}

async function loadSiteConfig() {
  if (!hasDom) return runtimeConfig;
  if (runtimeConfigPromise) return runtimeConfigPromise;
  runtimeConfigPromise = fetch(SITE.configPath, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Site config request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      runtimeConfig = normalizeSiteConfig(payload);
      return runtimeConfig;
    })
    .catch(() => {
      runtimeConfig = DEFAULT_SITE_CONFIG;
      return runtimeConfig;
    });
  return runtimeConfigPromise;
}

function getGoogleAnalyticsMeasurementId(config = runtimeConfig) {
  return config.analytics.googleAnalyticsMeasurementId;
}

function loadExternalScript(src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    Object.entries(attributes).forEach(([key, value]) => {
      script.setAttribute(key, value);
    });
    script.addEventListener('load', () => resolve(script), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });
}

async function initAnalytics(config = runtimeConfig) {
  if (!hasDom) return;
  if (analyticsPromise) return analyticsPromise;
  const measurementId = getGoogleAnalyticsMeasurementId(config);
  if (!measurementId) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
  analyticsPromise = loadExternalScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`, {
    'data-analytics-loader': 'google-analytics',
  }).catch(() => undefined);
  return analyticsPromise;
}

function getCategory(categoryId) {
  return CATEGORY_MAP[categoryId] || {
    id: categoryId,
    slug: slugify(categoryId.replace(/_/g, ' ')),
    emoji: '✨',
    name: categoryId.replace(/_/g, ' '),
    count: 0,
    aiRequired: 'Mixed',
    description: 'Explore this category in the starter catalog.',
  };
}

function getModelLabel(models = {}, modelKey = '') {
  return models?.[modelKey]?.name || modelKey || 'AI Model';
}

function sortByPopularity(a, b) {
  return (b.popularityScore || 0) - (a.popularityScore || 0);
}

function makeDateOffset(index = 0) {
  const date = new Date(Date.UTC(2026, 2, 12));
  date.setDate(date.getDate() - index * 3);
  return date.toISOString();
}

function normalizeCategory(rawCategory = {}) {
  const fallback = getCategory(rawCategory.id || rawCategory.slug || '');
  return {
    ...fallback,
    ...rawCategory,
    id: rawCategory.id || rawCategory.slug || fallback.id,
    slug: rawCategory.pageSlug || rawCategory.slug || fallback.slug,
    count: Number(rawCategory.filterCount ?? rawCategory.count ?? fallback.count),
    aiRequired: rawCategory.aiRequirement || rawCategory.aiRequired || fallback.aiRequired,
  };
}

function withDefaults(filter, index, models = {}, categoryMap = CATEGORY_MAP) {
  const category = categoryMap[filter.category] || getCategory(filter.category);
  const modelKey = filter.model || 'flux2-klein-9b';
  const model = models[modelKey] || {};
  const slug = filter.slug || slugify(filter.name);
  const id = filter.id || `${slug.replace(/-/g, '_')}--${category.id}`;
  const variantCount = Math.max(1, Math.min(4, Number(filter.variantCount || 1)));
  const clientSideOnly = Boolean(filter.clientSideOnly);
  const requiresAI = filter.requiresAI ?? !clientSideOnly;
  const isDemoFilter = Boolean(filter.isDemoFilter);
  const estimatedNeurons = Number.isFinite(filter.estimatedNeurons) ? filter.estimatedNeurons : model.neuronsPerRun || 0;
  const tags = Array.isArray(filter.tags) ? filter.tags : [];
  const popularityScore = Number.isFinite(filter.popularityScore) ? filter.popularityScore : Math.max(30, 100 - index * 3);
  const publishedAt = filter.publishedAt || makeDateOffset(index);
  const searchText = (filter.searchText || [filter.name, filter.description, tags.join(' '), category.name, category.description, filter.type, modelKey]
    .filter(Boolean)
    .join(' '))
    .toLowerCase();

  return {
    strength: typeof filter.strength === 'number' ? filter.strength : 0.62,
    guidance: typeof filter.guidance === 'number' ? filter.guidance : 7.2,
    outputWidth: filter.outputWidth || 1024,
    outputHeight: filter.outputHeight || 1024,
    negativePrompt: filter.negativePrompt || 'blurry, distorted, low detail',
    prompt: filter.prompt || `${filter.name} transformation`,
    shareText: filter.shareText || `Made with ${SITE.name}:`,
    seasonalMonths: Array.isArray(filter.seasonalMonths) ? filter.seasonalMonths : [],
    helpPath: filter.helpPath || `${category.id}/${slug.replace(/-/g, '_')}_help.md`,
    helpMarkdown: filter.helpMarkdown || '',
    isSeasonalHighlight: Boolean(filter.isSeasonalHighlight),
    categoryDisplay: filter.categoryDisplay || category.name,
    slug,
    id,
    type: filter.type || 'img2img',
    model: modelKey,
    modelLabel: filter.modelName || getModelLabel(models, modelKey),
    variantCount,
    categoryMeta: category,
    requiresAI,
    clientSideOnly,
    isDemoFilter,
    estimatedNeurons,
    tags,
    popularityScore,
    publishedAt,
    searchText,
    previewBefore: filter.previewBefore || generatePreviewData(filter, 'before'),
    previewAfter: filter.previewAfter || generatePreviewData(filter, 'after'),
    systemImage: filter.systemImage || 'camera',
    ...filter,
  };
}

function normalizeCatalog(rawCatalog) {
  const models = rawCatalog?.models || FALLBACK_CATALOG.models;
  const categories = (rawCatalog?.categories?.length ? rawCatalog.categories : CATEGORY_META).map((category) => normalizeCategory(category));
  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category]));
  const filters = (rawCatalog?.filters || FALLBACK_CATALOG.filters).map((filter, index) => withDefaults(filter, index, models, categoryMap));
  return {
    generatedAt: rawCatalog?.generatedAt || FALLBACK_CATALOG.generatedAt,
    totalFilters: Number(rawCatalog?.totalFilters || rawCatalog?.filters?.length || CATEGORY_TOTAL),
    dailyFreeNeurons: Number(rawCatalog?.dailyFreeNeurons || 10000),
    starterCatalog: Boolean(rawCatalog?.starterCatalog),
    filtersReady: Number(rawCatalog?.filtersReady || rawCatalog?.filters?.length || rawCatalog?.totalFilters || filters.length),
    categories,
    models,
    filters,
  };
}

async function loadCatalog() {
  try {
    const response = await fetch(`${SITE.catalogPath}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const payload = await response.json();
    return {
      catalog: normalizeCatalog(payload),
      source: payload?.starterCatalog ? 'starter' : 'catalog',
    };
  } catch (error) {
    return {
      catalog: normalizeCatalog(FALLBACK_CATALOG),
      source: 'fallback',
      error,
    };
  }
}

async function loadHealthSnapshot() {
  if (!hasDom) return null;
  if (healthSnapshotPromise) return healthSnapshotPromise;
  healthSnapshotPromise = fetch('/api/health', { cache: 'no-store' })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      return payload?.data || null;
    })
    .catch(() => null);
  return healthSnapshotPromise;
}

function generatePreviewData(filter, phase = 'before') {
  const cacheKey = `${filter.slug || slugify(filter.name)}-${phase}`;
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);
  const category = getCategory(filter.category);
  const palette = CATEGORY_PALETTES[category.id] || ['#ec5b13', '#16a5a0', '#7c3aed'];
  const primary = palette[0];
  const secondary = palette[1];
  const tertiary = palette[2];
  const title = filter.name || 'Photo Filter';
  const subtitle = phase === 'before' ? 'Before' : 'After';
  const gradient = phase === 'before' ? `${secondary};${primary}` : `${primary};${tertiary}`;
  const icon = category.emoji;
  const [start, end] = gradient.split(';');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" role="img" aria-label="${escapeHtml(title)} ${subtitle}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
        <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.28)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1200" fill="url(#bg)" rx="80" />
      <circle cx="930" cy="280" r="180" fill="rgba(255,255,255,0.18)" />
      <circle cx="240" cy="980" r="220" fill="rgba(255,255,255,0.12)" />
      <rect x="110" y="110" width="980" height="980" rx="64" fill="url(#card)" stroke="rgba(255,255,255,0.32)" />
      <text x="160" y="220" font-family="Inter,Arial,sans-serif" font-size="76" fill="white" opacity="0.88">${icon}</text>
      <text x="160" y="310" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="64" fill="white">${escapeHtml(title)}</text>
      <text x="160" y="390" font-family="Inter,Arial,sans-serif" font-size="38" fill="rgba(255,255,255,0.88)">${escapeHtml(category.name)}</text>
      <g opacity="${phase === 'before' ? '0.68' : '1'}">
        <circle cx="598" cy="625" r="220" fill="rgba(255,255,255,0.22)" />
        <circle cx="598" cy="560" r="135" fill="rgba(255,255,255,0.26)" />
        <rect x="435" y="690" width="325" height="215" rx="150" fill="rgba(255,255,255,0.24)" />
      </g>
      <text x="160" y="1035" font-family="Inter,Arial,sans-serif" font-size="58" font-weight="800" fill="white">${escapeHtml(subtitle)}</text>
      <text x="160" y="1095" font-family="Inter,Arial,sans-serif" font-size="34" fill="rgba(255,255,255,0.9)">${phase === 'before' ? 'Clean source preview' : 'Transformed concept preview'}</text>
    </svg>`;
  const data = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  previewCache.set(cacheKey, data);
  return data;
}

function renderFilterCard(filter, options = {}) {
  const detailsHref = `/try.html?id=${encodeURIComponent(filter.id)}#details`;
  const tryHref = `/try.html?id=${encodeURIComponent(filter.id)}`;
  const compact = options.compact ? ' compact' : '';
  return `
    <article class="filter-card${compact}">
      <div class="filter-card__media">
        <img src="${filter.previewBefore}" alt="${escapeHtml(filter.name)} before preview" loading="lazy" />
        <img src="${filter.previewAfter}" alt="${escapeHtml(filter.name)} transformed preview" loading="lazy" />
      </div>
      <div class="filter-card__content">
        <div class="filter-card__badges">
          <span class="badge badge--brand">${filter.categoryMeta.emoji} ${escapeHtml(filter.categoryDisplay)}</span>
          ${filter.isDemoFilter ? '<span class="badge badge--success">FREE</span>' : ''}
          ${filter.clientSideOnly ? '<span class="badge badge--accent">Client-side</span>' : ''}
        </div>
        <div>
          <h3>${escapeHtml(filter.name)}</h3>
          <p class="filter-card__description">${escapeHtml(filter.description)}</p>
        </div>
        <div class="filter-card__meta">
          <span class="meta-text">${capitalize(filter.type)}</span>
          <span class="meta-text">${escapeHtml(filter.modelLabel)}</span>
          <span class="meta-text">${filter.estimatedNeurons} neurons</span>
        </div>
        <div class="filter-card__actions">
          <a class="button" href="${tryHref}">Try</a>
          <a class="button-ghost" href="${detailsHref}">Details</a>
        </div>
      </div>
    </article>`;
}

function renderCategoryCard(category, actualCount = 0) {
  const countCopy = actualCount
    ? `${actualCount} filters live${category.count && category.count !== actualCount ? ` · ${category.count} planned` : ''}`
    : `${category.count} planned filters`;
  return `
    <article class="detail-card">
      <div class="filter-card__badges">
        <span class="badge badge--brand">${category.emoji} ${escapeHtml(category.name)}</span>
        <span class="badge">${countCopy}</span>
      </div>
      <h3>${escapeHtml(category.name)}</h3>
      <p>${escapeHtml(category.description)}</p>
      <div class="card-actions">
        <a class="button" href="/categories/${category.slug}.html">Explore category</a>
        <a class="button-ghost" href="/browse.html#category=${encodeURIComponent(category.id)}">Browse matching filters</a>
      </div>
    </article>`;
}

function renderBeforeAfter({ beforeUrl, afterUrl, beforeLabel = 'Before', afterLabel = 'After', id, caption = '' }) {
  const sliderId = id || `compare-${Math.random().toString(36).slice(2, 9)}`;
  return `
    <div class="before-after" data-slider style="--position:52%">
      <div class="before-after__pane"><img src="${beforeUrl}" alt="${escapeHtml(beforeLabel)} image" /></div>
      <div class="before-after__after"><img src="${afterUrl}" alt="${escapeHtml(afterLabel)} image" /></div>
      <div class="before-after__labels">
        <span class="pill">${escapeHtml(beforeLabel)}</span>
        <span class="pill">${escapeHtml(afterLabel)}</span>
      </div>
      <div class="before-after__divider" aria-hidden="true"></div>
      <input id="${sliderId}" class="before-after__range" type="range" min="0" max="100" value="52" aria-label="Compare before and after preview" />
    </div>
    ${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ''}`;
}

function initBeforeAfterSliders(root = document) {
  root.querySelectorAll('[data-slider]').forEach((slider) => {
    const input = slider.querySelector('input[type="range"]');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';
    const sync = () => slider.style.setProperty('--position', `${input.value}%`);
    input.addEventListener('input', sync);
    sync();
  });
}

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getSeasonalFilters(filters) {
  const month = getCurrentMonth();
  const seasonal = filters.filter((filter) => filter.seasonalMonths?.includes(month));
  if (seasonal.length) return seasonal.sort(sortByPopularity);
  return filters.filter((filter) => filter.isSeasonalHighlight).sort(sortByPopularity);
}

function renderCatalogNotice(target, info) {
  if (!target) return;
  if (!info || info.source === 'catalog') {
    target.innerHTML = '';
    return;
  }
  const message = info.source === 'fallback'
    ? 'The full manifest was not found at /docs/filters-index.json, so the site loaded its built-in starter catalog shell.'
    : 'This starter manifest lives at /docs/filters-index.json and can be swapped for the generated production catalog later.';
  target.innerHTML = `
    <div class="notice glass-panel">
      <div>
        <strong>Starter catalog mode</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <a class="button-ghost" href="/browse.html">Preview the catalog UX</a>
    </div>`;
}

function renderHealthNotice(target, health) {
  if (!target || !health?.storage) return;
  target.querySelector('[data-health-notice]')?.remove();
  const { mode, r2Available, r2SetupGuideUrl } = health.storage;
  if (mode === 'r2' && r2Available) return;

  const title = mode === 'direct' ? 'Direct mode is active' : 'R2 setup is still required';
  const body = mode === 'direct'
    ? 'Live transforms can still return a downloadable image immediately, but shareable 24-hour result URLs and /api/upload stay disabled until PHOTO_BUCKET is connected.'
    : 'This deployment expects R2 storage, but PHOTO_BUCKET is not bound yet, so upload-backed flows will fail until R2 is configured.';
  target.insertAdjacentHTML('beforeend', `
    <div class="notice glass-panel" data-health-notice>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
      </div>
      ${r2SetupGuideUrl ? `<a class="button-ghost" href="${r2SetupGuideUrl}">R2 setup guide</a>` : ''}
    </div>`);
}

function renderHeader(page) {
  const pageToHref = {
    browse: '/browse.html',
    try: '/try.html',
    'category-index': '/categories/index.html',
    'category-detail': '/categories/index.html',
  };
  const currentHref = pageToHref[page] || '/';
  const navItems = [
    ['Browse', '/browse.html'],
    ['Try', '/try.html'],
    ['Categories', '/categories/index.html'],
    ['Get App', SITE.appLink],
  ];
  return `
    <div class="site-header__inner">
      <a class="brand" href="/index.html" aria-label="${SITE.name} home">
        <span class="brand__mark"><img src="/docs/assets/favicon.svg" alt="" aria-hidden="true" /></span>
        <span>
          ${SITE.name}
          <small>Cloudflare Pages shell · PRD-aligned</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        ${navItems.map(([label, href]) => `<a href="${href}" ${href === currentHref ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <div class="header-actions">
        <div class="theme-menu">
          <button class="button-ghost" type="button" id="theme-menu-button" aria-haspopup="true" aria-expanded="false">Theme</button>
          <div class="theme-menu__panel" id="theme-menu-panel" hidden>
            ${['system', 'light', 'dark'].map((theme) => `<button class="theme-option" type="button" data-theme-value="${theme}">${capitalize(theme)}</button>`).join('')}
          </div>
        </div>
        <a class="button" href="/try.html">Try a Filter</a>
      </div>
    </div>`;
}

function renderFooter() {
  return `
    <div class="site-footer__inner">
      <div class="footer-grid">
        <div class="footer-column">
          <a class="brand" href="/index.html">
            <span class="brand__mark"><img src="/docs/assets/favicon.svg" alt="" aria-hidden="true" /></span>
            <span>
              ${SITE.name}
              <small>Upload, pick, share.</small>
            </span>
          </a>
          <p>Catalog-driven Cloudflare Pages shell with shared browse, try, category, and theme components powered by <code>/docs/filters-index.json</code>.</p>
        </div>
        <div class="footer-column">
          <strong>Explore</strong>
          <a href="/browse.html">Browse filters</a>
          <a href="/try.html">Try a filter</a>
          <a href="/categories/index.html">Categories</a>
          <a href="/about.html#app-availability">Get the app</a>
        </div>
        <div class="footer-column">
          <strong>GIC ecosystem</strong>
          <a href="https://forms.gic.mx" target="_blank" rel="noreferrer">forms.gic.mx</a>
          <a href="https://onepageapps.gic.mx" target="_blank" rel="noreferrer">onePageApps.gic.mx</a>
          <a href="https://gic.mx" target="_blank" rel="noreferrer">gic.mx</a>
        </div>
        <div class="footer-column">
          <strong>Legal</strong>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="/contact.html">Contact</a>
          <a href="/about.html">About</a>
        </div>
      </div>
      <div class="footer-note">
        <span>Free demo filters use a daily neuron budget. Client-side effects never leave the browser.</span>
        <span>© ${new Date().getFullYear()} GIC</span>
      </div>
    </div>`;
}

function applyTheme(theme) {
  if (!hasDom) return;
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
}

function loadThemePreference() {
  if (!hasDom) return 'system';
  const stored = localStorage.getItem('gic-theme');
  return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
}

function initThemeControls() {
  const button = document.getElementById('theme-menu-button');
  const panel = document.getElementById('theme-menu-panel');
  if (!button || !panel) return;
  const updateButtons = () => {
    const preference = loadThemePreference();
    panel.querySelectorAll('[data-theme-value]').forEach((option) => {
      option.setAttribute('aria-pressed', String(option.dataset.themeValue === preference));
    });
  };
  updateButtons();
  button.addEventListener('click', () => {
    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', 'hidden');
    button.setAttribute('aria-expanded', String(isHidden));
  });
  document.addEventListener('click', (event) => {
    if (!panel.contains(event.target) && event.target !== button) {
      panel.setAttribute('hidden', 'hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  });
  panel.querySelectorAll('[data-theme-value]').forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.dataset.themeValue;
      localStorage.setItem('gic-theme', value);
      applyTheme(value);
      updateButtons();
      panel.setAttribute('hidden', 'hidden');
      button.setAttribute('aria-expanded', 'false');
    });
  });
}

function injectShell(page) {
  const header = document.querySelector('[data-site-header]');
  const footer = document.querySelector('[data-site-footer]');
  if (header) header.innerHTML = renderHeader(page);
  if (footer) footer.innerHTML = renderFooter();
  initThemeControls();
}

function renderKpi(label, value, hint = '') {
  return `
    <div class="stat-card">
      <span class="meta-text">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${hint ? `<p class="microcopy">${escapeHtml(hint)}</p>` : ''}
    </div>`;
}

function renderSkeletonCards(target, count = 6) {
  if (!target) return;
  target.innerHTML = Array.from({ length: count }, () => '<div class="skeleton skeleton-card"></div>').join('');
}

function updateMeta({ title, description, canonicalPath, image = '/docs/assets/social-preview.svg' }) {
  if (!hasDom) return;
  document.title = title;
  const canonical = document.getElementById('canonical-link');
  if (canonical && canonicalPath) canonical.href = `${SITE.baseUrl}${canonicalPath}`;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta && description) descriptionMeta.content = description;
  const metaMap = {
    'meta[property="og:title"]': title,
    'meta[property="og:description"]': description,
    'meta[property="og:url"]': canonicalPath ? `${SITE.baseUrl}${canonicalPath}` : window.location.href,
    'meta[property="og:image"]': image.startsWith('http') ? image : `${SITE.baseUrl}${image}`,
    'meta[name="twitter:title"]': title,
    'meta[name="twitter:description"]': description,
    'meta[name="twitter:image"]': image.startsWith('http') ? image : `${SITE.baseUrl}${image}`,
  };
  Object.entries(metaMap).forEach(([selector, value]) => {
    const meta = document.querySelector(selector);
    if (meta && value) meta.content = value;
  });
}

function updateSchema(payload) {
  const script = document.getElementById('page-schema');
  if (!script) return;
  script.textContent = JSON.stringify(payload, null, 2);
}

function showToast(message) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${SITE.name}</strong><p>${escapeHtml(message)}</p>`;
  region.appendChild(toast);
  const timer = window.setTimeout(() => {
    toast.remove();
    toastTimers.delete(timer);
  }, 3200);
  toastTimers.add(timer);
}

function track(eventName, detail = {}) {
  if (!hasDom) return;
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, detail);
  }
  window.dispatchEvent(new CustomEvent(`gic:${eventName}`, { detail }));
}

function getUsageSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem('gic-photo-usage') || '{}');
    if (raw.date !== today) {
      const reset = { date: today, transformsUsed: 0, neuronsUsed: 0 };
      localStorage.setItem('gic-photo-usage', JSON.stringify(reset));
      return reset;
    }
    return {
      date: raw.date || today,
      transformsUsed: Number(raw.transformsUsed || 0),
      neuronsUsed: Number(raw.neuronsUsed || 0),
    };
  } catch {
    const reset = { date: today, transformsUsed: 0, neuronsUsed: 0 };
    localStorage.setItem('gic-photo-usage', JSON.stringify(reset));
    return reset;
  }
}

function incrementUsage(filter) {
  const usage = getUsageSnapshot();
  usage.transformsUsed += 1;
  usage.neuronsUsed += filter.estimatedNeurons || 0;
  localStorage.setItem('gic-photo-usage', JSON.stringify(usage));
  return usage;
}

function renderUsageGrid(target, catalog, filter = null) {
  if (!target) return;
  const usage = getUsageSnapshot();
  const remainingFree = Math.max(0, 10 - usage.transformsUsed);
  const remainingNeurons = Math.max(0, catalog.dailyFreeNeurons - usage.neuronsUsed);
  const currentCost = filter ? `${filter.estimatedNeurons} neurons / run` : 'Pick a filter to see per-run cost';
  target.innerHTML = `
    ${renderKpi('Free demo runs today', `${usage.transformsUsed}/10`, `${remainingFree} demo runs remaining`)}
    ${renderKpi('Neuron budget', `${formatNumber(usage.neuronsUsed)}/${formatNumber(catalog.dailyFreeNeurons)}`, `${formatNumber(remainingNeurons)} neurons left`)}
    ${renderKpi('Current filter', filter ? escapeHtml(filter.name) : 'Choose a filter', currentCost)}
    ${renderKpi('Unlimited option', 'Companion app', 'Bring your own API key later for full access')}`;
}

function markdownToHtml(markdown = '') {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;
  lines.forEach((line) => {
    if (!line.trim()) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      return;
    }
    if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h3>${escapeHtml(line.slice(3))}</h3>`);
      return;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      return;
    }
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(`<p>${escapeHtml(line)}</p>`);
  });
  if (inList) html.push('</ul>');
  return `<div class="markdown-content">${html.join('')}</div>`;
}

async function getHelpHtml(filter) {
  if (filter.helpMarkdown) return markdownToHtml(filter.helpMarkdown);
  try {
    const response = await fetch(`/${filter.helpPath}`);
    if (!response.ok) throw new Error('Help missing');
    return markdownToHtml(await response.text());
  } catch {
    return markdownToHtml(`## Quick tips\n- Start with a bright, centered portrait.\n- ${filter.clientSideOnly ? 'Adjust the intensity slider to tune the live effect.' : 'Demo filters are tuned for chest-up and half-body photos.'}\n- Share text is ready after the result renders.`);
  }
}

function readHashState() {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  return {
    search: params.get('search') || '',
    categories: params.getAll('category'),
    types: params.getAll('type'),
    models: params.getAll('model'),
    ai: params.get('ai') || 'all',
    demo: params.get('demo') || 'all',
    seasonal: params.get('seasonal') === 'true',
    sort: params.get('sort') || 'popular',
  };
}

function writeHashState(state) {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  state.categories.forEach((category) => params.append('category', category));
  state.types.forEach((type) => params.append('type', type));
  state.models.forEach((model) => params.append('model', model));
  if (state.ai !== 'all') params.set('ai', state.ai);
  if (state.demo !== 'all') params.set('demo', state.demo);
  if (state.seasonal) params.set('seasonal', 'true');
  if (state.sort !== 'popular') params.set('sort', state.sort);
  const nextHash = params.toString();
  if (`#${nextHash}` !== window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${nextHash ? `#${nextHash}` : ''}`);
  }
}

function matchesFilter(filter, state) {
  const matchesSearch = !state.search || filter.searchText.includes(state.search.toLowerCase());
  const matchesCategory = !state.categories.length || state.categories.includes(filter.category);
  const matchesType = !state.types.length || state.types.includes(filter.type);
  const matchesModel = !state.models.length || state.models.includes(filter.model);
  const matchesAi = state.ai === 'all' || (state.ai === 'yes' ? filter.requiresAI : !filter.requiresAI);
  const matchesDemo = state.demo === 'all' || (state.demo === 'yes' ? filter.isDemoFilter : !filter.isDemoFilter);
  const matchesSeasonal = !state.seasonal || filter.seasonalMonths.includes(getCurrentMonth());
  return matchesSearch && matchesCategory && matchesType && matchesModel && matchesAi && matchesDemo && matchesSeasonal;
}

function sortFilters(filters, sort) {
  const sorted = [...filters];
  switch (sort) {
    case 'alpha':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'category':
      return sorted.sort((a, b) => a.categoryDisplay.localeCompare(b.categoryDisplay) || a.name.localeCompare(b.name));
    case 'newest':
      return sorted.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    case 'popular':
    default:
      return sorted.sort(sortByPopularity);
  }
}

function renderOptionList({ options, selectedValues, type = 'checkbox', name, counts, target }) {
  if (!target) return;
  target.innerHTML = options.map((option) => {
    const checked = selectedValues.includes(option.value);
    const count = counts?.[option.value] ?? 0;
    return `
      <div class="checkbox-row">
        <label>
          <input type="${type}" name="${name}" value="${option.value}" ${checked ? 'checked' : ''} />
          <span>${escapeHtml(option.label)}</span>
        </label>
        <span class="meta-text">${count}</span>
      </div>`;
  }).join('');
}

function getFilterCounts(filters, key) {
  return filters.reduce((counts, filter) => {
    const value = filter[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function createSelectionMarkup(filters) {
  return filters.map((filter) => `
    <article class="detail-card">
      <div class="filter-card__badges">
        <span class="badge badge--brand">${filter.categoryMeta.emoji} ${escapeHtml(filter.categoryDisplay)}</span>
        ${filter.isDemoFilter ? '<span class="badge badge--success">FREE</span>' : ''}
      </div>
      <h3>${escapeHtml(filter.name)}</h3>
      <p>${escapeHtml(filter.description)}</p>
      <div class="card-actions">
        <a class="button" href="/try.html?id=${encodeURIComponent(filter.id)}">Try this filter</a>
      </div>
    </article>`).join('');
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function resizeFile(file, maxDimension = 1024) {
  const originalUrl = URL.createObjectURL(file);
  const image = await loadImage(originalUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(originalUrl);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return {
    blob,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width,
    height,
  };
}

function getTransformPalette(filter, variantIndex = 0) {
  const palette = CATEGORY_PALETTES[filter.category] || ['#ec5b13', '#16a5a0', '#7c3aed'];
  return palette.map((_, index) => palette[(index + variantIndex) % palette.length]);
}

async function createVariantDataUrl(sourceUrl, filter, variantIndex = 0, intensity = 0.65) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement('canvas');
  const maxDimension = Math.max(image.width, image.height, 768);
  canvas.width = maxDimension;
  canvas.height = maxDimension;
  const context = canvas.getContext('2d');
  const scale = maxDimension / Math.max(image.width, image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (maxDimension - drawWidth) / 2;
  const offsetY = (maxDimension - drawHeight) / 2;
  const palette = getTransformPalette(filter, variantIndex);
  const hue = (variantIndex * 24) + (filter.clientSideOnly ? 18 : 10);
  const saturate = 1.1 + intensity * 0.8;
  const contrast = 1.03 + intensity * 0.28;
  const brightness = 0.98 + intensity * 0.16;

  context.fillStyle = '#111827';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = `${filter.category === 'retro_vintage' ? 'sepia(0.38) ' : ''}saturate(${saturate}) contrast(${contrast}) brightness(${brightness}) hue-rotate(${hue}deg)`;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  context.filter = 'none';

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `${palette[0]}55`);
  gradient.addColorStop(0.6, `${palette[1]}2a`);
  gradient.addColorStop(1, `${palette[2]}55`);
  context.globalCompositeOperation = filter.clientSideOnly ? 'soft-light' : 'overlay';
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'screen';
  context.fillStyle = `${palette[2]}22`;
  context.beginPath();
  context.arc(canvas.width * 0.82, canvas.height * 0.22, canvas.width * 0.16, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'source-over';

  if (filter.category === 'retro_vintage') {
    context.fillStyle = 'rgba(120, 78, 45, 0.12)';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.strokeStyle = 'rgba(255,255,255,0.35)';
  context.lineWidth = Math.max(8, canvas.width * 0.01);
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  context.fillStyle = 'rgba(17,24,39,0.72)';
  context.fillRect(40, canvas.height - 150, canvas.width - 80, 94);
  context.fillStyle = 'white';
  context.font = `${Math.round(canvas.width * 0.05)}px Inter, sans-serif`;
  context.fillText(filter.name, 70, canvas.height - 94);
  context.font = `${Math.round(canvas.width * 0.025)}px Inter, sans-serif`;
  context.fillText(filter.clientSideOnly ? 'Instant client-side preview' : 'Website shell preview mode', 70, canvas.height - 54);

  return canvas.toDataURL('image/jpeg', 0.94);
}

async function generatePreviewVariants(sourceUrl, filter, intensity = 0.65) {
  const count = filter.clientSideOnly ? 1 : Math.max(1, Math.min(filter.variantCount || 1, 3));
  const variants = [];
  for (let index = 0; index < count; index += 1) {
    variants.push(await createVariantDataUrl(sourceUrl, filter, index, intensity));
  }
  return variants;
}

function normalizeTransformResponse(payload) {
  const buckets = [payload?.images, payload?.variants, payload?.results, payload?.data].flat().filter(Boolean);
  const candidates = [];
  if (typeof payload?.image === 'string') candidates.push(payload.image);
  if (typeof payload?.imageUrl === 'string') candidates.push(payload.imageUrl);
  buckets.forEach((item) => {
    if (typeof item === 'string') candidates.push(item);
    else if (item?.url) candidates.push(item.url);
    else if (item?.image) candidates.push(item.image);
  });
  return candidates;
}

async function attemptApiTransform(filter, blob, intensity = 0.65) {
  const payload = new FormData();
  payload.append('image', blob, 'upload.jpg');
  payload.append('filterId', filter.id);
  payload.append('intensity', String(intensity));
  const response = await fetch('/api/transform', { method: 'POST', body: payload });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `Transform failed with ${response.status}`);
  }
  const storageMode = response.headers.get('x-storage-mode') || 'r2';
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    const blobResult = await response.blob();
    return {
      images: [URL.createObjectURL(blobResult)],
      mode: 'api',
      storageMode,
    };
  }
  const data = await response.json();
  const images = normalizeTransformResponse(data?.data || data);
  if (!images.length) throw new Error('Transform response did not include images');
  return {
    images,
    mode: 'api',
    storageMode: data?.data?.storage?.mode || data?.storage?.mode || storageMode,
  };
}

function updateProgress(progressElement, percentage) {
  if (!progressElement) return;
  const bar = progressElement.querySelector('span');
  if (bar) bar.style.setProperty('--progress', `${percentage}%`);
}

async function runTransform({ filter, source, sourceBlob, intensity, statusElement, progressElement }) {
  const messages = filter.clientSideOnly
    ? ['Applying the browser effect…', 'Dialing in color and contrast…', 'Rendering the instant preview…']
    : ['Preparing your upload…', 'Mixing the palette…', 'Building the transformed result shell…'];
  let step = 0;
  if (statusElement) statusElement.textContent = messages[0];
  if (progressElement) progressElement.hidden = false;
  updateProgress(progressElement, 14);
  const ticker = window.setInterval(() => {
    step = Math.min(step + 1, messages.length - 1);
    if (statusElement) statusElement.textContent = messages[step];
    updateProgress(progressElement, 14 + step * 28);
  }, 800);

  try {
    let images = [];
    let mode = 'preview';
    if (!filter.clientSideOnly) {
      try {
        images = await attemptApiTransform(filter, sourceBlob, intensity);
        mode = 'api';
      } catch {
        images = await generatePreviewVariants(source, filter, intensity);
        mode = 'preview';
      }
    } else {
      images = await generatePreviewVariants(source, filter, intensity);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    return { images, mode };
  } finally {
    window.clearInterval(ticker);
    updateProgress(progressElement, 100);
    window.setTimeout(() => {
      if (progressElement) progressElement.hidden = true;
    }, 500);
  }
}

function renderOverview(filter) {
  return `
    <div class="markdown-content">
      <p>${escapeHtml(filter.description)}</p>
      <ul>
        <li><strong>Type:</strong> ${escapeHtml(filter.type)}</li>
        <li><strong>Demo access:</strong> ${filter.isDemoFilter ? 'Free to try on the web shell' : 'Use your own API key in the companion app'}</li>
        <li><strong>Model:</strong> ${escapeHtml(filter.modelLabel)}</li>
        <li><strong>Share text:</strong> ${escapeHtml(filter.shareText)}</li>
      </ul>
    </div>`;
}

function renderTech(filter, catalog) {
  const model = catalog.models[filter.model] || {};
  return `
    <div class="markdown-content">
      <h3>Transform settings</h3>
      <ul>
        <li>Prompt baked into manifest: ${escapeHtml(filter.prompt)}</li>
        <li>Negative prompt: ${escapeHtml(filter.negativePrompt)}</li>
        <li>Strength ${filter.strength} · Guidance ${filter.guidance}</li>
        <li>Output target ${filter.outputWidth}×${filter.outputHeight}</li>
        <li>Estimated neurons ${filter.estimatedNeurons} · model ${escapeHtml(model.id || filter.modelLabel)}</li>
      </ul>
    </div>`;
}

function renderStagePlaceholder(filter) {
  if (!filter) {
    return `
      <div class="stage-placeholder">
        <div>
          <h3>Pick a filter to start</h3>
          <p>Choose a transformation from the curated grid, upload a JPEG/PNG/WebP image, and preview the result flow.</p>
        </div>
      </div>`;
  }
  return `
    <div class="stage-placeholder stage-placeholder--example">
      <div class="stage-placeholder__copy">
        <h3>Upload a photo for ${escapeHtml(filter.name)}</h3>
        <p>${filter.clientSideOnly ? 'This effect renders in the browser.' : 'Use this catalog example to judge the look first, then upload your own photo when you are ready.'}</p>
      </div>
      ${renderBeforeAfter({
        beforeUrl: filter.previewBefore,
        afterUrl: filter.previewAfter,
        beforeLabel: 'Catalog example',
        afterLabel: filter.name,
        id: `placeholder-${filter.id}`,
        caption: filter.clientSideOnly ? 'Instant effect example from the catalog' : 'Example before/after preview from the catalog',
      })}
    </div>`;
}

function renderVariants(target, variants, activeIndex, onSelect) {
  if (!target) return;
  if (!variants.length) {
    target.innerHTML = '';
    return;
  }
  target.innerHTML = variants.map((variant, index) => `
    <div class="variant-card" data-active="${index === activeIndex}">
      <button type="button" data-variant-index="${index}" aria-label="Select variant ${index + 1}">
        <img src="${variant}" alt="Variant ${index + 1}" />
        <div class="variant-card__label">Variant ${index + 1}</div>
      </button>
    </div>`).join('');
  target.querySelectorAll('[data-variant-index]').forEach((button) => {
    button.addEventListener('click', () => onSelect(Number(button.dataset.variantIndex)));
  });
}

async function initHomePage() {
  const noticeTarget = document.getElementById('catalog-notice');
  const heroStats = document.getElementById('hero-stats');
  const showcase = document.getElementById('season-showcase');
  const seasonalGrid = document.getElementById('seasonal-grid');
  const categoryGrid = document.getElementById('category-grid');
  const popularGrid = document.getElementById('popular-grid');
  const heroFilterName = document.getElementById('hero-filter-name');
  renderSkeletonCards(seasonalGrid, 4);
  renderSkeletonCards(categoryGrid, 6);
  renderSkeletonCards(popularGrid, 4);
  const info = await loadCatalog();
  const { catalog } = info;
  renderCatalogNotice(noticeTarget, info);
  const seasonal = getSeasonalFilters(catalog.filters).slice(0, 6);
  const showcaseFilter = seasonal[0] || sortFilters(catalog.filters, 'popular')[0];
  const categories = catalog.categories?.length ? catalog.categories : CATEGORY_META;
  const liveCatalogCopy = catalog.starterCatalog ? `${catalog.filtersReady} filters live in the starter manifest` : `${catalog.filtersReady} filters live in the catalog`;
  heroStats.innerHTML = [
    renderKpi('Catalog size', `${formatNumber(catalog.totalFilters)} filters`, liveCatalogCopy),
    renderKpi('Categories', `${categories.length}`, 'SEO landing pages included'),
    renderKpi('Free to try', 'Demo-ready shell', `${catalog.filters.filter((filter) => filter.isDemoFilter).length} filters marked FREE`),
  ].join('');
  if (showcaseFilter) {
    if (heroFilterName) heroFilterName.textContent = showcaseFilter.name;
    showcase.innerHTML = renderBeforeAfter({
      beforeUrl: showcaseFilter.previewBefore,
      afterUrl: showcaseFilter.previewAfter,
      beforeLabel: 'Source portrait',
      afterLabel: showcaseFilter.name,
      caption: `${showcaseFilter.name} · ${showcaseFilter.categoryDisplay}`,
    });
  }
  seasonalGrid.innerHTML = seasonal.map((filter) => renderFilterCard(filter)).join('');
  categoryGrid.innerHTML = categories.slice(0, 6).map((category) => {
    const actualCount = catalog.filters.filter((filter) => filter.category === category.id).length;
    return renderCategoryCard(category, actualCount);
  }).join('');
  popularGrid.innerHTML = sortFilters(catalog.filters, 'popular').slice(0, 8).map((filter) => renderFilterCard(filter, { compact: true })).join('');
  initBeforeAfterSliders();
  updateSchema({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.baseUrl,
    description: 'Browse the gicPhotoFilters catalog, try free demo filters, and preview the Cloudflare Pages shell for photofilters.gic.mx.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.baseUrl}/browse.html#search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });
}

async function initBrowsePage() {
  const noticeTarget = document.getElementById('catalog-notice');
  const grid = document.getElementById('browse-grid');
  const resultsMeta = document.getElementById('results-meta');
  const searchInput = document.getElementById('browse-search');
  const sortInput = document.getElementById('browse-sort');
  const aiInput = document.getElementById('filter-ai');
  const demoInput = document.getElementById('filter-demo');
  const seasonalInput = document.getElementById('filter-seasonal');
  const clearButton = document.getElementById('browse-clear');
  const categoryTarget = document.getElementById('filter-category-options');
  const typeTarget = document.getElementById('filter-type-options');
  const modelTarget = document.getElementById('filter-model-options');

  renderSkeletonCards(grid, 8);
  const info = await loadCatalog();
  const { catalog } = info;
  renderCatalogNotice(noticeTarget, info);
  const categories = catalog.categories?.length ? catalog.categories : CATEGORY_META;

  const state = readHashState();
  searchInput.value = state.search;
  sortInput.value = state.sort;
  aiInput.value = state.ai;
  demoInput.value = state.demo;
  seasonalInput.checked = state.seasonal;

  const typeOptions = ['img2img', 'inpainting', 'style-transfer', 'utility', 'overlay'];
  renderOptionList({
    options: categories.map((category) => ({ label: category.name, value: category.id })),
    selectedValues: state.categories,
    name: 'category',
    counts: Object.fromEntries(categories.map((category) => [category.id, catalog.filters.filter((filter) => filter.category === category.id).length])),
    target: categoryTarget,
  });
  renderOptionList({
    options: typeOptions.map((type) => ({ label: capitalize(type), value: type })),
    selectedValues: state.types,
    name: 'type',
    counts: getFilterCounts(catalog.filters, 'type'),
    target: typeTarget,
  });
  renderOptionList({
    options: Object.keys(catalog.models).map((modelKey) => ({ label: getModelLabel(catalog.models, modelKey), value: modelKey })),
    selectedValues: state.models,
    name: 'model',
    counts: getFilterCounts(catalog.filters, 'model'),
    target: modelTarget,
  });

  const collectState = () => ({
    search: searchInput.value.trim(),
    sort: sortInput.value,
    ai: aiInput.value,
    demo: demoInput.value,
    seasonal: seasonalInput.checked,
    categories: Array.from(categoryTarget.querySelectorAll('input:checked')).map((input) => input.value),
    types: Array.from(typeTarget.querySelectorAll('input:checked')).map((input) => input.value),
    models: Array.from(modelTarget.querySelectorAll('input:checked')).map((input) => input.value),
  });

  const render = () => {
    const nextState = collectState();
    writeHashState(nextState);
    const filtered = sortFilters(catalog.filters.filter((filter) => matchesFilter(filter, nextState)), nextState.sort);
    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No filters matched this search</h3>
          <p>Try clearing a few filters, or use the request CTA to note a missing transformation before the full 205-filter manifest lands.</p>
          <div class="card-actions">
            <button type="button" class="button-ghost" id="empty-clear">Clear filters</button>
            <a class="button" href="/contact.html">Request a filter</a>
          </div>
        </div>`;
      grid.querySelector('#empty-clear')?.addEventListener('click', () => clearButton.click());
    } else {
      grid.innerHTML = filtered.map((filter) => renderFilterCard(filter)).join('');
    }
    resultsMeta.innerHTML = `
      <div>
        <strong>${filtered.length}</strong> matching filters · <span class="meta-text">${catalog.totalFilters} total in the catalog</span>
      </div>`;
    track('category_browse', { count: filtered.length, source: 'browse-page' });
  };

  [searchInput, sortInput, aiInput, demoInput, seasonalInput].forEach((element) => {
    element.addEventListener('input', render);
    element.addEventListener('change', render);
  });
  [categoryTarget, typeTarget, modelTarget].forEach((target) => {
    target.addEventListener('change', render);
  });
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    sortInput.value = 'popular';
    aiInput.value = 'all';
    demoInput.value = 'all';
    seasonalInput.checked = false;
    [categoryTarget, typeTarget, modelTarget].forEach((target) => {
      target.querySelectorAll('input').forEach((input) => {
        input.checked = false;
      });
    });
    render();
  });
  render();
  updateSchema({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${SITE.name} Browse`,
    url: `${SITE.baseUrl}/browse.html`,
    description: 'Browse the searchable gicPhotoFilters catalog, including category, type, demo, seasonal, and model filters.',
  });
}

async function initCategoryIndexPage() {
  const noticeTarget = document.getElementById('catalog-notice');
  const grid = document.getElementById('category-index-grid');
  const stats = document.getElementById('category-index-stats');
  renderSkeletonCards(grid, CATEGORY_META.length);
  const info = await loadCatalog();
  const { catalog } = info;
  renderCatalogNotice(noticeTarget, info);
  const categories = catalog.categories?.length ? catalog.categories : CATEGORY_META;
  stats.innerHTML = [
    renderKpi('Categories', String(categories.length), 'Static SEO landing pages shipped in this shell'),
    renderKpi('Filters live', String(catalog.filtersReady), catalog.starterCatalog ? 'Starter manifest loaded today' : 'Catalog data is live on the site'),
    renderKpi('Catalog total', formatNumber(catalog.totalFilters), 'Browse, try, and category pages share the same data source'),
  ].join('');
  grid.innerHTML = categories.map((category) => renderCategoryCard(category, catalog.filters.filter((filter) => filter.category === category.id).length)).join('');
  updateSchema({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${SITE.name} categories`,
    url: `${SITE.baseUrl}/categories/index.html`,
    description: 'Category landing pages for the planned gicPhotoFilters catalog.',
  });
}

async function initCategoryDetailPage() {
  const categoryId = document.body.dataset.category;
  const noticeTarget = document.getElementById('catalog-notice');
  const hero = document.getElementById('category-hero');
  const meta = document.getElementById('category-meta');
  const grid = document.getElementById('category-grid');
  renderSkeletonCards(grid, 4);
  const info = await loadCatalog();
  const { catalog } = info;
  renderCatalogNotice(noticeTarget, info);
  const category = (catalog.categories || []).find((item) => item.id === categoryId) || getCategory(categoryId);
  const filters = sortFilters(catalog.filters.filter((filter) => filter.category === category.id), 'popular');
  hero.innerHTML = `
    <span class="page-eyebrow">${category.emoji} Category detail</span>
    <h1>${escapeHtml(category.name)}</h1>
    <p class="lead">${escapeHtml(category.description)}</p>
    <div class="detail-grid">
      ${renderKpi('Catalog filters', String(category.count || filters.length), 'Category metadata from the shared manifest')}
      ${renderKpi('Filters live', String(filters.length), filters.length ? 'Linked to try and browse flows today' : 'Ready for the generated manifest')}
      ${renderKpi('AI required', category.aiRequired, 'Pulled from the PRD summary')}
    </div>`;
  meta.innerHTML = `<span class="badge badge--brand">${filters.length} filters live</span><span class="badge">${category.count || filters.length} in catalog</span>`;
  grid.innerHTML = filters.length
    ? filters.map((filter) => renderFilterCard(filter)).join('')
    : `<div class="empty-state"><h3>${escapeHtml(category.name)} is wired and waiting for data</h3><p>As soon as <code>docs/filters-index.json</code> includes this category, the page will populate automatically without backend changes.</p><div class="card-actions"><a class="button" href="/browse.html">See the catalog</a><a class="button-ghost" href="/categories/index.html">Back to categories</a></div></div>`;
  updateMeta({
    title: `${category.name} · ${SITE.name}`,
    description: `${category.description} Explore the ${category.name.toLowerCase()} catalog on ${SITE.name}.`,
    canonicalPath: `/categories/${category.slug}.html`,
  });
  updateSchema({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} · ${SITE.name}`,
    url: `${SITE.baseUrl}/categories/${category.slug}.html`,
    description: category.description,
  });
}

async function initTryPage() {
  const noticeTarget = document.getElementById('catalog-notice');
  const breadcrumb = document.getElementById('try-breadcrumb');
  const summary = document.getElementById('try-filter-summary');
  const selection = document.getElementById('try-selection');
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');
  const transformButton = document.getElementById('transform-button');
  const resetButton = document.getElementById('reset-photo-button');
  const downloadButton = document.getElementById('download-button');
  const shareButton = document.getElementById('share-button');
  const status = document.getElementById('try-status');
  const progress = document.getElementById('try-progress');
  const stageSlot = document.getElementById('stage-slot');
  const stageNote = document.getElementById('stage-note');
  const variantsTarget = document.getElementById('variant-list');
  const usageGrid = document.getElementById('usage-grid');
  const effectsControls = document.getElementById('effects-controls');
  const intensityInput = document.getElementById('effects-intensity');
  const resultActions = document.getElementById('result-actions');
  const overviewTab = document.getElementById('tab-overview');
  const helpTab = document.getElementById('tab-help');
  const techTab = document.getElementById('tab-tech');
  const relatedGrid = document.getElementById('related-grid');
  const trySelectionTitle = document.getElementById('selection-title');
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id');

  const info = await loadCatalog();
  const { catalog } = info;
  const health = await loadHealthSnapshot();
  renderCatalogNotice(noticeTarget, info);
  renderHealthNotice(noticeTarget, health);

  const state = {
    catalog,
    health,
    filter: catalog.filters.find((item) => item.id === requestedId) || sortFilters(catalog.filters, 'popular')[0],
    sourceDataUrl: '',
    sourceBlob: null,
    variants: [],
    activeVariantIndex: 0,
    outputMode: '',
    helpHtml: '',
  };

  const setSummary = async () => {
    const filter = state.filter;
    const demoOnlyOnWeb = Boolean(state.health?.limits?.demoMode) && !filter.isDemoFilter && !filter.clientSideOnly;
    const related = sortFilters(catalog.filters.filter((item) => item.category === filter.category && item.id !== filter.id), 'popular').slice(0, 6);
    trySelectionTitle.textContent = requestedId ? 'Switch filters' : 'Popular filters to start';
    selection.innerHTML = createSelectionMarkup(sortFilters(catalog.filters, 'popular').slice(0, 6));
    breadcrumb.innerHTML = `
      <a href="/index.html">Home</a>
      <span>→</span>
      <a href="/categories/${filter.categoryMeta.slug}.html">${escapeHtml(filter.categoryDisplay)}</a>
      <span>→</span>
      <span>${escapeHtml(filter.name)}</span>`;
    summary.innerHTML = `
      <span class="page-eyebrow">${filter.categoryMeta.emoji} ${escapeHtml(filter.categoryDisplay)}</span>
      <h1>${escapeHtml(filter.name)}</h1>
      <p class="lead">${escapeHtml(filter.description)}</p>
      <div class="filter-summary__badges">
        <span class="badge badge--brand">${capitalize(filter.type)}</span>
        <span class="badge">${escapeHtml(filter.modelLabel)}</span>
        <span class="badge">${filter.estimatedNeurons} neurons</span>
        ${filter.isDemoFilter ? '<span class="badge badge--success">FREE</span>' : '<span class="badge badge--warning">Bring your own key</span>'}
        ${filter.clientSideOnly ? '<span class="badge badge--accent">Browser-only</span>' : ''}
      </div>`;
    effectsControls.classList.toggle('hidden', !filter.clientSideOnly);
    transformButton.textContent = filter.clientSideOnly
      ? 'Apply effect instantly'
      : demoOnlyOnWeb
        ? 'Preview only on web'
        : filter.isDemoFilter
        ? 'Transform — FREE ✨'
        : 'Transform with this deployment';
    stageSlot.innerHTML = renderStagePlaceholder(filter);
    stageNote.innerHTML = filter.clientSideOnly
      ? '<span class="badge badge--accent">Client-side effect · no upload to AI needed</span>'
      : demoOnlyOnWeb
        ? '<span class="badge badge--warning">Catalog preview only on the public web demo · use the app or your own deployment for live runs</span>'
      : filter.isDemoFilter
        ? '<span class="badge badge--success">Demo filter · ready for the free daily usage shell</span>'
        : '<span class="badge badge--warning">Full-catalog mode is enabled for this deployment</span>';
    renderUsageGrid(usageGrid, catalog, filter);
    overviewTab.innerHTML = renderOverview(filter);
    state.helpHtml = await getHelpHtml(filter);
    helpTab.innerHTML = state.helpHtml;
    techTab.innerHTML = renderTech(filter, catalog);
    relatedGrid.innerHTML = related.length ? related.map((item) => renderFilterCard(item)).join('') : '<div class="empty-state"><p>More related filters appear here once the full manifest lands.</p></div>';
    updateMeta({
      title: `${filter.name} · ${SITE.name}`,
      description: `${filter.description} Upload a photo, preview the transform flow, and browse related filters on ${SITE.name}.`,
      canonicalPath: `/try.html?id=${encodeURIComponent(filter.id)}`,
      image: filter.previewAfter,
    });
    updateSchema({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: filter.name,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      description: filter.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: `${SITE.baseUrl}/try.html?id=${encodeURIComponent(filter.id)}`,
    });
  };

  const renderResult = () => {
    const filter = state.filter;
    if (!state.variants.length || !state.sourceDataUrl) {
      stageSlot.innerHTML = renderStagePlaceholder(filter);
      resultActions.classList.add('hidden');
      renderVariants(variantsTarget, [], 0, () => {});
      initBeforeAfterSliders(stageSlot);
      return;
    }
    const current = state.variants[state.activeVariantIndex] || state.variants[0];
    stageSlot.innerHTML = renderBeforeAfter({
      beforeUrl: state.sourceDataUrl,
      afterUrl: current,
      beforeLabel: 'Original',
      afterLabel: state.outputMode === 'api' ? `${filter.name} result` : `${filter.name} preview`,
      caption: state.outputMode === 'api'
        ? 'Rendered from /api/transform'
        : 'Preview mode kept the flow usable because the live AI result was unavailable',
    });
    resultActions.classList.remove('hidden');
    renderVariants(variantsTarget, state.variants, state.activeVariantIndex, (nextIndex) => {
      state.activeVariantIndex = nextIndex;
      renderResult();
    });
    initBeforeAfterSliders(stageSlot);
  };

  const setSource = async (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file) return;
    if (!validTypes.includes(file.type)) {
      showToast('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Please keep uploads below 5MB.');
      return;
    }
    const resized = await resizeFile(file, 1024);
    state.sourceBlob = resized.blob;
    state.sourceDataUrl = resized.dataUrl;
    state.variants = [];
    state.activeVariantIndex = 0;
    stageSlot.innerHTML = `<div class="preview-frame"><img src="${state.sourceDataUrl}" alt="Uploaded preview" /></div>`;
    stageNote.innerHTML = `<span class="badge badge--brand">Ready to transform</span><span class="badge">${resized.width}×${resized.height} px</span>`;
    status.textContent = 'Photo loaded. When you are ready, start the transform flow.';
    resultActions.classList.add('hidden');
  };

  const clearSource = () => {
    state.sourceBlob = null;
    state.sourceDataUrl = '';
    state.variants = [];
    state.activeVariantIndex = 0;
    state.outputMode = '';
    fileInput.value = '';
    status.textContent = 'Upload a clear face photo for the best result.';
    renderResult();
  };

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (file) await setSource(file);
  });
  ['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.dataset.dragging = 'true';
  }));
  ['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.dataset.dragging = 'false';
  }));
  dropzone.addEventListener('drop', async (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) await setSource(file);
  });
  document.addEventListener('paste', async (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) {
        await setSource(file);
        showToast('Pasted image added to the try flow.');
      }
    }
  });

  transformButton.addEventListener('click', async () => {
    if (!state.filter) return;
    if (Boolean(state.health?.limits?.demoMode) && !state.filter.isDemoFilter && !state.filter.clientSideOnly) {
      showToast('This filter is preview-only on the public web demo. Pick a FREE filter, use the app, or self-host with DEMO_MODE=false.');
      return;
    }
    if (!state.sourceDataUrl || !state.sourceBlob) {
      showToast('Upload a photo before running the transform shell.');
      return;
    }
    transformButton.disabled = true;
    transformButton.textContent = 'Working…';
    const intensity = Number(intensityInput.value || 65) / 100;
    try {
      const result = await runTransform({
        filter: state.filter,
        source: state.sourceDataUrl,
        sourceBlob: state.sourceBlob,
        intensity,
        statusElement: status,
        progressElement: progress,
      });
      state.variants = result.images;
      state.outputMode = result.mode;
      state.activeVariantIndex = 0;
      renderResult();
      if (!state.filter.clientSideOnly && state.filter.isDemoFilter) {
        incrementUsage(state.filter);
      }
      renderUsageGrid(usageGrid, catalog, state.filter);
      status.textContent = result.mode === 'api'
        ? result.storageMode === 'direct'
          ? 'Transform complete. Save the image now or share the filter link while direct mode is active.'
          : 'Transform complete. Download or share the result.'
        : 'Preview ready. The UI kept working even though the live AI result was unavailable.';
      track('filter_transform', { filterId: state.filter.id, mode: result.mode });
    } catch (error) {
      status.textContent = 'The transform shell hit an error. Try a different photo or filter.';
      showToast('Transform failed. The shell stayed intact so you can keep testing the UI.');
      console.error(error);
    } finally {
      transformButton.disabled = false;
      const demoOnlyOnWeb = Boolean(state.health?.limits?.demoMode) && !state.filter.isDemoFilter && !state.filter.clientSideOnly;
      transformButton.textContent = state.filter.clientSideOnly
        ? 'Apply effect instantly'
        : demoOnlyOnWeb
          ? 'Preview only on web'
          : state.filter.isDemoFilter
            ? 'Transform — FREE ✨'
            : 'Transform with this deployment';
    }
  });

  resetButton.addEventListener('click', clearSource);

  downloadButton.addEventListener('click', () => {
    const current = state.variants[state.activeVariantIndex];
    if (!current) return;
    const link = document.createElement('a');
    link.href = current;
    link.download = `${state.filter.slug || 'gic-photo-filter'}-${state.activeVariantIndex + 1}.jpg`;
    link.click();
    track('filter_download', { filterId: state.filter.id });
  });

  shareButton.addEventListener('click', async () => {
    const url = `${window.location.origin}/try.html?id=${encodeURIComponent(state.filter.id)}`;
    const text = `${state.filter.shareText} ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: state.filter.name, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Share text copied to your clipboard.');
      }
      track('filter_share', { filterId: state.filter.id });
    } catch {
      showToast('Sharing was cancelled.');
    }
  });

  intensityInput.addEventListener('input', () => {
    if (state.filter?.clientSideOnly && state.sourceDataUrl) {
      transformButton.click();
    }
  });

  document.querySelectorAll('[data-tab-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tabTarget;
      document.querySelectorAll('[data-tab-target]').forEach((candidate) => candidate.setAttribute('aria-selected', String(candidate === button)));
      [overviewTab, helpTab, techTab].forEach((panel) => { panel.hidden = true; });
      document.getElementById(`tab-${target}`).hidden = false;
    });
  });

  await setSummary();
  status.textContent = 'Upload a clear face photo for the best result.';
  renderResult();
  track('filter_view', { filterId: state.filter.id });
}

function initStaticPage() {
  const schemaType = document.body.dataset.schemaType || 'WebPage';
  updateSchema({
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: document.title,
    url: `${SITE.baseUrl}${window.location.pathname}`,
    description: document.querySelector('meta[name="description"]')?.content || `${SITE.name} static page`,
  });
}

async function initApp() {
  const page = document.body.dataset.page || 'home';
  applyTheme(loadThemePreference());
  injectShell(page);
  const config = await loadSiteConfig();
  await initAnalytics(config);
  switch (page) {
    case 'home':
      initHomePage();
      break;
    case 'browse':
      initBrowsePage();
      break;
    case 'try':
      initTryPage();
      break;
    case 'category-index':
      initCategoryIndexPage();
      break;
    case 'category-detail':
      initCategoryDetailPage();
      break;
    default:
      initStaticPage();
      break;
  }
}

if (hasDom) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
  } else {
    initApp();
  }
}

export {
  CATEGORY_META,
  FALLBACK_CATALOG,
  getCategory,
  loadCatalog,
  normalizeCatalog,
};
