import { readCloudflareCredentials } from "./cloudflare.js";
import { ApiError, assert } from "./errors.js";
import { assertSafeObjectKey, assertSupportedImage, detectImageMimeType } from "./storage.js";

function isBlobLike(value) {
  return Boolean(value) && typeof value.arrayBuffer === "function";
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function readObjectString(value, fieldName, { required = false, maxLength = 200, fallback = "" } = {}) {
  const normalized = normalizeString(value);
  if (!normalized) {
    if (required) {
      throw new ApiError(400, `${fieldName}_required`, `${fieldName} is required.`, { field: fieldName });
    }
    return fallback;
  }

  assert(normalized.length <= maxLength, 400, `${fieldName}_too_long`, `${fieldName} exceeds ${maxLength} characters.`, {
    field: fieldName,
    maxLength,
  });
  return normalized;
}

function readObjectNumber(value, fieldName, {
  required = false,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  fallback = null,
  allowedValues = null,
} = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ApiError(400, `${fieldName}_required`, `${fieldName} is required.`, { field: fieldName });
    }
    return fallback;
  }

  const number = Number(value);
  assert(Number.isFinite(number), 400, `${fieldName}_invalid`, `${fieldName} must be a number.`, {
    field: fieldName,
    value,
  });
  if (allowedValues?.length) {
    assert(allowedValues.includes(number), 400, `${fieldName}_invalid`, `${fieldName} must be one of ${allowedValues.join(", ")}.`, {
      field: fieldName,
      allowedValues,
      value: number,
    });
  } else {
    assert(number >= min && number <= max, 400, `${fieldName}_out_of_range`, `${fieldName} must be between ${min} and ${max}.`, {
      field: fieldName,
      min,
      max,
      value: number,
    });
  }
  return number;
}

function readObjectTags(value, fieldName) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readObjectString(entry, fieldName, { required: false, maxLength: 24 }))
      .filter(Boolean)
      .slice(0, 8);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => readObjectString(entry, fieldName, { required: false, maxLength: 24 }))
      .filter(Boolean)
      .slice(0, 8);
  }

  return [];
}

export async function parseRequestPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return {
      kind: "form",
      value: await request.formData(),
    };
  }

  if (contentType.includes("application/json")) {
    try {
      return {
        kind: "json",
        value: await request.json(),
      };
    } catch (error) {
      throw new ApiError(400, "invalid_json", "Request body is not valid JSON.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new ApiError(
    415,
    "unsupported_media_type",
    'Expected "multipart/form-data" or "application/json".',
    { contentType: contentType || null },
  );
}

function readField(payload, fieldName) {
  if (payload.kind === "form") {
    return payload.value.get(fieldName);
  }
  return payload.value?.[fieldName];
}

export function readStringField(payload, fieldName, { required = false, maxLength = 200 } = {}) {
  const value = readField(payload, fieldName);

  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ApiError(400, `${fieldName}_required`, `${fieldName} is required.`, { field: fieldName });
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldName}_invalid`, `${fieldName} must be a string.`, { field: fieldName });
  }

  const normalized = value.trim();
  assert(normalized.length <= maxLength, 400, `${fieldName}_too_long`, `${fieldName} exceeds ${maxLength} characters.`, {
    field: fieldName,
    maxLength,
  });
  return normalized;
}

function decodeBase64Image(value, fieldName) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const dataUrlMatch = normalized.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  const mimeTypeFromDataUrl = dataUrlMatch?.[1] || null;
  const base64Payload = dataUrlMatch?.[2] || normalized;

  try {
    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return {
      bytes,
      mimeTypeFromDataUrl,
    };
  } catch (error) {
    throw new ApiError(400, `${fieldName}_invalid_base64`, `${fieldName} is not valid base64 image data.`, {
      field: fieldName,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readBlobImage(blob, fieldName) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes,
    mimeType: normalizeString(blob.type),
    filename: typeof blob.name === "string" ? blob.name : undefined,
  };
}

export async function readImageField(payload, fieldName, maxBytes, { required = true } = {}) {
  const directField = readField(payload, fieldName);

  if (isBlobLike(directField)) {
    const fileImage = await readBlobImage(directField, fieldName);
    const detectedMimeType = fileImage.mimeType || detectImageMimeType(fileImage.bytes);
    assertSupportedImage(fileImage.bytes, detectedMimeType, maxBytes, fieldName);
    return {
      bytes: fileImage.bytes,
      mimeType: detectedMimeType,
      filename: fileImage.filename,
      size: fileImage.bytes.byteLength,
    };
  }

  if (payload.kind === "json" && directField && typeof directField === "object") {
    const objectBase64 = normalizeString(directField.base64);
    if (objectBase64) {
      const decoded = decodeBase64Image(objectBase64, fieldName);
      const explicitMimeType = normalizeString(directField.mimeType);
      const mimeType = explicitMimeType || decoded.mimeTypeFromDataUrl || detectImageMimeType(decoded.bytes);
      assertSupportedImage(decoded.bytes, mimeType, maxBytes, fieldName);
      return {
        bytes: decoded.bytes,
        mimeType,
        filename: normalizeString(directField.filename) || undefined,
        size: decoded.bytes.byteLength,
      };
    }
  }

  const base64Field = readField(payload, `${fieldName}Base64`);
  if (typeof base64Field === "string" && normalizeString(base64Field)) {
    const decoded = decodeBase64Image(base64Field, fieldName);
    const explicitMimeType = readStringField(payload, `${fieldName}MimeType`, { required: false, maxLength: 100 });
    const mimeType = explicitMimeType || decoded.mimeTypeFromDataUrl || detectImageMimeType(decoded.bytes);
    assertSupportedImage(decoded.bytes, mimeType, maxBytes, fieldName);
    return {
      bytes: decoded.bytes,
      mimeType,
      size: decoded.bytes.byteLength,
    };
  }

  if (!required) {
    return null;
  }

  throw new ApiError(400, `${fieldName}_required`, `${fieldName} is required.`, { field: fieldName });
}

export async function readUploadRequest(request, config) {
  const payload = await parseRequestPayload(request);
  const image = await readImageField(payload, "image", config.maxUploadBytes, { required: true });

  return {
    image,
  };
}

export function readCustomFilterField(payload) {
  const raw = readStringField(payload, "customFilter", { required: false, maxLength: 12000 });
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ApiError(400, "custom_filter_invalid_json", "customFilter must be valid JSON.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  assert(parsed && typeof parsed === "object" && !Array.isArray(parsed), 400, "custom_filter_invalid", "customFilter must be a JSON object.");

  const prompt = readObjectString(parsed.prompt, "prompt", { required: true, maxLength: 500 });
  const model = readObjectString(parsed.model, "model", { required: true, maxLength: 100 });
  assert(model !== "client-side", 400, "custom_model_invalid", "Custom filters must use an AI model.");

  return {
    name: readObjectString(parsed.name, "name", { required: false, maxLength: 60, fallback: "Custom Filter" }),
    description: readObjectString(parsed.description, "description", { required: false, maxLength: 160, fallback: "" }),
    category: readObjectString(parsed.category, "category", { required: false, maxLength: 80, fallback: "artistic_styles" }),
    prompt,
    negativePrompt: readObjectString(parsed.negativePrompt, "negativePrompt", { required: false, maxLength: 300, fallback: "" }),
    model,
    strength: readObjectNumber(parsed.strength, "strength", { required: false, min: 0.3, max: 1, fallback: 0.65 }),
    guidance: readObjectNumber(parsed.guidance, "guidance", { required: false, min: 3, max: 15, fallback: 7.5 }),
    width: readObjectNumber(parsed.width, "width", { required: false, allowedValues: [512, 768, 1024], fallback: 768 }),
    height: readObjectNumber(parsed.height, "height", { required: false, allowedValues: [512, 768, 1024], fallback: 768 }),
    variantCount: readObjectNumber(parsed.variantCount, "variantCount", { required: false, allowedValues: [1, 2], fallback: 1 }),
    tags: readObjectTags(parsed.tags, "tags"),
  };
}

export async function readTransformRequest(request, config) {
  const payload = await parseRequestPayload(request);
  const customFilter = readCustomFilterField(payload);
  const filterId = readStringField(payload, "filterId", { required: false, maxLength: 200 });
  const legacyApiKey = readStringField(payload, "apiKey", { required: false, maxLength: 400 });
  const sourceImageKey = readStringField(payload, "sourceImageKey", { required: false, maxLength: 200 });
  const cloudflare = readCloudflareCredentials(request, { optional: true });
  const hasInlineImage = payload.kind === "form" ? isBlobLike(readField(payload, "image")) : Boolean(payload.value?.image || payload.value?.imageBase64);
  assert(
    !(sourceImageKey && hasInlineImage),
    400,
    "image_source_conflict",
    'Provide either "sourceImageKey" or an inline image, but not both.',
  );
  const image = sourceImageKey ? null : await readImageField(payload, "image", config.maxUploadBytes, { required: true });
  const mask = await readImageField(payload, "mask", config.maxUploadBytes, { required: false });

  if (sourceImageKey) {
    assertSafeObjectKey(sourceImageKey, "sourceImageKey");
  }

  assert(
    filterId || customFilter,
    400,
    "filter_required",
    'Provide either "filterId" or "customFilter" when calling /api/transform.',
  );

  assert(
    !legacyApiKey,
    400,
    "api_key_body_not_supported",
    "Send Cloudflare credentials with X-CF-Account-ID and X-CF-API-Token headers instead of the request body.",
  );

  return {
    filterId,
    customFilter,
    cloudflare,
    sourceImageKey,
    image,
    mask,
  };
}
