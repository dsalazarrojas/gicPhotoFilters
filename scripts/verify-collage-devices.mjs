import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { devices, webkit, chromium } from "playwright";

const baseUrl = (process.env.PHOTO_FILTERS_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Set PHOTO_FILTERS_BASE_URL to the deployed Pages URL.");
  process.exit(2);
}

const catalog = JSON.parse(await fs.readFile(new URL("../docs/filters-index.json", import.meta.url), "utf8"));
const filter = catalog.filters.find((entry) => entry.requiresAI && entry.isDemoFilter && !entry.clientSideOnly) || catalog.filters.find((entry) => entry.requiresAI && !entry.clientSideOnly);
if (!filter) throw new Error("No real AI filter found in docs/filters-index.json");

const orientations = {
  portrait: { width: 900, height: 1600, color: [225, 78, 78] },
  landscape: { width: 1600, height: 900, color: [54, 132, 220] },
  square: { width: 1200, height: 1200, color: [48, 180, 128] },
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const kind = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([kind, data])), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, kind, data, checksum]);
}

function makePng(width, height, baseColor) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const gradient = (x + y) / (width + height);
      raw[offset] = Math.round(baseColor[0] * (0.65 + gradient * 0.35));
      raw[offset + 1] = Math.round(baseColor[1] * (0.65 + gradient * 0.35));
      raw[offset + 2] = Math.round(baseColor[2] * (0.65 + gradient * 0.35));
      raw[offset + 3] = 255;
    }
  }
  const header = Buffer.from("\x89PNG\r\n\x1a\n", "binary");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([header, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gic-shr202-"));
const screenshotDir = path.resolve("reports/collage-screenshots");
await fs.mkdir(screenshotDir, { recursive: true });
const sourceFiles = {};
for (const [orientation, spec] of Object.entries(orientations)) {
  const file = path.join(tempDir, `${orientation}.png`);
  await fs.writeFile(file, makePng(spec.width, spec.height, spec.color));
  sourceFiles[orientation] = file;
}

const runs = [
  { engine: "webkit", launcher: webkit, device: devices["iPhone 14"] },
  { engine: "chromium", launcher: chromium, device: devices["Pixel 7"] },
];
let failures = 0;

for (const run of runs) {
  const browser = await run.launcher.launch({ headless: true });
  try {
    for (const [orientation, sourceFile] of Object.entries(sourceFiles)) {
      const result = { engine: run.engine, orientation };
      const context = await browser.newContext({ ...run.device });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}/try.html?id=${encodeURIComponent(filter.id)}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.locator("#file-input").setInputFiles(sourceFile);
        await page.locator("#stage-note").getByText("Ready to transform").waitFor({ state: "visible", timeout: 15_000 });
        await page.locator("#transform-button").click();
        await page.locator('#share-result-button:not([disabled])').waitFor({ state: "visible", timeout: 60_000 });
        await page.locator("#stage-slot").waitFor({ state: "visible" });
        await page.waitForFunction(() => document.querySelector("#stage-slot")?.innerText.includes("Rendered from /api/transform"), null, { timeout: 60_000 });
        await page.locator("#share-result-button").click();
        await page.waitForFunction(() => document.querySelector("#share-overlay")?.open === true, null, { timeout: 15_000 });
        const preview = page.locator("#share-overlay-preview");
        await preview.locator("img").waitFor({ state: "visible", timeout: 15_000 });
        await page.waitForFunction(() => { const image = document.querySelector("#share-overlay-preview img"); return image?.complete && image.naturalWidth > 0; }, null, { timeout: 15_000 });
        const screenshotPath = path.join(screenshotDir, `${run.engine}-${orientation}.png`);
        await preview.screenshot({ path: screenshotPath });
        result.overlayOpened = true;
        result.screenshotPath = screenshotPath;
      } catch (error) {
        failures += 1;
        result.error = error instanceof Error ? error.message : String(error);
      } finally {
        await context.close();
      }
      console.log(JSON.stringify(result));
    }
  } finally {
    await browser.close();
  }
}

await fs.rm(tempDir, { recursive: true, force: true });
process.exitCode = failures ? 1 : 0;
