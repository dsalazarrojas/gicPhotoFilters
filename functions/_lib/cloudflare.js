import { ApiError, assert } from "./errors.js";

export const CLOUDFLARE_PROXY_HEADERS = Object.freeze({
  accountId: "x-cf-account-id",
  apiToken: "x-cf-api-token",
});

const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;

function readTrimmedHeader(request, headerName) {
  return request.headers.get(headerName)?.trim() || "";
}

function extractCloudflareMessage(payload) {
  return (
    payload?.errors?.[0]?.message ||
    payload?.messages?.[0]?.message ||
    payload?.result?.error?.message ||
    payload?.message ||
    null
  );
}

function buildCloudflareError(status, payload, { defaultCode, defaultMessage, permissionMessage } = {}) {
  const cloudflareMessage = extractCloudflareMessage(payload);
  const details = {
    cloudflareStatus: status,
    cloudflareCode: payload?.errors?.[0]?.code ?? null,
  };

  if (cloudflareMessage) {
    details.cloudflareMessage = cloudflareMessage;
  }

  if (status === 401) {
    return new ApiError(
      401,
      "cloudflare_invalid_api_token",
      "Invalid API token — check it in your Cloudflare dashboard.",
      details,
    );
  }

  if (status === 403) {
    return new ApiError(
      403,
      "cloudflare_workers_ai_permission_required",
      permissionMessage || "Token doesn't have Workers AI permission — re-create it with the right scope.",
      details,
    );
  }

  if (status === 404) {
    return new ApiError(404, "cloudflare_account_not_found", "Account not found — verify your Cloudflare Account ID.", details);
  }

  if (status === 429) {
    return new ApiError(
      429,
      "cloudflare_rate_limited",
      cloudflareMessage ? `Cloudflare rate limit reached: ${cloudflareMessage}` : "Cloudflare rate limit reached or quota exhausted.",
      details,
    );
  }

  const normalizedStatus = status >= 500 ? 502 : Math.max(400, status || 502);
  return new ApiError(
    normalizedStatus,
    defaultCode || "cloudflare_request_failed",
    cloudflareMessage ? `Cloudflare error: ${cloudflareMessage}` : defaultMessage || "Cloudflare error. Please try again in a moment.",
    details,
  );
}

function toUint8Array(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return null;
}

// FLUX.2 models (klein-9b, klein-4b, dev) take a multipart/form-data body with an
// "input_image_0" file field, not the plain-JSON "image" byte-array body the older
// Stable Diffusion img2img/inpainting models use. See:
// https://developers.cloudflare.com/workers-ai/models/flux-2-klein-9b/
export function usesMultipartWorkersAi(modelId) {
  return typeof modelId === "string" && modelId.includes("/flux-2-");
}

// Shared between the BYOK REST proxy (fetch) and the direct env.AI binding call —
// both need the same FormData shape for FLUX.2 models, just wrapped differently.
export function buildMultipartWorkersAiForm(input) {
  const form = new FormData();
  const imageBytes = toUint8Array(input?.image);

  if (input?.prompt) form.set("prompt", String(input.prompt));
  if (input?.negative_prompt) form.set("negative_prompt", String(input.negative_prompt));
  if (Number.isFinite(Number(input?.width))) form.set("width", String(Number(input.width)));
  if (Number.isFinite(Number(input?.height))) form.set("height", String(Number(input.height)));
  if (Number.isFinite(Number(input?.guidance))) form.set("guidance", String(Number(input.guidance)));
  if (Number.isFinite(Number(input?.strength))) form.set("strength", String(Number(input.strength)));

  if (imageBytes?.byteLength) {
    form.set("input_image_0", new Blob([imageBytes], { type: "image/jpeg" }), "input.jpg");
  }

  return form;
}

function buildWorkersAiFetchOptions({ apiToken, modelId, input }) {
  if (!usesMultipartWorkersAi(modelId)) {
    return {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    };
  }

  return {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    body: buildMultipartWorkersAiForm(input),
  };
}

export function maskCloudflareAccountId(accountId) {
  const value = String(accountId || "").trim();
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function readCloudflareCredentials(request, { optional = true } = {}) {
  const accountId = readTrimmedHeader(request, CLOUDFLARE_PROXY_HEADERS.accountId);
  const apiToken = readTrimmedHeader(request, CLOUDFLARE_PROXY_HEADERS.apiToken);
  const hasAnyCredentials = Boolean(accountId || apiToken);

  if (!hasAnyCredentials) {
    if (optional) {
      return null;
    }

    throw new ApiError(400, "cloudflare_credentials_missing", "No credentials provided. Add your Cloudflare Account ID and API token.", {
      expectedHeaders: ["X-CF-Account-ID", "X-CF-API-Token"],
    });
  }

  if (!(accountId && apiToken)) {
    throw new ApiError(
      400,
      "cloudflare_credentials_incomplete",
      "Provide both your Cloudflare Account ID and API token.",
      {
        accountIdProvided: Boolean(accountId),
        apiTokenProvided: Boolean(apiToken),
      },
    );
  }

  assert(
    ACCOUNT_ID_PATTERN.test(accountId),
    400,
    "cloudflare_account_id_invalid",
    "Account not found — verify your Cloudflare Account ID.",
    {
      header: "X-CF-Account-ID",
    },
  );

  return {
    accountId,
    apiToken,
  };
}

export async function fetchCloudflareUsage({ accountId, apiToken }) {
  // Cloudflare does not expose a public REST endpoint for Workers AI neuron usage.
  // We verify credentials by hitting the AI models search endpoint, which requires
  // a valid account ID and a token with Workers AI access.
  let response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/models/search?per_page=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      },
    );
  } catch (error) {
    throw new ApiError(502, "cloudflare_unreachable", "Unable to reach Cloudflare right now. Please try again.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw buildCloudflareError(response.status, payload, {
      defaultCode: "cloudflare_credentials_invalid",
      defaultMessage: "Could not verify Cloudflare credentials.",
      permissionMessage: "Token doesn't have Workers AI permission — re-create with ai:read scope.",
    });
  }

  // Neuron usage is not available via Cloudflare's REST API.
  // Users can check their usage at dash.cloudflare.com → Workers AI.
  return {
    neuronsUsed: null,
    neuronsLimit: null,
    neuronsRemaining: null,
  };
}

export async function runCloudflareModel({ accountId, apiToken, modelId, input }) {
  const normalizedModelId = String(modelId || "").replace(/^\/+/, "");
  let response;
  try {
    const requestOptions = buildWorkersAiFetchOptions({ apiToken, modelId: normalizedModelId, input });
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${normalizedModelId}`,
      {
        method: "POST",
        headers: requestOptions.headers,
        body: requestOptions.body,
      },
    );
  } catch (error) {
    throw new ApiError(502, "cloudflare_unreachable", "Unable to reach Cloudflare right now. Please try again.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!response.ok) {
    const payload = contentType.includes("json") ? await response.json().catch(() => null) : null;
    throw buildCloudflareError(response.status, payload, {
      defaultCode: "cloudflare_transform_failed",
      defaultMessage: "Cloudflare could not run the transform right now.",
      permissionMessage: "Token doesn't have Workers AI permission — re-create it with ai:read or ai:write scope.",
    });
  }

  if (contentType.startsWith("image/")) {
    return {
      contentType,
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  const payload = await response.json().catch(() => null);
  if (payload?.success === false) {
    throw buildCloudflareError(response.status || 502, payload, {
      defaultCode: "cloudflare_transform_failed",
      defaultMessage: "Cloudflare could not run the transform right now.",
      permissionMessage: "Token doesn't have Workers AI permission — re-create it with ai:read or ai:write scope.",
    });
  }

  return {
    contentType,
    payload,
  };
}
