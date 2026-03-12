import { ApiError, assert } from "./errors.js";

let manifestCache = null;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateManifest(manifest) {
  assert(manifest && typeof manifest === "object", 500, "manifest_invalid", "Filters manifest is not a JSON object.");
  assert(Array.isArray(manifest.filters), 500, "manifest_invalid", 'Filters manifest must contain a "filters" array.');
  assert(manifest.models && typeof manifest.models === "object", 500, "manifest_invalid", 'Filters manifest must contain a "models" object.');
}

async function loadManifestText(context) {
  const configuredUrl = String(context.env.FILTERS_INDEX_URL || "").trim();
  const requestUrl = configuredUrl || new URL("/docs/filters-index.json", context.request.url).toString();

  let response;
  if (!configuredUrl && typeof context.env.ASSETS?.fetch === "function") {
    response = await context.env.ASSETS.fetch(new Request(requestUrl, { headers: { accept: "application/json" } }));
  } else {
    response = await fetch(requestUrl, { headers: { accept: "application/json" } });
  }

  if (!response.ok) {
    throw new ApiError(503, "manifest_unavailable", "Filter manifest is not available yet.", {
      source: requestUrl,
      status: response.status,
      hint: "Generate or publish docs/filters-index.json before calling transform endpoints.",
    });
  }

  return {
    source: requestUrl,
    text: await response.text(),
  };
}

export async function loadManifest(context) {
  if (manifestCache) {
    return cloneValue(manifestCache);
  }

  const loaded = await loadManifestText(context);
  let parsed;

  try {
    parsed = JSON.parse(loaded.text);
  } catch (error) {
    throw new ApiError(500, "manifest_invalid_json", "Filter manifest is not valid JSON.", {
      source: loaded.source,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  validateManifest(parsed);

  manifestCache = {
    source: loaded.source,
    manifest: parsed,
  };

  return cloneValue(manifestCache);
}

export async function getFilterById(context, filterId) {
  const loaded = await loadManifest(context);
  const filter = loaded.manifest.filters.find((entry) => entry.id === filterId || entry.slug === filterId);

  if (!filter) {
    throw new ApiError(404, "filter_not_found", `Filter "${filterId}" was not found in the manifest.`, {
      filterId,
      manifestSource: loaded.source,
    });
  }

  return {
    filter,
    manifest: loaded.manifest,
    source: loaded.source,
  };
}
