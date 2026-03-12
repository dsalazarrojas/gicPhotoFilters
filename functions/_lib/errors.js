export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, status, code, message, details = undefined) {
  if (!condition) {
    throw new ApiError(status, code, message, details);
  }
}

export function missingBindingError(bindingName, purpose) {
  return new ApiError(
    503,
    `${bindingName.toLowerCase()}_binding_missing`,
    `Cloudflare binding "${bindingName}" is not configured.`,
    {
      binding: bindingName,
      purpose,
    },
  );
}

export function notImplementedError(code, message, details = undefined) {
  return new ApiError(501, code, message, details);
}

export function asApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(500, "internal_error", "Unexpected server error.", {
    cause: error instanceof Error ? error.message : String(error),
  });
}
