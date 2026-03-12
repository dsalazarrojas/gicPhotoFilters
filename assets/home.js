import { activeSeasonalFilters, categoryCard, loadCatalog, populateFooterStats, renderFilterList } from './catalog.js'
import { initTheme } from './theme.js'

function setStats(catalog) {
  document.querySelector('[data-hero-filters]').textContent = catalog.totalFilters
  document.querySelector('[data-hero-categories]').textContent = catalog.categories.length
  document.querySelector('[data-hero-demo]').textContent = catalog.demoFilterIds.length
}

async function main() {
  initTheme()
  const catalog = await loadCatalog()
  populateFooterStats(catalog)
  setStats(catalog)

  const highlights = activeSeasonalFilters(catalog).slice(0, 6)
  renderFilterList(document.querySelector('[data-seasonal-grid]'), highlights.length ? highlights : catalog.filters.filter((filter) => filter.isDemoFilter).slice(0, 6), { compact: true })

  document.querySelector('[data-category-grid]').innerHTML = catalog.categories.map((category) => categoryCard(category)).join('')
  renderFilterList(document.querySelector('[data-popular-grid]'), catalog.filters.filter((filter) => filter.isDemoFilter).slice(0, 8), { compact: true })

  const heroFilter = catalog.filters.find((filter) => filter.slug === 'grinch-ify') ?? catalog.filters[0]
  document.querySelector('[data-hero-cta]').href = `/${heroFilter.tryPath}`
  document.querySelector('[data-slider-link]').href = `/${heroFilter.tryPath}`
}

main().catch((error) => {
  document.querySelector('[data-home-error]').textContent = error.message
})
