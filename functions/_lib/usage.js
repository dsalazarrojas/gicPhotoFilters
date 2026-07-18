import { getConfig } from "./config.js";
import { ApiError, missingBindingError } from "./errors.js";

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function toSafeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export function usageKey(ip, dateKey) {
  return `usage:v1:ip:${dateKey}:${ip}`;
}

function siteUsageKey(dateKey) {
  return `usage:v1:site:${dateKey}`;
}

export const LOOP_COUNTER_EVENTS = Object.freeze([
  "transform_real_success",
  "share_opened",
  "share_completed",
  "referral_landed",
  "referral_bonus_granted",
]);

const LOOP_COUNTER_EVENT_SET = new Set(LOOP_COUNTER_EVENTS);

function counterKey(dateKey) {
  return `usage:v1:counters:${dateKey}`;
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
  const baseLimit = getEffectiveTransformLimit(config, filter);

  const ipRecord = await getJson(kv, usageKey(ip, dateKey), {
    dateKey,
    used: 0,
    limit: baseLimit,
    baseLimit,
    bonusTransforms: 0,
    neuronsUsed: 0,
    referralCode: null,
    referralBonusUpdatedAt: null,
    updatedAt: null,
  });

  const siteRecord = await getJson(kv, siteUsageKey(dateKey), {
    dateKey,
    neuronsUsed: 0,
    transformsUsed: 0,
    neuronsLimit: config.maxFreeNeuronsPerDay,
    updatedAt: null,
  });

  const bonusTransforms = Math.max(0, toSafeInteger(ipRecord.bonusTransforms, 0));
  const limit = baseLimit + bonusTransforms;

  return {
    ip,
    dateKey,
    ipKey: usageKey(ip, dateKey),
    siteKey: siteUsageKey(dateKey),
    ttlSeconds: secondsUntilReset(),
    config,
    limit,
    baseLimit,
    bonusTransforms,
    ipRecord: {
      ...ipRecord,
      baseLimit,
      bonusTransforms,
      limit,
    },
    siteRecord: {
      ...siteRecord,
      neuronsLimit: config.maxFreeNeuronsPerDay,
    },
  };
}

export async function incrementUsageCounter(context, eventName, amount = 1) {
  if (!LOOP_COUNTER_EVENT_SET.has(eventName)) return null;
  const kv = requireUsageKv(context.env);
  const dateKey = getDateKey();
  const key = counterKey(dateKey);
  const record = await getJson(kv, key, { dateKey, updatedAt: null, counters: {} });
  const counters = { ...record.counters };
  counters[eventName] = Math.max(0, toSafeInteger(counters[eventName], 0)) + Math.max(1, toSafeInteger(amount, 1));
  const next = { dateKey, counters, updatedAt: new Date().toISOString() };
  await kv.put(key, JSON.stringify(next), { expirationTtl: secondsUntilReset() });
  return next;
}

export async function getUsageCounters(context) {
  const kv = requireUsageKv(context.env);
  const dateKey = getDateKey();
  const record = await getJson(kv, counterKey(dateKey), { dateKey, updatedAt: null, counters: {} });
  const counters = Object.fromEntries(LOOP_COUNTER_EVENTS.map((eventName) => [eventName, toSafeInteger(record.counters?.[eventName], 0)]));
  return { dateKey, counters, updatedAt: record.updatedAt || null };
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
    incrementUsageCounter(context, "transform_real_success"),
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
