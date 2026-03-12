import { ApiError, assert, missingBindingError, notImplementedError } from "./errors.js";

const BUILT_IN_MODELS = {
  "flux2-klein-9b": {
    id: "@cf/black-forest-labs/flux-2-klein-9b",
    name: "FLUX.2 Klein 9B",
    neuronsPerRun: 150,
    supportsImg2Img: true,
    supportsInpainting: false,
  },
  "flux2-klein-4b": {
    id: "@cf/black-forest-labs/flux-2-klein-4b",
    name: "FLUX.2 Klein 4B",
    neuronsPerRun: 80,
    supportsImg2Img: true,
    supportsInpainting: false,
  },
  "sd15-img2img": {
    id: "@cf/stabilityai/stable-diffusion-v1-5-img2img",
    name: "Stable Diffusion v1.5 Img2Img",
    neuronsPerRun: 100,
    supportsImg2Img: true,
    supportsInpainting: false,
  },
  "sd15-inpainting": {
    id: "@cf/stabilityai/stable-diffusion-v1-5-inpainting",
    name: "Stable Diffusion v1.5 Inpainting",
    neuronsPerRun: 120,
    supportsImg2Img: false,
    supportsInpainting: true,
  },
  "client-side": {
    id: "client-side",
    name: "Browser effect",
    neuronsPerRun: 0,
    supportsImg2Img: false,
    supportsInpainting: false,
  },
};

function decodeBase64Payload(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function coerceBinaryPayload(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }

  if (Array.isArray(value) && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)) {
    return Uint8Array.from(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
    if (!normalized) {
      return null;
    }
    try {
      return decodeBase64Payload(normalized);
    } catch {
      return null;
    }
  }

  return null;
}

export function getEstimatedNeurons(filter, modelDefinition) {
  return Number.isFinite(filter?.estimatedNeurons) ? filter.estimatedNeurons : Number(modelDefinition?.neuronsPerRun || 0);
}

export function resolveModelDefinition(filter, manifest) {
  const registry = {
    ...BUILT_IN_MODELS,
    ...(manifest?.models || {}),
  };

  const manifestDefinition = registry[filter.model];
  if (manifestDefinition) {
    return manifestDefinition;
  }

  if (typeof filter.model === "string" && filter.model.startsWith("@cf/")) {
    return {
      id: filter.model,
      name: filter.model,
      neuronsPerRun: filter.estimatedNeurons || 0,
      supportsImg2Img: filter.type === "img2img",
      supportsInpainting: filter.type === "inpainting",
    };
  }

  throw new ApiError(422, "model_not_supported", `Filter model "${filter.model}" is not supported by the backend foundation.`, {
    filterId: filter.id,
    model: filter.model,
  });
}

export function getFallbackDescriptor(filter) {
  return {
    mode: "client",
    reason: "This filter is marked as browser-only and should be applied on the client.",
    filterId: filter.id,
    slug: filter.slug,
  };
}

function buildWorkersAiInput(filter, requestData) {
  const imageBytes = requestData.imageBytes;
  assert(imageBytes?.byteLength, 400, "image_required", "Transform requests require an input image.");

  if (filter.type === "img2img") {
    return {
      prompt: filter.prompt,
      negative_prompt: filter.negativePrompt || undefined,
      image: Array.from(imageBytes),
      strength: Number(filter.strength ?? 0.65),
      guidance: Number(filter.guidance ?? 7.5),
      width: Number(filter.outputWidth ?? 768),
      height: Number(filter.outputHeight ?? 768),
    };
  }

  if (filter.type === "inpainting") {
    assert(requestData.maskBytes?.byteLength, 400, "mask_required", "Inpainting filters require a mask image.");
    return {
      prompt: filter.prompt,
      negative_prompt: filter.negativePrompt || undefined,
      image: Array.from(imageBytes),
      mask: Array.from(requestData.maskBytes),
      guidance: Number(filter.guidance ?? 7.5),
      width: Number(filter.outputWidth ?? 768),
      height: Number(filter.outputHeight ?? 768),
    };
  }

  throw new ApiError(422, "filter_type_not_supported", `Filter type "${filter.type}" is not supported.`, {
    filterId: filter.id,
    type: filter.type,
  });
}

function extractImagePayload(result) {
  const candidates = [
    result,
    result?.image,
    result?.result?.image,
    result?.images?.[0],
    result?.result?.images?.[0],
    result?.data,
  ];

  for (const candidate of candidates) {
    const bytes = coerceBinaryPayload(candidate);
    if (bytes?.byteLength) {
      return {
        bytes,
        contentType: result?.contentType || result?.mimeType || result?.result?.contentType || "image/png",
      };
    }
  }

  throw new ApiError(502, "workers_ai_response_invalid", "Workers AI did not return image data in a recognized format.");
}

export async function executeTransform(context, filter, manifest, requestData) {
  if (requestData.apiKey) {
    throw notImplementedError(
      "user_api_key_mode_not_supported",
      "User-supplied API keys are not proxied by this Pages backend. The app should call the user's Cloudflare account directly.",
      { filterId: filter.id },
    );
  }

  const modelDefinition = resolveModelDefinition(filter, manifest);
  if (filter.clientSideOnly || filter.requiresAI === false || modelDefinition.id === "client-side") {
    throw new ApiError(409, "client_side_only_filter", "This filter must be applied on the client instead of the backend.", {
      fallback: getFallbackDescriptor(filter),
    });
  }

  if (!modelDefinition.id.startsWith("@cf/")) {
    throw notImplementedError(
      "external_provider_not_implemented",
      "Only native Workers AI execution is wired in this backend foundation.",
      {
        filterId: filter.id,
        modelId: modelDefinition.id,
      },
    );
  }

  if (!context.env.AI || typeof context.env.AI.run !== "function") {
    throw missingBindingError("AI", "executing Workers AI image transforms");
  }

  const input = buildWorkersAiInput(filter, requestData);

  let result;
  try {
    result = await context.env.AI.run(modelDefinition.id, input);
  } catch (error) {
    throw new ApiError(502, "workers_ai_failed", `Workers AI failed while running model "${modelDefinition.id}".`, {
      filterId: filter.id,
      modelId: modelDefinition.id,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const imagePayload = extractImagePayload(result);

  return {
    imageBytes: imagePayload.bytes,
    contentType: imagePayload.contentType,
    estimatedNeurons: getEstimatedNeurons(filter, modelDefinition),
    modelDefinition,
  };
}
