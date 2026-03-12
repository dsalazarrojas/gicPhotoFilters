import { getConfig } from "./config.js";
import { ApiError, missingBindingError } from "./errors.js";

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "127.0.0.1";
}

function requireUsageKv(env) {
  if (!env.USAGE_KV || typeof env.USAGE_KV.get !== "function" || typeof env.USAGE_KV.put !== "function") {
    throw missingBindingError("USAGE_KV", "tracking rate limits and job status");
  }
  return env.USAGE_KV;
}

function usageKey(ip, dateKey) {
  return `usage:v1:ip:${dateKey}:${ip}`;
}

function siteUsageKey(dateKey) {
  return `usage:v1:site:${dateKey}`;
}

function jobKey(jobId) {
  return `job:v1:${jobId}`;
}

function secondsUntilReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}

async function getJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) {
    return cloneValue(fallback);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ApiError(500, "usage_store_corrupt", `Stored record "${key}" is not valid JSON.`, {
      key,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getEffectiveTransformLimit(config, filter) {
  const isSeasonal = config.seasonalFilter && [filter?.id, filter?.slug].includes(config.seasonalFilter);
  return config.maxFreeTransformsPerIp + (isSeasonal ? config.seasonalFilterBonusTransforms : 0);
}

export async function getUsageSnapshot(context, { filter } = {}) {
  const kv = requireUsageKv(context.env);
  const config = getConfig(context.env);
  const dateKey = getDateKey();
  const ip = getClientIp(context.request);
  const limit = getEffectiveTransformLimit(config, filter);

  const ipRecord = await getJson(kv, usageKey(ip, dateKey), {
    dateKey,
    used: 0,
    limit,
    neuronsUsed: 0,
    updatedAt: null,
  });

  const siteRecord = await getJson(kv, siteUsageKey(dateKey), {
    dateKey,
    neuronsUsed: 0,
    transformsUsed: 0,
    neuronsLimit: config.maxFreeNeuronsPerDay,
    updatedAt: null,
  });

  return {
    ip,
    dateKey,
    ipKey: usageKey(ip, dateKey),
    siteKey: siteUsageKey(dateKey),
    ttlSeconds: secondsUntilReset(),
    config,
    limit,
    ipRecord: {
      ...ipRecord,
      limit,
    },
    siteRecord: {
      ...siteRecord,
      neuronsLimit: config.maxFreeNeuronsPerDay,
    },
  };
}

export function assertWithinUsageLimits(snapshot, estimatedNeurons) {
  if (snapshot.ipRecord.used >= snapshot.limit) {
    throw new ApiError(429, "daily_limit_reached", "Free daily transform limit reached for this IP.", {
      used: snapshot.ipRecord.used,
      limit: snapshot.limit,
      dateKey: snapshot.dateKey,
    });
  }

  if (snapshot.siteRecord.neuronsUsed + estimatedNeurons > snapshot.config.maxFreeNeuronsPerDay) {
    throw new ApiError(429, "daily_neuron_budget_reached", "Free daily neuron budget has been exhausted.", {
      neuronsUsed: snapshot.siteRecord.neuronsUsed,
      neuronsLimit: snapshot.config.maxFreeNeuronsPerDay,
      estimatedNeurons,
      dateKey: snapshot.dateKey,
    });
  }
}

export async function recordSuccessfulTransform(context, snapshot, { estimatedNeurons, filterId, jobId, resultKey }) {
  const kv = requireUsageKv(context.env);
  const updatedAt = new Date().toISOString();

  const nextIpRecord = {
    ...snapshot.ipRecord,
    used: snapshot.ipRecord.used + 1,
    neuronsUsed: snapshot.ipRecord.neuronsUsed + estimatedNeurons,
    lastFilterId: filterId,
    lastJobId: jobId,
    updatedAt,
  };

  const nextSiteRecord = {
    ...snapshot.siteRecord,
    transformsUsed: snapshot.siteRecord.transformsUsed + 1,
    neuronsUsed: snapshot.siteRecord.neuronsUsed + estimatedNeurons,
    lastFilterId: filterId,
    lastJobId: jobId,
    lastResultKey: resultKey,
    updatedAt,
  };

  await Promise.all([
    kv.put(snapshot.ipKey, JSON.stringify(nextIpRecord), { expirationTtl: snapshot.ttlSeconds }),
    kv.put(snapshot.siteKey, JSON.stringify(nextSiteRecord), { expirationTtl: snapshot.ttlSeconds }),
  ]);

  return {
    ipRecord: nextIpRecord,
    siteRecord: nextSiteRecord,
  };
}

export async function saveJobStatus(context, jobId, record) {
  const kv = requireUsageKv(context.env);
  await kv.put(jobKey(jobId), JSON.stringify(record), {
    expirationTtl: getConfig(context.env).jobStatusTtlSeconds,
  });
}

export async function getJobStatus(context, jobId) {
  const kv = requireUsageKv(context.env);
  const raw = await kv.get(jobKey(jobId));

  if (!raw) {
    throw new ApiError(404, "job_not_found", `Transform job "${jobId}" was not found.`, { jobId });
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ApiError(500, "job_record_invalid", `Transform job "${jobId}" is not valid JSON.`, {
      jobId,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
