const storageKey = 'gic-theme'

function root() {
  return document.documentElement
}

export function getPreferredTheme() {
  const stored = localStorage.getItem(storageKey)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme) {
  root().classList.toggle('dark', theme === 'dark')
  root().dataset.theme = theme
  localStorage.setItem(storageKey, theme)
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode'
  })
}

export function initTheme() {
  applyTheme(getPreferredTheme())
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      applyTheme(root().classList.contains('dark') ? 'light' : 'dark')
    })
  })
}
