import { activeSeasonalFilters, findFilter, formatType, loadCatalog, populateFooterStats, qs, renderFilterList } from './catalog.js'
import { applyInstantEffect, supportsInstantEffect } from './effects.js'
import { initTheme } from './theme.js'

const funProgressMessages = [
  'Mixing the orange pixels...',
  'Teaching the model your best angles...',
  'Adding the cinematic glow...',
  'Checking costumes and lighting...',
  'Rendering the final frame...'
]

function setStatus(message, tone = 'default') {
  const node = document.querySelector('[data-status]')
  node.textContent = message
  node.className = `rounded-2xl px-4 py-3 text-sm ${tone === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200' : tone === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200' : 'progress-pill text-slate-700 dark:text-slate-200'}`
}

function previewSlider(beforeUrl, afterUrl) {
  const frame = document.querySelector('[data-compare-frame]')
  frame.innerHTML = `
    <img src="${beforeUrl}" alt="Original upload" />
    <img class="before-after-after" src="${afterUrl}" alt="Filtered result" data-after-image />
    <span class="compare-label before">Before</span>
    <span class="compare-label after">After</span>
    <span class="compare-handle" data-handle></span>
  `
  const slider = document.querySelector('[data-compare-slider]')
  slider.classList.remove('hidden')
  slider.value = '50'
  const sync = () => {
    const value = Number(slider.value)
    frame.querySelector('[data-after-image]').style.clipPath = `inset(0 0 0 ${value}%)`
    frame.querySelector('[data-handle]').style.left = `${value}%`
  }
  slider.addEventListener('input', sync)
  sync()
}

async function readUsage(filter) {
  const node = document.querySelector('[data-usage]')
  try {
    const response = await fetch(`/api/usage?filterId=${encodeURIComponent(filter.id)}`)
    if (!response.ok) throw new Error()
    const payload = await response.json()
    node.textContent = `${payload.remaining}/${payload.limit} free transforms remaining today · ${payload.neuronsUsed}/${payload.neuronsLimit} neurons used`
  } catch {
    node.textContent = filter.isDemoFilter ? 'Demo allowance is available when the Cloudflare bindings are configured.' : 'Bring your own token in the app for unlimited transforms.'
  }
}

async function uploadAndTransform(filter, file) {
  if (supportsInstantEffect(filter)) {
    setStatus('Applying instant browser effect...', 'default')
    const blob = await applyInstantEffect(filter, file)
    return { kind: 'instant', blob, url: URL.createObjectURL(blob) }
  }

  const formData = new FormData()
  formData.append('filterId', filter.id)
  formData.append('image', file)
  const response = await fetch('/api/transform', { method: 'POST', body: formData })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const details = payload.error?.message || payload.message || 'Transform failed.'
    throw new Error(details)
  }
  return { kind: 'remote', url: payload.result?.url, payload }
}

async function main() {
  initTheme()
  const catalog = await loadCatalog()
  populateFooterStats(catalog)
  const filterId = qs('id') || catalog.demoFilterIds[0]
  const filter = findFilter(catalog, filterId)
  if (!filter) throw new Error('Filter not found in the catalog.')

  document.title = `Try ${filter.name} · GIC Photo Filters`
  document.querySelector('[data-filter-name]').textContent = filter.name
  document.querySelector('[data-filter-category]').textContent = filter.categoryDisplay
  document.querySelector('[data-filter-description]').textContent = filter.description
  document.querySelector('[data-filter-cost]').textContent = filter.costEstimate
  document.querySelector('[data-filter-type]').textContent = formatType(filter.type)
  document.querySelector('[data-filter-runtime]').textContent = filter.clientSideOnly ? 'Instant in browser' : `~${filter.estimatedRunSeconds}s runtime`
  document.querySelector('[data-filter-share]').textContent = filter.shareText
  document.querySelector('[data-open-category]').href = `/${filter.categoryPath}`
  document.querySelector('[data-app-link]').href = `gicphotofilters://filter/${filter.id}`
  document.querySelector('[data-help]').innerHTML = `
    <h3 class="text-lg font-semibold text-slate-950 dark:text-white">What it does</h3>
    <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">${filter.promptSummary}</p>
    <h4 class="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Helpful tips</h4>
    <ul class="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
      <li>Use a bright, front-facing photo for the cleanest result.</li>
      <li>${filter.clientSideOnly ? 'This one runs instantly in your browser and does not spend neurons.' : 'Demo filters work with the site allowance when bindings are configured.'}</li>
      <li>Download the result as PNG or open the filter inside the companion app.</li>
    </ul>
  `

  const related = catalog.filters.filter((entry) => entry.category === filter.category && entry.id !== filter.id).slice(0, 4)
  renderFilterList(document.querySelector('[data-related]'), related, { compact: true })
  await readUsage(filter)

  const dropzone = document.querySelector('[data-dropzone]')
  const fileInput = document.querySelector('[data-file-input]')
  const downloadButton = document.querySelector('[data-download]')
  const shareButton = document.querySelector('[data-share]')
  const seasonal = activeSeasonalFilters(catalog).slice(0, 3)
  document.querySelector('[data-seasonal-links]').innerHTML = seasonal.map((entry) => `<a class="site-link text-sm font-medium" href="/${entry.tryPath}">${entry.name}</a>`).join(' · ')

  let currentDownloadUrl = null
  let sourcePreviewUrl = null

  function validateFile(file) {
    if (!file) throw new Error('Please choose an image first.')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Use a JPEG, PNG, or WebP image.')
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Images must be 5MB or smaller.')
    }
  }

  async function handleFile(file) {
    validateFile(file)
    sourcePreviewUrl = URL.createObjectURL(file)
    document.querySelector('[data-upload-name]').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
    setStatus(funProgressMessages[Math.floor(Math.random() * funProgressMessages.length)])
    try {
      const result = await uploadAndTransform(filter, file)
      currentDownloadUrl = result.url
      previewSlider(sourcePreviewUrl, result.url)
      setStatus(result.kind === 'instant' ? 'Instant effect ready. Download or share it below.' : 'Transform complete. Your result is ready.', 'success')
      downloadButton.classList.remove('hidden')
      shareButton.classList.remove('hidden')
      await readUsage(filter)
    } catch (error) {
      setStatus(error.message, 'error')
    }
  }

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault()
    dropzone.classList.add('dragover')
  })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'))
  dropzone.addEventListener('drop', async (event) => {
    event.preventDefault()
    dropzone.classList.remove('dragover')
    const [file] = event.dataTransfer.files
    await handleFile(file)
  })
  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files
    await handleFile(file)
  })

  downloadButton.addEventListener('click', () => {
    if (!currentDownloadUrl) return
    const link = document.createElement('a')
    link.href = currentDownloadUrl
    link.download = `${filter.slug}.png`
    link.click()
  })

  shareButton.addEventListener('click', async () => {
    if (!currentDownloadUrl) return
    const shareData = { title: filter.name, text: filter.shareText, url: window.location.href }
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(`${filter.shareText} ${window.location.href}`)
      setStatus('Share text copied to your clipboard.', 'success')
    }
  })
}

main().catch((error) => {
  setStatus(error.message, 'error')
})
