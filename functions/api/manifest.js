import { ApiError } from "../_lib/errors.js";
import { fail, ok, preflight } from "../_lib/http.js";
import { getFilterById, loadManifest } from "../_lib/manifest.js";

function readBooleanQuery(url, name) {
  const value = url.searchParams.get(name);
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function onRequestOptions(context) {
  return preflight(context.request, "GET,OPTIONS");
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const filterId = url.searchParams.get("filterId")?.trim() || "";
    const includeFilters = readBooleanQuery(url, "includeFilters");

    if (filterId) {
      const loaded = await getFilterById(context, filterId);
      return ok(
        context.request,
        {
          manifestSource: loaded.source,
          generatedAt: loaded.manifest.generatedAt || null,
          totalFilters: loaded.manifest.totalFilters || loaded.manifest.filters.length,
          models: loaded.manifest.models,
          filter: loaded.filter,
        },
        { methods: "GET,OPTIONS" },
      );
    }

    const loaded = await loadManifest(context);
    const response = {
      manifestSource: loaded.source,
      generatedAt: loaded.manifest.generatedAt || null,
      totalFilters: loaded.manifest.totalFilters || loaded.manifest.filters.length,
      dailyFreeNeurons: loaded.manifest.dailyFreeNeurons || null,
      models: loaded.manifest.models,
      filters: includeFilters ? loaded.manifest.filters : undefined,
    };

    return ok(context.request, response, { methods: "GET,OPTIONS" });
  } catch (error) {
    return fail(context.request, error instanceof ApiError ? error : error, { methods: "GET,OPTIONS" });
  }
}
