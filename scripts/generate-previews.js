#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const filtersIndexPath = path.join(repoRoot, "docs", "filters-index.json");
const defaultOutputDir = path.join(repoRoot, "docs", "assets", "filter-previews");
const defaultSampleDir = path.join(repoRoot, "docs", "assets", "sample-photos");
const defaultBaseImagePath = path.join(defaultSampleDir, "portrait_a.jpg");
const defaultStateFile = path.join(defaultOutputDir, ".preview-state.json");

const DEFAULT_API_URL = process.env.PREVIEW_API_URL || "https://photofilters.gic.mx/api/transform";
const DEFAULT_DELAY_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_BUDGET = 150;

class RateLimitStop extends Error {
  constructor(message) {
    super(message);
    this.name = "RateLimitStop";
  }
}

function printHelp() {
  console.log(`
Usage:
  node scripts/generate-previews.js [options]

Options:
  --batch <n>         Limit the run to the next N pending filters
  --budget <n>        Maximum remote API calls per run (default: ${DEFAULT_BUDGET})
  --delay-ms <ms>     Delay between remote API calls (default: ${DEFAULT_DELAY_MS})
  --timeout-ms <ms>   Timeout per remote API request (default: ${DEFAULT_TIMEOUT_MS})
  --api-url <url>     Transform endpoint (default: ${DEFAULT_API_URL})
  --base-image <path> Override the base portrait path
  --state-file <path> Override the resumable state file path
  --force             Rebuild previews even if both files already exist
  --dry-run           Resolve ordering and resume logic without calling the API
  --help              Show this help

Environment:
  CF_ACCOUNT_ID       Optional Cloudflare account header for BYOK preview generation
  CF_API_TOKEN        Optional Cloudflare token header for BYOK preview generation
  PREVIEW_API_URL     Optional default override for the transform API URL
`);
}

function parseArgs(argv) {
  const options = {
    apiUrl: DEFAULT_API_URL,
    batch: null,
    budget: DEFAULT_BUDGET,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    baseImagePath: defaultBaseImagePath,
    outputDir: defaultOutputDir,
    stateFile: defaultStateFile,
    force: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const readValue = () => {
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${arg}.`);
      }
      index += 1;
      return next;
    };

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--batch") {
      options.batch = parsePositiveInt(readValue(), "--batch");
    } else if (arg.startsWith("--batch=")) {
      options.batch = parsePositiveInt(arg.split("=")[1], "--batch");
    } else if (arg === "--budget") {
      options.budget = parsePositiveInt(readValue(), "--budget");
    } else if (arg.startsWith("--budget=")) {
      options.budget = parsePositiveInt(arg.split("=")[1], "--budget");
    } else if (arg === "--delay-ms") {
      options.delayMs = parseNonNegativeInt(readValue(), "--delay-ms");
    } else if (arg.startsWith("--delay-ms=")) {
      options.delayMs = parseNonNegativeInt(arg.split("=")[1], "--delay-ms");
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInt(readValue(), "--timeout-ms");
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = parsePositiveInt(arg.split("=")[1], "--timeout-ms");
    } else if (arg === "--api-url") {
      options.apiUrl = readValue();
    } else if (arg.startsWith("--api-url=")) {
      options.apiUrl = arg.split("=")[1];
    } else if (arg === "--base-image") {
      options.baseImagePath = path.resolve(readValue());
    } else if (arg.startsWith("--base-image=")) {
      options.baseImagePath = path.resolve(arg.split("=")[1]);
    } else if (arg === "--state-file") {
      options.stateFile = path.resolve(readValue());
    } else if (arg.startsWith("--state-file=")) {
      options.stateFile = path.resolve(arg.split("=")[1]);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parsePositiveInt(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInt(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a non-negative integer.`);
  }
  return parsed;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeForState(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name || "Error",
    message: error.message || String(error),
  };
}

async function loadState(stateFile) {
  if (!(await fileExists(stateFile))) {
    return {
      version: 1,
      lastRun: null,
      filters: {},
    };
  }

  try {
    return JSON.parse(await fs.readFile(stateFile, "utf8"));
  } catch {
    return {
      version: 1,
      lastRun: null,
      filters: {},
    };
  }
}

async function writeState(stateFile, state) {
  await ensureDirectory(path.dirname(stateFile));
  const tempPath = `${stateFile}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, stateFile);
}

function createFilterState(filter, patch) {
  return {
    id: filter.id,
    slug: filter.slug,
    name: filter.name,
    category: filter.category,
    type: filter.type,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

async function runCommand(command, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();
      if (code === 0) {
        resolve({ stdout: stdoutText, stderr: stderrText });
        return;
      }

      const message = stderrText || stdoutText || `${command} exited with ${code}`;
      reject(new Error(message));
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function ensureMagickAvailable() {
  await runCommand("magick", ["-version"]);
}

async function ensurePlaceholderPortrait(baseImagePath) {
  if (await fileExists(baseImagePath)) {
    return;
  }

  await ensureDirectory(path.dirname(baseImagePath));
  await runCommand("magick", [
    "-size",
    "1024x1024",
    "canvas:#d8dde5",
    "-fill",
    "#60738a",
    "-draw",
    "ellipse 512,860 330,190 0,360",
    "-fill",
    "#835638",
    "-draw",
    "rectangle 452,585 572,725",
    "-draw",
    "ellipse 512,445 190,240 0,360",
    "-fill",
    "#251f1b",
    "-draw",
    "ellipse 512,300 230,185 0,360",
    "-draw",
    "rectangle 286,300 738,420",
    "-fill",
    "#4b3527",
    "-draw",
    "ellipse 512,270 175,70 0,360",
    "-fill",
    "#1f1a17",
    "-draw",
    "ellipse 438,430 18,10 0,360",
    "-draw",
    "ellipse 586,430 18,10 0,360",
    "-fill",
    "#e8d3c4",
    "-draw",
    "ellipse 438,428 7,5 0,360",
    "-draw",
    "ellipse 586,428 7,5 0,360",
    "-fill",
    "#6d4830",
    "-draw",
    "line 512,452 512,520",
    "-draw",
    "arc 452,528 572,600 0,180",
    "-strip",
    "-quality",
    "92",
    baseImagePath,
  ]);
}

async function prepareBaseAssets(baseImagePath, tempDir) {
  const resizedBasePath = path.join(tempDir, "portrait_a_512.jpg");
  const beforePreviewPath = path.join(tempDir, "portrait_a_before.webp");
  const inpaintingMaskPath = path.join(tempDir, "portrait_a_mask.png");

  await runCommand("magick", [
    baseImagePath,
    "-auto-orient",
    "-thumbnail",
    "512x512^",
    "-gravity",
    "center",
    "-extent",
    "512x512",
    "-strip",
    "-quality",
    "92",
    resizedBasePath,
  ]);

  await runCommand("magick", [
    resizedBasePath,
    "-thumbnail",
    "400x400^",
    "-gravity",
    "center",
    "-extent",
    "400x400",
    "-strip",
    "-quality",
    "80",
    beforePreviewPath,
  ]);

  await runCommand("magick", [
    "-size",
    "512x512",
    "xc:white",
    "-fill",
    "black",
    "-draw",
    "ellipse 256,228 124,158 0,360",
    "-draw",
    "ellipse 256,404 178,126 0,360",
    "-blur",
    "0x14",
    inpaintingMaskPath,
  ]);

  return {
    resizedBasePath,
    beforePreviewPath,
    inpaintingMaskPath,
  };
}

function outputPathsFor(filter, outputDir) {
  return {
    beforePath: path.join(outputDir, `${filter.slug}_before.webp`),
    afterPath: path.join(outputDir, `${filter.slug}_after.webp`),
  };
}

async function hasCompletePreview(filter, outputDir) {
  const { beforePath, afterPath } = outputPathsFor(filter, outputDir);
  return (await fileExists(beforePath)) && (await fileExists(afterPath));
}

function orderFilters(filters, demoFilterIds = []) {
  const demoRank = new Map(demoFilterIds.map((id, index) => [id, index]));

  return [...filters].sort((left, right) => {
    const featuredDiff = Number(Boolean(right.featured)) - Number(Boolean(left.featured));
    if (featuredDiff !== 0) {
      return featuredDiff;
    }

    const demoLeft = demoRank.has(left.id) ? demoRank.get(left.id) : Number.POSITIVE_INFINITY;
    const demoRight = demoRank.has(right.id) ? demoRank.get(right.id) : Number.POSITIVE_INFINITY;
    if (demoLeft !== demoRight) {
      return demoLeft - demoRight;
    }

    return left.slug.localeCompare(right.slug, "en", { sensitivity: "base" });
  });
}

function isLocalPreviewFilter(filter) {
  return Boolean(filter.clientSideOnly) || filter.requiresAI === false || filter.model === "client-side";
}

async function copyBeforePreview(preparedBase, beforePath, force = false) {
  if (!force && (await fileExists(beforePath))) {
    return;
  }
  await fs.copyFile(preparedBase.beforePreviewPath, beforePath);
}

function effectArgsFor(filter, inputPath, outputPath) {
  const standardTail = [
    "-thumbnail",
    "400x400^",
    "-gravity",
    "center",
    "-extent",
    "400x400",
    "-strip",
    "-quality",
    "80",
    outputPath,
  ];

  switch (filter.slug) {
    case "sepia-tone":
      return [inputPath, "-auto-orient", "-sepia-tone", "85%", ...standardTail];
    case "black-and-white":
      return [inputPath, "-auto-orient", "-colorspace", "Gray", ...standardTail];
    case "vignette":
      return [inputPath, "-auto-orient", "-background", "black", "-vignette", "0x28", ...standardTail];
    case "duotone":
      return [inputPath, "-auto-orient", "-colorspace", "Gray", "+level-colors", "#2e2354,#f4a7bc", ...standardTail];
    case "glitch-art":
      return [inputPath, "-auto-orient", "-wave", "2x18", "-attenuate", "0.09", "+noise", "Gaussian", ...standardTail];
    case "mirror-kaleidoscope":
      return [inputPath, "-auto-orient", "(", "+clone", "-flop", ")", "+append", ...standardTail];
    case "tilt-shift":
      return [
        inputPath,
        "-auto-orient",
        "-region",
        "512x150+0+0",
        "-blur",
        "0x10",
        "+region",
        "-region",
        "512x150+0+362",
        "-blur",
        "0x10",
        "+region",
        ...standardTail,
      ];
    case "lomo-lomography":
      return [
        inputPath,
        "-auto-orient",
        "-modulate",
        "110,130,100",
        "-sigmoidal-contrast",
        "5,50%",
        "-background",
        "black",
        "-vignette",
        "0x34",
        ...standardTail,
      ];
    case "thermal-infrared":
      return [
        inputPath,
        "-auto-orient",
        "-colorspace",
        "Gray",
        "(",
        "-size",
        "1x256",
        "gradient:#1c1cff-#ff7a00",
        "-rotate",
        "90",
        ")",
        "-clut",
        ...standardTail,
      ];
    case "neon-glow":
      return [
        inputPath,
        "-auto-orient",
        "(",
        "+clone",
        "-edge",
        "1",
        "-blur",
        "0x2",
        "-negate",
        "-fill",
        "#23f4ff",
        "-colorize",
        "100",
        ")",
        "-compose",
        "screen",
        "-composite",
        "-modulate",
        "112,150,100",
        ...standardTail,
      ];
    case "red-eye-fix":
    case "auto-color-correct":
      return [inputPath, "-auto-orient", "-auto-level", "-contrast-stretch", "1%x1%", "-modulate", "104,106,100", ...standardTail];
    case "hdr-effect":
      return [inputPath, "-auto-orient", "-sigmoidal-contrast", "7,50%", "-modulate", "106,120,100", ...standardTail];
    case "passport-photo":
    case "id-photo":
    case "social-media-resize":
      return [
        inputPath,
        "-auto-orient",
        "-resize",
        "340x340",
        "-background",
        "white",
        "-gravity",
        "center",
        "-extent",
        "400x400",
        "-strip",
        "-quality",
        "80",
        outputPath,
      ];
    case "vhs-glitch":
      return [
        inputPath,
        "-auto-orient",
        "-wave",
        "1x10",
        "-motion-blur",
        "0x4+90",
        "-attenuate",
        "0.06",
        "+noise",
        "Gaussian",
        ...standardTail,
      ];
    case "polaroid-vintage":
      return [
        inputPath,
        "-auto-orient",
        "-sepia-tone",
        "55%",
        "-bordercolor",
        "#fffaf0",
        "-border",
        "24x24",
        ...standardTail,
      ];
    case "1970s-film-grain":
      return [
        inputPath,
        "-auto-orient",
        "-modulate",
        "105,82,100",
        "-fill",
        "#d8a46d",
        "-colorize",
        "10",
        "-attenuate",
        "0.18",
        "+noise",
        "Multiplicative",
        ...standardTail,
      ];
    case "remove-background":
      return [
        inputPath,
        "-auto-orient",
        "-alpha",
        "set",
        "-fuzz",
        "14%",
        "-transparent",
        "#d8dde5",
        "-gravity",
        "center",
        "-background",
        "none",
        "-extent",
        "512x512",
        ...standardTail,
      ];
    default:
      return [inputPath, "-auto-orient", "-modulate", "106,112,100", ...standardTail];
  }
}

async function generateLocalPreview(filter, preparedBase, outputPath) {
  await runCommand("magick", effectArgsFor(filter, preparedBase.resizedBasePath, outputPath));
}

function buildTransformHeaders() {
  const headers = {};
  if (process.env.CF_ACCOUNT_ID) {
    headers["X-CF-Account-ID"] = process.env.CF_ACCOUNT_ID;
  }
  if (process.env.CF_API_TOKEN) {
    headers["X-CF-API-Token"] = process.env.CF_API_TOKEN;
  }
  return headers;
}

function mimeToExtension(mimeType) {
  switch ((mimeType || "").toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".img";
  }
}

function decodeBase64Image(maybeBase64) {
  if (typeof maybeBase64 !== "string" || maybeBase64.length === 0) {
    return null;
  }

  const normalized = maybeBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  try {
    return Buffer.from(normalized, "base64");
  } catch {
    return null;
  }
}

async function readApiErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      return payload?.error?.message || payload?.message || payload?.error || JSON.stringify(payload);
    }
    return (await response.text()).trim();
  } catch {
    return `${response.status} ${response.statusText}`.trim();
  }
}

async function extractImageBuffer(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType,
    };
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(text.trim() || "Transform response did not include image bytes.");
  }

  const payload = await response.json();
  const directBase64 =
    decodeBase64Image(payload?.imageBase64) ||
    decodeBase64Image(payload?.image) ||
    decodeBase64Image(payload?.result?.image) ||
    decodeBase64Image(payload?.result?.imageBase64) ||
    decodeBase64Image(payload?.images?.[0]) ||
    decodeBase64Image(payload?.result?.images?.[0]);

  if (directBase64) {
    return {
      buffer: directBase64,
      contentType: payload?.contentType || payload?.result?.contentType || "image/png",
    };
  }

  const resultUrl = payload?.result?.url || payload?.url;
  if (typeof resultUrl === "string" && resultUrl.length > 0) {
    const fetched = await fetch(resultUrl);
    if (!fetched.ok) {
      throw new Error(`Result fetch failed: ${fetched.status} ${fetched.statusText}`);
    }
    return {
      buffer: Buffer.from(await fetched.arrayBuffer()),
      contentType: fetched.headers.get("content-type") || "image/png",
    };
  }

  throw new Error("Transform response JSON did not include image data.");
}

async function requestRemotePreview(filter, preparedBase, options) {
  const baseBuffer = await fs.readFile(preparedBase.resizedBasePath);
  const form = new FormData();
  form.append("filterId", filter.id);
  form.append("prompt", filter.prompt || "");
  form.append("negativePrompt", filter.negativePrompt || "");
  form.append("model", filter.model || "");
  form.append("type", filter.type || "");
  form.append("strength", String(filter.strength ?? ""));
  form.append("guidance", String(filter.guidance ?? ""));
  form.append("image", new Blob([baseBuffer], { type: "image/jpeg" }), path.basename(preparedBase.resizedBasePath));

  if (filter.type === "inpainting") {
    const maskBuffer = await fs.readFile(preparedBase.inpaintingMaskPath);
    form.append("mask", new Blob([maskBuffer], { type: "image/png" }), path.basename(preparedBase.inpaintingMaskPath));
  }

  const headers = buildTransformHeaders();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), options.timeoutMs);

  try {
    const response = await fetch(options.apiUrl, {
      method: "POST",
      headers,
      body: form,
      signal: abortController.signal,
    });

    if (response.status === 429) {
      const message = await readApiErrorMessage(response);
      throw new RateLimitStop(message || "Preview generation hit the remote rate limit.");
    }

    if (!response.ok) {
      const message = await readApiErrorMessage(response);
      throw new Error(message || `${response.status} ${response.statusText}`.trim());
    }

    return extractImageBuffer(response);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Timed out after ${options.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function writeProcessedAfterPreview(imageBuffer, contentType, afterPath) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gic-preview-after-"));
  const inputPath = path.join(tempDir, `source${mimeToExtension(contentType)}`);

  try {
    await fs.writeFile(inputPath, imageBuffer);
    await runCommand("magick", [
      inputPath,
      "-auto-orient",
      "-thumbnail",
      "400x400^",
      "-gravity",
      "center",
      "-extent",
      "400x400",
      "-strip",
      "-quality",
      "80",
      afterPath,
    ]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await ensureDirectory(options.outputDir);
  await ensureDirectory(path.dirname(options.baseImagePath));
  await ensureDirectory(path.dirname(options.stateFile));
  await ensureMagickAvailable();
  await ensurePlaceholderPortrait(options.baseImagePath);

  const state = await loadState(options.stateFile);
  const manifest = JSON.parse(await fs.readFile(filtersIndexPath, "utf8"));
  const orderedFilters = orderFilters(manifest.filters || [], manifest.demoFilterIds || []);
  const pendingFilters = [];

  for (const filter of orderedFilters) {
    const isDone = !options.force && (await hasCompletePreview(filter, options.outputDir));
    if (!isDone) {
      pendingFilters.push(filter);
    }
  }

  const selectedFilters = options.batch ? pendingFilters.slice(0, options.batch) : pendingFilters;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gic-preview-base-"));
  const preparedBase = await prepareBaseAssets(options.baseImagePath, tempDir);

  const summary = {
    totalFilters: orderedFilters.length,
    pendingAtStart: pendingFilters.length,
    selected: selectedFilters.length,
    skippedExisting: orderedFilters.length - pendingFilters.length,
    generated: 0,
    generatedLocal: 0,
    generatedRemote: 0,
    failed: 0,
    dryRun: 0,
    apiCalls: 0,
    stopped: "completed",
  };

  state.lastRun = {
    startedAt: new Date().toISOString(),
    options: {
      apiUrl: options.apiUrl,
      batch: options.batch,
      budget: options.budget,
      delayMs: options.delayMs,
      timeoutMs: options.timeoutMs,
      force: options.force,
      dryRun: options.dryRun,
    },
    summary: null,
  };
  await writeState(options.stateFile, state);

  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_API_TOKEN) {
    console.warn("Warning: CF_ACCOUNT_ID / CF_API_TOKEN not set. Remote filters will rely on whatever the target API allows without BYOK headers.");
  }

  try {
    for (let index = 0; index < selectedFilters.length; index += 1) {
      const filter = selectedFilters[index];
      const progress = `[${index + 1}/${selectedFilters.length}] ${filter.slug}`;
      const { beforePath, afterPath } = outputPathsFor(filter, options.outputDir);

      if (options.dryRun) {
        summary.dryRun += 1;
        state.filters[filter.id] = createFilterState(filter, {
          status: "dry_run",
          beforePath,
          afterPath,
          note: isLocalPreviewFilter(filter) ? "local" : "remote",
        });
        await writeState(options.stateFile, state);
        console.log(`${progress} · dry-run (${isLocalPreviewFilter(filter) ? "local" : "remote"})`);
        continue;
      }

      await copyBeforePreview(preparedBase, beforePath, options.force);

      try {
        if (isLocalPreviewFilter(filter)) {
          await generateLocalPreview(filter, preparedBase, afterPath);
          summary.generated += 1;
          summary.generatedLocal += 1;
          state.filters[filter.id] = createFilterState(filter, {
            status: "generated",
            mode: "local",
            beforePath,
            afterPath,
            lastSuccessAt: new Date().toISOString(),
          });
          await writeState(options.stateFile, state);
          console.log(`${progress} ✓ local`);
          continue;
        }

        if (summary.apiCalls >= options.budget) {
          summary.stopped = "budget";
          console.log(`${progress} · budget reached (${options.budget} API calls), stopping`);
          break;
        }

        if (summary.apiCalls > 0 && options.delayMs > 0) {
          await sleep(options.delayMs);
        }

        summary.apiCalls += 1;
        const remoteResult = await requestRemotePreview(filter, preparedBase, options);
        await writeProcessedAfterPreview(remoteResult.buffer, remoteResult.contentType, afterPath);

        summary.generated += 1;
        summary.generatedRemote += 1;
        state.filters[filter.id] = createFilterState(filter, {
          status: "generated",
          mode: "remote",
          beforePath,
          afterPath,
          lastSuccessAt: new Date().toISOString(),
          contentType: remoteResult.contentType,
        });
        await writeState(options.stateFile, state);
        console.log(`${progress} ✓ remote`);
      } catch (error) {
        if (error instanceof RateLimitStop) {
          summary.stopped = "rate_limited";
          state.filters[filter.id] = createFilterState(filter, {
            status: "rate_limited",
            beforePath,
            afterPath,
            lastError: sanitizeForState(error),
          });
          await writeState(options.stateFile, state);
          console.log(`${progress} … 429 received, stopping`);
          break;
        }

        summary.failed += 1;
        state.filters[filter.id] = createFilterState(filter, {
          status: "failed",
          beforePath,
          afterPath,
          lastError: sanitizeForState(error),
        });
        await writeState(options.stateFile, state);
        console.log(`${progress} … ${error.message}, skipping`);
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  state.lastRun.finishedAt = new Date().toISOString();
  state.lastRun.summary = summary;
  await writeState(options.stateFile, state);

  console.log("");
  console.log(
    `Summary: ${summary.generated} generated (${summary.generatedRemote} remote, ${summary.generatedLocal} local), ` +
      `${summary.failed} failed, ${summary.skippedExisting} already present, ` +
      `${summary.apiCalls}/${options.budget} API calls, stopped=${summary.stopped}.`,
  );
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
