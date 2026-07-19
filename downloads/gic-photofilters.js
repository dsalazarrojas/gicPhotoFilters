#!/usr/bin/env node
/**
 * GIC Photo Filters CLI — programmatic access to the public Photo Filters API
 *
 * Usage:
 *   node cli/gic-photofilters.js listFilters
 *   node cli/gic-photofilters.js transform photo.jpg --filter anime-portrait --out result.png
 *   node cli/gic-photofilters.js transformCustom photo.jpg --prompt "oil painting style" --out result.png
 *   node cli/gic-photofilters.js usage
 *
 * No GIC key needed — the free tier is anonymous (IP-based daily allowance).
 * Custom filters require YOUR OWN Cloudflare credentials (BYOK):
 *
 * Environment variables:
 *   GIC_PHOTOFILTERS_URL — optional site override (default: production)
 *   CF_ACCOUNT_ID        — BYOK: your Cloudflare account id
 *   CF_API_TOKEN         — BYOK: token with Workers AI access
 *
 * Falls back to ~/.config/gic/credentials.json:
 *   { "cloudflare": { "accountId": "...", "apiToken": "..." } }
 * (The same pair serves GIC OnePageApps BYO deploys.)
 */

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://photofilters.gic.mx';

const CREDS_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.config', 'gic', 'credentials.json'
);

function getSiteUrl() {
  return (process.env.GIC_PHOTOFILTERS_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function readCredsFile() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function getCloudflareCreds() {
  const creds = readCredsFile();
  return {
    accountId: process.env.CF_ACCOUNT_ID || (creds && creds.cloudflare && creds.cloudflare.accountId) || '',
    apiToken: process.env.CF_API_TOKEN || (creds && creds.cloudflare && creds.cloudflare.apiToken) || ''
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers (Node.js built-in only)
// ─────────────────────────────────────────────────────────────────────────────

function rawRequest(method, urlString, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        buffer: Buffer.concat(chunks)
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function buildMultipart(fields, fileField, filePath) {
  const boundary = `----gicphotofilters${Date.now().toString(16)}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value == null) continue;
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ));
  }
  const fileData = fs.readFileSync(filePath);
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${path.basename(filePath)}"\r\n` +
    `Content-Type: ${contentTypeFor(filePath)}\r\n\r\n`
  ));
  parts.push(fileData);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function parseJsonBuffer(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

async function listFilters() {
  const res = await rawRequest('GET', `${getSiteUrl()}/docs/filters-index.json`);
  const parsed = parseJsonBuffer(res.buffer);
  if (res.status >= 400 || !parsed) throw apiError(res, parsed);
  return parsed;
}

async function usage() {
  const res = await rawRequest('GET', `${getSiteUrl()}/api/usage`);
  const parsed = parseJsonBuffer(res.buffer);
  if (res.status >= 400 || !parsed) throw apiError(res, parsed);
  return parsed;
}

function apiError(res, parsed) {
  const code = parsed && parsed.error && parsed.error.code;
  const message = (parsed && parsed.error && parsed.error.message) || `HTTP ${res.status}`;
  const err = new Error(code ? `${code}: ${message}` : message);
  err.status = res.status;
  err.data = parsed;
  return err;
}

async function runTransform(fields, photoPath, { byok = false, out } = {}) {
  const headers = {};
  if (byok) {
    const { accountId, apiToken } = getCloudflareCreds();
    if (!accountId || !apiToken) {
      throw new Error(
        'Custom filters need your own Cloudflare credentials (BYOK).\n' +
        'Set CF_ACCOUNT_ID and CF_API_TOKEN, or add them to ~/.config/gic/credentials.json ' +
        'under {"cloudflare":{"accountId":"...","apiToken":"..."}}.\n' +
        'Guide: ' + getSiteUrl() + '/docs/cloudflare-setup.html'
      );
    }
    headers['X-CF-Account-ID'] = accountId;
    headers['X-CF-API-Token'] = apiToken;
  }
  const { body, contentType } = buildMultipart(fields, 'image', photoPath);
  headers['Content-Type'] = contentType;
  headers['Content-Length'] = body.length;

  const res = await rawRequest('POST', `${getSiteUrl()}/api/transform`, { headers, body });
  const resContentType = String(res.headers['content-type'] || '');
  if (resContentType.startsWith('image/')) {
    const outPath = out || `transformed-${Date.now()}.png`;
    fs.writeFileSync(outPath, res.buffer);
    return { ok: true, savedTo: outPath, bytes: res.buffer.length, storageMode: res.headers['x-storage-mode'] || 'direct' };
  }
  const parsed = parseJsonBuffer(res.buffer);
  if (res.status >= 400 || !parsed) throw apiError(res, parsed);
  return parsed;
}

async function transform(photoPath, { filter, out } = {}) {
  if (!filter) throw new Error('--filter <filterId> is required. Use listFilters to see ids.');
  return runTransform({ filterId: filter }, photoPath, { out });
}

async function transformCustom(photoPath, { prompt, model, strength, guidance, out } = {}) {
  if (!prompt) throw new Error('--prompt "<style description>" is required.');
  const customFilter = JSON.stringify({
    prompt,
    model: model || 'flux2-klein-9b',
    ...(strength != null ? { strength: Number(strength) } : {}),
    ...(guidance != null ? { guidance: Number(guidance) } : {})
  });
  return runTransform({ customFilter }, photoPath, { byok: true, out });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      flags[name] = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

const USAGE = `
GIC Photo Filters CLI

Usage: node cli/gic-photofilters.js <command> [args] [--flags]

Commands:
  listFilters                                   List the filter catalog (ids, categories, models)
  transform <photo> --filter <id> [--out f.png] Run a catalog filter (free tier, anonymous)
  transformCustom <photo> --prompt "..."        Run a custom prompt (requires your Cloudflare creds)
                 [--model flux2-klein-9b] [--strength 0.65] [--guidance 7.5] [--out f.png]
  usage                                         Show today's free-transform allowance

Environment:
  GIC_PHOTOFILTERS_URL         Optional site override
  CF_ACCOUNT_ID / CF_API_TOKEN Your Cloudflare creds for custom filters (BYOK)
`;

async function runCli() {
  const [, , command, ...rest] = process.argv;
  const { flags, positional } = parseFlags(rest);
  const print = (result) => process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  try {
    switch (command) {
      case 'listFilters': {
        const manifest = await listFilters();
        if (flags.full) { print(manifest); break; }
        const filters = (manifest.data && manifest.data.filters) || manifest.filters || [];
        print(filters.map((f) => ({ id: f.id, name: f.name, category: f.category, model: f.model })));
        break;
      }
      case 'transform': print(await transform(positional[0], { filter: flags.filter, out: flags.out })); break;
      case 'transformCustom': print(await transformCustom(positional[0], flags)); break;
      case 'usage': print(await usage()); break;
      default:
        process.stdout.write(USAGE);
        process.exitCode = command ? 1 : 0;
    }
  } catch (error) {
    const detail = error.data ? `\n${JSON.stringify(error.data, null, 2)}` : '';
    process.stderr.write(`Error${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message}${detail}\n`);
    process.exitCode = 1;
  }
}

export { listFilters, usage, transform, transformCustom };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runCli();
