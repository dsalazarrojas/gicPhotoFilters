export const BYOK_STORAGE_MODES = Object.freeze({
  LOCAL: 'local',
  SESSION: 'session',
})

export const BYOK_EVENTS = Object.freeze({
  CHANGED: 'gic:byok-changed',
})

const STORAGE_MODE_KEY = 'gicpf.byok.storageMode'
const ACCOUNT_ID_KEY = 'gicpf.byok.accountId'
const API_TOKEN_KEY = 'gicpf.byok.apiToken'
const SESSION_USAGE_KEY = 'gicpf.byok.neuronsUsed'
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined'
const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i

function getStorage(mode) {
  if (!hasDom) return null
  return mode === BYOK_STORAGE_MODES.SESSION ? window.sessionStorage : window.localStorage
}

function readFromStorage(mode, key) {
  const storage = getStorage(mode)
  if (!storage) return ''
  try {
    return storage.getItem(key) || ''
  } catch (error) {
    console.warn(`Unable to read ${mode}Storage`, error)
    return ''
  }
}

function writeToStorage(mode, key, value) {
  const storage = getStorage(mode)
  if (!storage) return
  try {
    storage.setItem(key, value)
  } catch (error) {
    console.warn(`Unable to write ${mode}Storage`, error)
  }
}

function removeFromStorage(mode, key) {
  const storage = getStorage(mode)
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch (error) {
    console.warn(`Unable to update ${mode}Storage`, error)
  }
}

function clearStoredCredentials() {
  Object.values(BYOK_STORAGE_MODES).forEach((mode) => {
    removeFromStorage(mode, ACCOUNT_ID_KEY)
    removeFromStorage(mode, API_TOKEN_KEY)
    removeFromStorage(mode, STORAGE_MODE_KEY)
  })
}

function normalizeStorageMode(mode) {
  return mode === BYOK_STORAGE_MODES.SESSION ? BYOK_STORAGE_MODES.SESSION : BYOK_STORAGE_MODES.LOCAL
}

function readStoredState(mode) {
  return {
    storageMode: mode,
    configuredMode: readFromStorage(mode, STORAGE_MODE_KEY),
    accountId: readFromStorage(mode, ACCOUNT_ID_KEY).trim(),
    apiToken: readFromStorage(mode, API_TOKEN_KEY).trim(),
  }
}

function buildByokState({ storageMode, accountId, apiToken }) {
  const normalizedStorageMode = normalizeStorageMode(storageMode)
  const normalizedAccountId = String(accountId || '').trim()
  const normalizedApiToken = String(apiToken || '').trim()
  const hasCredentials = Boolean(normalizedAccountId && normalizedApiToken)

  return {
    storageMode: normalizedStorageMode,
    accountId: normalizedAccountId,
    apiToken: normalizedApiToken,
    hasCredentials,
    accountIdValid: !normalizedAccountId || isValidCloudflareAccountId(normalizedAccountId),
    maskedAccountId: maskCloudflareAccountId(normalizedAccountId),
    mode: hasCredentials ? 'cloudflare' : 'demo',
  }
}

function emitChange(state) {
  if (!hasDom) return
  window.dispatchEvent(new CustomEvent(BYOK_EVENTS.CHANGED, {
    detail: {
      storageMode: state.storageMode,
      hasCredentials: state.hasCredentials,
      maskedAccountId: state.maskedAccountId,
      mode: state.mode,
    },
  }))
}

export function isValidCloudflareAccountId(value = '') {
  return ACCOUNT_ID_PATTERN.test(String(value).trim())
}

export function maskCloudflareAccountId(value = '') {
  const normalized = String(value || '').trim()
  if (normalized.length <= 8) return normalized
  return `${normalized.slice(0, 4)}…${normalized.slice(-4)}`
}

export function loadByokSettings() {
  const localState = readStoredState(BYOK_STORAGE_MODES.LOCAL)
  const sessionState = readStoredState(BYOK_STORAGE_MODES.SESSION)

  let storageMode = BYOK_STORAGE_MODES.LOCAL
  if (localState.configuredMode === BYOK_STORAGE_MODES.LOCAL) {
    storageMode = BYOK_STORAGE_MODES.LOCAL
  } else if (sessionState.configuredMode === BYOK_STORAGE_MODES.SESSION) {
    storageMode = BYOK_STORAGE_MODES.SESSION
  } else if (localState.accountId || localState.apiToken) {
    storageMode = BYOK_STORAGE_MODES.LOCAL
  } else if (sessionState.accountId || sessionState.apiToken) {
    storageMode = BYOK_STORAGE_MODES.SESSION
  }

  const activeState = storageMode === BYOK_STORAGE_MODES.SESSION ? sessionState : localState
  return buildByokState(activeState)
}

export function saveByokSettings({ accountId = '', apiToken = '', storageMode = BYOK_STORAGE_MODES.LOCAL } = {}) {
  const normalizedStorageMode = normalizeStorageMode(storageMode)
  const normalizedAccountId = String(accountId || '').trim()
  const normalizedApiToken = String(apiToken || '').trim()

  clearStoredCredentials()
  writeToStorage(normalizedStorageMode, STORAGE_MODE_KEY, normalizedStorageMode)
  if (normalizedAccountId) writeToStorage(normalizedStorageMode, ACCOUNT_ID_KEY, normalizedAccountId)
  if (normalizedApiToken) writeToStorage(normalizedStorageMode, API_TOKEN_KEY, normalizedApiToken)

  const nextState = buildByokState({
    storageMode: normalizedStorageMode,
    accountId: normalizedAccountId,
    apiToken: normalizedApiToken,
  })
  emitChange(nextState)
  return nextState
}

export function clearByokSettings({ storageMode } = {}) {
  const normalizedStorageMode = normalizeStorageMode(storageMode || loadByokSettings().storageMode)
  clearStoredCredentials()
  writeToStorage(normalizedStorageMode, STORAGE_MODE_KEY, normalizedStorageMode)
  const nextState = buildByokState({
    storageMode: normalizedStorageMode,
    accountId: '',
    apiToken: '',
  })
  emitChange(nextState)
  return nextState
}

export function buildCloudflareProxyHeaders(byokState = loadByokSettings()) {
  if (!byokState?.hasCredentials) return {}
  return {
    'X-CF-Account-ID': byokState.accountId,
    'X-CF-API-Token': byokState.apiToken,
  }
}

export function getSessionNeurons() {
  const value = readFromStorage(BYOK_STORAGE_MODES.SESSION, SESSION_USAGE_KEY)
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

export function resetSessionNeurons() {
  removeFromStorage(BYOK_STORAGE_MODES.SESSION, SESSION_USAGE_KEY)
}

export function addSessionNeurons(amount) {
  const current = getSessionNeurons()
  const next = current + Math.max(0, Number(amount) || 0)
  writeToStorage(BYOK_STORAGE_MODES.SESSION, SESSION_USAGE_KEY, String(next))
  return next
}
