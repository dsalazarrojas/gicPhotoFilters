#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultLogo = path.join(repoRoot, "assets", "brand", "gic-collect-logo.png");
const MAGICK_TIMEOUT_MS = 30_000;

function printHelp() {
  console.log(`
Usage:
  node scripts/composite-ad.js --background <path> --headline "<text>" --out <path> [options]

Options:
  --background <path> Required AI-generated background image
  --headline <text>   Required headline text
  --subtext <text>    Optional supporting text
  --cta <text>        Optional CTA text
  --logo <path>       Logo path (default: assets/brand/gic-collect-logo.png)
  --width <n>         Canvas width (default: 728)
  --height <n>        Canvas height (default: 90)
  --out <path>        Required final PNG output path
  --help              Show this help

Environment:
  PATH               Must include the ImageMagick magick binary
`);
}

function parsePositiveInt(value, flag) { const n = Number.parseInt(value, 10); if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer.`); return n; }
function parseArgs(argv) {
  const options = { width: 728, height: 90, logo: defaultLogo };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]; const next = argv[index + 1];
    const value = () => { if (!next || next.startsWith("--")) throw new Error(`Missing value for ${arg}.`); index += 1; return next; };
    if (arg === "--help") { printHelp(); process.exit(0); }
    else if (["--background", "--headline", "--subtext", "--cta"].includes(arg)) options[arg.slice(2)] = value();
    else if (["--background", "--headline", "--subtext", "--cta"].some((flag) => arg.startsWith(`${flag}=`))) { const [key, ...parts] = arg.slice(2).split("="); options[key] = parts.join("="); }
    else if (arg === "--logo") options.logo = path.resolve(value());
    else if (arg.startsWith("--logo=")) options.logo = path.resolve(arg.split("=").slice(1).join("="));
    else if (arg === "--out") options.out = path.resolve(value());
    else if (arg.startsWith("--out=")) options.out = path.resolve(arg.split("=").slice(1).join("="));
    else if (arg === "--width") options.width = parsePositiveInt(value(), "--width");
    else if (arg.startsWith("--width=")) options.width = parsePositiveInt(arg.split("=")[1], "--width");
    else if (arg === "--height") options.height = parsePositiveInt(value(), "--height");
    else if (arg.startsWith("--height=")) options.height = parsePositiveInt(arg.split("=")[1], "--height");
    else throw new Error(`Unknown option: ${arg}`);
  }
  for (const key of ["background", "headline", "out"]) if (!options[key]) throw new Error(`--${key} ${key === "headline" ? "<text>" : "<path>"} is required.`);
  return options;
}

export async function runCommand(command, args, { input, timeoutMs = MAGICK_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = []; const stderr = [];
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`${command} timed out after ${timeoutMs}ms`)); }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => { clearTimeout(timeout); const stdoutText = Buffer.concat(stdout).toString("utf8").trim(); const stderrText = Buffer.concat(stderr).toString("utf8").trim(); if (code === 0) { resolve({ stdout: stdoutText, stderr: stderrText }); return; } reject(new Error(stderrText || stdoutText || `${command} exited with ${code}`)); });
    if (input) child.stdin.write(input); child.stdin.end();
  });
}

async function ensureMagickAvailable() {
  try { await runCommand("magick", ["-version"]); }
  catch (error) { if (error.code === "ENOENT") throw new Error("ImageMagick not found on PATH. Install ImageMagick so the magick binary is available."); throw error; }
}

function fontResolutionError(error) { return /font|typeface|unable to read.*font/i.test(error.message); }

export async function compositeAd({ background, headline, subtext = "", cta = "", logo = defaultLogo, width = 728, height = 90, out }) {
  if (!background || !headline || !out) throw new Error("--background, --headline, and --out are required.");
  await ensureMagickAvailable();
  await fs.access(background); await fs.access(logo); await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  const small = Math.min(width, height); const margin = Math.max(4, Math.round(small * 0.04));
  const portrait = height >= 200; const logoHeight = Math.max(16, Math.round(height * (portrait ? 0.20 : 0.50)));
  const textAreaWidth = Math.max(20, (portrait ? width : Math.round(width * 0.72)) - 2 * margin);

  // Each text element gets a bounded box (width x height) rendered via ImageMagick's
  // caption: pseudo-format, which word-wraps AND auto-shrinks the font to fit that box
  // when -pointsize is left unset — this guarantees no clipping regardless of copy
  // length or aspect ratio, unlike a fixed -pointsize -annotate (which caused headline
  // text to be cut off in the 300x600 portrait format with longer Spanish copy).
  const headlineBoxH = Math.round(height * (portrait ? 0.30 : 0.55));
  const subtextBoxH = subtext ? Math.round(height * (portrait ? 0.16 : 0.24)) : 0;
  const ctaBoxH = cta ? Math.round(height * (portrait ? 0.11 : 0.20)) : 0;
  const gap = Math.max(2, Math.round(small * 0.02));

  const textX = margin;
  const headlineY = margin;
  const subtextY = headlineY + headlineBoxH + (subtext ? gap : 0);
  const ctaY = subtextY + subtextBoxH + (cta ? gap : 0);
  const boxBottom = Math.min(height - margin, ctaY + ctaBoxH + margin);
  const draw = `rectangle 0,0 ${Math.min(width, portrait ? width : Math.round(width * 0.72))},${boxBottom}`;

  function captionGroup(text, boxH, y, fill) {
    return ["(", "-size", `${textAreaWidth}x${boxH}`, "-background", "none", "-fill", fill, "-font", "Arial-Bold", "-gravity", "northwest", `caption:${text}`, ")", "-gravity", "northwest", "-geometry", `+${textX}+${y}`, "-composite"];
  }

  const args = [background, "-resize", `${width}x${height}^`, "-gravity", "center", "-extent", `${width}x${height}`, "-fill", "rgba(15,31,61,0.55)", "-draw", draw];
  args.push(...captionGroup(headline, headlineBoxH, headlineY, "white"));
  if (subtext) args.push(...captionGroup(subtext, subtextBoxH, subtextY, "#f3f6ff"));
  if (cta) args.push(...captionGroup(cta, ctaBoxH, ctaY, "#ff6b4a"));
  args.push("(", logo, "-resize", `x${logoHeight}`, ")", "-gravity", "southeast", "-geometry", `+${margin}+${margin}`, "-composite", "PNG24:" + path.resolve(out));
  try { await runCommand("magick", args); }
  catch (error) {
    // Some ImageMagick installations lack Arial; retry with its default font only for font lookup failures.
    if (!fontResolutionError(error)) throw error;
    const retryArgs = args.filter((value, index) => !(value === "-font" || (index > 0 && args[index - 1] === "-font")));
    await runCommand("magick", retryArgs);
  }
  return { out, width, height };
}

async function main() { const result = await compositeAd(parseArgs(process.argv.slice(2))); console.log(`Composited ad: ${result.out} (${result.width}x${result.height})`); }
const invokedDirectly = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
