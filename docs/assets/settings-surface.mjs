import {
  BYOK_EVENTS,
  BYOK_STORAGE_MODES,
  buildCloudflareProxyHeaders,
  clearByokSettings,
  getSessionNeurons,
  isValidCloudflareAccountId,
  loadByokSettings,
  saveByokSettings,
} from './byok.mjs';

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
const MODEL_PREFERENCE_KEY = 'gicpf.modelPreference';
const BYOK_HEALTH_KEY = 'gicpf.byok.health';

export const SETTINGS_EVENTS = Object.freeze({
  MODEL_CHANGED: 'gic:model-preference-changed',
  HEALTH_CHANGED: 'gic:byok-health',
});

export const MODEL_OPTIONS = Object.freeze([
  { id: 'default', label: 'Use filter default', description: 'Keeps the catalog model or builder choice unchanged.' },
  { id: 'flux2-klein-9b', label: 'FLUX.2 Klein 9B', description: 'Highest quality for faces, characters, and polished styles.' },
  { id: 'flux2-klein-4b', label: 'FLUX.2 Klein 4B', description: 'Faster, lighter option for rapid experiments.' },
  { id: 'sd15-img2img', label: 'SD v1.5 img2img', description: 'Classic painterly and retro-friendly image-to-image results.' },
  { id: 'sd15-inpainting', label: 'SD v1.5 Inpainting', description: 'Best for masked edits. Web mask tools are coming soon.' },
]);

const STORAGE_COPY = {
  [BYOK_STORAGE_MODES.LOCAL]: 'Saved in localStorage on this browser until you clear it.',
  [BYOK_STORAGE_MODES.SESSION]: 'Saved in sessionStorage and removed when this tab closes.',
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Number(value) || 0));
}

function readStorage(key, storage = window.localStorage) {
  try {
    return storage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(key, value, storage = window.localStorage) {
  try {
    if (!value) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Ignore storage write issues so the UI still works in private browsing modes.
  }
}

function normalizePreferredModel(value = '') {
  return MODEL_OPTIONS.some((entry) => entry.id === value) ? value : 'default';
}

export function loadPreferredModel() {
  if (!hasDom) return 'default';
  return normalizePreferredModel(readStorage(MODEL_PREFERENCE_KEY, window.localStorage));
}

export function savePreferredModel(value) {
  if (!hasDom) return 'default';
  const normalized = normalizePreferredModel(value);
  writeStorage(MODEL_PREFERENCE_KEY, normalized === 'default' ? '' : normalized, window.localStorage);
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENTS.MODEL_CHANGED, { detail: { model: normalized } }));
  return normalized;
}

function normalizeHealthPayload(payload = {}, byok = loadByokSettings()) {
  if (!payload || typeof payload !== 'object') return null;
  return {
    ...payload,
    accountIdMasked: payload.accountIdMasked || byok.maskedAccountId,
    testedAt: payload.testedAt || new Date().toISOString(),
  };
}

export function loadCachedByokHealth(byok = loadByokSettings()) {
  if (!hasDom || !byok?.hasCredentials) return null;
  const raw = readStorage(BYOK_HEALTH_KEY, window.sessionStorage);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.accountIdMasked || parsed.accountIdMasked !== byok.maskedAccountId) return null;
    return normalizeHealthPayload(parsed, byok);
  } catch {
    return null;
  }
}

export function cacheByokHealth(payload, byok = loadByokSettings()) {
  if (!hasDom || !byok?.hasCredentials) return null;
  const normalized = normalizeHealthPayload(payload, byok);
  writeStorage(BYOK_HEALTH_KEY, JSON.stringify(normalized), window.sessionStorage);
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENTS.HEALTH_CHANGED, { detail: normalized }));
  return normalized;
}

export function clearCachedByokHealth() {
  if (!hasDom) return;
  writeStorage(BYOK_HEALTH_KEY, '', window.sessionStorage);
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENTS.HEALTH_CHANGED, { detail: null }));
}

function renderUsageCards(byok, health) {
  const sessionNeurons = getSessionNeurons();
  const remaining = health?.neuronsRemaining;
  const limit = health?.neuronsLimit;
  const lastChecked = health?.testedAt
    ? new Date(health.testedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Not tested yet';

  return `
    <div class="settings-surface__usage-grid">
      <article class="stat-card settings-surface__usage-card">
        <span class="microcopy">Cloudflare status</span>
        <strong>${health ? 'Connected' : byok.hasCredentials ? 'Saved locally' : 'Demo mode'}</strong>
        <p>${health ? `${formatNumber(remaining)} / ${formatNumber(limit)} neurons left today` : byok.hasCredentials ? 'Run Test Connection to see today\'s balance.' : 'Add a key for unlimited BYOK testing.'}</p>
      </article>
      <article class="stat-card settings-surface__usage-card">
        <span class="microcopy">Session estimate</span>
        <strong>${formatNumber(sessionNeurons)} neurons used</strong>
        <p>Tracks BYOK runs in this browser tab.</p>
      </article>
      <article class="stat-card settings-surface__usage-card">
        <span class="microcopy">Last checked</span>
        <strong>${escapeHtml(lastChecked)}</strong>
        <p>${escapeHtml(byok.maskedAccountId || 'No account saved yet')}</p>
      </article>
    </div>`;
}

function createSurfaceMarkup() {
  return `
    <dialog class="settings-surface" id="site-settings-surface" aria-labelledby="settings-surface-title">
      <form method="dialog" class="settings-surface__close-form">
        <button class="settings-surface__backdrop-close" type="submit" aria-label="Close settings"></button>
      </form>
      <div class="settings-surface__dialog">
        <header class="settings-surface__header">
          <div>
            <span class="page-eyebrow">Secure proxy settings</span>
            <h2 id="settings-surface-title">Cloudflare &amp; AI preferences</h2>
            <p>Credentials stay in this browser and are only forwarded to <code>/api/health</code> and <code>/api/transform</code> as HTTPS request headers.</p>
          </div>
          <button class="button-ghost" type="button" data-settings-close>Close</button>
        </header>

        <div class="settings-surface__tabs" role="tablist" aria-label="Settings views">
          <button class="button-ghost" type="button" role="tab" aria-selected="true" data-surface-tab="settings">Settings</button>
          <button class="button-ghost" type="button" role="tab" aria-selected="false" data-surface-tab="setup">Cloudflare setup wizard</button>
        </div>

        <section class="settings-surface__panel" data-surface-panel="settings">
          <div class="settings-surface__grid">
            <article class="detail-card settings-surface__card">
              <div class="section-heading settings-surface__card-heading">
                <div>
                  <span class="page-eyebrow">Cloudflare Workers AI</span>
                  <h3>Connect your free account</h3>
                </div>
                <button class="button-link" type="button" data-open-setup>Don\'t have a key? Set up in 2 minutes →</button>
              </div>
              <div class="byok-panel__storage settings-surface__storage" role="group" aria-label="Credential storage mode">
                <button class="button-ghost" type="button" data-storage-mode="local">Store in this browser</button>
                <button class="button-ghost" type="button" data-storage-mode="session">Session only</button>
              </div>
              <p class="microcopy settings-surface__storage-copy" data-storage-copy></p>
              <label class="byok-panel__field">
                <span>Cloudflare Account ID</span>
                <input id="settings-account-id" type="text" autocomplete="off" placeholder="32-character Account ID from the Cloudflare dashboard" />
              </label>
              <p class="microcopy byok-panel__note" data-account-validation>Paste your 32-character Account ID to unlock BYOK mode.</p>
              <label class="byok-panel__field">
                <span>API Token</span>
                <div class="settings-surface__password-row">
                  <input id="settings-api-token" type="password" autocomplete="off" placeholder="Workers AI · Run permission" />
                  <button class="button-ghost" type="button" data-toggle-token>Show</button>
                  <button class="button-ghost" type="button" data-clear-token>Clear</button>
                </div>
              </label>
              <p class="microcopy settings-surface__privacy-note">📷 Your photos are processed and immediately discarded — never stored on our servers.</p>
              <div class="byok-panel__actions settings-surface__actions-row">
                <button class="button" type="button" data-test-connection>Test connection</button>
                <a class="button-link" href="/docs/cloudflare-setup.html" target="_blank" rel="noreferrer">Open full guide →</a>
              </div>
              <p class="microcopy byok-panel__note" data-connection-status>No connection test yet.</p>
            </article>

            <article class="detail-card settings-surface__card">
              <div class="section-heading settings-surface__card-heading">
                <div>
                  <span class="page-eyebrow">Model preference</span>
                  <h3>Pick your default AI model</h3>
                </div>
                <p class="microcopy">The builder starts here by default. Inpainting is shown for parity, but the browser mask workflow is still coming soon.</p>
              </div>
              <div class="settings-surface__model-grid" data-model-grid>
                ${MODEL_OPTIONS.map((model) => `
                  <button class="button-ghost settings-surface__model-card" type="button" data-model-choice="${model.id}" ${model.id === 'sd15-inpainting' ? 'data-coming-soon="true"' : ''}>
                    <strong>${escapeHtml(model.label)}</strong>
                    <span>${escapeHtml(model.description)}</span>
                  </button>`).join('')}
              </div>
            </article>

            <article class="detail-card settings-surface__card">
              <div class="section-heading settings-surface__card-heading">
                <div>
                  <span class="page-eyebrow">Usage &amp; storage</span>
                  <h3>Know what stays local</h3>
                </div>
                <p class="microcopy">Clear credentials any time without losing the photo or builder state underneath this modal.</p>
              </div>
              <div data-usage-grid></div>
              <div class="byok-panel__actions settings-surface__danger-row">
                <button class="button-ghost" type="button" data-clear-credentials>Clear all credentials</button>
              </div>
            </article>
          </div>
        </section>

        <section class="settings-surface__panel" data-surface-panel="setup" hidden>
          <div class="detail-card settings-surface__wizard-shell">
            <div class="settings-surface__wizard-head">
              <div>
                <span class="page-eyebrow">Cloudflare setup wizard</span>
                <h3>Bring your own key without leaving the page</h3>
              </div>
              <p class="microcopy" data-wizard-progress>Step 1 of 4</p>
            </div>
            <div class="settings-surface__wizard-steps" role="list" aria-label="Wizard steps">
              ${['Create account', 'Copy Account ID', 'Create API token', 'Connect in settings'].map((label, index) => `<span role="listitem" data-wizard-step-indicator="${index + 1}">${index + 1}. ${escapeHtml(label)}</span>`).join('')}
            </div>
            <div class="settings-surface__wizard-card" data-wizard-step="1">
              <h4>1. Create your free Cloudflare account</h4>
              <p>Cloudflare gives every new account a Workers AI quota, which is enough to test custom filters without buying infrastructure first.</p>
              <div class="inline-actions">
                <a class="button" href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer">Open sign-up</a>
                <button class="button-ghost" type="button" data-wizard-next>Next</button>
              </div>
            </div>
            <div class="settings-surface__wizard-card" data-wizard-step="2" hidden>
              <h4>2. Copy your Account ID</h4>
              <p>After you log in, open <strong>Account Home</strong> and look at the right sidebar. Copy the 32-character Account ID exactly as shown.</p>
              <div class="inline-actions">
                <button class="button-ghost" type="button" data-wizard-back>Back</button>
                <button class="button-ghost" type="button" data-wizard-next>Next</button>
              </div>
            </div>
            <div class="settings-surface__wizard-card" data-wizard-step="3" hidden>
              <h4>3. Create a Workers AI token</h4>
              <p>Go to <strong>My Profile → API Tokens</strong> and create a token with <strong>Workers AI: Run</strong> permission. Keep it private, then paste it into the secure settings form.</p>
              <div class="inline-actions">
                <a class="button" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">Open API tokens</a>
                <button class="button-ghost" type="button" data-wizard-back>Back</button>
                <button class="button-ghost" type="button" data-wizard-next>Next</button>
              </div>
            </div>
            <div class="settings-surface__wizard-card" data-wizard-step="4" hidden>
              <h4>4. Paste and test without losing your page state</h4>
              <p>The secure settings form opens in this same overlay. Your current photo, builder inputs, and page scroll position stay exactly where they are underneath.</p>
              <div class="inline-actions">
                <button class="button-ghost" type="button" data-wizard-back>Back</button>
                <button class="button" type="button" data-open-settings-form>Open secure connection form</button>
                <a class="button-link" href="/docs/cloudflare-setup.html" target="_blank" rel="noreferrer">Read the full guide →</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </dialog>`;
}

function buildState() {
  const byok = loadByokSettings();
  return {
    byok,
    health: loadCachedByokHealth(byok),
    healthError: '',
    preferredModel: loadPreferredModel(),
    wizardStep: 1,
    currentPanel: 'settings',
  };
}

function attachSurfaceHandlers(surface, state) {
  const dialog = surface.querySelector('dialog') || surface;
  const refs = {
    dialog,
    closeButtons: Array.from(surface.querySelectorAll('[data-settings-close]')),
    tabs: Array.from(surface.querySelectorAll('[data-surface-tab]')),
    panels: Array.from(surface.querySelectorAll('[data-surface-panel]')),
    storageButtons: Array.from(surface.querySelectorAll('[data-storage-mode]')),
    accountInput: surface.querySelector('#settings-account-id'),
    tokenInput: surface.querySelector('#settings-api-token'),
    toggleTokenButton: surface.querySelector('[data-toggle-token]'),
    clearTokenButton: surface.querySelector('[data-clear-token]'),
    testButton: surface.querySelector('[data-test-connection]'),
    clearCredentialsButton: surface.querySelector('[data-clear-credentials]'),
    openSetupButtons: Array.from(surface.querySelectorAll('[data-open-setup]')),
    openSettingsFormButton: surface.querySelector('[data-open-settings-form]'),
    accountValidation: surface.querySelector('[data-account-validation]'),
    storageCopy: surface.querySelector('[data-storage-copy]'),
    connectionStatus: surface.querySelector('[data-connection-status]'),
    usageGrid: surface.querySelector('[data-usage-grid]'),
    modelButtons: Array.from(surface.querySelectorAll('[data-model-choice]')),
    wizardProgress: surface.querySelector('[data-wizard-progress]'),
    wizardCards: Array.from(surface.querySelectorAll('[data-wizard-step]')),
    wizardIndicators: Array.from(surface.querySelectorAll('[data-wizard-step-indicator]')),
    wizardNextButtons: Array.from(surface.querySelectorAll('[data-wizard-next]')),
    wizardBackButtons: Array.from(surface.querySelectorAll('[data-wizard-back]')),
  };

  const syncUi = () => {
    state.byok = loadByokSettings();
    if (!state.byok.hasCredentials) {
      state.health = null;
      state.healthError = '';
    } else if (!state.health) {
      state.health = loadCachedByokHealth(state.byok);
    }

    refs.tabs.forEach((button) => {
      const active = button.dataset.surfaceTab === state.currentPanel;
      button.setAttribute('aria-selected', String(active));
      button.dataset.active = String(active);
    });
    refs.panels.forEach((panel) => {
      panel.hidden = panel.dataset.surfacePanel !== state.currentPanel;
    });

    refs.storageButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.storageMode === state.byok.storageMode));
    });
    if (refs.storageCopy) refs.storageCopy.textContent = STORAGE_COPY[state.byok.storageMode] || STORAGE_COPY.local;
    if (refs.accountInput && refs.accountInput.value !== state.byok.accountId) refs.accountInput.value = state.byok.accountId;
    if (refs.tokenInput && refs.tokenInput.value !== state.byok.apiToken) refs.tokenInput.value = state.byok.apiToken;

    if (refs.accountValidation) {
      if (!state.byok.accountId) {
        refs.accountValidation.textContent = 'Paste your 32-character Account ID to unlock BYOK mode.';
        refs.accountValidation.dataset.tone = 'default';
      } else if (isValidCloudflareAccountId(state.byok.accountId)) {
        refs.accountValidation.textContent = 'Looks good ✓';
        refs.accountValidation.dataset.tone = 'success';
      } else {
        refs.accountValidation.textContent = 'Should be 32 hexadecimal characters.';
        refs.accountValidation.dataset.tone = 'error';
      }
    }

    if (refs.connectionStatus) {
      if (state.health?.status === 'ok') {
        refs.connectionStatus.textContent = `Connected — ${formatNumber(state.health.neuronsRemaining)} neurons available today (resets midnight UTC).`;
        refs.connectionStatus.dataset.tone = 'success';
      } else if (state.healthError) {
        refs.connectionStatus.textContent = state.healthError;
        refs.connectionStatus.dataset.tone = 'error';
      } else if (state.byok.hasCredentials) {
        refs.connectionStatus.textContent = 'Credentials are saved locally. Run Test connection to verify today\'s balance.';
        refs.connectionStatus.dataset.tone = 'default';
      } else {
        refs.connectionStatus.textContent = 'No Cloudflare credentials saved yet. Demo mode stays available on Try; the builder requires your own key.';
        refs.connectionStatus.dataset.tone = 'default';
      }
    }

    if (refs.testButton) refs.testButton.disabled = !state.byok.hasCredentials || !state.byok.accountIdValid;
    if (refs.clearCredentialsButton) refs.clearCredentialsButton.disabled = !state.byok.accountId && !state.byok.apiToken;
    if (refs.usageGrid) refs.usageGrid.innerHTML = renderUsageCards(state.byok, state.health);

    refs.modelButtons.forEach((button) => {
      const selected = button.dataset.modelChoice === state.preferredModel;
      button.setAttribute('aria-pressed', String(selected));
      if (button.dataset.comingSoon === 'true') {
        button.dataset.comingSoon = 'true';
      }
    });

    if (refs.toggleTokenButton) {
      refs.toggleTokenButton.textContent = refs.tokenInput?.type === 'text' ? 'Hide' : 'Show';
    }

    if (refs.wizardProgress) refs.wizardProgress.textContent = `Step ${state.wizardStep} of 4`;
    refs.wizardCards.forEach((card) => {
      card.hidden = Number(card.dataset.wizardStep) !== state.wizardStep;
    });
    refs.wizardIndicators.forEach((indicator) => {
      const step = Number(indicator.dataset.wizardStepIndicator);
      indicator.dataset.active = String(step === state.wizardStep);
      indicator.dataset.complete = String(step < state.wizardStep);
    });
  };

  const persistSettings = (storageMode = state.byok.storageMode) => {
    state.byok = saveByokSettings({
      accountId: refs.accountInput?.value || '',
      apiToken: refs.tokenInput?.value || '',
      storageMode,
    });
    state.health = null;
    state.healthError = '';
    clearCachedByokHealth();
    syncUi();
    return state.byok;
  };

  const testConnection = async () => {
    const byok = persistSettings(state.byok.storageMode);
    if (!byok.hasCredentials) {
      state.health = null;
      state.healthError = 'Add both your Account ID and API token before testing the connection.';
      syncUi();
      return null;
    }
    if (!byok.accountIdValid) {
      state.health = null;
      state.healthError = 'Account ID should be 32 hexadecimal characters.';
      syncUi();
      return null;
    }

    state.health = null;
    state.healthError = '';
    if (refs.testButton) {
      refs.testButton.disabled = true;
      refs.testButton.textContent = 'Testing…';
    }
    if (refs.connectionStatus) {
      refs.connectionStatus.textContent = 'Testing your Cloudflare connection…';
      refs.connectionStatus.dataset.tone = 'default';
    }

    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
        headers: buildCloudflareProxyHeaders(byok),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || `Health check failed with ${response.status}`);
      }
      state.health = cacheByokHealth({
        ...payload.data,
        status: payload.data?.status || 'ok',
        testedAt: new Date().toISOString(),
      }, byok);
      state.healthError = '';
      syncUi();
      return state.health;
    } catch (error) {
      state.health = null;
      state.healthError = error?.message || 'Unable to verify your Cloudflare key right now.';
      clearCachedByokHealth();
      syncUi();
      return null;
    } finally {
      if (refs.testButton) refs.testButton.textContent = 'Test connection';
    }
  };

  const switchPanel = (panelName) => {
    state.currentPanel = panelName === 'setup' ? 'setup' : 'settings';
    syncUi();
    if (state.currentPanel === 'settings') {
      window.setTimeout(() => refs.accountInput?.focus(), 20);
    }
  };

  const setWizardStep = (nextStep) => {
    state.wizardStep = Math.max(1, Math.min(4, Number(nextStep) || 1));
    syncUi();
  };

  refs.closeButtons.forEach((button) => {
    button.addEventListener('click', () => refs.dialog.close());
  });
  refs.dialog.addEventListener('click', (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });
  refs.tabs.forEach((button) => {
    button.addEventListener('click', () => switchPanel(button.dataset.surfaceTab));
  });
  refs.openSetupButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setWizardStep(1);
      switchPanel('setup');
    });
  });
  refs.openSettingsFormButton?.addEventListener('click', () => switchPanel('settings'));
  refs.storageButtons.forEach((button) => {
    button.addEventListener('click', () => persistSettings(button.dataset.storageMode));
  });
  refs.accountInput?.addEventListener('input', () => persistSettings(state.byok.storageMode));
  refs.tokenInput?.addEventListener('input', () => persistSettings(state.byok.storageMode));
  refs.toggleTokenButton?.addEventListener('click', () => {
    if (!refs.tokenInput) return;
    refs.tokenInput.type = refs.tokenInput.type === 'password' ? 'text' : 'password';
    syncUi();
  });
  refs.clearTokenButton?.addEventListener('click', () => {
    if (!refs.tokenInput) return;
    refs.tokenInput.value = '';
    persistSettings(state.byok.storageMode);
    refs.tokenInput.focus();
  });
  refs.testButton?.addEventListener('click', async () => {
    await testConnection();
  });
  refs.clearCredentialsButton?.addEventListener('click', () => {
    if (!window.confirm('Clear the saved Cloudflare Account ID and API token from this browser?')) return;
    state.byok = clearByokSettings({ storageMode: state.byok.storageMode });
    state.health = null;
    state.healthError = '';
    clearCachedByokHealth();
    syncUi();
  });
  refs.modelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.comingSoon === 'true') return;
      state.preferredModel = savePreferredModel(button.dataset.modelChoice);
      syncUi();
    });
  });
  refs.wizardNextButtons.forEach((button) => {
    button.addEventListener('click', () => setWizardStep(state.wizardStep + 1));
  });
  refs.wizardBackButtons.forEach((button) => {
    button.addEventListener('click', () => setWizardStep(state.wizardStep - 1));
  });

  window.addEventListener(BYOK_EVENTS.CHANGED, () => {
    state.byok = loadByokSettings();
    state.health = loadCachedByokHealth(state.byok);
    syncUi();
  });
  window.addEventListener(SETTINGS_EVENTS.HEALTH_CHANGED, (event) => {
    state.health = event.detail || null;
    syncUi();
  });
  window.addEventListener(SETTINGS_EVENTS.MODEL_CHANGED, (event) => {
    state.preferredModel = normalizePreferredModel(event.detail?.model);
    syncUi();
  });
  window.addEventListener('gic:open-settings', () => {
    if (!refs.dialog.open) refs.dialog.showModal();
    switchPanel('settings');
    if (state.byok.hasCredentials && !state.health) void testConnection();
  });
  window.addEventListener('gic:open-setup', () => {
    if (!refs.dialog.open) refs.dialog.showModal();
    setWizardStep(1);
    switchPanel('setup');
  });

  syncUi();
}

export function initSettingsSurface() {
  if (!hasDom || document.getElementById('site-settings-surface')) return;
  document.body.insertAdjacentHTML('beforeend', createSurfaceMarkup());
  const surface = document.getElementById('site-settings-surface');
  attachSurfaceHandlers(surface, buildState());
}
