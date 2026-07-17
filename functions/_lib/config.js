function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStorageMode(value, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "r2" || normalized === "direct") {
    return normalized;
  }
  return fallback;
}

export function getConfig(env) {
  const hasPhotoBucket = typeof env.PHOTO_BUCKET?.get === "function" && typeof env.PHOTO_BUCKET?.put === "function";

  return {
    storageMode: parseStorageMode(env.STORAGE_MODE, hasPhotoBucket ? "r2" : "direct"),
    maxFreeNeuronsPerDay: parseInteger(env.MAX_FREE_NEURONS_PER_DAY, 10_000),
    maxFreeTransformsPerIp: parseInteger(env.MAX_FREE_TRANSFORMS_PER_IP, 10),
    seasonalFilter: String(env.SEASONAL_FILTER || "").trim(),
    seasonalFilterBonusTransforms: parseInteger(env.SEASONAL_FILTER_BONUS_TRANSFORMS, 0),
    maxUploadBytes: parseInteger(env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024),
    maxImageDimension: parseInteger(env.MAX_IMAGE_DIMENSION, 1024),
    resultTtlSeconds: parseInteger(env.RESULT_TTL_SECONDS, 86_400),
    jobStatusTtlSeconds: parseInteger(env.JOB_STATUS_TTL_SECONDS, 86_400),
    transformTimeoutMs: parseInteger(env.TRANSFORM_TIMEOUT_MS, 45_000),
    filtersIndexUrl: String(env.FILTERS_INDEX_URL || "").trim(),
  };
}

export function getBindingStatus(env) {
  return {
    AI: typeof env.AI?.run === "function",
    USAGE_KV: typeof env.USAGE_KV?.get === "function" && typeof env.USAGE_KV?.put === "function",
    PHOTO_BUCKET: typeof env.PHOTO_BUCKET?.get === "function" && typeof env.PHOTO_BUCKET?.put === "function",
    ASSETS: typeof env.ASSETS?.fetch === "function",
  };
}
