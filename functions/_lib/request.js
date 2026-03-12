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

export async function readTransformRequest(request, config) {
  const payload = await parseRequestPayload(request);
  const filterId = readStringField(payload, "filterId", { required: true, maxLength: 200 });
  const apiKey = readStringField(payload, "apiKey", { required: false, maxLength: 400 });
  const sourceImageKey = readStringField(payload, "sourceImageKey", { required: false, maxLength: 200 });
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

  return {
    filterId,
    apiKey,
    sourceImageKey,
    image,
    mask,
  };
}
