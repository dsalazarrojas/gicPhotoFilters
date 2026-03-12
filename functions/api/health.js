import { getBindingStatus, getConfig } from "../_lib/config.js";
import { fail, jsonResponse, preflight } from "../_lib/http.js";
import { loadManifest } from "../_lib/manifest.js";

export function onRequestOptions(context) {
  return preflight(context.request, "GET,OPTIONS");
}

export async function onRequestGet(context) {
  try {
    const bindingStatus = getBindingStatus(context.env);
    const config = getConfig(context.env);
    const issues = [];
    let manifest = {
      available: false,
      source: context.env.FILTERS_INDEX_URL || "/docs/filters-index.json",
    };

    for (const [bindingName, available] of Object.entries(bindingStatus)) {
      if (!available && bindingName !== "ASSETS") {
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

    return jsonResponse(
      context.request,
      {
        ok: !degraded,
        data: {
          status: degraded ? "degraded" : "ok",
          service: "gic-photo-filters-api",
          runtime: "cloudflare-pages-functions",
        bindings: bindingStatus,
        manifest,
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
      { status: degraded ? 503 : 200, methods: "GET,OPTIONS" },
    );
  } catch (error) {
    return fail(context.request, error, { methods: "GET,OPTIONS" });
  }
}
