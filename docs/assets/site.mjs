import {
  BYOK_EVENTS,
  BYOK_STORAGE_MODES,
  addSessionNeurons,
  buildCloudflareProxyHeaders,
  clearByokSettings,
  getSessionNeurons,
  loadByokSettings,
  resetSessionNeurons,
  saveByokSettings,
} from './byok.mjs'
import {
  MODEL_OPTIONS,
  cacheByokHealth,
  clearCachedByokHealth,
  initSettingsSurface,
  loadCachedByokHealth,
  loadPreferredModel,
} from './settings-surface.mjs'

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
  freeTransformsPerIp: 10,
  starterTransforms: 10,
  referralBonusTransforms: 5,
  referralThreshold: 3,
  starterBonusCapPerDay: 5,
  cloudflareFreeDailyEstimate: 160,
  byokPromptAfterSuccess: true,
  embedAllowed: true,
  challengeMode: true,
  starterCatalog: true,
  filtersReady: 6,
  viralTags: {
    'hero-mode': {
      label: 'Superhero Reveal ⚡',
      filters: ['cyberpunk-pulse'],
      hero: 'Drop one selfie, get a hero poster, and send it back to the chat in seconds.',
      active: true,
      priority: 100,
    },
    'grinch-2026': {
      label: 'Grinch Christmas Challenge 🎄',
      filters: ['grinch-ify'],
      hero: 'Everyone is turning themselves into a holiday character — join in one tap.',
      active: true,
      priority: 92,
    },
    'headshot-upgrade': {
      label: 'Headshot Upgrade Sprint 💼',
      filters: ['professional-headshot'],
      hero: 'Upgrade a profile photo fast and get back to your day with a stronger first impression.',
      active: true,
      priority: 88,
    },
  },
  models: {
    'flux2-klein-9b': { id: '@cf/black-forest-labs/flux-2-klein-9b', name: 'FLUX.2 Klein 9B', neuronsPerRun: 150 },
    'flux2-klein-4b': { id: '@cf/black-forest-labs/flux-2-klein-4b', name: 'FLUX.2 Klein 4B', neuronsPerRun: 80 },
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
      viralScore: 98,
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
      model: 'flux2-klein-9b',
      variantCount: 2,
      isDemoFilter: true,
      viralScore: 90,
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
      viralScore: 84,
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
      type: 'img2img',
      model: 'flux2-klein-9b',
      variantCount: 1,
      isDemoFilter: true,
      viralScore: 65,
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
      viralScore: 50,
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
      viralScore: 100,
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

function syncHeaderSettingsState(root = document) {
  if (!hasDom || !root) return;
  const byok = loadByokSettings();
  root.querySelectorAll('[data-settings-trigger]').forEach((button) => {
    button.dataset.configured = String(byok.hasCredentials);
    button.setAttribute(
      'aria-label',
      byok.hasCredentials
        ? `Cloudflare settings connected for account ${byok.maskedAccountId || 'configured'}`
        : 'Open Cloudflare settings',
    );
    const label = button.querySelector('[data-settings-label]');
    if (label) label.textContent = 'Settings';
  });
}

function openSettingsSurface(source = 'site-header') {
  if (!hasDom) return;
  window.dispatchEvent(new CustomEvent('gic:open-settings', { detail: { source } }));
}

if (hasDom) {
  initCardPublishButtons(document.body);
  window.addEventListener(BYOK_EVENTS.CHANGED, () => syncHeaderSettingsState());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function encodeBase64Json(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBase64Json(value = '') {
  const binary = atob(String(value || '').trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function normalizeCustomFilterDefinition(rawDefinition = {}) {
  if (!rawDefinition || typeof rawDefinition !== 'object') return null;
  const prompt = String(rawDefinition.prompt || '').trim();
  if (!prompt) return null;
  const supportedModels = MODEL_OPTIONS.map((option) => option.id).filter((id) => id !== 'default');
  const category = getCategory(rawDefinition.category || rawDefinition.categorySlug || 'artistic_styles');
  const width = [512, 768, 1024].includes(Number(rawDefinition.width)) ? Number(rawDefinition.width) : 768;
  const height = [512, 768, 1024].includes(Number(rawDefinition.height)) ? Number(rawDefinition.height) : 768;
  const normalizedTags = Array.isArray(rawDefinition.tags)
    ? rawDefinition.tags
    : String(rawDefinition.tags || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  return {
    name: String(rawDefinition.name || 'Custom Filter').trim().slice(0, 60) || 'Custom Filter',
    description: String(rawDefinition.description || '').trim().slice(0, 160),
    category: category.id,
    prompt: prompt.slice(0, 500),
    negativePrompt: String(rawDefinition.negativePrompt || '').trim().slice(0, 300),
    model: supportedModels.includes(rawDefinition.model) ? rawDefinition.model : 'flux2-klein-9b',
    strength: clamp(Number(rawDefinition.strength) || 0.65, 0.3, 1),
    guidance: clamp(Number(rawDefinition.guidance) || 7.5, 3, 15),
    width,
    height,
    variantCount: [1, 2].includes(Number(rawDefinition.variantCount)) ? Number(rawDefinition.variantCount) : 1,
    tags: normalizedTags.slice(0, 8),
  };
}

function createCustomFilterEntry(rawDefinition, catalog) {
  const definition = normalizeCustomFilterDefinition(rawDefinition);
  if (!definition) return null;
  const categories = (catalog?.categories?.length ? catalog.categories : CATEGORY_META).map((category) => normalizeCategory(category));
  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category]));
  const customSlug = `custom-${slugify(definition.name)}`;
  const category = categoryMap[definition.category] || getCategory(definition.category);
  return withDefaults({
    id: `custom_${slugify(definition.name)}--${category.id}`,
    slug: customSlug,
    name: definition.name,
    category: category.id,
    description: definition.description || `Custom ${category.name.toLowerCase()} prompt built with the website builder.`,
    prompt: definition.prompt,
    negativePrompt: definition.negativePrompt,
    model: definition.model,
    strength: definition.strength,
    guidance: definition.guidance,
    outputWidth: definition.width,
    outputHeight: definition.height,
    variantCount: definition.variantCount,
    requiresAI: true,
    clientSideOnly: false,
    isDemoFilter: false,
    type: 'img2img',
    tags: definition.tags,
    shareText: `Try my custom filter “${definition.name}”:`,
    helpMarkdown: `## Shared custom filter\n- Prompt: ${definition.prompt}\n- Model: ${definition.model}\n- Add your Cloudflare key in Settings to run this custom filter.`,
    customDefinition: definition,
    isCustomFilter: true,
  }, 0, catalog?.models || FALLBACK_CATALOG.models, categoryMap);
}

function buildTryHref(filter) {
  if (filter?.customDefinition) {
    return `/try.html?custom=${encodeURIComponent(encodeBase64Json(filter.customDefinition))}`;
  }
  return `/try.html?id=${encodeURIComponent(filter?.id || '')}`;
}

function buildReferralCode(filter) {
  const basis = filter?.slug || filter?.id || filter?.name || 'gic';
  return `${slugify(basis).slice(0, 26) || 'gic'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
}

function buildTryShareUrl(filter, options = {}) {
  const baseUrl = hasDom ? window.location.origin : SITE.baseUrl;
  const url = new URL(buildTryHref(filter), baseUrl);
  const referralCode = String(options.ref || '').trim();
  const trendId = String(options.trend || '').trim();
  const source = String(options.source || '').trim();
  if (referralCode) url.searchParams.set('ref', referralCode);
  if (trendId) url.searchParams.set('trend', trendId);
  if (source) url.searchParams.set('src', source);
  return url.toString();
}

function buildViralShareCopy(filter, options = {}) {
  const trendLabel = String(options.trendLabel || '').trim();
  const suffix = trendLabel ? ` Join ${trendLabel} next.` : ' Try it next.';
  return `${filter?.shareText || `Made with ${SITE.name}:`} ${suffix}`.trim();
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

function sortByTrending(a, b) {
  return (b.viralScore || 0) - (a.viralScore || 0) || sortByPopularity(a, b);
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
  const viralScore = Number.isFinite(filter.viralScore) ? filter.viralScore : 0;
  const publishedAt = filter.publishedAt || makeDateOffset(index);
  const searchText = (filter.searchText || [filter.name, filter.description, tags.join(' '), category.name, category.description, filter.type, modelKey]
    .filter(Boolean)
    .join(' '))
    .toLowerCase();
  const firstPreview = Array.isArray(filter.previewImages) && filter.previewImages.length ? filter.previewImages[0] : null;

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
    viralScore,
    publishedAt,
    searchText,
    previewBefore: filter.previewBefore || firstPreview?.before || generatePreviewData(filter, 'before'),
    previewAfter: filter.previewAfter || firstPreview?.after || generatePreviewData(filter, 'after'),
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
    freeTransformsPerIp: Number(rawCatalog?.freeTransformsPerIp || FALLBACK_CATALOG.freeTransformsPerIp || 10),
    starterTransforms: Number(rawCatalog?.starterTransforms || FALLBACK_CATALOG.starterTransforms || 10),
    referralBonusTransforms: Number(rawCatalog?.referralBonusTransforms || FALLBACK_CATALOG.referralBonusTransforms || 5),
    referralThreshold: Number(rawCatalog?.referralThreshold || FALLBACK_CATALOG.referralThreshold || 3),
    starterBonusCapPerDay: Number(rawCatalog?.starterBonusCapPerDay || FALLBACK_CATALOG.starterBonusCapPerDay || 5),
    cloudflareFreeDailyEstimate: Number(rawCatalog?.cloudflareFreeDailyEstimate || FALLBACK_CATALOG.cloudflareFreeDailyEstimate || 160),
    byokPromptAfterSuccess: rawCatalog?.byokPromptAfterSuccess ?? FALLBACK_CATALOG.byokPromptAfterSuccess ?? true,
    embedAllowed: rawCatalog?.embedAllowed ?? FALLBACK_CATALOG.embedAllowed ?? true,
    challengeMode: rawCatalog?.challengeMode ?? FALLBACK_CATALOG.challengeMode ?? true,
    starterCatalog: Boolean(rawCatalog?.starterCatalog),
    filtersReady: Number(rawCatalog?.filtersReady || rawCatalog?.filters?.length || rawCatalog?.totalFilters || filters.length),
    viralTags: rawCatalog?.viralTags || FALLBACK_CATALOG.viralTags || {},
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
  healthSnapshotPromise = fetch('/api/health?view=site', { cache: 'no-store' })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      return payload?.data || null;
    })
    .catch(() => null);
  return healthSnapshotPromise;
}

async function loadDemoUsage(filterId = '', options = {}) {
  if (!hasDom) return null;
  const queryParams = new URLSearchParams();
  if (filterId) queryParams.set('filterId', filterId);
  if (options.referralCode) queryParams.set('ref', options.referralCode);
  if (options.trendId) queryParams.set('trend', options.trendId);
  if (options.source) queryParams.set('src', options.source);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  try {
    const response = await fetch(`/api/usage${query}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    return payload?.data || null;
  } catch {
    return null;
  }
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
  const tryHref = buildTryHref(filter);
  const detailsHref = `${tryHref}#details`;
  const compact = options.compact ? ' compact' : '';
  const shareUrl = buildTryShareUrl(filter);
  const shareText = `${filter.shareText} ${shareUrl}`.trim();
  return `
    <article class="filter-card${compact}">
      <a class="filter-card__media filter-card__media-link" href="${detailsHref}" aria-label="Open ${escapeHtml(filter.name)} details">
        <img src="${filter.previewAfter}" alt="${escapeHtml(filter.name)} transformed preview" loading="lazy" />
        <img src="${filter.previewBefore}" alt="${escapeHtml(filter.name)} before preview" loading="lazy" />
      </a>
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
          <button
            class="button-ghost"
            type="button"
            data-publish-filter="${escapeHtml(filter.id)}"
            data-share-url="${escapeHtml(shareUrl)}"
            data-share-text="${escapeHtml(shareText)}"
            data-filter-name="${escapeHtml(filter.name)}"
          >Publish</button>
        </div>
      </div>
    </article>`;
}

function getActiveTrends(catalog) {
  const filterMap = new Map(catalog.filters.flatMap((filter) => [[filter.slug, filter], [filter.id, filter]]));
  return Object.entries(catalog.viralTags || {})
    .map(([id, trend]) => {
      const filterRefs = Array.isArray(trend?.filters) ? trend.filters.filter(Boolean) : [];
      const filters = filterRefs.map((ref) => filterMap.get(ref)).filter(Boolean);
      return {
        id,
        label: trend?.label || id,
        hero: trend?.hero || filters[0]?.description || '',
        active: Boolean(trend?.active),
        priority: Number(trend?.priority || 0),
        note: trend?.note || '',
        filters,
        primaryFilter: filters[0] || null,
      };
    })
    .filter((trend) => trend.active && trend.primaryFilter)
    .sort((a, b) => b.priority - a.priority || sortByTrending(a.primaryFilter, b.primaryFilter) || a.label.localeCompare(b.label));
}

function renderTrendCard(trend) {
  const primaryFilter = trend.primaryFilter;
  const joinHref = buildTryHref(primaryFilter);
  return `
    <article class="filter-card trend-card">
      <a class="filter-card__media filter-card__media-link" href="${joinHref}" aria-label="Join ${escapeHtml(trend.label)}">
        <img src="${primaryFilter.previewAfter}" alt="${escapeHtml(trend.label)} preview" loading="lazy" />
        <img src="${primaryFilter.previewBefore}" alt="${escapeHtml(primaryFilter.name)} source preview" loading="lazy" />
      </a>
      <div class="filter-card__content">
        <div class="filter-card__badges">
          <span class="badge badge--brand">🔥 Trending</span>
          <span class="badge">${trend.filters.length} filter${trend.filters.length === 1 ? '' : 's'}</span>
          ${primaryFilter.isDemoFilter ? '<span class="badge badge--success">FREE starter try</span>' : ''}
        </div>
        <div class="trend-card__headline">
          <h3>${escapeHtml(trend.label)}</h3>
          <p class="filter-card__description">${escapeHtml(trend.hero)}</p>
        </div>
        <div class="trend-card__filters">
          ${trend.filters.map((filter) => `<span class="badge">${escapeHtml(filter.name)}</span>`).join('')}
        </div>
        <div class="filter-card__meta">
          <span class="meta-text">Start with ${escapeHtml(primaryFilter.name)}</span>
          <span class="meta-text">${escapeHtml(primaryFilter.categoryMeta.emoji)} ${escapeHtml(primaryFilter.categoryDisplay)}</span>
          <span class="meta-text">${primaryFilter.clientSideOnly ? 'Runs instantly in your browser' : 'Generates in a few seconds'}</span>
        </div>
        <div class="filter-card__actions">
          <a class="button trend-card__cta" href="${joinHref}">Join ${escapeHtml(trend.label)} in 5 seconds →</a>
        </div>
      </div>
    </article>`;
}

function initCardPublishButtons(root = document) {
  if (!root || root.dataset.publishButtonsBound === 'true') return;
  root.dataset.publishButtonsBound = 'true';

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-publish-filter]');
    if (!button) return;
    event.preventDefault();

    const shareUrl = button.dataset.shareUrl || '';
    const shareText = button.dataset.shareText || shareUrl;
    const filterName = button.dataset.filterName || 'GIC Photo Filter';

    try {
      if (navigator.share) {
        await navigator.share({ title: filterName, text: shareText, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        showToast('Publish link copied to your clipboard.');
      } else {
        showToast('Publishing is not available in this browser.');
        return;
      }
      track('filter_publish_card', { filterId: button.dataset.publishFilter || '', source: 'catalog-card' });
    } catch {
      showToast('Publishing was cancelled.');
    }
  });
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
    build: '/build.html',
    browse: '/browse.html',
    trends: '/trends.html',
    try: '/try.html',
    'category-index': '/categories/index.html',
    'category-detail': '/categories/index.html',
  };
  const currentHref = pageToHref[page] || '/';
  const navItems = [
    ['Trends', '/trends.html'],
    ['Browse', '/browse.html'],
    ['Try', '/try.html'],
    ['Build', '/build.html'],
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
        <button class="button-ghost settings-trigger" type="button" data-settings-trigger data-configured="false" aria-label="Open Cloudflare settings">
          <span class="settings-trigger__icon" aria-hidden="true">⚙</span>
          <span class="settings-trigger__dot" aria-hidden="true"></span>
          <span data-settings-label>Settings</span>
        </button>
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
          <a href="/trends.html">Trending now</a>
          <a href="/browse.html">Browse filters</a>
          <a href="/try.html">Try a filter</a>
          <a href="/build.html">Build a filter</a>
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
  initSettingsSurface();
  document.querySelectorAll('[data-settings-trigger]').forEach((button) => {
    button.addEventListener('click', () => openSettingsSurface('site-header'));
  });
  syncHeaderSettingsState();
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

function renderUsageGrid(target, catalog, filter = null, usageSnapshot = null) {
  if (!target) return;
  const usage = usageSnapshot || getUsageSnapshot();
  const used = Number(usage.used ?? usage.transformsUsed ?? 0);
  const limit = Number(usage.limit ?? 10);
  const bonusLimit = Number(usage.referralBonusTransforms ?? usage.bonusTransforms ?? 0);
  const remainingFree = Number.isFinite(Number(usage.remaining)) ? Number(usage.remaining) : Math.max(0, limit - used);
  const currentCost = filter ? `${filter.estimatedNeurons} neurons / run` : 'Pick a filter to see per-run cost';
  const referralLine = usage.referral
    ? `Referral ${usage.referral.code || 'campaign'} · ${usage.referral.progress || 0}/${usage.referral.threshold || catalog.referralThreshold || 3}`
    : `${catalog.referralThreshold || 3} friend referrals can unlock +${catalog.referralBonusTransforms || 5} runs`;
  target.innerHTML = `
    ${renderKpi('Free transforms today', `${used} of ${limit}`, `${remainingFree} free transforms remaining${bonusLimit ? ` · +${bonusLimit} referral bonus` : ''}`)}
    ${renderKpi('Referral bonus', bonusLimit ? `+${bonusLimit} unlocked` : `+${catalog.referralBonusTransforms || 5} pending`, referralLine)}
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
    case 'trending':
      return sorted.sort(sortByTrending);
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

async function createShareCollage({ beforeUrl, afterUrl, filterName, trendLabel = '', sourceLabel = '' }) {
  const [beforeImage, afterImage] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);
  const width = 1200;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const half = width / 2;
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, half, height);

  const drawCover = (image, x, y, drawWidth, drawHeight) => {
    const scale = Math.max(drawWidth / image.width, drawHeight / image.height);
    const targetWidth = image.width * scale;
    const targetHeight = image.height * scale;
    const offsetX = x + (drawWidth - targetWidth) / 2;
    const offsetY = y + (drawHeight - targetHeight) / 2;
    context.drawImage(image, offsetX, offsetY, targetWidth, targetHeight);
  };

  drawCover(beforeImage, 0, 0, half, height - 170);
  drawCover(afterImage, half, 0, half, height - 170);
  context.fillStyle = 'rgba(15,23,42,0.82)';
  context.fillRect(0, height - 170, width, 170);
  context.strokeStyle = 'rgba(255,255,255,0.26)';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(half, 24);
  context.lineTo(half, height - 194);
  context.stroke();
  context.font = '700 42px Inter, Arial, sans-serif';
  context.fillStyle = '#fff';
  context.fillText(filterName || 'GIC Photo Filters', 38, height - 106);
  context.font = '500 29px Inter, Arial, sans-serif';
  const label = [trendLabel, sourceLabel].filter(Boolean).join(' · ') || 'Try it free on GIC Photo Filters';
  context.fillText(label, 38, height - 58);
  context.font = '700 26px Inter, Arial, sans-serif';
  context.fillStyle = '#0f172a';
  context.fillRect(34, 30, 188, 58);
  context.fillStyle = '#fff';
  context.fillText('BEFORE', 52, 69);
  context.fillStyle = '#fff';
  context.fillRect(width - 222, 30, 188, 58);
  context.fillStyle = '#0f172a';
  context.fillText('AFTER', width - 188, 69);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return {
    blob,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
  };
}

async function resizeFile(file, maxDimension = 512) {
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

async function attemptApiTransform(filter, blob, intensity = 0.65, byok = {}, options = {}) {
  const { customFilter = filter?.customDefinition || null, signal = undefined } = options;
  const payload = new FormData();
  payload.append('image', blob, 'upload.jpg');
  if (customFilter) payload.append('customFilter', JSON.stringify(customFilter));
  else payload.append('filterId', filter.id);
  payload.append('intensity', String(intensity));
  const response = await fetch('/api/transform', {
    method: 'POST',
    body: payload,
    headers: buildCloudflareProxyHeaders(byok),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.message || `Transform failed with ${response.status}`);
    error.code = payload?.error?.code || '';
    error.status = response.status;
    throw error;
  }
  const storageMode = response.headers.get('x-storage-mode') || 'r2';
  const requestMode = response.headers.get('x-proxy-mode') || (byok?.hasCredentials ? 'cloudflare' : 'demo');
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    const blobResult = await response.blob();
    return {
      images: [URL.createObjectURL(blobResult)],
      mode: 'api',
      storageMode,
      requestMode,
      blob: blobResult,
    };
  }
  const data = await response.json();
  const images = normalizeTransformResponse(data?.data || data);
  if (!images.length) throw new Error('Transform response did not include images');
  return {
    images,
    mode: 'api',
    storageMode: data?.data?.storage?.mode || data?.storage?.mode || storageMode,
    requestMode: data?.data?.proxyMode || data?.proxyMode || requestMode,
  };
}

function updateProgress(progressElement, percentage) {
  if (!progressElement) return;
  const bar = progressElement.querySelector('span');
  if (bar) bar.style.setProperty('--progress', `${percentage}%`);
}

async function runTransform({
  filter,
  source,
  sourceBlob,
  intensity,
  statusElement,
  progressElement,
  byok,
  customFilter = filter?.customDefinition || null,
  signal,
}) {
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
    let storageMode = 'preview';
    let warningMessage = '';
    let requestMode = 'preview';
    if (!filter.clientSideOnly) {
      const apiOptions = { customFilter, signal };
      const apiResult = await attemptApiTransform(filter, sourceBlob, intensity, byok, apiOptions);
      images = apiResult.images;
      mode = apiResult.mode;
      storageMode = apiResult.storageMode || 'r2';
      requestMode = apiResult.requestMode || (byok?.hasCredentials ? 'cloudflare' : 'demo');
      warningMessage = '';
    } else {
      images = await generatePreviewVariants(source, filter, intensity);
      mode = 'preview';
      storageMode = 'preview';
      requestMode = 'preview';
    }
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    return { images, mode, storageMode, warningMessage, requestMode };
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
  const trendCarousel = document.getElementById('home-trend-carousel');
  const trendTemplateGrid = document.querySelector('[data-home-trend-templates]');
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
  if (trendCarousel) {
    const trendCards = getActiveTrends(catalog).slice(0, 4);
    trendCarousel.innerHTML = trendCards.length
      ? trendCards.map((trend) => renderTrendCard(trend)).join('')
      : '<p class="microcopy">No active trends right now.</p>';
  }
  if (trendTemplateGrid) {
    trendTemplateGrid.innerHTML = sortFilters(catalog.filters, 'trending')
      .slice(0, 4)
      .map((filter) => `<a class="button-ghost" href="${buildTryHref(filter)}&embed=true">${escapeHtml(filter.name)} embed</a>`)
      .join('');
  }
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

async function initTrendsPage() {
  const noticeTarget = document.getElementById('catalog-notice');
  const grid = document.getElementById('trends-grid');
  const meta = document.getElementById('trends-meta');
  const lead = document.getElementById('trends-lead');
  const heroActions = document.getElementById('trends-hero-actions');
  const proof = document.getElementById('trend-proof');

  renderSkeletonCards(grid, 3);
  const [info, usage] = await Promise.all([loadCatalog(), loadDemoUsage()]);
  const { catalog } = info;
  const trends = getActiveTrends(catalog);
  const topTrend = trends[0] || null;
  const joinedToday = Number.isFinite(usage?.siteTransformsUsed) ? usage.siteTransformsUsed : null;

  renderCatalogNotice(noticeTarget, info);

  if (lead) {
    lead.textContent = topTrend
      ? topTrend.hero
      : 'No trends are active right now. Check back soon, or browse the full catalog while the next challenge is queued up.';
  }

  if (heroActions) {
    heroActions.innerHTML = topTrend
      ? `<a class="button" href="${buildTryHref(topTrend.primaryFilter)}">Join ${escapeHtml(topTrend.label)} in 5 seconds →</a><a class="button-ghost" href="/browse.html">Browse all filters</a>`
      : '<a class="button" href="/browse.html">Browse all filters</a>';
  }

  if (proof) {
    proof.innerHTML = [
      renderKpi(
        'Joined today',
        joinedToday === null ? 'Live counter unavailable' : `${formatNumber(joinedToday)} people`,
        joinedToday === null ? 'The /api/usage counter did not respond, but active trends are still live.' : 'Based on today’s site-wide transform count.',
      ),
      renderKpi('Starter pack', `${catalog.starterTransforms} free tries`, 'Platform-funded before Cloudflare setup is required.'),
      renderKpi('Referral bonus', `+${catalog.referralBonusTransforms} tries`, `${catalog.referralThreshold} friends unlock another free batch.`),
    ].join('');
  }

  if (!trends.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No trends active</h3>
        <p>Check back soon or browse all filters while the next challenge is being prepared in the shared catalog config.</p>
        <div class="card-actions">
          <a class="button" href="/browse.html">Browse all filters</a>
        </div>
      </div>`;
    if (meta) {
      meta.innerHTML = '<div><strong>0</strong> active trends · <span class="meta-text">Flip a <code>viralTags.*.active</code> flag to launch the next one.</span></div>';
    }
  } else {
    grid.innerHTML = trends.map((trend) => renderTrendCard(trend)).join('');
    if (meta) {
      meta.innerHTML = `<div><strong>${trends.length}</strong> active trends · <span class="meta-text">Sorted by priority from the shared catalog config.</span></div>`;
    }
  }

  updateMeta({
    title: `Trending Now · ${SITE.name}`,
    description: topTrend?.hero || 'Join the active photo filter trends on GIC Photo Filters.',
    canonicalPath: '/trends.html',
  });
  updateSchema({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Trending Now · ${SITE.name}`,
    url: `${SITE.baseUrl}/trends.html`,
    description: topTrend?.hero || 'Join the active photo filter trends on GIC Photo Filters.',
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
  const cameraInput = document.getElementById('camera-input');
  const transformButton = document.getElementById('transform-button');
  const resetButton = document.getElementById('reset-photo-button');
  const downloadButton = document.getElementById('download-button');
  const shareFilterButton = document.getElementById('share-filter-button');
  const shareResultButton = document.getElementById('share-result-button');
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
  const byokPanel = document.getElementById('byok-panel');
  const byokSummary = document.getElementById('byok-summary');
  const byokAccountInput = document.getElementById('cf-account-id');
  const byokTokenInput = document.getElementById('cf-api-token');
  const byokStorageButtons = byokPanel ? Array.from(byokPanel.querySelectorAll('[data-byok-storage]')) : [];
  const byokClearButton = document.getElementById('byok-clear-button');
  const byokTestButton = document.getElementById('byok-test-button');
  const byokSessionUsage = document.getElementById('byok-session-usage');
  const byokStorageDetail = document.getElementById('byok-storage-detail');
  const byokConnectionStatus = document.getElementById('byok-connection-status');
  const byokStatusBanner = document.getElementById('byok-status-banner');
  const byokStatusTitle = document.getElementById('byok-status-title');
  const byokStatusDetail = document.getElementById('byok-status-detail');
  const byokStatusPrimary = document.getElementById('byok-status-primary');
  const byokStatusSetup = document.getElementById('byok-status-setup');
  const byokInlineSettings = document.getElementById('byok-inline-settings');
  const cameraButton = document.getElementById('camera-button');
  const entryBanner = document.getElementById('try-entry-banner');
  const trendShortcuts = document.getElementById('try-trend-shortcuts');
  const shareOverlay = document.getElementById('share-overlay');
  const shareOverlayTitle = document.getElementById('share-overlay-title');
  const shareOverlayCopy = document.getElementById('share-overlay-copy');
  const shareOverlayPreview = document.getElementById('share-overlay-preview');
  const shareOverlayNative = document.getElementById('share-overlay-native');
  const shareOverlayCopyButton = document.getElementById('share-overlay-copy');
  const shareOverlayCopyImage = document.getElementById('share-overlay-copy-image');
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id');
  const requestedCustom = params.get('custom');
  const requestedTrend = params.get('trend');
  const referralCode = params.get('ref');
  const referralSource = params.get('src') || params.get('source');
  const embedMode = params.get('embed') === 'true';
  document.body.dataset.embed = embedMode ? 'true' : 'false';

  const info = await loadCatalog();
  const { catalog } = info;
  const activeTrends = getActiveTrends(catalog);
  const requestedTrendEntry = activeTrends.find((entry) => entry.id === requestedTrend) || null;
  const health = await loadHealthSnapshot();
  let requestedCustomFilter = null;
  let requestedCustomError = '';
  if (requestedCustom) {
    try {
      requestedCustomFilter = createCustomFilterEntry(decodeBase64Json(requestedCustom), catalog);
      if (!requestedCustomFilter) throw new Error('invalid_custom_filter');
    } catch (error) {
      requestedCustomError = 'This shared custom filter link is invalid or incomplete.';
      console.error(error);
    }
  }
  renderCatalogNotice(noticeTarget, info);
  renderHealthNotice(noticeTarget, health);
  if (noticeTarget && requestedCustomError) {
    noticeTarget.insertAdjacentHTML('beforeend', `
      <div class="notice glass-panel">
        <div>
          <strong>Shared custom filter unavailable</strong>
          <p>${escapeHtml(requestedCustomError)} We loaded the standard catalog instead.</p>
        </div>
      </div>`);
  }

  const state = {
    catalog,
    health,
    trend: requestedTrendEntry,
    referralCode: referralCode || '',
    referralSource: referralSource || (requestedTrendEntry ? 'trend-link' : ''),
    embedMode,
    filter: requestedCustomFilter
      || catalog.filters.find((item) => item.id === requestedId)
      || requestedTrendEntry?.primaryFilter
      || activeTrends[0]?.primaryFilter
      || sortFilters(catalog.filters, 'popular')[0],
    sourceDataUrl: '',
    sourceBlob: null,
    variants: [],
    activeVariantIndex: 0,
    outputMode: '',
    storageMode: '',
    lastTransformSource: '',
    latestResultBlob: null,
    byok: loadByokSettings(),
    byokHealth: loadCachedByokHealth(loadByokSettings()),
    byokHealthError: '',
    demoUsage: await loadDemoUsage(
      requestedCustomFilter ? '' : (requestedId || requestedTrendEntry?.primaryFilter?.id || ''),
      {
        referralCode: referralCode || '',
        trendId: requestedTrendEntry?.id || requestedTrend || '',
        source: referralSource || '',
      },
    ),
    helpHtml: '',
    customLinkError: requestedCustomError,
    shareContext: null,
  };

  const buildHealthMessage = (remaining) => `Connected — ${formatNumber(Math.max(0, Number(remaining) || 0))} neurons available today.`;
  const getDemoRemainingCount = () => {
    if (Number.isFinite(Number(state.demoUsage?.remaining))) return Math.max(0, Number(state.demoUsage.remaining));
    if (Number.isFinite(Number(state.health?.limits?.maxFreeTransformsPerIp))) return Number(state.health.limits.maxFreeTransformsPerIp);
    return 0;
  };
  const getStorageCopy = () => state.byok.storageMode === BYOK_STORAGE_MODES.SESSION
    ? 'Credentials are saved in sessionStorage and clear when this tab closes.'
    : 'Credentials are saved in localStorage on this browser until you clear them.';
  const setByokConnectionMessage = (message, tone = 'default') => {
    if (!byokConnectionStatus) return;
    byokConnectionStatus.textContent = message;
    byokConnectionStatus.dataset.tone = tone;
  };
  const updateSessionUsageDisplay = () => {
    if (!byokSessionUsage) return;
    const used = getSessionNeurons();
    const cost = state.filter ? `${state.filter.estimatedNeurons} neurons/run` : 'Pick a filter to see the cost';
    const label = used
      ? `Session estimate: ${formatNumber(used)} neurons used · ${cost}`
      : `Session estimate: 0 neurons used · ${cost}`;
    byokSessionUsage.textContent = label;
  };

  const showEntryBanner = () => {
    if (!entryBanner) return;
    if (state.trend) {
      entryBanner.classList.remove('hidden');
      entryBanner.innerHTML = `
        <div>
          <strong>🔥 Trend shortcut active: ${escapeHtml(state.trend.label)}</strong>
          <p>${escapeHtml(state.trend.hero || 'Start with this filter and share your result in one tap.')}</p>
        </div>`;
      return;
    }
    if (state.referralCode) {
      entryBanner.classList.remove('hidden');
      entryBanner.innerHTML = `
        <div>
          <strong>🎁 Referral link detected</strong>
          <p>Your starter usage may include bonus tries once this session syncs.</p>
        </div>`;
      return;
    }
    entryBanner.classList.add('hidden');
  };

  const renderTrendShortcuts = () => {
    if (!trendShortcuts || embedMode) return;
    const topTrends = activeTrends.slice(0, 3);
    if (!topTrends.length) {
      trendShortcuts.classList.add('hidden');
      return;
    }
    trendShortcuts.classList.remove('hidden');
    trendShortcuts.innerHTML = `
      <div>
        <strong>Trending quick-start</strong>
        <p class="microcopy">Jump straight into an active challenge and pre-fill the share path.</p>
      </div>
      <div class="try-trend-shortcuts__actions">
        ${topTrends.map((trend) => `
          <a class="button-ghost" href="${buildTryHref(trend.primaryFilter)}&trend=${encodeURIComponent(trend.id)}${state.referralCode ? `&ref=${encodeURIComponent(state.referralCode)}` : ''}">${escapeHtml(trend.label)}</a>`).join('')}
      </div>`;
  };

  const buildShareContext = () => {
    const trendLabel = state.trend?.label || '';
    const referral = state.referralCode || buildReferralCode(state.filter);
    const shareUrl = buildTryShareUrl(state.filter, {
      ref: referral,
      trend: state.trend?.id || '',
      source: state.referralSource || 'try-share',
    });
    const copyLead = buildViralShareCopy(state.filter, { trendLabel });
    return {
      referral,
      trendLabel,
      shareUrl,
      shareText: `${copyLead} ${shareUrl}`.trim(),
    };
  };

  const renderByokStatusBanner = () => {
    if (!byokStatusBanner || !byokStatusTitle || !byokStatusDetail || !byokStatusPrimary) return;
    if (state.byok.hasCredentials) {
      const storageLabel = state.byok.storageMode === BYOK_STORAGE_MODES.SESSION ? 'session only' : 'this browser';
      const healthy = state.byokHealth?.status === 'ok';
      byokStatusBanner.dataset.variant = healthy ? 'configured' : state.byokHealthError ? 'warning' : 'configured';
      byokStatusTitle.textContent = healthy
        ? `🟢 Your Cloudflare key · ${formatNumber(state.byokHealth.neuronsRemaining)} neurons available`
        : '🟢 Cloudflare key saved';
      byokStatusDetail.textContent = healthy
        ? `Account ${state.byok.maskedAccountId || 'configured'} · Stored in ${storageLabel} · Sent only to this site over HTTPS request headers.`
        : state.byokHealthError || `Account ${state.byok.maskedAccountId || 'configured'} is stored in ${storageLabel}. Test the connection before your next transform.`;
      byokStatusPrimary.textContent = 'Settings ⚙';
      byokStatusSetup.textContent = 'Cloudflare guide →';
    } else {
      byokStatusBanner.dataset.variant = 'demo';
      byokStatusTitle.textContent = `✨ ${getDemoRemainingCount()} free transforms left today`;
      byokStatusDetail.textContent = 'Add your free Cloudflare key for unlimited access. Demo requests stay on this site and use the shared rate-limited proxy.';
      byokStatusPrimary.textContent = 'Add your key →';
      byokStatusSetup.textContent = 'Set up in 2 minutes →';
    }
  };

  const updateByokPanelUi = () => {
    byokStorageButtons.forEach((button) => {
      const targetMode = button.dataset.byokStorage;
      button.setAttribute('aria-pressed', String(targetMode === state.byok.storageMode));
    });
    if (byokSummary) {
      byokSummary.textContent = state.byok.hasCredentials
        ? 'Transforms keep posting to this site backend, which forwards your Cloudflare credentials as secure request headers.'
        : 'Add your Cloudflare account ID and API token for unlimited transforms without leaving the page.';
    }
    if (byokStorageDetail) byokStorageDetail.textContent = getStorageCopy();
    if (byokTestButton) byokTestButton.disabled = !state.byok.hasCredentials || !state.byok.accountIdValid;
    if (state.byokHealth?.status === 'ok') {
      setByokConnectionMessage(buildHealthMessage(state.byokHealth.neuronsRemaining), 'success');
    } else if (state.byokHealthError) {
      setByokConnectionMessage(state.byokHealthError, 'error');
    } else if (state.byok.accountId && !state.byok.accountIdValid) {
      setByokConnectionMessage('Account ID should be 32 hexadecimal characters.', 'error');
    } else if (state.byok.hasCredentials) {
      setByokConnectionMessage('Credentials are saved locally. Test the connection before your next transform.');
    } else {
      setByokConnectionMessage('No Cloudflare key saved yet. Free transforms use the site’s daily limits.');
    }
    updateSessionUsageDisplay();
    renderByokStatusBanner();
  };

  const updateTransformButtonLabel = () => {
    const filter = state.filter;
    if (!filter) return;
    const isCustomFilter = Boolean(filter.customDefinition);
    transformButton.textContent = filter.clientSideOnly
      ? 'Apply effect instantly'
      : isCustomFilter && !state.byok.hasCredentials
        ? 'Add your key to run this custom filter'
      : state.byok.hasCredentials
        ? isCustomFilter ? 'Run custom filter with your Cloudflare key' : 'Transform with your Cloudflare key'
        : 'Transform — FREE ✨';
  };

  const syncByokState = (nextState, { resetHealth = true } = {}) => {
    state.byok = nextState;
    if (resetHealth) {
      state.byokHealth = null;
      state.byokHealthError = '';
    }
    if (byokAccountInput && byokAccountInput.value !== nextState.accountId) byokAccountInput.value = nextState.accountId;
    if (byokTokenInput && byokTokenInput.value !== nextState.apiToken) byokTokenInput.value = nextState.apiToken;
    updateByokPanelUi();
    updateTransformButtonLabel();
  };

  const persistByokInputs = (storageMode = state.byok.storageMode) => {
    const nextState = saveByokSettings({
      accountId: byokAccountInput?.value || '',
      apiToken: byokTokenInput?.value || '',
      storageMode,
    });
    syncByokState(nextState);
    return nextState;
  };

  const clearByokCredentials = () => {
    const nextState = clearByokSettings({ storageMode: state.byok.storageMode });
    resetSessionNeurons();
    clearCachedByokHealth();
    syncByokState(nextState);
    status.textContent = 'Cloudflare credentials cleared. Free transforms use the site’s daily limits.';
  };

  const testByokConnection = async ({ announce = true } = {}) => {
    if (!state.byok.hasCredentials) {
      state.byokHealth = null;
      state.byokHealthError = 'Add both your Account ID and API token before testing the connection.';
      updateByokPanelUi();
      return null;
    }
    if (!state.byok.accountIdValid) {
      state.byokHealth = null;
      state.byokHealthError = 'Account ID should be 32 hexadecimal characters.';
      updateByokPanelUi();
      return null;
    }

    state.byokHealth = null;
    state.byokHealthError = '';
    setByokConnectionMessage('Testing your Cloudflare connection…');
    if (announce) status.textContent = 'Testing your Cloudflare key…';
    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
        headers: buildCloudflareProxyHeaders(state.byok),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || `Health check failed with ${response.status}`);
      }
      state.byokHealth = cacheByokHealth({
        ...payload.data,
        message: payload.data?.message || buildHealthMessage(payload.data?.neuronsRemaining),
        testedAt: new Date().toISOString(),
      }, state.byok);
      state.byokHealthError = '';
      updateByokPanelUi();
      if (announce) {
        status.textContent = state.byokHealth.message;
        showToast(state.byokHealth.message);
      }
      return state.byokHealth;
    } catch (error) {
      state.byokHealth = null;
      state.byokHealthError = error?.message || 'Unable to verify your Cloudflare key right now.';
      updateByokPanelUi();
      if (announce) {
        status.textContent = state.byokHealthError;
        showToast(state.byokHealthError);
      }
      return null;
    }
  };

  const refreshDemoUsage = async (filterId = state.filter?.id) => {
    const usage = await loadDemoUsage(state.filter?.customDefinition ? '' : filterId, {
      referralCode: state.referralCode,
      trendId: state.trend?.id || requestedTrend || '',
      source: state.referralSource || 'try-page',
    });
    if (usage) {
      state.demoUsage = usage;
      if (!state.referralCode && usage.referral?.code) state.referralCode = usage.referral.code;
    }
    showEntryBanner();
    renderUsageGrid(usageGrid, catalog, state.filter, state.demoUsage);
    renderByokStatusBanner();
    return state.demoUsage;
  };

  const getStageBadge = (filter) => {
    if (filter?.customDefinition && !state.byok.hasCredentials) {
      return '<span class="badge badge--warning">Custom filters on the public website require your Cloudflare key</span>';
    }
    if (state.outputMode === 'api') {
      return state.lastTransformSource === 'cloudflare'
        ? '<span class="badge badge--brand">BYOK result · secure proxy via /api/transform</span>'
        : '<span class="badge badge--success">Demo result · /api/transform</span>';
    }
    if (filter.clientSideOnly) {
      return '<span class="badge badge--accent">Client-side effect · no AI upload</span>';
    }
    if (state.byok.hasCredentials) {
      return '<span class="badge badge--brand">Cloudflare key ready · transforms proxy through this site</span>';
    }
    if (filter.isDemoFilter) {
      return '<span class="badge badge--success">Demo filter · ready for the free daily usage shell</span>';
    }
    return '<span class="badge badge--success">Free transforms available within today’s usage limit</span>';
  };

  if (byokAccountInput) byokAccountInput.value = state.byok.accountId;
  if (byokTokenInput) byokTokenInput.value = state.byok.apiToken;

  const setSummary = async () => {
    const filter = state.filter;
    const isCustomFilter = Boolean(filter?.customDefinition);
    const related = sortFilters(catalog.filters.filter((item) => item.category === filter.category && item.id !== filter.id), 'popular').slice(0, 6);
    trySelectionTitle.textContent = isCustomFilter
      ? 'Switch to catalog filters'
      : state.trend
        ? `${state.trend.label} starters`
        : requestedId ? 'Switch filters' : 'Popular filters to start';
    const selectionPool = state.trend?.filters?.length
      ? state.trend.filters
      : sortFilters(catalog.filters, 'popular');
    selection.innerHTML = createSelectionMarkup(selectionPool.slice(0, 6));
    if (embedMode) {
      relatedGrid.closest('.section')?.classList.add('hidden');
      if (noticeTarget) noticeTarget.classList.add('hidden');
    }
    breadcrumb.innerHTML = `
      <a href="/index.html">Home</a>
      <span>→</span>
      <a href="/categories/${filter.categoryMeta.slug}.html">${escapeHtml(filter.categoryDisplay)}</a>
      <span>→</span>
      <span>${escapeHtml(filter.name)}</span>`;
    summary.innerHTML = `
      <span class="page-eyebrow">${filter.categoryMeta.emoji} ${escapeHtml(filter.categoryDisplay)}${isCustomFilter ? ' · Shared custom filter' : ''}</span>
      <h1>${escapeHtml(filter.name)}</h1>
      <p class="lead">${escapeHtml(filter.description)}</p>
      <div class="filter-summary__badges">
        <span class="badge badge--brand">${capitalize(filter.type)}</span>
        <span class="badge">${escapeHtml(filter.modelLabel)}</span>
        <span class="badge">${filter.estimatedNeurons} neurons</span>
        ${isCustomFilter ? '<span class="badge badge--warning">Shared custom</span>' : '<span class="badge badge--success">FREE</span>'}
        ${filter.clientSideOnly ? '<span class="badge badge--accent">Browser-only</span>' : ''}
      </div>`;
    effectsControls.classList.toggle('hidden', !filter.clientSideOnly);
    transformButton.textContent = filter.clientSideOnly
      ? 'Apply effect instantly'
      : state.byok.hasCredentials
        ? 'Transform with your Cloudflare key'
        : 'Transform — FREE ✨';
    stageSlot.innerHTML = renderStagePlaceholder(filter);
    stageNote.innerHTML = getStageBadge(filter);
    renderUsageGrid(usageGrid, catalog, filter, state.demoUsage);
    overviewTab.innerHTML = renderOverview(filter);
    state.helpHtml = await getHelpHtml(filter);
    helpTab.innerHTML = state.helpHtml;
    techTab.innerHTML = renderTech(filter, catalog);
    relatedGrid.innerHTML = related.length ? related.map((item) => renderFilterCard(item)).join('') : '<div class="empty-state"><p>More related filters appear here once the full manifest lands.</p></div>';
    updateMeta({
      title: `${filter.name} · ${SITE.name}`,
      description: `${filter.description} Upload a photo, preview the transform flow, and browse related filters on ${SITE.name}.`,
      canonicalPath: buildTryHref(filter),
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
      url: `${SITE.baseUrl}${buildTryHref(filter)}`,
    });
    updateTransformButtonLabel();
    updateByokPanelUi();
    status.textContent = state.byok.hasCredentials
      ? 'Your Cloudflare key is ready. Upload a photo to run it through the secure proxy.'
      : isCustomFilter
        ? 'This shared custom filter needs your Cloudflare key on the public website.'
        : state.trend
          ? `Trend mode active: ${state.trend.label}. Upload a clear photo and transform it to join in.`
          : 'Upload a clear face photo for the best result.';
  };

  const renderResult = () => {
    const filter = state.filter;
    if (!state.variants.length || !state.sourceDataUrl) {
      stageSlot.innerHTML = renderStagePlaceholder(filter);
      resultActions.classList.add('hidden');
      renderVariants(variantsTarget, [], 0, () => {});
      initBeforeAfterSliders(stageSlot);
      stageNote.innerHTML = getStageBadge(filter);
      if (shareResultButton) shareResultButton.disabled = true;
      if (shareFilterButton) shareFilterButton.disabled = false;
      return;
    }
    const current = state.variants[state.activeVariantIndex] || state.variants[0];
    stageSlot.innerHTML = renderBeforeAfter({
      beforeUrl: state.sourceDataUrl,
      afterUrl: current,
      beforeLabel: 'Original',
      afterLabel: state.outputMode === 'api' ? `${filter.name} result` : `${filter.name} preview`,
      caption: state.outputMode === 'api'
        ? state.lastTransformSource === 'cloudflare'
          ? 'Rendered from /api/transform with your Cloudflare credentials'
          : 'Rendered from /api/transform'
        : 'Preview mode kept the flow usable because the live AI result was unavailable',
    });
    resultActions.classList.remove('hidden');
    renderVariants(variantsTarget, state.variants, state.activeVariantIndex, (nextIndex) => {
      state.activeVariantIndex = nextIndex;
      renderResult();
    });
    initBeforeAfterSliders(stageSlot);
    stageNote.innerHTML = getStageBadge(filter);
    if (shareResultButton) shareResultButton.disabled = !state.variants.length;
    if (shareFilterButton) shareFilterButton.disabled = false;
  };

  const openShareOverlay = async ({ budgetBlocked = false } = {}) => {
    if (!shareOverlay || !state.filter) return;
    const current = state.variants[state.activeVariantIndex];
    if (!current && !budgetBlocked) return;
    const shareContext = buildShareContext();
    state.shareContext = shareContext;
    if (shareOverlayTitle) shareOverlayTitle.textContent = budgetBlocked
      ? 'Share GIC Photo Filters to earn more transforms'
      : `Your ${state.filter.name} result is ready`;
    if (shareOverlayCopy) {
      shareOverlayCopy.textContent = budgetBlocked
        ? 'Share your referral link to help unlock more free transforms.'
        : shareContext.trendLabel
          ? `Use this caption to invite friends into ${shareContext.trendLabel}.`
          : 'Use this caption to post your before/after result.';
    }
    if (shareOverlayCopyImage) shareOverlayCopyImage.hidden = budgetBlocked;
    if (budgetBlocked) {
      if (shareOverlayPreview) shareOverlayPreview.innerHTML = '<p class="microcopy">Your next free transform is available after referrals unlock a bonus or the daily limit resets.</p>';
      if (typeof shareOverlay.showModal === 'function') shareOverlay.showModal();
      return;
    }
    try {
      const collage = await createShareCollage({
        beforeUrl: state.sourceDataUrl,
        afterUrl: current,
        filterName: state.filter.name,
        trendLabel: shareContext.trendLabel,
        sourceLabel: 'GIC Photo Filters',
      });
      if (shareOverlayPreview) {
        shareOverlayPreview.innerHTML = `<img src="${collage.dataUrl}" alt="${escapeHtml(state.filter.name)} before and after collage" />`;
      }
      state.latestResultBlob = collage.blob || state.latestResultBlob;
    } catch {
      if (shareOverlayPreview) {
        shareOverlayPreview.innerHTML = renderBeforeAfter({
          beforeUrl: state.sourceDataUrl,
          afterUrl: current,
          beforeLabel: 'Original',
          afterLabel: state.filter.name,
        });
      }
    }
    if (typeof shareOverlay.showModal === 'function') shareOverlay.showModal();
  };

  const showBudgetState = (error) => {
    const siteWide = error?.code === 'daily_neuron_budget_reached';
    const title = siteWide ? 'Today’s free transform budget is spent' : 'You’ve used today’s free transforms';
    const copy = siteWide
      ? 'The site-wide free transform budget is spent for today. Share to earn more, or use your own Cloudflare key. Resets at midnight UTC.'
      : 'Share to earn more free transforms, or use your own Cloudflare key. Resets at midnight UTC.';
    state.variants = [];
    state.activeVariantIndex = 0;
    resultActions.classList.add('hidden');
    renderVariants(variantsTarget, [], 0, () => {});
    stageSlot.innerHTML = `
      <div class="empty-state">
        <span class="badge badge--warning">Free limit reached</span>
        <h3>${title}</h3>
        <p>${copy}</p>
        <div class="card-actions">
          <button class="button" type="button" data-budget-share>Share to earn more</button>
          <button class="button-secondary" type="button" data-budget-setup>Use your own Cloudflare key</button>
        </div>
      </div>`;
    stageSlot.querySelector('[data-budget-share]')?.addEventListener('click', () => openShareOverlay({ budgetBlocked: true }));
    stageSlot.querySelector('[data-budget-setup]')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('gic:open-setup', { detail: { source: 'try-budget-state' } }));
    });
    stageNote.innerHTML = '<span class="badge badge--warning">No image was created</span>';
    status.textContent = `${title}. ${copy}`;
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
    const resized = await resizeFile(file, 512);
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
    state.storageMode = '';
    state.lastTransformSource = '';
    state.latestResultBlob = null;
    fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
    status.textContent = 'Upload a clear face photo for the best result.';
    renderResult();
  };

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (file) await setSource(file);
  });
  if (cameraButton && cameraInput) {
    cameraButton.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', async (event) => {
      const [file] = event.target.files || [];
      if (file) await setSource(file);
    });
  }
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

  byokStorageButtons.forEach((button) => {
    button.addEventListener('click', () => persistByokInputs(button.dataset.byokStorage));
  });
  byokAccountInput?.addEventListener('input', () => persistByokInputs());
  byokTokenInput?.addEventListener('input', () => persistByokInputs());
  byokClearButton?.addEventListener('click', clearByokCredentials);
  byokTestButton?.addEventListener('click', async () => {
    await testByokConnection();
  });
  byokStatusPrimary?.addEventListener('click', () => {
    if (state.byok.hasCredentials) openSettingsSurface('try-banner');
    else window.dispatchEvent(new CustomEvent('gic:open-setup', { detail: { source: 'try-banner-primary' } }));
  });
  byokStatusSetup?.addEventListener('click', (event) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('gic:open-setup', { detail: { source: 'try-banner' } }));
  });
  byokInlineSettings?.addEventListener('click', () => openSettingsSurface('try-inline-card'));

  window.addEventListener(BYOK_EVENTS.CHANGED, async () => {
    syncByokState(loadByokSettings(), { resetHealth: false });
    state.byokHealth = loadCachedByokHealth(loadByokSettings());
    updateByokPanelUi();
    updateTransformButtonLabel();
    if (state.byok.hasCredentials && !state.byokHealth) {
      await testByokConnection({ announce: false });
    }
  });
  window.addEventListener('gic:byok-health', (event) => {
    state.byokHealth = event.detail || null;
    state.byokHealthError = '';
    updateByokPanelUi();
  });

  transformButton.addEventListener('click', async () => {
    if (!state.filter) return;
    if (state.filter.customDefinition && !state.byok.hasCredentials) {
      status.textContent = 'Shared custom filters on the public website need your Cloudflare key.';
      window.dispatchEvent(new CustomEvent('gic:open-setup', { detail: { source: 'try-custom-transform' } }));
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
        byok: state.byok,
        customFilter: state.filter.customDefinition || null,
      });
      state.variants = result.images;
      state.outputMode = result.mode;
      state.storageMode = result.storageMode || state.storageMode;
      state.lastTransformSource = result.requestMode || '';
      state.latestResultBlob = result.blob || null;
      state.activeVariantIndex = 0;
      renderResult();
      if (result.requestMode === 'cloudflare') {
        addSessionNeurons(state.filter.estimatedNeurons);
        updateSessionUsageDisplay();
        if (state.byokHealth?.status === 'ok') {
          const nextRemaining = Math.max(0, Number(state.byokHealth.neuronsRemaining || 0) - Number(state.filter.estimatedNeurons || 0));
          state.byokHealth = {
            ...state.byokHealth,
            neuronsUsed: Number(state.byokHealth.neuronsUsed || 0) + Number(state.filter.estimatedNeurons || 0),
            neuronsRemaining: nextRemaining,
            message: buildHealthMessage(nextRemaining),
          };
          cacheByokHealth({
            ...state.byokHealth,
            testedAt: new Date().toISOString(),
          }, state.byok);
        }
      }
      if (!state.filter.clientSideOnly && result.mode === 'api' && result.requestMode !== 'cloudflare') {
        incrementUsage(state.filter);
        await refreshDemoUsage(state.filter.id);
      }
      renderUsageGrid(usageGrid, catalog, state.filter, state.demoUsage);
      renderByokStatusBanner();
      const successMessage = result.warningMessage
        ? result.warningMessage
        : result.requestMode === 'cloudflare'
          ? 'Transform complete through your Cloudflare key. Open share to post your before/after.'
          : result.mode === 'api'
            ? result.storageMode === 'direct'
              ? 'Transform complete. Open share now to publish your result and referral link.'
              : 'Transform complete. Open share to post your result.'
            : 'Preview ready. The UI kept working even though the live AI result was unavailable.';
      status.textContent = successMessage;
      if (!result.warningMessage) {
        window.setTimeout(() => {
          openShareOverlay();
        }, 260);
      }
      if (!state.byok.hasCredentials && catalog.byokPromptAfterSuccess && result.mode === 'api') {
        window.setTimeout(() => {
          if (!state.byok.hasCredentials && byokStatusTitle && byokStatusDetail) {
            byokStatusTitle.textContent = '⚡ Nice result. Want unlimited runs?';
            byokStatusDetail.textContent = 'Add your Cloudflare key now to keep transforming without free-tier caps.';
          }
        }, 1600);
      }
      track('filter_transform', { filterId: state.filter.id, mode: result.mode });
    } catch (error) {
      if (error?.code === 'daily_limit_reached' || error?.code === 'daily_neuron_budget_reached') {
        showBudgetState(error);
        return;
      }
      const message = error?.message || 'The transform shell hit an error. Try a different photo or filter.';
      status.textContent = message;
      showToast(`Transform failed: ${message}`);
      console.error(error);
    } finally {
      transformButton.disabled = false;
      updateTransformButtonLabel();
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

  const runShareFlow = async ({ includeImage = false } = {}) => {
    if (!state.filter) return false;
    const shareContext = state.shareContext || buildShareContext();
    state.shareContext = shareContext;
    const current = state.variants[state.activeVariantIndex];
    let shareFile = null;
    if (includeImage && current) {
      const blob = state.latestResultBlob || await fetch(current).then((response) => response.blob());
      shareFile = new File([blob], `${state.filter.slug || 'gic-photo-filter'}-share.jpg`, {
        type: blob.type || 'image/jpeg',
      });
    }
    try {
      if (navigator.share) {
        if (shareFile && navigator.canShare?.({ files: [shareFile] })) {
          await navigator.share({ title: `${state.filter.name} · ${SITE.name}`, text: shareContext.shareText, files: [shareFile], url: shareContext.shareUrl });
        } else {
          await navigator.share({ title: `${state.filter.name} · ${SITE.name}`, text: shareContext.shareText, url: shareContext.shareUrl });
        }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareContext.shareText);
        showToast('Share caption + link copied to your clipboard.');
      } else {
        showToast('Sharing is not available in this browser.');
        return false;
      }
      return true;
    } catch {
      showToast('Sharing was cancelled.');
      return false;
    }
  };

  shareFilterButton?.addEventListener('click', async () => {
    state.shareContext = buildShareContext();
    const shared = await runShareFlow();
    if (shared) track('filter_share', { filterId: state.filter.id, source: 'try-filter' });
  });

  shareResultButton?.addEventListener('click', async () => {
    if (!state.filter) return;
    const current = state.variants[state.activeVariantIndex];
    if (!current) {
      showToast('Run a transform before sharing a result.');
      return;
    }
    await openShareOverlay();
    track('filter_share_result_open', { filterId: state.filter.id, mode: state.outputMode || 'preview' });
  });

  shareOverlayNative?.addEventListener('click', async () => {
    const shared = await runShareFlow({ includeImage: true });
    if (shared) track('filter_share_result', { filterId: state.filter?.id || '', mode: state.outputMode || 'preview', channel: 'native' });
  });
  shareOverlayCopyButton?.addEventListener('click', async () => {
    const shareContext = state.shareContext || buildShareContext();
    try {
      await navigator.clipboard.writeText(shareContext.shareText);
      showToast('Caption + referral link copied.');
      track('filter_share_result', { filterId: state.filter?.id || '', mode: state.outputMode || 'preview', channel: 'copy' });
    } catch {
      showToast('Unable to copy share text.');
    }
  });
  shareOverlayCopyImage?.addEventListener('click', async () => {
    const current = state.variants[state.activeVariantIndex];
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      showToast('Result image link copied.');
    } catch {
      showToast('Unable to copy image link.');
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

  showEntryBanner();
  renderTrendShortcuts();
  if (embedMode) {
    resultActions?.classList.remove('hidden');
    resetButton?.classList.add('hidden');
  }
  updateByokPanelUi();
  updateTransformButtonLabel();
  await setSummary();
  await refreshDemoUsage(state.filter?.id);
  if (state.byok.hasCredentials) {
    await testByokConnection({ announce: false });
  } else {
    renderByokStatusBanner();
  }
  renderResult();
  track('filter_view', { filterId: state.filter.id });
}

async function initBuildPage() {
  const noticeTarget = document.getElementById('build-notice');
  const modelGrid = document.getElementById('build-model-grid');
  const promptInput = document.getElementById('build-prompt');
  const promptCounter = document.getElementById('build-prompt-counter');
  const negativeInput = document.getElementById('build-negative-prompt');
  const negativeCounter = document.getElementById('build-negative-counter');
  const suggestionsTarget = document.getElementById('build-suggestions');
  const shuffleSuggestionsButton = document.getElementById('build-suggestions-shuffle');
  const strengthInput = document.getElementById('build-strength');
  const strengthValue = document.getElementById('build-strength-value');
  const guidanceInput = document.getElementById('build-guidance');
  const guidanceValue = document.getElementById('build-guidance-value');
  const dimensionButtons = Array.from(document.querySelectorAll('[data-build-dimension]'));
  const variantButtons = Array.from(document.querySelectorAll('[data-build-variants]'));
  const uploadDropzone = document.getElementById('build-upload-dropzone');
  const buildFileInput = document.getElementById('build-file-input');
  const buildCameraInput = document.getElementById('build-camera-input');
  const buildCameraButton = document.getElementById('build-camera-button');
  const runButtons = Array.from(document.querySelectorAll('[data-build-run]'));
  const stickyBar = document.getElementById('build-sticky-bar');
  const stickyLabel = document.getElementById('build-sticky-label');
  const cancelButton = document.getElementById('build-cancel-button');
  const keepWaitingButton = document.getElementById('build-keep-waiting');
  const retryButton = document.getElementById('build-retry-button');
  const buildProgress = document.getElementById('build-progress');
  const buildStatus = document.getElementById('build-status');
  const buildNoKeyBanner = document.getElementById('build-no-key-banner');
  const buildNoKeyCta = document.getElementById('build-no-key-cta');
  const buildStage = document.getElementById('build-stage');
  const buildVariants = document.getElementById('build-variant-list');
  const buildDetails = document.getElementById('build-details');
  const nameInput = document.getElementById('build-name');
  const descriptionInput = document.getElementById('build-description');
  const descriptionCounter = document.getElementById('build-description-counter');
  const categorySelect = document.getElementById('build-category');
  const tagsInput = document.getElementById('build-tags');
  const shareInput = document.getElementById('build-share-url');
  const embedInput = document.getElementById('build-embed-code');
  const copyShareButton = document.getElementById('build-copy-share');
  const nativeShareButton = document.getElementById('build-native-share');
  const shareHint = document.getElementById('build-share-hint');
  const downloadButton = document.getElementById('build-download-button');
  const sectionCards = Array.from(document.querySelectorAll('[data-build-section]'));
  const sectionBadges = Object.fromEntries(sectionCards.map((card) => [card.dataset.buildSection, card.querySelector('[data-section-state]')]));

  const info = await loadCatalog();
  const { catalog } = info;
  const health = await loadHealthSnapshot();
  renderCatalogNotice(noticeTarget, info);
  renderHealthNotice(noticeTarget, health);
  if (categorySelect && !categorySelect.options.length) {
    categorySelect.innerHTML = catalog.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  }

  const builderModels = [
    { id: 'flux2-klein-9b', tagline: 'Highest quality', bestFor: 'Faces, character styles, polished artistic looks', recommended: true },
    { id: 'flux2-klein-4b', tagline: 'Faster results', bestFor: 'Quick iterations and lighter creative edits' },
  ].map((entry) => ({
    ...entry,
    label: MODEL_OPTIONS.find((option) => option.id === entry.id)?.label || entry.id,
    description: MODEL_OPTIONS.find((option) => option.id === entry.id)?.description || entry.bestFor,
  }));

  const suggestedFilters = catalog.filters.filter((filter) => filter.prompt && !filter.clientSideOnly);
  const initialPreferredModel = loadPreferredModel();
  const resolvedInitialModel = initialPreferredModel !== 'default'
    ? initialPreferredModel
    : 'flux2-klein-9b';
  const state = {
    catalog,
    health,
    byok: loadByokSettings(),
    byokHealth: loadCachedByokHealth(loadByokSettings()),
    prompt: '',
    negativePrompt: '',
    model: resolvedInitialModel,
    manualModelSelection: initialPreferredModel !== 'default',
    strength: 0.65,
    guidance: 7.5,
    width: 768,
    height: 768,
    variantCount: 1,
    sourceBlob: null,
    sourceDataUrl: '',
    name: 'Custom Filter',
    description: '',
    category: catalog.categories[0]?.id || 'artistic_styles',
    tags: '',
    resultImages: [],
    activeResultIndex: 0,
    latestResultBlob: null,
    hasSuccessfulRun: false,
    isRunning: false,
    runController: null,
    didTimeout: false,
    slowUiVisible: false,
    timeoutHandles: [],
    suggestionIds: [],
  };

  const getShareDefinition = () => normalizeCustomFilterDefinition({
    name: state.name,
    description: state.description,
    category: state.category,
    prompt: state.prompt,
    negativePrompt: state.negativePrompt,
    model: state.model,
    strength: state.strength,
    guidance: state.guidance,
    width: state.width,
    height: state.height,
    variantCount: state.variantCount,
    tags: state.tags,
  });

  const getPreviewFilter = () => createCustomFilterEntry(getShareDefinition(), catalog);
  const getShareUrl = () => {
    const filter = getPreviewFilter();
    return filter ? buildTryShareUrl(filter) : '';
  };

  const clearTimeoutHandles = () => {
    state.timeoutHandles.forEach((handle) => window.clearTimeout(handle));
    state.timeoutHandles = [];
  };

  const markSection = (id, ready, complete = ready) => {
    const badge = sectionBadges[id];
    const card = sectionCards.find((entry) => entry.dataset.buildSection === id);
    if (!badge || !card) return;
    card.dataset.ready = String(ready);
    card.dataset.complete = String(complete);
    badge.textContent = complete ? '✓ Complete' : ready ? '• Ready' : '○ Incomplete';
  };

  const renderSuggestions = () => {
    if (!suggestionsTarget) return;
    const pool = [...suggestedFilters];
    const picked = [];
    while (pool.length && picked.length < 3) {
      const index = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(index, 1)[0]);
    }
    state.suggestionIds = picked.map((entry) => entry.id);
    suggestionsTarget.innerHTML = picked.map((filter) => `
      <article class="detail-card build-suggestion">
        <strong>${escapeHtml(filter.name)}</strong>
        <p>${escapeHtml(filter.prompt)}</p>
        <button class="button-link" type="button" data-build-suggestion="${filter.id}">Use this prompt</button>
      </article>`).join('');
    suggestionsTarget.querySelectorAll('[data-build-suggestion]').forEach((button) => {
      button.addEventListener('click', () => {
        const match = suggestedFilters.find((filter) => filter.id === button.dataset.buildSuggestion);
        if (!match) return;
        state.prompt = match.prompt || state.prompt;
        state.negativePrompt = match.negativePrompt || state.negativePrompt;
        if (promptInput) promptInput.value = state.prompt;
        if (negativeInput) negativeInput.value = state.negativePrompt;
        syncFormUi();
      });
    });
  };

  const renderModelCards = () => {
    if (!modelGrid) return;
    modelGrid.innerHTML = builderModels.map((model) => `
      <button class="button-ghost build-model-card" type="button" data-build-model="${model.id}" data-disabled="${String(Boolean(model.disabled))}" aria-pressed="${String(state.model === model.id)}">
        <div class="build-model-card__topline">
          <strong>${escapeHtml(model.label)}</strong>
          ${model.recommended ? '<span class="badge badge--brand">Recommended</span>' : model.disabled ? '<span class="badge">Soon</span>' : ''}
        </div>
        <p>${escapeHtml(model.tagline)}</p>
        <span class="microcopy">${escapeHtml(model.bestFor)}</span>
      </button>`).join('');
    modelGrid.querySelectorAll('[data-build-model]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.disabled === 'true') {
          showToast('Web inpainting masks are coming soon. Pick another model for now.');
          return;
        }
        state.model = button.dataset.buildModel;
        state.manualModelSelection = true;
        syncFormUi();
      });
    });
  };

  const renderResults = () => {
    const previewFilter = getPreviewFilter();
    if (!state.sourceDataUrl) {
      buildStage.innerHTML = `
        <div class="stage-placeholder stage-placeholder--example">
          <div class="stage-placeholder__copy">
            <h3>Upload a photo to test your custom filter</h3>
            <p>Once you add a photo, you can compare your original with the transformed result right here.</p>
          </div>
          ${previewFilter ? renderBeforeAfter({
            beforeUrl: previewFilter.previewBefore,
            afterUrl: previewFilter.previewAfter,
            beforeLabel: 'Catalog-style preview',
            afterLabel: previewFilter.name,
            caption: 'The live test area below will use your uploaded photo.',
          }) : ''}
        </div>`;
      buildVariants.innerHTML = '';
      if (downloadButton) downloadButton.disabled = true;
      return;
    }

    if (!state.resultImages.length) {
      buildStage.innerHTML = renderBeforeAfter({
        beforeUrl: state.sourceDataUrl,
        afterUrl: state.sourceDataUrl,
        beforeLabel: 'Original',
        afterLabel: 'Waiting for test result',
        caption: state.isRunning ? 'Running your custom filter now…' : 'Run a test to see the transformed comparison here.',
      });
      buildVariants.innerHTML = '';
      if (downloadButton) downloadButton.disabled = true;
      initBeforeAfterSliders(buildStage);
      return;
    }

    const activeImage = state.resultImages[state.activeResultIndex] || state.resultImages[0];
    buildStage.innerHTML = renderBeforeAfter({
      beforeUrl: state.sourceDataUrl,
      afterUrl: activeImage,
      beforeLabel: 'Original',
      afterLabel: `${previewFilter?.name || 'Custom filter'} result`,
      caption: 'Adjust the prompt or sliders, then rerun the test to keep refining the look.',
    });
    buildVariants.innerHTML = state.resultImages.map((imageUrl, index) => `
      <article class="variant-card" data-active="${String(index === state.activeResultIndex)}">
        <button type="button" data-build-variant-index="${index}">
          <img src="${imageUrl}" alt="Custom filter variant ${index + 1}" />
          <div class="variant-card__label">Variant ${index + 1}</div>
        </button>
      </article>`).join('');
    buildVariants.querySelectorAll('[data-build-variant-index]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeResultIndex = Number(button.dataset.buildVariantIndex) || 0;
        renderResults();
      });
    });
    if (downloadButton) downloadButton.disabled = false;
    initBeforeAfterSliders(buildStage);
  };

  const renderDetails = () => {
    const definition = getShareDefinition();
    const previewFilter = getPreviewFilter();
    if (!definition || !previewFilter) {
      buildDetails.innerHTML = '<p class="microcopy">Finish the prompt and choose a model to unlock the live custom filter summary.</p>';
      return;
    }
    buildDetails.innerHTML = `
      <div class="markdown-content">
        <p><strong>${escapeHtml(definition.name)}</strong> · ${escapeHtml(previewFilter.modelLabel)} · ${definition.width}×${definition.height}</p>
        <ul>
          <li>Prompt: ${escapeHtml(definition.prompt)}</li>
          <li>Negative prompt: ${escapeHtml(definition.negativePrompt || 'None')}</li>
          <li>Strength ${definition.strength.toFixed(2)} · Guidance ${definition.guidance.toFixed(1)} · ${definition.variantCount} result${definition.variantCount > 1 ? 's' : ''}</li>
          <li>Tags: ${escapeHtml(definition.tags.join(', ') || 'None')}</li>
        </ul>
      </div>`;
    const shareUrl = state.hasSuccessfulRun ? getShareUrl() : '';
    if (shareInput) shareInput.value = shareUrl;
    if (embedInput) {
      embedInput.value = shareUrl
        ? `<iframe src="${shareUrl}&embed=true" loading="lazy" style="width:100%;max-width:720px;aspect-ratio:4/5;border:0;border-radius:16px;" title="${escapeHtml(definition.name)}"></iframe>`
        : '';
    }
  };

  const syncFormUi = () => {
    if (promptCounter) promptCounter.textContent = `${state.prompt.length}/500`;
    if (negativeCounter) negativeCounter.textContent = `${state.negativePrompt.length}/300`;
    if (descriptionCounter) descriptionCounter.textContent = `${state.description.length}/120`;
    if (strengthValue) strengthValue.textContent = state.strength.toFixed(2);
    if (guidanceValue) guidanceValue.textContent = state.guidance.toFixed(1);
    dimensionButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(`${state.width}x${state.height}` === button.dataset.buildDimension));
    });
    variantButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.buildVariants) === state.variantCount));
    });
    if (stickyBar) stickyBar.hidden = !(state.prompt.trim() && state.model);
    if (stickyLabel) stickyLabel.textContent = state.hasSuccessfulRun
      ? 'Adjust any section, then rerun your test.'
      : state.prompt.trim()
        ? 'Prompt ready — add a photo and run your first test.'
        : 'Write a prompt and pick a model to unlock Run Test.';
    if (buildNoKeyBanner) buildNoKeyBanner.hidden = state.byok.hasCredentials;
    if (shareHint) {
      shareHint.textContent = state.hasSuccessfulRun
        ? 'Anyone with this link can load your filter on the Try page. Use embed mode for lightweight website previews.'
        : 'Run a successful test first to generate a shareable result link.';
    }
    if (copyShareButton) copyShareButton.disabled = !state.hasSuccessfulRun;
    if (nativeShareButton) nativeShareButton.disabled = !state.hasSuccessfulRun;
    if (downloadButton) downloadButton.disabled = !state.resultImages.length;
    markSection('prompt', Boolean(state.prompt.trim()), state.prompt.trim().length > 10);
    markSection('model', Boolean(state.model), Boolean(state.model));
    markSection('params', true, true);
    markSection('test', Boolean(state.sourceBlob), state.hasSuccessfulRun);
    markSection('name', Boolean(state.name.trim()), Boolean(state.name.trim() && state.description.trim()));
    markSection('share', state.hasSuccessfulRun, state.hasSuccessfulRun);
    renderModelCards();
    renderResults();
    renderDetails();
  };

  const resetRunUi = ({ keepStatus = false, showRetry = false } = {}) => {
    clearTimeoutHandles();
    state.isRunning = false;
    state.runController = null;
    state.slowUiVisible = false;
    if (buildProgress) buildProgress.hidden = true;
    if (cancelButton) cancelButton.hidden = true;
    if (keepWaitingButton) keepWaitingButton.hidden = true;
    if (retryButton) retryButton.hidden = !showRetry;
    runButtons.forEach((button) => {
      button.disabled = false;
      button.textContent = 'Run Test ▶';
    });
    if (!keepStatus && buildStatus && !state.hasSuccessfulRun) buildStatus.textContent = 'Upload a photo, then run a live test through /api/transform.';
  };

  const scheduleRunMilestones = () => {
    clearTimeoutHandles();
    state.timeoutHandles.push(window.setTimeout(() => {
      if (state.isRunning && buildStatus) buildStatus.textContent = 'Transforms usually take 15–30 seconds…';
    }, 1000));
    state.timeoutHandles.push(window.setTimeout(() => {
      if (state.isRunning && buildStatus) buildStatus.textContent = 'Still working — complex transforms can take up to a minute…';
    }, 45000));
    state.timeoutHandles.push(window.setTimeout(() => {
      if (!state.isRunning) return;
      state.slowUiVisible = true;
      if (buildStatus) buildStatus.textContent = 'This is taking longer than usual.';
      if (cancelButton) cancelButton.hidden = false;
      if (keepWaitingButton) keepWaitingButton.hidden = false;
    }, 90000));
    state.timeoutHandles.push(window.setTimeout(() => {
      if (!state.isRunning || !state.runController) return;
      state.didTimeout = true;
      state.runController.abort();
      if (buildStatus) buildStatus.textContent = 'The transform timed out. Check your connection and try again.';
      if (retryButton) retryButton.hidden = false;
    }, 120000));
  };

  const applyUploadedFile = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Please keep uploads below 5MB.');
      return;
    }
    const resized = await resizeFile(file, 512);
    state.sourceBlob = resized.blob;
    state.sourceDataUrl = resized.dataUrl;
    state.resultImages = [];
    state.activeResultIndex = 0;
    state.hasSuccessfulRun = false;
    if (buildStatus) buildStatus.textContent = 'Photo ready. Run a live test when you are ready.';
    syncFormUi();
  };

  const runBuilderTest = async () => {
    const definition = getShareDefinition();
    const previewFilter = getPreviewFilter();
    if (!definition || !previewFilter) {
      showToast('Write your prompt and choose a model first.');
      return;
    }
    if (!state.sourceBlob || !state.sourceDataUrl) {
      showToast('Upload a photo before running the builder test.');
      return;
    }
    if (!state.byok.hasCredentials) {
      if (buildStatus) buildStatus.textContent = 'You need your Cloudflare key to run builder tests.';
      window.dispatchEvent(new CustomEvent('gic:open-setup', { detail: { source: 'build-run-test' } }));
      return;
    }

    state.isRunning = true;
    state.didTimeout = false;
    state.hasSuccessfulRun = false;
    state.resultImages = [];
    state.activeResultIndex = 0;
    state.runController = new AbortController();
    if (buildProgress) buildProgress.hidden = false;
    updateProgress(buildProgress, 12);
    if (buildStatus) buildStatus.textContent = 'Starting…';
    if (cancelButton) cancelButton.hidden = true;
    if (keepWaitingButton) keepWaitingButton.hidden = true;
    if (retryButton) retryButton.hidden = true;
    runButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = 'Starting…';
    });
    scheduleRunMilestones();
    renderResults();

    try {
      const images = [];
      for (let index = 0; index < definition.variantCount; index += 1) {
        if (state.runController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (buildStatus) {
          buildStatus.textContent = definition.variantCount > 1
            ? `Running variant ${index + 1} of ${definition.variantCount}…`
            : 'Running your custom filter…';
        }
        updateProgress(buildProgress, clamp(20 + (index * 40), 20, 80));
        const result = await attemptApiTransform(previewFilter, state.sourceBlob, definition.strength, state.byok, {
          customFilter: definition,
          signal: state.runController.signal,
        });
        images.push(result.images[0]);
        state.latestResultBlob = result.blob || state.latestResultBlob;
      }
      state.resultImages = images.filter(Boolean);
      state.activeResultIndex = 0;
      state.hasSuccessfulRun = state.resultImages.length > 0;
      if (!state.hasSuccessfulRun) throw new Error('No result image was returned.');
      addSessionNeurons(previewFilter.estimatedNeurons * state.resultImages.length);
      if (state.byokHealth?.status === 'ok') {
        const nextRemaining = Math.max(0, Number(state.byokHealth.neuronsRemaining || 0) - (previewFilter.estimatedNeurons * state.resultImages.length));
        state.byokHealth = cacheByokHealth({
          ...state.byokHealth,
          neuronsRemaining: nextRemaining,
          neuronsUsed: Number(state.byokHealth.neuronsUsed || 0) + (previewFilter.estimatedNeurons * state.resultImages.length),
          testedAt: new Date().toISOString(),
        }, state.byok);
      }
      updateProgress(buildProgress, 100);
      if (buildStatus) buildStatus.textContent = 'Test complete. Compare the result, tweak your prompt, or share the custom link.';
      track('builder_test_run', { model: definition.model, variants: definition.variantCount });
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (buildStatus && !state.didTimeout) buildStatus.textContent = 'Test canceled. Your photo and settings are still here.';
      } else {
        const message = error?.message || 'Unable to run the custom filter right now.';
        if (buildStatus) buildStatus.textContent = message;
        showToast(message);
        console.error(error);
      }
    } finally {
      resetRunUi({ keepStatus: true, showRetry: state.didTimeout });
      syncFormUi();
    }
  };

  const syncSettingsState = async () => {
    state.byok = loadByokSettings();
    state.byokHealth = loadCachedByokHealth(state.byok);
    syncFormUi();
  };

  promptInput?.addEventListener('input', (event) => {
    state.prompt = String(event.target.value || '').slice(0, 500);
    if (event.target.value !== state.prompt) event.target.value = state.prompt;
    syncFormUi();
  });
  negativeInput?.addEventListener('input', (event) => {
    state.negativePrompt = String(event.target.value || '').slice(0, 300);
    if (event.target.value !== state.negativePrompt) event.target.value = state.negativePrompt;
    syncFormUi();
  });
  nameInput?.addEventListener('input', (event) => {
    state.name = String(event.target.value || '').slice(0, 40) || 'Custom Filter';
    syncFormUi();
  });
  descriptionInput?.addEventListener('input', (event) => {
    state.description = String(event.target.value || '').slice(0, 120);
    if (event.target.value !== state.description) event.target.value = state.description;
    syncFormUi();
  });
  categorySelect?.addEventListener('change', (event) => {
    state.category = event.target.value;
    syncFormUi();
  });
  tagsInput?.addEventListener('input', (event) => {
    state.tags = String(event.target.value || '').slice(0, 160);
    syncFormUi();
  });
  strengthInput?.addEventListener('input', (event) => {
    state.strength = clamp(Number(event.target.value) || 0.65, 0.3, 1);
    syncFormUi();
  });
  guidanceInput?.addEventListener('input', (event) => {
    state.guidance = clamp(Number(event.target.value) || 7.5, 3, 15);
    syncFormUi();
  });
  dimensionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const [width, height] = (button.dataset.buildDimension || '768x768').split('x').map(Number);
      state.width = width;
      state.height = height;
      syncFormUi();
    });
  });
  variantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.variantCount = Number(button.dataset.buildVariants) || 1;
      syncFormUi();
    });
  });
  uploadDropzone?.addEventListener('click', () => buildFileInput?.click());
  buildFileInput?.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (file) await applyUploadedFile(file);
  });
  buildCameraButton?.addEventListener('click', () => buildCameraInput?.click());
  buildCameraInput?.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (file) await applyUploadedFile(file);
  });
  ['dragenter', 'dragover'].forEach((eventName) => uploadDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadDropzone.dataset.dragging = 'true';
  }));
  ['dragleave', 'drop'].forEach((eventName) => uploadDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadDropzone.dataset.dragging = 'false';
  }));
  uploadDropzone?.addEventListener('drop', async (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) await applyUploadedFile(file);
  });
  document.addEventListener('paste', async (event) => {
    if (!document.body.matches('[data-page="build"]')) return;
    const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
      await applyUploadedFile(file);
      showToast('Pasted image added to the builder.');
    }
  });
  runButtons.forEach((button) => button.addEventListener('click', runBuilderTest));
  buildNoKeyCta?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('gic:open-setup', { detail: { source: 'build-no-key-banner' } }));
  });
  cancelButton?.addEventListener('click', () => state.runController?.abort());
  keepWaitingButton?.addEventListener('click', () => {
    if (cancelButton) cancelButton.hidden = true;
    if (keepWaitingButton) keepWaitingButton.hidden = true;
    if (buildStatus) buildStatus.textContent = 'Okay — keeping the request alive a little longer…';
  });
  retryButton?.addEventListener('click', runBuilderTest);
  shuffleSuggestionsButton?.addEventListener('click', renderSuggestions);
  copyShareButton?.addEventListener('click', async () => {
    if (!state.hasSuccessfulRun) return;
    try {
      await navigator.clipboard.writeText(getShareUrl());
      showToast('Custom filter link copied.');
    } catch {
      showToast('Unable to copy the custom filter link.');
    }
  });
  nativeShareButton?.addEventListener('click', async () => {
    if (!state.hasSuccessfulRun) return;
    const url = getShareUrl();
    const title = `${state.name} · GIC Photo Filters`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Try my custom filter on GIC Photo Filters: ${url}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Custom filter link copied.');
      }
    } catch {
      showToast('Sharing was cancelled.');
    }
  });
  downloadButton?.addEventListener('click', () => {
    const current = state.resultImages[state.activeResultIndex];
    if (!current) return;
    const link = document.createElement('a');
    link.href = current;
    link.download = `${slugify(state.name || 'custom-filter')}-${state.activeResultIndex + 1}.jpg`;
    link.click();
  });

  window.addEventListener(BYOK_EVENTS.CHANGED, syncSettingsState);
  window.addEventListener('gic:byok-health', (event) => {
    state.byokHealth = event.detail || null;
    syncFormUi();
  });
  window.addEventListener('gic:model-preference-changed', (event) => {
    if (state.manualModelSelection) return;
    const nextModel = event.detail?.model;
    if (nextModel && nextModel !== 'default') {
      state.model = nextModel;
      syncFormUi();
    }
  });

  if (promptInput) promptInput.value = state.prompt;
  if (negativeInput) negativeInput.value = state.negativePrompt;
  if (nameInput) nameInput.value = state.name;
  if (descriptionInput) descriptionInput.value = state.description;
  if (categorySelect) categorySelect.value = state.category;
  if (tagsInput) tagsInput.value = state.tags;
  if (strengthInput) strengthInput.value = String(state.strength);
  if (guidanceInput) guidanceInput.value = String(state.guidance);
  renderSuggestions();
  syncFormUi();
  if (buildStatus) buildStatus.textContent = 'Upload a photo, then run a live test through /api/transform.';
  track('builder_view', { model: state.model });
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
    case 'trends':
      initTrendsPage();
      break;
    case 'browse':
      initBrowsePage();
      break;
    case 'build':
      initBuildPage();
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
