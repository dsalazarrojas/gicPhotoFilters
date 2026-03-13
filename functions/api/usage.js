import { fail, ok, preflight } from "../_lib/http.js";
import { getFilterById } from "../_lib/manifest.js";
import { getUsageSnapshot } from "../_lib/usage.js";

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
    const bonusDelta = priorBonus >= REFERRAL_MAX_BONUS_PER_DAY ? 0 : 1;
    const nextIpRecord = {
      ...snapshot.ipRecord,
      bonusTransforms: Math.min(REFERRAL_MAX_BONUS_PER_DAY, priorBonus + bonusDelta),
      referralCode,
      referralBonusUpdatedAt: now,
      updatedAt: now,
    };
    codeRecord.uniqueVisits += 1;
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
    ]);

    return {
      ...codeRecord,
      code: referralCode,
      bonusTransforms: nextIpRecord.bonusTransforms,
      bonusAwarded: bonusDelta,
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
