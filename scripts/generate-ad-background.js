#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CREDS_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.config', 'gic', 'credentials.json'
);

function readCredsFile() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function getAdAdminToken() {
  const creds = readCredsFile();
  return process.env.AD_ADMIN_TOKEN || (creds && creds.adAdminToken) || "";
}

function printHelp() {
  console.log(`
Usage:
  node scripts/generate-ad-background.js --prompt "<text>" --out <path> [options]

Options:
  --prompt <text>    Required image-generation prompt
  --width <n>        Intended canvas width (default: 728)
  --height <n>       Intended canvas height (default: 90)
  --out <path>       Required raw background image output path
  --api-url <url>    Background API URL (default: https://photofilters.gic.mx/api/generate-background)
  --help             Show this help

Environment:
  GIC_AD_API_URL     Background API URL (overridden by --api-url)
  AD_ADMIN_TOKEN     Admin token for the deployed background API

Credentials file:
  ~/.config/gic/credentials.json may contain { "adAdminToken": "..." }
`);
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseArgs(argv) {
  const options = { width: 728, height: 90, apiUrl: process.env.GIC_AD_API_URL || "https://photofilters.gic.mx/api/generate-background" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const value = () => {
      if (!next || next.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      index += 1;
      return next;
    };
    if (arg === "--help") { printHelp(); process.exit(0); }
    else if (arg === "--prompt") options.prompt = value();
    else if (arg.startsWith("--prompt=")) options.prompt = arg.split("=").slice(1).join("=");
    else if (arg === "--out") options.out = path.resolve(value());
    else if (arg.startsWith("--out=")) options.out = path.resolve(arg.split("=").slice(1).join("="));
    else if (arg === "--api-url") options.apiUrl = value();
    else if (arg.startsWith("--api-url=")) options.apiUrl = arg.split("=").slice(1).join("=");
    else if (arg === "--width") options.width = parsePositiveInt(value(), "--width");
    else if (arg.startsWith("--width=")) options.width = parsePositiveInt(arg.split("=")[1], "--width");
    else if (arg === "--height") options.height = parsePositiveInt(value(), "--height");
    else if (arg.startsWith("--height=")) options.height = parsePositiveInt(arg.split("=")[1], "--height");
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.prompt) throw new Error("--prompt <text> is required.");
  if (!options.out) throw new Error("--out <path> is required.");
  return options;
}

export async function generateAdBackground({ prompt, width = 728, height = 90, out, apiUrl = process.env.GIC_AD_API_URL || "https://photofilters.gic.mx/api/generate-background" }) {
  if (!prompt) throw new Error("--prompt <text> is required.");
  if (!out) throw new Error("--out <path> is required.");
  const adminToken = getAdAdminToken();
  if (!adminToken) {
    throw new Error('GIC ad generation needs the deployed ad admin token.\n' +
      'Set AD_ADMIN_TOKEN, or add it to ~/.config/gic/credentials.json under {"adAdminToken":"..."}.');
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gic-ad-admin-token": adminToken,
    },
    body: JSON.stringify({ prompt, width, height }),
  });
  if (!response.ok) {
    const responseText = await response.text();
    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = null; }
    const detail = parsed?.error?.message || parsed?.error?.code || responseText || `HTTP ${response.status}`;
    throw new Error(`Background API returned HTTP ${response.status}: ${detail}`);
  }
  const image = Buffer.from(await response.arrayBuffer());
  if (!image.length) throw new Error("Background API returned an empty image.");
  await fs.promises.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.promises.writeFile(out, image);
  return { out, bytes: image.length };
}

async function main() {
  const result = await generateAdBackground(parseArgs(process.argv.slice(2)));
  console.log(`Generated background: ${result.out} (${result.bytes} bytes)`);
}

const invokedDirectly = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
