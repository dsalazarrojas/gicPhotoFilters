import { getBindingStatus, getConfig } from "../_lib/config.js";
import { fetchCloudflareUsage, maskCloudflareAccountId, readCloudflareCredentials } from "../_lib/cloudflare.js";
import { fail, jsonResponse, preflight } from "../_lib/http.js";
import { loadManifest } from "../_lib/manifest.js";

export function onRequestOptions(context) {
  return preflight(context.request, "GET,OPTIONS");
}

async function buildSiteHealth(context) {
  const bindingStatus = getBindingStatus(context.env);
  const config = getConfig(context.env);
  const issues = [];
  const r2SetupGuideUrl = "/docs/r2-setup.html";
  let manifest = {
    available: false,
    source: context.env.FILTERS_INDEX_URL || "/docs/filters-index.json",
  };

  for (const [bindingName, available] of Object.entries(bindingStatus)) {
    if (bindingName === "ASSETS") {
      continue;
    }

    if (bindingName === "PHOTO_BUCKET") {
      if (!available && config.storageMode === "r2") {
        issues.push({
          code: "photo_bucket_binding_missing",
          message: 'Binding "PHOTO_BUCKET" is not configured for STORAGE_MODE="r2".',
          details: {
            storageMode: config.storageMode,
            r2SetupGuideUrl,
          },
        });
      }
      continue;
    }

    if (!available) {
      issues.push({
        code: `${bindingName.toLowerCase()}_binding_missing`,
        message: `Binding "${bindingName}" is not configured.`,
      });
    }
  }

  try {
    const loaded = await loadManifest(context);
    manifest = {
      available: true,
      source: loaded.source,
      generatedAt: loaded.manifest.generatedAt || null,
      totalFilters: loaded.manifest.totalFilters || loaded.manifest.filters.length,
    };
  } catch (error) {
    issues.push({
      code: "manifest_unavailable",
      message: error.message,
      details: error.details,
    });
  }

  const degraded = issues.length > 0;

  return {
    degraded,
    payload: {
      ok: !degraded,
      data: {
        mode: "site",
        status: degraded ? "degraded" : "ok",
        service: "gic-photo-filters-api",
        runtime: "cloudflare-pages-functions",
        byokProxy: {
          enabled: true,
          transport: "https-request-headers",
          transformEndpoint: "/api/transform",
          healthEndpoint: "/api/health",
          credentialsStoredServerSide: false,
        },
        bindings: bindingStatus,
        manifest,
        storage: {
          mode: config.storageMode,
          r2Available: bindingStatus.PHOTO_BUCKET,
          uploadsAvailable: config.storageMode === "r2" && bindingStatus.PHOTO_BUCKET,
          shareableResults: config.storageMode === "r2" && bindingStatus.PHOTO_BUCKET,
          resultStrategy: config.storageMode === "r2" && bindingStatus.PHOTO_BUCKET ? "stored-url" : "direct-response",
          r2SetupGuideUrl: bindingStatus.PHOTO_BUCKET ? null : r2SetupGuideUrl,
        },
        limits: {
          demoMode: config.demoMode,
          maxFreeTransformsPerIp: config.maxFreeTransformsPerIp,
          maxFreeNeuronsPerDay: config.maxFreeNeuronsPerDay,
          maxUploadBytes: config.maxUploadBytes,
          maxImageDimension: config.maxImageDimension,
        },
        endpoints: {
          transform: "/api/transform",
          usage: "/api/usage",
          manifest: "/api/manifest",
          upload: "/api/upload",
          status: "/api/status/:jobId",
          image: "/api/image/:key",
        },
        issues,
      },
    },
  };
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    if (url.searchParams.get("view") === "site") {
      const siteHealth = await buildSiteHealth(context);
      return jsonResponse(context.request, siteHealth.payload, {
        status: siteHealth.degraded ? 503 : 200,
        methods: "GET,OPTIONS",
      });
    }

    const credentials = readCloudflareCredentials(context.request, { optional: false });
    const usage = await fetchCloudflareUsage(credentials);

    return jsonResponse(
      context.request,
      {
        ok: true,
        data: {
          mode: "cloudflare",
          status: "ok",
          provider: "cloudflare",
          accountIdMasked: maskCloudflareAccountId(credentials.accountId),
          neuronsUsed: usage.neuronsUsed,
          neuronsLimit: usage.neuronsLimit,
          neuronsRemaining: usage.neuronsRemaining,
          usage,
          message: "Connected to Cloudflare Workers AI.",
          proxy: {
            transformEndpoint: "/api/transform",
            authTransport: "https-request-headers",
            credentialsStoredServerSide: false,
          },
        },
      },
      { status: 200, methods: "GET,OPTIONS" },
    );
  } catch (error) {
    return fail(context.request, error, { methods: "GET,OPTIONS" });
  }
}
