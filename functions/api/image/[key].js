import { fail, preflight } from "../../_lib/http.js";
import { getStoredImage } from "../../_lib/storage.js";

export function onRequestOptions(context) {
  return preflight(context.request, "GET,HEAD,OPTIONS");
}

async function serveImage(context, includeBody) {
  const stored = await getStoredImage(context, context.params.key);
  const headers = new Headers();

  if (typeof stored.object.writeHttpMetadata === "function") {
    stored.object.writeHttpMetadata(headers);
  } else if (stored.mimeType) {
    headers.set("content-type", stored.mimeType);
  }

  headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
  if (stored.object.httpEtag) {
    headers.set("etag", stored.object.httpEtag);
  }

  return new Response(includeBody ? stored.object.body : null, {
    status: 200,
    headers,
  });
}

export async function onRequestGet(context) {
  try {
    return await serveImage(context, true);
  } catch (error) {
    return fail(context.request, error, { methods: "GET,HEAD,OPTIONS" });
  }
}

export async function onRequestHead(context) {
  try {
    return await serveImage(context, false);
  } catch (error) {
    return fail(context.request, error, { methods: "GET,HEAD,OPTIONS" });
  }
}
