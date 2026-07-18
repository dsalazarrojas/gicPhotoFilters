import assert from "node:assert/strict";
import { executeTransform } from "../functions/_lib/ai.js";

const filter = {
  id: "quota-test-filter",
  model: "flux2-klein-9b",
  type: "img2img",
  prompt: "test",
};
const requestData = { imageBytes: Uint8Array.from([1, 2, 3]) };

async function assertTransformError(aiError, expectedCode, expectedStatus) {
  await assert.rejects(
    executeTransform({ env: { AI: { run: async () => { throw new Error(aiError); } } } }, filter, {}, requestData),
    (error) => {
      assert.equal(error.code, expectedCode);
      assert.equal(error.status, expectedStatus);
      return true;
    },
  );
}

await assertTransformError(
  'Error: Workers AI failed while running model "@cf/black-forest-labs/flux-2-klein-9b". (4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare\'s Workers Paid plan if you would like to continue usage.)',
  "workers_ai_account_quota_exhausted",
  429,
);
await assertTransformError("model timeout", "workers_ai_failed", 502);

console.log("TEST SUCCEEDED");
