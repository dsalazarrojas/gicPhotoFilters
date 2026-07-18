import { fail, ok, preflight } from "../_lib/http.js";
import { ApiError } from "../_lib/errors.js";
import { getFilterById } from "../_lib/manifest.js";
import { getClientIp, getDateKey, getUsageCounters, getUsageSnapshot, incrementUsageCounter, usageKey } from "../_lib/usage.js";

const REFERRAL_THRESHOLD = 3;
const REFERRAL_BONUS_TRANSFORMS = 5;
const REFERRAL_MAX_BONUS_PER_DAY = 5;

function sanitizeReferralCode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 48);
}

function sanitizeToken(value, maxLength = 48) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, maxLength);
}

function referralVisitKey(dateKey, ip) {
  return `usage:v1:referral:visit:${dateKey}:${ip}`;
}

function referralCodeKey(dateKey, code) {
  return `usage:v1:referral:code:${dateKey}:${code}`;
}

async function claimReferralOwner(context, referralCode) {
  if (!referralCode || !context.env.USAGE_KV) return;
  const kv = context.env.USAGE_KV;
  const dateKey = getDateKey();
  const key = referralCodeKey(dateKey, referralCode);
  const record = (await kv.get(key, "json")) || { code: referralCode, dateKey, uniqueVisits: 0, sources: {}, trendId: "" };
  if (!record.ownerIp) {
    record.ownerIp = getClientIp(context.request);
    record.ownerClaimedAt = new Date().toISOString();
    await kv.put(key, JSON.stringify(record), { expirationTtl: 86_400 });
  }
}

async function applyReferralTracking(context, snapshot, { referralCode, trendId, source }) {
  if (!referralCode || !context.env.USAGE_KV) return null;
  const kv = context.env.USAGE_KV;
  const visitKey = referralVisitKey(snapshot.dateKey, snapshot.ip);
  const codeKey = referralCodeKey(snapshot.dateKey, referralCode);
  const now = new Date().toISOString();
  const seen = await kv.get(visitKey, "json");
  const priorBonus = Number(snapshot.ipRecord.bonusTransforms || 0);
  const wasAlreadyTracked = Boolean(seen?.code);
  const isNewReferral = !wasAlreadyTracked;

  const codeRecord = (await kv.get(codeKey, "json")) || {
    code: referralCode,
    dateKey: snapshot.dateKey,
    uniqueVisits: 0,
    sources: {},
    trendId: "",
    updatedAt: now,
  };

  if (isNewReferral) {
    const nextUniqueVisits = Number(codeRecord.uniqueVisits || 0) + 1;
    const reachedThreshold = nextUniqueVisits >= REFERRAL_THRESHOLD && priorBonus < REFERRAL_MAX_BONUS_PER_DAY;
    const bonusDelta = reachedThreshold ? REFERRAL_BONUS_TRANSFORMS : 0;
    const ownerIp = codeRecord.ownerIp || snapshot.ip;
    const ownerKey = usageKey(ownerIp, snapshot.dateKey);
    const ownerRecord = ownerIp === snapshot.ip
      ? snapshot.ipRecord
      : (await kv.get(ownerKey, "json")) || { dateKey: snapshot.dateKey, used: 0, limit: snapshot.config.maxFreeTransformsPerIp, baseLimit: snapshot.config.maxFreeTransformsPerIp, bonusTransforms: 0, neuronsUsed: 0 };
    const nextOwnerRecord = {
      ...ownerRecord,
      bonusTransforms: Math.min(REFERRAL_MAX_BONUS_PER_DAY, Number(ownerRecord.bonusTransforms || 0) + bonusDelta),
      referralCode,
      referralBonusUpdatedAt: now,
      updatedAt: now,
    };
    const nextIpRecord = ownerIp === snapshot.ip ? nextOwnerRecord : {
      ...snapshot.ipRecord,
      referralCode,
      updatedAt: now,
    };
    codeRecord.uniqueVisits = nextUniqueVisits;
    if (source) codeRecord.sources[source] = Number(codeRecord.sources[source] || 0) + 1;
    if (trendId) codeRecord.trendId = trendId;
    codeRecord.updatedAt = now;

    await Promise.all([
      kv.put(visitKey, JSON.stringify({
        code: referralCode,
        trendId: trendId || "",
        source: source || "",
        dateKey: snapshot.dateKey,
        updatedAt: now,
      }), { expirationTtl: snapshot.ttlSeconds }),
      kv.put(codeKey, JSON.stringify(codeRecord), { expirationTtl: snapshot.ttlSeconds }),
      kv.put(snapshot.ipKey, JSON.stringify(nextIpRecord), { expirationTtl: snapshot.ttlSeconds }),
      ...(ownerIp === snapshot.ip ? [] : [kv.put(ownerKey, JSON.stringify(nextOwnerRecord), { expirationTtl: snapshot.ttlSeconds })]),
    ]);
    await incrementUsageCounter(context, "referral_landed");
    if (reachedThreshold) await incrementUsageCounter(context, "referral_bonus_granted");

    return {
      ...codeRecord,
      code: referralCode,
      bonusTransforms: nextOwnerRecord.bonusTransforms,
      bonusAwarded: ownerIp === snapshot.ip ? bonusDelta : 0,
      ownerBonusAwarded: bonusDelta,
      threshold: REFERRAL_THRESHOLD,
      bonusTarget: REFERRAL_BONUS_TRANSFORMS,
      progress: Math.min(codeRecord.uniqueVisits, REFERRAL_THRESHOLD),
    };
  }

  if (source && source !== seen?.source) {
    codeRecord.sources[source] = Number(codeRecord.sources[source] || 0) + 1;
    codeRecord.updatedAt = now;
    await kv.put(codeKey, JSON.stringify(codeRecord), { expirationTtl: snapshot.ttlSeconds });
  }

  return {
    ...codeRecord,
    code: seen.code || referralCode,
    bonusTransforms: priorBonus,
    bonusAwarded: 0,
    threshold: REFERRAL_THRESHOLD,
    bonusTarget: REFERRAL_BONUS_TRANSFORMS,
    progress: Math.min(Number(codeRecord.uniqueVisits || 0), REFERRAL_THRESHOLD),
  };
}

export function onRequestOptions(context) {
  return preflight(context.request, "GET,OPTIONS");
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    if (url.searchParams.get("view") === "counters") {
      return ok(context.request, await getUsageCounters(context), { methods: "GET,OPTIONS" });
    }
    const eventName = url.searchParams.get("event")?.trim();
    if (eventName) {
      const eventReferralCode = sanitizeReferralCode(url.searchParams.get("ref") || url.searchParams.get("referral"));
      if (eventName === "share_opened" && eventReferralCode) await claimReferralOwner(context, eventReferralCode);
      const counters = await incrementUsageCounter(context, eventName);
      if (!counters) {
        throw new ApiError(400, "unsupported_usage_event", "Unsupported usage counter event.", { event: eventName });
      }
      return ok(context.request, { event: eventName, counters: counters.counters }, { methods: "GET,OPTIONS" });
    }
    const filterId = url.searchParams.get("filterId")?.trim();
    const referralCode = sanitizeReferralCode(url.searchParams.get("ref") || url.searchParams.get("referral"));
    const trendId = sanitizeToken(url.searchParams.get("trend"), 40);
    const source = sanitizeToken(url.searchParams.get("src") || url.searchParams.get("source"), 40);

    let filter = null;
    if (filterId) {
      filter = (await getFilterById(context, filterId)).filter;
    }

    let snapshot = await getUsageSnapshot(context, { filter });
    const referral = await applyReferralTracking(context, snapshot, { referralCode, trendId, source });
    if (referral?.bonusAwarded) {
      snapshot = await getUsageSnapshot(context, { filter });
    }

    return ok(
      context.request,
      {
        date: snapshot.dateKey,
        used: snapshot.ipRecord.used,
        limit: snapshot.limit,
        remaining: Math.max(0, snapshot.limit - snapshot.ipRecord.used),
        baseLimit: snapshot.baseLimit,
        bonusTransforms: snapshot.bonusTransforms,
        referralBonusTransforms: snapshot.bonusTransforms,
        neuronsUsed: snapshot.siteRecord.neuronsUsed,
        neuronsLimit: snapshot.config.maxFreeNeuronsPerDay,
        ipNeuronsUsed: snapshot.ipRecord.neuronsUsed,
        siteTransformsUsed: snapshot.siteRecord.transformsUsed,
        referral,
        filterContext: filter ? { id: filter.id, slug: filter.slug || null } : null,
      },
      { methods: "GET,OPTIONS" },
    );
  } catch (error) {
    return fail(context.request, error, { methods: "GET,OPTIONS" });
  }
}
