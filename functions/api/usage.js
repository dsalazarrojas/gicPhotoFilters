import { fail, ok, preflight } from "../_lib/http.js";
import { getFilterById } from "../_lib/manifest.js";
import { getUsageSnapshot } from "../_lib/usage.js";

export function onRequestOptions(context) {
  return preflight(context.request, "GET,OPTIONS");
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const filterId = url.searchParams.get("filterId")?.trim();

    let filter = null;
    if (filterId) {
      filter = (await getFilterById(context, filterId)).filter;
    }

    const snapshot = await getUsageSnapshot(context, { filter });

    return ok(
      context.request,
      {
        date: snapshot.dateKey,
        used: snapshot.ipRecord.used,
        limit: snapshot.limit,
        remaining: Math.max(0, snapshot.limit - snapshot.ipRecord.used),
        neuronsUsed: snapshot.siteRecord.neuronsUsed,
        neuronsLimit: snapshot.config.maxFreeNeuronsPerDay,
        ipNeuronsUsed: snapshot.ipRecord.neuronsUsed,
        siteTransformsUsed: snapshot.siteRecord.transformsUsed,
        filterContext: filter ? { id: filter.id, slug: filter.slug || null } : null,
      },
      { methods: "GET,OPTIONS" },
    );
  } catch (error) {
    return fail(context.request, error, { methods: "GET,OPTIONS" });
  }
}
