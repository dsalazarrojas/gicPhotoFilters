import { getConfig } from "../_lib/config.js";
import { ApiError } from "../_lib/errors.js";
import { fail, ok, preflight } from "../_lib/http.js";
import { readUploadRequest } from "../_lib/request.js";
import { putImageObject } from "../_lib/storage.js";

export function onRequestOptions(context) {
  return preflight(context.request, "POST,OPTIONS");
}

export async function onRequestPost(context) {
  try {
    const config = getConfig(context.env);
    if (config.storageMode === "direct") {
      throw new ApiError(
        409,
        "upload_requires_r2",
        '/api/upload is only available when STORAGE_MODE="r2" and PHOTO_BUCKET is configured.',
        {
          storageMode: config.storageMode,
          r2SetupGuideUrl: "/docs/r2-setup.html",
        },
      );
    }
    const requestData = await readUploadRequest(context.request, config);
    const stored = await putImageObject(context, requestData.image.bytes, {
      prefix: "upload",
      contentType: requestData.image.mimeType,
      ttlSeconds: config.resultTtlSeconds,
      metadata: {
        source: "upload",
      },
    });

    return ok(
      context.request,
      {
        upload: {
          key: stored.key,
          url: stored.url,
          contentType: stored.contentType,
          size: requestData.image.size,
          expiresAt: stored.expiresAt,
        },
        normalization: {
          performed: false,
          reason: "Image resizing is not wired into this backend foundation yet.",
          maxDimension: config.maxImageDimension,
        },
      },
      { methods: "POST,OPTIONS" },
    );
  } catch (error) {
    return fail(context.request, error, { methods: "POST,OPTIONS" });
  }
}
