import { executeTransform, getEstimatedNeurons, resolveModelDefinition } from "../_lib/ai.js";
import { getConfig } from "../_lib/config.js";
import { fail, ok, preflight, rawResponse } from "../_lib/http.js";
import { ApiError } from "../_lib/errors.js";
import { getFilterById } from "../_lib/manifest.js";
import { readTransformRequest } from "../_lib/request.js";
import { getStoredImage, putImageObject } from "../_lib/storage.js";
import { assertWithinUsageLimits, getUsageSnapshot, recordSuccessfulTransform, saveJobStatus } from "../_lib/usage.js";

export function onRequestOptions(context) {
  return preflight(context.request, "POST,OPTIONS");
}

export async function onRequestPost(context) {
  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let shouldPersistJob = false;

  try {
    const config = getConfig(context.env);
    const requestData = await readTransformRequest(context.request, config);
    const loaded = await getFilterById(context, requestData.filterId);
    if (config.demoMode && !loaded.filter.isDemoFilter && !loaded.filter.clientSideOnly && !requestData.apiKey) {
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
    const usageSnapshot = await getUsageSnapshot(context, { filter: loaded.filter });
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

    assertWithinUsageLimits(usageSnapshot, estimatedNeurons);

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
      const usageAfter = await recordSuccessfulTransform(context, usageSnapshot, {
        estimatedNeurons: transformResult.estimatedNeurons,
        filterId: loaded.filter.id,
        jobId: null,
        resultKey: null,
      });

      return rawResponse(context.request, transformResult.imageBytes, {
        methods: "POST,OPTIONS",
        headers: {
          "content-type": transformResult.contentType,
          "content-length": String(transformResult.imageBytes.byteLength),
          "x-storage-mode": "direct",
          "x-filter-id": loaded.filter.id,
          "x-usage-limit": String(usageSnapshot.limit),
          "x-usage-used": String(usageAfter.ipRecord.used),
          "x-usage-remaining": String(Math.max(0, usageSnapshot.limit - usageAfter.ipRecord.used)),
          "x-neurons-limit": String(usageSnapshot.config.maxFreeNeuronsPerDay),
          "x-neurons-used": String(usageAfter.siteRecord.neuronsUsed),
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

    const usageAfter = await recordSuccessfulTransform(context, usageSnapshot, {
      estimatedNeurons: transformResult.estimatedNeurons,
      filterId: loaded.filter.id,
      jobId,
      resultKey: storedResult.key,
    });

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
      usage: {
        used: usageAfter.ipRecord.used,
        limit: usageSnapshot.limit,
        neuronsUsed: usageAfter.siteRecord.neuronsUsed,
        neuronsLimit: usageSnapshot.config.maxFreeNeuronsPerDay,
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
        usage: {
          used: usageAfter.ipRecord.used,
          limit: usageSnapshot.limit,
          remaining: Math.max(0, usageSnapshot.limit - usageAfter.ipRecord.used),
          neuronsUsed: usageAfter.siteRecord.neuronsUsed,
          neuronsLimit: usageSnapshot.config.maxFreeNeuronsPerDay,
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
