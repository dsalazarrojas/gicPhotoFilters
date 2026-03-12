import { loadCatalog, populateFooterStats, renderFilterList } from './catalog.js'
import { initTheme } from './theme.js'

async function main() {
  initTheme()
  const slug = document.body.dataset.categoryPageSlug
  const catalog = await loadCatalog()
  populateFooterStats(catalog)
  const category = catalog.categories.find((entry) => entry.pageSlug === slug)
  if (!category) throw new Error('Category not found.')

  document.title = `${category.name} · GIC Photo Filters`
  document.querySelector('[data-category-name]').textContent = category.name
  document.querySelector('[data-category-description]').textContent = category.description
  document.querySelector('[data-category-count]').textContent = `${category.filterCount} filters`
  document.querySelector('[data-category-keywords]').innerHTML = (category.keywords || []).map((keyword) => `<span class="tag-chip rounded-full px-3 py-1">${keyword}</span>`).join('')

  const filters = catalog.filters.filter((filter) => filter.categoryPageSlug === slug)
  renderFilterList(document.querySelector('[data-category-results]'), filters)
}

main().catch((error) => {
  document.querySelector('[data-category-error]').textContent = error.message
})
