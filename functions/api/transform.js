import { executeTransform, getEstimatedNeurons, resolveModelDefinition } from "../_lib/ai.js";
import { getConfig } from "../_lib/config.js";
import { fail, ok, preflight, rawResponse } from "../_lib/http.js";
import { ApiError } from "../_lib/errors.js";
import { getFilterById, loadManifest } from "../_lib/manifest.js";
import { readTransformRequest } from "../_lib/request.js";
import { getStoredImage, putImageObject } from "../_lib/storage.js";
import { assertWithinUsageLimits, getUsageSnapshot, recordSuccessfulTransform, saveJobStatus } from "../_lib/usage.js";

export function onRequestOptions(context) {
  return preflight(context.request, "POST,OPTIONS");
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-filter";
}

function buildCustomFilter(filterDefinition = {}) {
  const category = String(filterDefinition.category || "artistic_styles").trim() || "artistic_styles";
  const slug = slugify(filterDefinition.name || "Custom Filter");
  return {
    id: `custom_${slug}--${category}`,
    slug,
    name: filterDefinition.name || "Custom Filter",
    category,
    description: filterDefinition.description || "Custom prompt built on the website builder.",
    type: "img2img",
    model: filterDefinition.model,
    prompt: filterDefinition.prompt,
    negativePrompt: filterDefinition.negativePrompt || "",
    strength: Number(filterDefinition.strength ?? 0.65),
    guidance: Number(filterDefinition.guidance ?? 7.5),
    outputWidth: Number(filterDefinition.width ?? 768),
    outputHeight: Number(filterDefinition.height ?? 768),
    variantCount: Number(filterDefinition.variantCount ?? 1),
    requiresAI: true,
    clientSideOnly: false,
    isDemoFilter: false,
    tags: Array.isArray(filterDefinition.tags) ? filterDefinition.tags : [],
    shareText: "Try my custom filter on GIC Photo Filters:",
  };
}

export async function onRequestPost(context) {
  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let shouldPersistJob = false;

  try {
    const config = getConfig(context.env);
    const requestData = await readTransformRequest(context.request, config);
    const loaded = requestData.customFilter
      ? {
          filter: buildCustomFilter(requestData.customFilter),
          manifest: (await loadManifest(context)).manifest,
        }
      : await getFilterById(context, requestData.filterId);
    const usingByok = Boolean(requestData.cloudflare);
    if (config.demoMode && requestData.customFilter && !usingByok) {
      throw new ApiError(
        403,
        "custom_filter_requires_byok",
        "Custom filters on the public website require your Cloudflare credentials. Add your key in Settings, then run the builder or shared custom link again.",
        {
          demoMode: config.demoMode,
          requiresByok: true,
        },
      );
    }
    if (config.demoMode && !loaded.filter.isDemoFilter && !loaded.filter.clientSideOnly && !usingByok) {
      throw new ApiError(
        403,
        "filter_requires_demo_or_byok",
        "This filter is preview-only on the public website. Use a demo filter here, self-host with DEMO_MODE=false, or run it from the companion app with your own Cloudflare credentials.",
        {
          filterId: loaded.filter.id,
          demoMode: config.demoMode,
        },
      );
    }
    const usageSnapshot = usingByok ? null : await getUsageSnapshot(context, { filter: loaded.filter });
    const storageMode = config.storageMode;

    if (requestData.sourceImageKey && storageMode === "direct") {
      throw new ApiError(
        400,
        "source_image_key_requires_r2",
        'The "sourceImageKey" flow requires STORAGE_MODE="r2" with PHOTO_BUCKET configured.',
        {
          storageMode,
          r2SetupGuideUrl: "/docs/r2-setup.html",
        },
      );
    }

    if (requestData.sourceImageKey) {
      const storedInput = await getStoredImage(context, requestData.sourceImageKey);
      requestData.image = {
        bytes: storedInput.bytes,
        mimeType: storedInput.mimeType,
        size: storedInput.bytes.byteLength,
      };
    }

    requestData.imageBytes = requestData.image?.bytes;
    requestData.maskBytes = requestData.mask?.bytes;

    const estimatedNeurons = getEstimatedNeurons(loaded.filter, resolveModelDefinition(loaded.filter, loaded.manifest));

    if (usageSnapshot) {
      assertWithinUsageLimits(usageSnapshot, estimatedNeurons);
    }

    shouldPersistJob = storageMode === "r2";

    if (shouldPersistJob) {
      await saveJobStatus(context, jobId, {
        id: jobId,
        status: "processing",
        filterId: loaded.filter.id,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const transformResult = await executeTransform(context, loaded.filter, loaded.manifest, requestData);
    if (storageMode === "direct") {
      const usageAfter = usageSnapshot
        ? await recordSuccessfulTransform(context, usageSnapshot, {
            estimatedNeurons: transformResult.estimatedNeurons,
            filterId: loaded.filter.id,
            jobId: null,
            resultKey: null,
          })
        : null;

      return rawResponse(context.request, transformResult.imageBytes, {
        methods: "POST,OPTIONS",
        headers: {
          "content-type": transformResult.contentType,
          "content-length": String(transformResult.imageBytes.byteLength),
          "x-storage-mode": "direct",
          "x-proxy-mode": transformResult.billingMode,
          "x-filter-id": loaded.filter.id,
          ...(usageSnapshot && usageAfter
            ? {
                "x-usage-source": "demo",
                "x-usage-limit": String(usageSnapshot.limit),
                "x-usage-used": String(usageAfter.ipRecord.used),
                "x-usage-remaining": String(Math.max(0, usageSnapshot.limit - usageAfter.ipRecord.used)),
                "x-neurons-limit": String(usageSnapshot.config.maxFreeNeuronsPerDay),
                "x-neurons-used": String(usageAfter.siteRecord.neuronsUsed),
              }
            : {
                "x-usage-source": "cloudflare",
                "x-neurons-estimated": String(transformResult.estimatedNeurons),
              }),
        },
      });
    }

    const storedResult = await putImageObject(context, transformResult.imageBytes, {
      prefix: "result",
      contentType: transformResult.contentType,
      ttlSeconds: config.resultTtlSeconds,
      metadata: {
        source: "transform",
        filterId: loaded.filter.id,
        jobId,
      },
    });

    const usageAfter = usageSnapshot
      ? await recordSuccessfulTransform(context, usageSnapshot, {
          estimatedNeurons: transformResult.estimatedNeurons,
          filterId: loaded.filter.id,
          jobId,
          resultKey: storedResult.key,
        })
      : null;

    const completedAt = new Date().toISOString();
    await saveJobStatus(context, jobId, {
      id: jobId,
      status: "completed",
      filterId: loaded.filter.id,
      createdAt,
      updatedAt: completedAt,
      result: {
        key: storedResult.key,
        url: storedResult.url,
        contentType: storedResult.contentType,
        expiresAt: storedResult.expiresAt,
      },
      usage: usageSnapshot && usageAfter
        ? {
            source: "demo",
            used: usageAfter.ipRecord.used,
            limit: usageSnapshot.limit,
            neuronsUsed: usageAfter.siteRecord.neuronsUsed,
            neuronsLimit: usageSnapshot.config.maxFreeNeuronsPerDay,
          }
        : {
            source: "cloudflare",
            estimatedNeuronsForRun: transformResult.estimatedNeurons,
          },
    });

    return ok(
      context.request,
      {
        job: {
          id: jobId,
          status: "completed",
          pollUrl: new URL(`/api/status/${jobId}`, context.request.url).toString(),
        },
        filter: {
          id: loaded.filter.id,
          name: loaded.filter.name,
          type: loaded.filter.type,
          model: loaded.filter.model,
        },
        result: {
          key: storedResult.key,
          url: storedResult.url,
          contentType: storedResult.contentType,
          expiresAt: storedResult.expiresAt,
        },
        proxyMode: transformResult.billingMode,
        usage: usageSnapshot && usageAfter
          ? {
              source: "demo",
              used: usageAfter.ipRecord.used,
              limit: usageSnapshot.limit,
              remaining: Math.max(0, usageSnapshot.limit - usageAfter.ipRecord.used),
              neuronsUsed: usageAfter.siteRecord.neuronsUsed,
              neuronsLimit: usageSnapshot.config.maxFreeNeuronsPerDay,
              estimatedNeuronsForRun: transformResult.estimatedNeurons,
            }
          : {
              source: "cloudflare",
              estimatedNeuronsForRun: transformResult.estimatedNeurons,
            },
      },
      { methods: "POST,OPTIONS" },
    );
  } catch (error) {
    if (shouldPersistJob) {
      try {
        await saveJobStatus(context, jobId, {
          id: jobId,
          status: "failed",
          createdAt,
          updatedAt: new Date().toISOString(),
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: error?.code || "internal_error",
          },
        });
      } catch {
        // Intentionally ignored so the main failure can still surface.
      }
    }

    return fail(context.request, error, { methods: "POST,OPTIONS" });
  }
}
