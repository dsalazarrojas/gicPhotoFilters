#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateAdBackground } from "./generate-ad-background.js";
import { compositeAd } from "./composite-ad.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const generatedAdsDir = path.join(repoRoot, "generated-ads");

function printHelp() {
  console.log(`
Usage:
  node scripts/generate-ad.js --template ad-templates/<file>.json --out <path> [options]

Options:
  --template <path>   Required ad template JSON file
  --width <n>         Canvas width (default: 728)
  --height <n>        Canvas height (default: 90)
  --out <path>        Final PNG output path (default: generated-ads/ad-<timestamp>.png)
  --help              Show this help

Environment:
  AD_ADMIN_TOKEN      Shared secret for the deployed /api/generate-background endpoint
                      (falls back to "adAdminToken" in ~/.config/gic/credentials.json)
  GIC_AD_API_URL      Optional override for the generate-background endpoint URL
  PATH                Must include the ImageMagick magick binary
`);
}

function parsePositiveInt(value, flag) { const n = Number.parseInt(value, 10); if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer.`); return n; }
function parseArgs(argv) {
  const options = { width: 728, height: 90, out: path.join(generatedAdsDir, `ad-${Date.now()}.png`) };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]; const next = argv[index + 1];
    const value = () => { if (!next || next.startsWith("--")) throw new Error(`Missing value for ${arg}.`); index += 1; return next; };
    if (arg === "--help") { printHelp(); process.exit(0); }
    else if (arg === "--template") options.template = path.resolve(value());
    else if (arg.startsWith("--template=")) options.template = path.resolve(arg.split("=").slice(1).join("="));
    else if (arg === "--out") options.out = path.resolve(value());
    else if (arg.startsWith("--out=")) options.out = path.resolve(arg.split("=").slice(1).join("="));
    else if (arg === "--width") options.width = parsePositiveInt(value(), "--width");
    else if (arg.startsWith("--width=")) options.width = parsePositiveInt(arg.split("=")[1], "--width");
    else if (arg === "--height") options.height = parsePositiveInt(value(), "--height");
    else if (arg.startsWith("--height=")) options.height = parsePositiveInt(arg.split("=")[1], "--height");
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.template) throw new Error("--template <path> is required.");
  return options;
}

export async function appendManifest(entry) {
  await fs.mkdir(generatedAdsDir, { recursive: true });
  await fs.appendFile(path.join(generatedAdsDir, "manifest.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}

export async function generateAd({ template, width = 728, height = 90, out }) {
  const templatePath = path.resolve(template);
  let ad;
  try { ad = JSON.parse(await fs.readFile(templatePath, "utf8")); }
  catch (error) { throw new Error(`Could not read template ${templatePath}: ${error.message}`); }
  for (const field of ["headline", "imagePrompt"]) if (!ad[field]) throw new Error(`Template ${templatePath} is missing ${field}.`);
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gic-ad-"));
  const background = path.join(tempDir, "background.png");
  try {
    await generateAdBackground({ prompt: ad.imagePrompt, width, height, out: background });
    await compositeAd({ background, headline: ad.headline, subtext: ad.subtext, cta: ad.cta, width, height, out });
    await appendManifest({ template, size: `${width}x${height}`, outputFile: out, prompt: ad.imagePrompt, timestamp: new Date().toISOString() });
  } finally { await fs.rm(tempDir, { recursive: true, force: true }); }
  return { out, width, height };
}

async function main() { const result = await generateAd(parseArgs(process.argv.slice(2))); console.log(`Generated ad: ${result.out} (${result.width}x${result.height})`); }
const invokedDirectly = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
