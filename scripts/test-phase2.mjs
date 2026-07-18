import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/usage.js";
import { getUsageCounters } from "../functions/_lib/usage.js";

class FakeKV {
  constructor() { this.values = new Map(); }
  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return type === "json" && value ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, String(value)); }
}

const kv = new FakeKV();
const env = {
  USAGE_KV: kv,
  MAX_FREE_TRANSFORMS_PER_IP: "5",
  MAX_FREE_NEURONS_PER_DAY: "10000",
  STORAGE_MODE: "direct",
};

function context(ip, query) {
  return {
    env,
    request: new Request(`https://example.test/api/usage${query}`, {
      headers: { "x-forwarded-for": ip },
    }),
  };
}

for (const event of ["share_completed"]) {
  const response = await onRequestGet(context("10.0.0.1", `?event=${event}`));
  assert.equal(response.status, 200);
}
const unsupported = await onRequestGet(context("10.0.0.1", "?event=arbitrary_event"));
assert.equal(unsupported.status, 400);

const referralCode = "phase2-shr-test";
const ownerShare = await onRequestGet(context("10.0.0.1", `?event=share_opened&ref=${referralCode}`));
assert.equal(ownerShare.status, 200);
for (const ip of ["10.0.0.2", "10.0.0.3", "10.0.0.4"]) {
  const response = await onRequestGet(context(ip, `?ref=${referralCode}&src=phase2`));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
}

const thresholdPayload = await onRequestGet(context("10.0.0.4", "?ref=phase2-shr-test"));
assert.equal(thresholdPayload.status, 200);
const thresholdData = await thresholdPayload.json();
assert.equal(thresholdData.data.referral.progress, 3);
const ownerUsage = await onRequestGet(context("10.0.0.1", ""));
const ownerUsageData = await ownerUsage.json();
assert.equal(ownerUsageData.data.bonusTransforms, 5);

const counters = await getUsageCounters({ env, request: new Request("https://example.test/api/usage") });
assert.equal(counters.counters.share_opened, 1);
assert.equal(counters.counters.share_completed, 1);
assert.equal(counters.counters.referral_landed, 3);
assert.equal(counters.counters.referral_bonus_granted, 1);

const countersResponse = await onRequestGet(context("10.0.0.1", "?view=counters"));
assert.equal(countersResponse.status, 200);
const countersPayload = await countersResponse.json();
assert.deepEqual(countersPayload.data.counters, counters.counters);

console.log("SHR-205 counters: PASS");
console.log(`referral threshold: ${thresholdData.data.referral.progress}/${thresholdData.data.referral.threshold}`);
console.log(`owner bonus transforms: ${ownerUsageData.data.bonusTransforms}`);
console.log(JSON.stringify(countersPayload.data));
console.log("TEST SUCCEEDED");
