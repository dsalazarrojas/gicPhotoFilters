const CATALOG_URL = '/docs/filters-index.json'
let catalogPromise

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function qs(key) {
  return new URLSearchParams(window.location.search).get(key)
}

export async function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL, { headers: { accept: 'application/json' } }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load filter catalog (${response.status})`)
      }
      return response.json()
    })
  }
  return catalogPromise
}

export function findFilter(catalog, filterId) {
  return catalog.filters.find((filter) => filter.id === filterId || filter.slug === filterId)
}

export function activeSeasonalFilters(catalog, month = new Date().getMonth() + 1) {
  const seasonal = catalog.seasonalCalendar.find((entry) => entry.month === month)
  if (!seasonal) return []
  const ids = new Set(seasonal.filterIds)
  return catalog.filters.filter((filter) => ids.has(filter.id))
}

export function formatType(type) {
  return type.replace('-', ' ')
}

export function isInstantFilter(filter) {
  return Boolean(filter.clientSideOnly) || (!filter.requiresAI && filter.estimatedNeurons === 0)
}

export function filterCard(filter, options = {}) {
  const compact = options.compact ? 'gap-3 p-4' : 'gap-4 p-5'
  return `
    <article class="filter-card glass-card rounded-3xl ${compact} flex flex-col h-full">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">${escapeHtml(filter.categoryDisplay)}</p>
          <h3 class="mt-2 text-xl font-semibold text-slate-950 dark:text-white">${escapeHtml(filter.name)}</h3>
        </div>
        <span class="filter-badge rounded-full px-3 py-1 text-xs font-semibold">${filter.clientSideOnly ? 'Instant' : escapeHtml(filter.modelName)}</span>
      </div>
      <p class="text-sm leading-6 text-slate-600 dark:text-slate-300">${escapeHtml(filter.description)}</p>
      <div class="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span class="tag-chip rounded-full px-3 py-1">${escapeHtml(formatType(filter.type))}</span>
        <span class="tag-chip rounded-full px-3 py-1">${escapeHtml(filter.costEstimate)}</span>
        <span class="tag-chip rounded-full px-3 py-1">${filter.isDemoFilter ? 'Demo ready' : 'Bring your own token'}</span>
      </div>
      <div class="mt-auto flex items-center justify-between gap-3 pt-4">
        <a href="/${escapeHtml(filter.tryPath)}" class="inline-flex items-center justify-center rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500">Try filter</a>
        <a href="/${escapeHtml(filter.categoryPath)}" class="site-link text-sm font-medium">Explore category</a>
      </div>
    </article>
  `
}

export function categoryCard(category) {
  return `
    <article class="glass-card rounded-3xl p-6 filter-card h-full">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-3xl">${escapeHtml(category.emoji)}</p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">${escapeHtml(category.name)}</h3>
        </div>
        <span class="filter-badge rounded-full px-3 py-1 text-xs font-semibold">${category.filterCount ?? category.plannedFilterCount} filters</span>
      </div>
      <p class="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">${escapeHtml(category.description)}</p>
      <div class="mt-5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        ${(category.keywords || []).map((keyword) => `<span class="tag-chip rounded-full px-3 py-1">${escapeHtml(keyword)}</span>`).join('')}
      </div>
      <a href="/${escapeHtml(category.categoryPath ?? `categories/${category.pageSlug}.html`)}" class="mt-6 inline-flex items-center text-sm font-semibold text-orange-600 dark:text-orange-300">Browse this category →</a>
    </article>
  `
}

export function populateFooterStats(catalog) {
  document.querySelectorAll('[data-total-filters]').forEach((node) => {
    node.textContent = String(catalog.totalFilters)
  })
  document.querySelectorAll('[data-total-categories]').forEach((node) => {
    node.textContent = String(catalog.categories.length)
  })
}

export function renderFilterList(target, filters, options = {}) {
  target.innerHTML = filters.map((filter) => filterCard(filter, options)).join('')
}

export function sortFilters(filters, value) {
  const list = [...filters]
  switch (value) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name))
    case 'neurons':
      return list.sort((a, b) => a.estimatedNeurons - b.estimatedNeurons)
    case 'demo':
      return list.sort((a, b) => Number(b.isDemoFilter) - Number(a.isDemoFilter) || a.name.localeCompare(b.name))
    case 'seasonal':
      return list.sort((a, b) => Number(b.isSeasonalHighlight) - Number(a.isSeasonalHighlight) || a.name.localeCompare(b.name))
    default:
      return list.sort((a, b) => a.number - b.number)
  }
}

export function uniqueValues(filters, key) {
  return [...new Set(filters.map((item) => item[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
}
