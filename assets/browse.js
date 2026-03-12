import { loadCatalog, populateFooterStats, renderFilterList, sortFilters, uniqueValues } from './catalog.js'
import { initTheme } from './theme.js'

function syncUrl(params) {
  const url = new URL(window.location.href)
  url.search = ''
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  history.replaceState({}, '', url)
}

function populateSelect(select, values, labelFormatter = (value) => value) {
  values.forEach((value) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = labelFormatter(value)
    select.append(option)
  })
}

async function main() {
  initTheme()
  const catalog = await loadCatalog()
  populateFooterStats(catalog)

  const searchInput = document.querySelector('[data-search]')
  const categorySelect = document.querySelector('[data-category]')
  const typeSelect = document.querySelector('[data-type]')
  const modelSelect = document.querySelector('[data-model]')
  const sortSelect = document.querySelector('[data-sort]')
  const demoCheckbox = document.querySelector('[data-demo-only]')
  const instantCheckbox = document.querySelector('[data-instant-only]')
  const seasonalCheckbox = document.querySelector('[data-seasonal-only]')
  const countNode = document.querySelector('[data-result-count]')
  const emptyNode = document.querySelector('[data-empty-state]')
  const grid = document.querySelector('[data-results]')
  const params = new URLSearchParams(window.location.search)

  populateSelect(categorySelect, catalog.categories.map((category) => category.slug), (value) => catalog.categories.find((category) => category.slug === value)?.name ?? value)
  populateSelect(typeSelect, uniqueValues(catalog.filters, 'type'))
  populateSelect(modelSelect, uniqueValues(catalog.filters, 'modelName'))

  searchInput.value = params.get('q') ?? ''
  categorySelect.value = params.get('category') ?? ''
  typeSelect.value = params.get('type') ?? ''
  modelSelect.value = params.get('model') ?? ''
  sortSelect.value = params.get('sort') ?? 'featured'
  demoCheckbox.checked = params.get('demo') === '1'
  instantCheckbox.checked = params.get('instant') === '1'
  seasonalCheckbox.checked = params.get('seasonal') === '1'

  function render() {
    const query = searchInput.value.trim().toLowerCase()
    const filtered = catalog.filters.filter((filter) => {
      if (query && !filter.searchText.toLowerCase().includes(query)) return false
      if (categorySelect.value && filter.category !== categorySelect.value) return false
      if (typeSelect.value && filter.type !== typeSelect.value) return false
      if (modelSelect.value && filter.modelName !== modelSelect.value) return false
      if (demoCheckbox.checked && !filter.isDemoFilter) return false
      if (instantCheckbox.checked && !filter.clientSideOnly) return false
      if (seasonalCheckbox.checked && !filter.isSeasonalHighlight) return false
      return true
    })

    const sorted = sortFilters(filtered, sortSelect.value)
    countNode.textContent = `${sorted.length} filters`
    emptyNode.classList.toggle('hidden', sorted.length > 0)
    grid.classList.toggle('hidden', sorted.length === 0)
    renderFilterList(grid, sorted)
    syncUrl({
      q: searchInput.value.trim(),
      category: categorySelect.value,
      type: typeSelect.value,
      model: modelSelect.value,
      sort: sortSelect.value === 'featured' ? '' : sortSelect.value,
      demo: demoCheckbox.checked ? '1' : '',
      instant: instantCheckbox.checked ? '1' : '',
      seasonal: seasonalCheckbox.checked ? '1' : ''
    })
  }

  ;[searchInput, categorySelect, typeSelect, modelSelect, sortSelect, demoCheckbox, instantCheckbox, seasonalCheckbox].forEach((input) => {
    input.addEventListener('input', render)
    input.addEventListener('change', render)
  })

  render()
}

main().catch((error) => {
  document.querySelector('[data-browse-error]').textContent = error.message
})
