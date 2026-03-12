import { asApiError } from "./errors.js";

function getRequestId(request) {
  return request.headers.get("x-request-id") || request.headers.get("cf-ray") || crypto.randomUUID();
}

function buildCorsHeaders(request, methods) {
  const origin = request.headers.get("origin") || "*";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type, x-request-id",
    "access-control-allow-methods": methods,
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

export function jsonResponse(request, payload, { status = 200, headers = {}, methods = "GET,POST,OPTIONS" } = {}) {
  const requestId = payload.requestId || getRequestId(request);

  return new Response(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      ...payload,
    }),
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-request-id": requestId,
        ...buildCorsHeaders(request, methods),
        ...headers,
      },
    },
  );
}

export function ok(request, data, init = {}) {
  return jsonResponse(request, { ok: true, data }, init);
}

export function fail(request, error, init = {}) {
  const apiError = asApiError(error);

  return jsonResponse(
    request,
    {
      ok: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        retryable: apiError.status >= 500,
        details: apiError.details,
      },
    },
    {
      ...init,
      status: apiError.status,
    },
  );
}

export function preflight(request, methods = "GET,POST,OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request, methods),
  });
}
