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
  let response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/usage`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
  } catch (error) {
    throw new ApiError(502, "cloudflare_unreachable", "Unable to reach Cloudflare right now. Please try again.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw buildCloudflareError(response.status, payload, {
      defaultCode: "cloudflare_usage_failed",
      defaultMessage: "Cloudflare could not return Workers AI usage right now.",
      permissionMessage: "Token doesn't have Workers AI permission — re-create with ai:read scope.",
    });
  }

  const neurons = payload?.result?.neurons || payload?.result || {};
  const neuronsUsed = Number(neurons.used);
  const neuronsLimit = Number(neurons.limit);
  const neuronsRemaining = Number.isFinite(Number(neurons.remaining))
    ? Number(neurons.remaining)
    : neuronsLimit - neuronsUsed;

  assert(
    Number.isFinite(neuronsUsed) && Number.isFinite(neuronsLimit) && Number.isFinite(neuronsRemaining),
    502,
    "cloudflare_usage_invalid",
    "Cloudflare returned an unexpected usage response.",
  );

  return {
    neuronsUsed,
    neuronsLimit,
    neuronsRemaining: Math.max(0, neuronsRemaining),
  };
}

export async function runCloudflareModel({ accountId, apiToken, modelId, input }) {
  let response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${encodeURIComponent(modelId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
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
