import { getConfig } from "./config.js";
import { ApiError, assert, missingBindingError } from "./errors.js";

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function extensionForMimeType(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function detectImageMimeType(bytes) {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function assertSupportedImage(bytes, mimeType, maxBytes, fieldName = "image") {
  assert(bytes && bytes.byteLength > 0, 400, `${fieldName}_missing`, `${fieldName} is required.`);
  assert(bytes.byteLength <= maxBytes, 413, `${fieldName}_too_large`, `${fieldName} exceeds the ${maxBytes} byte limit.`, {
    field: fieldName,
    maxBytes,
    actualBytes: bytes.byteLength,
  });
  assert(
    SUPPORTED_IMAGE_MIME_TYPES.has(mimeType),
    400,
    `${fieldName}_unsupported_type`,
    `${fieldName} must be JPEG, PNG, or WebP.`,
    {
      field: fieldName,
      mimeType,
      supportedMimeTypes: Array.from(SUPPORTED_IMAGE_MIME_TYPES),
    },
  );
}

export function getPhotoBucket(env) {
  if (!env.PHOTO_BUCKET || typeof env.PHOTO_BUCKET.get !== "function" || typeof env.PHOTO_BUCKET.put !== "function") {
    throw missingBindingError("PHOTO_BUCKET", "storing uploads and generated images");
  }
  return env.PHOTO_BUCKET;
}

export function assertSafeObjectKey(key, fieldName = "key") {
  assert(
    typeof key === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(key),
    400,
    `${fieldName}_invalid`,
    `${fieldName} must be a safe image key.`,
    { field: fieldName },
  );
  return key;
}

export function buildImageUrl(request, key) {
  return new URL(`/api/image/${key}`, request.url).toString();
}

export async function putImageObject(context, bytes, { prefix, contentType, ttlSeconds, metadata = {} }) {
  const config = getConfig(context.env);
  const bucket = getPhotoBucket(context.env);
  const key = `${prefix}-${crypto.randomUUID()}.${extensionForMimeType(contentType)}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl:
        prefix === "result" ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store, max-age=0",
    },
    customMetadata: {
      ...metadata,
      expiresAt,
      contentType,
      configuredMaxDimension: String(config.maxImageDimension),
    },
  });

  return {
    key,
    url: buildImageUrl(context.request, key),
    expiresAt,
    contentType,
  };
}

export async function getStoredImage(context, key) {
  const bucket = getPhotoBucket(context.env);
  const safeKey = assertSafeObjectKey(key);
  const object = await bucket.get(safeKey);

  if (!object) {
    throw new ApiError(404, "image_not_found", `Stored image "${safeKey}" was not found.`, { key: safeKey });
  }

  const expiresAt = object.customMetadata?.expiresAt;
  if (expiresAt && Date.parse(expiresAt) < Date.now()) {
    throw new ApiError(410, "image_expired", `Stored image "${safeKey}" has expired.`, { key: safeKey, expiresAt });
  }

  const bytes = new Uint8Array(await object.arrayBuffer());
  const mimeType = object.httpMetadata?.contentType || object.customMetadata?.contentType || detectImageMimeType(bytes);

  return {
    key: safeKey,
    object,
    bytes,
    mimeType,
    expiresAt,
  };
}
