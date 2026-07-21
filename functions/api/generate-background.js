import { ApiError, assert, missingBindingError } from "../_lib/errors.js";
import { fail, preflight, rawResponse } from "../_lib/http.js";

export function onRequestOptions(context) {
  return preflight(context.request, "POST,OPTIONS");
}

function decodeBase64Payload(value) {
  const binary = atob(value.trim().replace(/^data:image\/[a-z0-9.+-]+;base64,/i, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function normalizeImagePayload(result) {
  const image = result?.image ?? result;
  let bytes;

  if (typeof image === "string") {
    try {
      bytes = decodeBase64Payload(image);
    } catch {
      bytes = null;
    }
  } else if (image instanceof ArrayBuffer) {
    bytes = new Uint8Array(image);
  } else if (image instanceof Uint8Array) {
    bytes = image;
  } else if (image instanceof ReadableStream) {
    bytes = new Uint8Array(await new Response(image).arrayBuffer());
  }

  if (!bytes?.byteLength) {
    throw new ApiError(502, "workers_ai_response_invalid", "Workers AI did not return image data in a recognized format.");
  }

  return {
    bytes,
    // flux-1-schnell returns JPEG bytes even though no explicit content-type is present
    // in the binding response; default matches the observed real payload.
    contentType: result?.contentType || result?.content_type || result?.mimeType || "image/jpeg",
  };
}

// flux-1-schnell rejects any width/height not divisible by 8 (Workers AI error 3030).
// Ad placements (e.g. 728x90, 300x600) don't satisfy that, so we generate at the
// nearest multiple-of-8 size and let composite-ad.js's resize+crop step fit the
// result to the exact target dimensions afterward.
function roundUpToMultipleOf8(value) {
  return Math.ceil(value / 8) * 8;
}

export async function onRequestPost(context) {
  try {
    const adminToken = context.request.headers.get("x-gic-ad-admin-token");
    if (!context.env.AD_ADMIN_TOKEN || !adminToken || adminToken !== context.env.AD_ADMIN_TOKEN) {
      throw new ApiError(401, "unauthorized", "Missing or invalid admin token.");
    }

    let body;
    try {
      body = await context.request.json();
    } catch (error) {
      throw new ApiError(400, "invalid_json", "Request body is not valid JSON.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    assert(prompt, 400, "prompt_required", "prompt must be a non-empty string.");
    assert(prompt.length <= 800, 400, "prompt_too_long", "prompt must be 800 characters or fewer.");
    assert(body?.width === undefined || (typeof body.width === "number" && Number.isFinite(body.width) && body.width > 0), 400, "width_invalid", "width must be a finite positive number.");
    assert(body?.height === undefined || (typeof body.height === "number" && Number.isFinite(body.height) && body.height > 0), 400, "height_invalid", "height must be a finite positive number.");

    if (!context.env.AI || typeof context.env.AI.run !== "function") {
      throw missingBindingError("AI", "generating ad background images");
    }

    const result = await context.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      ...(body.width && body.height
        ? { width: roundUpToMultipleOf8(body.width), height: roundUpToMultipleOf8(body.height) }
        : {}),
    });
    const image = await normalizeImagePayload(result);

    return rawResponse(context.request, image.bytes, {
      methods: "POST,OPTIONS",
      headers: { "content-type": image.contentType || "image/png" },
    });
  } catch (error) {
    return fail(context.request, error, { methods: "POST,OPTIONS" });
  }
}
